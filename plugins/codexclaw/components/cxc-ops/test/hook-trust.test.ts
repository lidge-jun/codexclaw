import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { supportsSymlinks } from "../test-support/symlink-support.ts";
import {
  diagnoseHookTrust,
  identityHash,
  listHookEntries,
  readInstalledPluginKeys,
  retrustHooks,
  type HookEntry,
  type HookHandler,
} from "../src/hook-trust.ts";
import { runHookTrustCheck } from "../src/doctor.ts";
import { main } from "../src/cli.ts";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PLUGIN_KEY = "fixture@market";
type HookTrustRunner = NonNullable<Parameters<typeof retrustHooks>[4]>;
const FEATURES_OK: HookTrustRunner = () => ({ status: 0, stdout: "", stderr: "", error: null });

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function command(command: string, extra: Partial<HookHandler> = {}): HookHandler {
  return { type: "command", command, ...extra };
}

function makePlugin(hookDocument: unknown, hookRef = "./hooks/sample.json"): string {
  const root = tempDir("cxc-hook-plugin-");
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  mkdirSync(join(root, "hooks"), { recursive: true });
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ name: "fixture", hooks: [hookRef] }));
  writeFileSync(join(root, hookRef), JSON.stringify(hookDocument));
  return root;
}

function makeCodexHome(content: string): string {
  const home = tempDir("cxc-hook-home-");
  writeFileSync(join(home, "config.toml"), content);
  return home;
}

function trustSection(entry: HookEntry, hash = entry.hash): string {
  return `[hooks.state."${entry.key}"]\ntrusted_hash = "${hash}"\n`;
}

test("identityHash matches the live Stop hook golden fixture", () => {
  const fixturePath = join(PLUGIN_ROOT, "hooks", "stop-checking-pabcd-continuation.json");
  const document = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    hooks: { Stop: Array<{ matcher?: string; hooks: HookHandler[] }> };
  };
  const group = document.hooks.Stop[0];
  assert.equal(
    identityHash("Stop", group.matcher, group.hooks[0]),
    "sha256:5be9da5eadafb4043c6576a5fa2805a8cb7cc259ad811a67251fde7b77f04f4a",
  );
});

test("identityHash keeps the matcher in the live SubagentStop hook golden fixture", () => {
  const fixturePath = join(PLUGIN_ROOT, "hooks", "subagent-stop-verifying-evidence.json");
  const document = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    hooks: { SubagentStop: Array<{ matcher?: string; hooks: HookHandler[] }> };
  };
  const group = document.hooks.SubagentStop.find((candidate) => candidate.matcher === "^worker$");
  assert.ok(group, "the real SubagentStop hook must keep its ^worker$ matcher group");
  assert.equal(
    identityHash("SubagentStop", group.matcher, group.hooks[0]),
    "sha256:9afd7aeccc4c240163001eec376823a6566ce30572fafcc300ceb1d6bb4c6290",
  );
});

test("identityHash filters matcher by event", () => {
  const handler = command("echo ok");
  assert.equal(identityHash("Stop", "^ignored$", handler), identityHash("Stop", undefined, handler));
  assert.notEqual(identityHash("PreToolUse", "^kept$", handler), identityHash("PreToolUse", undefined, handler));
});

test("identityHash normalizes timeout defaults and clamps zero", () => {
  assert.equal(identityHash("Stop", undefined, command("echo ok")), identityHash("Stop", undefined, command("echo ok", { timeout: 600 })));
  assert.equal(identityHash("Stop", undefined, command("echo ok", { timeout: 0 })), identityHash("Stop", undefined, command("echo ok", { timeout: 1 })));
});

test("identityHash preserves statusMessage only when present", () => {
  assert.notEqual(
    identityHash("Stop", undefined, command("echo ok")),
    identityHash("Stop", undefined, command("echo ok", { statusMessage: "Checking" })),
  );
  assert.equal(
    identityHash("Stop", undefined, command("echo ok")),
    identityHash("Stop", undefined, command("echo ok", { statusMessage: null })),
  );
});

test("listHookEntries skips async handlers and derives exact keys", () => {
  const root = makePlugin({
    hooks: {
      PreToolUse: [
        {
          matcher: "^tool$",
          hooks: [command("echo sync"), command("echo async", { async: true })],
        },
      ],
    },
  });
  const entries = listHookEntries(root, PLUGIN_KEY);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "fixture@market:hooks/sample.json:pre_tool_use:0:0");
});

test("listHookEntries skips handlers whose type is not command", () => {
  const root = makePlugin({
    hooks: {
      PreToolUse: [{ hooks: [{ type: "prompt", command: "ignored" }, command("echo kept")] }],
    },
  });
  assert.deepEqual(listHookEntries(root, PLUGIN_KEY).map((entry) => entry.key), [
    "fixture@market:hooks/sample.json:pre_tool_use:0:1",
  ]);
});

test("listHookEntries skips empty and whitespace-only commands", () => {
  const root = makePlugin({
    hooks: {
      PreToolUse: [{ hooks: [command(""), command("  \t"), command("echo kept")] }],
    },
  });
  assert.deepEqual(listHookEntries(root, PLUGIN_KEY).map((entry) => entry.key), [
    "fixture@market:hooks/sample.json:pre_tool_use:0:2",
  ]);
});

test("listHookEntries skips only the group with an invalid matcher", () => {
  const root = makePlugin({
    hooks: {
      PreToolUse: [
        { matcher: "[", hooks: [command("echo invalid group")] },
        { matcher: "^valid$", hooks: [command("echo valid group")] },
      ],
    },
  });
  assert.deepEqual(listHookEntries(root, PLUGIN_KEY).map((entry) => entry.key), [
    "fixture@market:hooks/sample.json:pre_tool_use:1:0",
  ]);
});

test("listHookEntries refuses manifest hook references outside the plugin root", () => {
  const root = makePlugin({ hooks: {} });
  const outside = join(root, "..", "outside-hook.json");
  writeFileSync(outside, JSON.stringify({ hooks: {} }));
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), JSON.stringify({ hooks: ["../outside-hook.json"] }));
  assert.throws(() => listHookEntries(root, PLUGIN_KEY), /escapes plugin root/);
});

test("readInstalledPluginKeys returns enabled candidates and excludes disabled sections", () => {
  const home = makeCodexHome([
    '[plugins."fixture@one"]',
    "enabled = true",
    '[plugins."fixture@off"]',
    "enabled = false # intentionally disabled",
    '[plugins."other@market"]',
    "enabled = true",
    '[plugins."fixture@two"]',
    "source = \"dev\"",
    "",
  ].join("\n"));
  assert.deepEqual(readInstalledPluginKeys(home, "fixture"), ["fixture@one", "fixture@two"]);
  assert.deepEqual(readInstalledPluginKeys(home, "missing"), []);
});

test("section headers allow trailing comments for plugin discovery and hook trust", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo comment headers")] }] } });
  const entry = listHookEntries(root, PLUGIN_KEY)[0];
  const home = makeCodexHome([
    '[plugins."fixture@market"] # installed from local marketplace',
    "enabled = true",
    `[hooks.state."${entry.key}"]  # retained by operator`,
    `trusted_hash = "${entry.hash}"`,
    "",
  ].join("\n"));
  assert.deepEqual(readInstalledPluginKeys(home, "fixture"), [PLUGIN_KEY]);
  assert.equal(diagnoseHookTrust(home, root, PLUGIN_KEY)[0].status, "trusted");
});

test("multiline TOML strings cannot poison reads, safety pins, or insertion anchors", () => {
  for (const quote of ['"""', "'''"]) {
    const root = makePlugin({ hooks: { Stop: [{ hooks: [command(`echo ${quote}`)] }] } });
    const entry = listHookEntries(root, PLUGIN_KEY)[0];
    const fakeHeader = `[hooks.state."${entry.key}"]`;
    const poison = [
      `inline = ${quote}closed${quote}`,
      `payload = ${quote}`,
      '[plugins."fixture@poison"]',
      fakeHeader,
      `trusted_hash = "${entry.hash}"`,
      quote,
      '[plugins."fixture@market"] # real section after same-line close',
      "enabled = true",
      `plugin_note = ${quote}`,
      "enabled = false # string content must not disable the plugin",
      quote,
      "",
    ].join("\n");
    const home = makeCodexHome(poison);

    assert.deepEqual(readInstalledPluginKeys(home, "fixture"), [PLUGIN_KEY]);
    assert.equal(diagnoseHookTrust(home, root, PLUGIN_KEY)[0].status, "untrusted");
    assert.throws(() => retrustHooks(home, root, PLUGIN_KEY, false, FEATURES_OK), /--bootstrap-ok/);

    retrustHooks(home, root, PLUGIN_KEY, true, FEATURES_OK);
    const after = readFileSync(join(home, "config.toml"), "utf8");
    assert.ok(after.lastIndexOf(fakeHeader) > after.indexOf(`\n${quote}\n`), `${quote} insertion must follow the string`);
    assert.equal(diagnoseHookTrust(home, root, PLUGIN_KEY)[0].status, "trusted");
  }
});

test("diagnoseHookTrust reports trusted, drifted, and untrusted independently", () => {
  const root = makePlugin({
    hooks: {
      Stop: [
        { hooks: [command("echo trusted")] },
        { hooks: [command("echo drifted")] },
        { hooks: [command("echo untrusted")] },
      ],
    },
  });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const home = makeCodexHome(`${trustSection(entries[0])}\n${trustSection(entries[1], "sha256:stale")}`);
  const diagnosed = diagnoseHookTrust(home, root, PLUGIN_KEY);
  assert.deepEqual(diagnosed.map((item) => item.status), ["trusted", "drifted", "untrusted"]);
  assert.equal(diagnosed[1].actual, "sha256:stale");
  assert.equal(diagnosed[2].actual, null);
});

test("doctor hook-trust check warns on ambiguous keys and fails with per-hook drift evidence", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo doctor")] }] } });
  const entry = listHookEntries(root, "fixture@one")[0];
  const ambiguousHome = makeCodexHome([
    '[plugins."fixture@one"]',
    "enabled = true",
    '[plugins."fixture@two"]',
    "enabled = true",
    "",
  ].join("\n"));
  const ambiguous = runHookTrustCheck(root, { codexHome: ambiguousHome });
  assert.equal(ambiguous.severity, "WARN");
  assert.match(ambiguous.evidence, /fixture@one, fixture@two/);

  writeFileSync(join(ambiguousHome, "config.toml"), `${trustSection(entry, "sha256:stale")}`);
  const drifted = runHookTrustCheck(root, { codexHome: ambiguousHome, pluginKey: "fixture@one" });
  assert.equal(drifted.severity, "FAIL");
  assert.match(drifted.evidence, new RegExp(entry.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(drifted.evidence, new RegExp(`expected=${entry.hash}`));
  assert.match(drifted.evidence, /actual=sha256:stale/);
});

test("retrustHooks replaces drift, appends missing sections, preserves unrelated bytes, and creates a backup", () => {
  const root = makePlugin({
    hooks: {
      Stop: [
        { hooks: [command("echo pin")] },
        { hooks: [command("echo drift")] },
        { hooks: [command("echo missing")] },
      ],
    },
  });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const before = [
    "# keep this comment byte-for-byte",
    '[plugins."fixture@market"]',
    "enabled = true",
    "custom = \"untouched\"",
    "",
    trustSection(entries[0]).trimEnd(),
    "note = \"pin-section-byte\"",
    "",
    trustSection(entries[1], "sha256:stale").trimEnd(),
    "",
    '[hooks.state."unrelated@market:hooks/else.json:stop:0:0"]',
    'trusted_hash = "sha256:leave-me"',
    "tail = \"untouched\"",
    "",
  ].join("\n");
  const home = makeCodexHome(before);

  const result = retrustHooks(home, root, PLUGIN_KEY, false, FEATURES_OK);
  assert.deepEqual({ updated: result.updated, appended: result.appended }, { updated: 2, appended: 1 });
  assert.ok(existsSync(result.backupPath));
  assert.equal(readFileSync(result.backupPath, "utf8"), before);
  assert.deepEqual(diagnoseHookTrust(home, root, PLUGIN_KEY).map((item) => item.status), ["trusted", "trusted", "trusted"]);

  const after = readFileSync(join(home, "config.toml"), "utf8");
  const expected = before
    .replace('trusted_hash = "sha256:stale"', `trusted_hash = "${entries[1].hash}"`)
    .replace(
      `[hooks.state."${entries[0].key}"]`,
      `${trustSection(entries[2]).trimEnd()}\n\n[hooks.state."${entries[0].key}"]`,
    );
  assert.equal(after, expected, "only the stale hash and missing exact section may change");
  assert.match(after, /enabled = true\ncustom = "untouched"/);
  assert.match(after, /trusted_hash = "sha256:leave-me"\ntail = "untouched"/);
});

test("retrustHooks rejects duplicate exact section headers before writing", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo one")] }] } });
  const entry = listHookEntries(root, PLUGIN_KEY)[0];
  const before = `${trustSection(entry)}\n${trustSection(entry)}`;
  const home = makeCodexHome(before);
  assert.throws(() => retrustHooks(home, root, PLUGIN_KEY), /duplicate section header/);
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), before);
});

test("retrustHooks rejects multiple trusted_hash lines before writing", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo one")] }] } });
  const entry = listHookEntries(root, PLUGIN_KEY)[0];
  const before = `[hooks.state."${entry.key}"]\ntrusted_hash = "${entry.hash}"\ntrusted_hash = "${entry.hash}"\n`;
  const home = makeCodexHome(before);
  assert.throws(() => retrustHooks(home, root, PLUGIN_KEY), /multiple trusted_hash lines/);
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), before);
});

test("retrustHooks safety pin blocks when every existing entry mismatches", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo one")] }, { hooks: [command("echo two")] }] } });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const before = `${trustSection(entries[0], "sha256:wrong-one")}\n${trustSection(entries[1], "sha256:wrong-two")}`;
  const home = makeCodexHome(before);
  assert.throws(() => retrustHooks(home, root, PLUGIN_KEY), /safety pin failed/);
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), before);
});

test("retrustHooks requires bootstrapOk only when no entries exist for the plugin key", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo bootstrap")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  assert.throws(() => retrustHooks(home, root, PLUGIN_KEY), /--bootstrap-ok/);
  const result = retrustHooks(home, root, PLUGIN_KEY, true, FEATURES_OK);
  assert.equal(result.updated, 0);
  assert.equal(result.appended, 1);
  assert.deepEqual(diagnoseHookTrust(home, root, PLUGIN_KEY).map((item) => item.status), ["trusted"]);
});

test("retrustHooks preserves a config symlink and atomically updates its resolved target", (t) => {
  // config.toml is linked as a FILE, which a directory junction cannot express,
  // so an unprivileged Windows host cannot build this fixture at all.
  if (!supportsSymlinks().file) {
    t.skip("file symlinks unavailable on this host: config-symlink preservation not exercised");
    return;
  }
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo symlink")] }] } });
  const home = tempDir("cxc-hook-link-home-");
  const targetDir = tempDir("cxc-hook-link-target-");
  const targetPath = join(targetDir, "managed-config.toml");
  const configPath = join(home, "config.toml");
  writeFileSync(targetPath, '[plugins."fixture@market"]\nenabled = true\n');
  symlinkSync(targetPath, configPath);

  const result = retrustHooks(home, root, PLUGIN_KEY, true, FEATURES_OK);
  assert.equal(lstatSync(configPath).isSymbolicLink(), true);
  assert.ok(result.backupPath.startsWith(`${realpathSync(targetPath)}.bak-`));
  assert.equal(diagnoseHookTrust(home, root, PLUGIN_KEY)[0].status, "trusted");
  assert.match(readFileSync(targetPath, "utf8"), /\[hooks\.state\./);
});

test("retrustHooks rolls back the resolved config when codex verification fails", () => {
  const root = makePlugin({
    hooks: { Stop: [{ hooks: [command("echo pinned")] }, { hooks: [command("echo appended")] }] },
  });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const before = trustSection(entries[0]);
  const home = makeCodexHome(before);
  const calls: Array<{ command: string; args: string[]; codexHome: string | undefined }> = [];
  const failingRunner: HookTrustRunner = (commandName, args, options) => {
    calls.push({ command: commandName, args, codexHome: options.env.CODEX_HOME });
    return { status: 2, stderr: "invalid config" };
  };

  // Pinned to a POSIX platform so this stays a ROLLBACK test: the win32 spawn
  // shape is asserted separately, and on a real Windows host the resolver would
  // otherwise rewrite the command into a cmd.exe hop here.
  assert.throws(
    () => retrustHooks(home, root, PLUGIN_KEY, false, failingRunner, "linux"),
    /codex features list verification failed/,
  );
  assert.deepEqual(calls, [{ command: "codex", args: ["features", "list"], codexHome: home }]);
  assert.equal(readFileSync(join(home, "config.toml"), "utf8"), before);
  assert.equal(diagnoseHookTrust(home, root, PLUGIN_KEY)[1].status, "untrusted");
});

test(
  "hooks retrust CLI reports each hook and backup path",
  {
    // Fake sh-script `codex` shim is not executable on NTFS (spawnSync ENOENT);
    // retrust behavior is covered cross-platform by the direct retrustHooks tests.
    skip: process.platform === "win32",
  },
  async () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo cli")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  const binDir = tempDir("cxc-hook-bin-");
  const codexPath = join(binDir, "codex");
  writeFileSync(codexPath, "#!/bin/sh\nexit 0\n");
  chmodSync(codexPath, 0o755);
  const fakeCliPath = join(root, "components", "cxc-ops", "src", "cli.ts");
  mkdirSync(dirname(fakeCliPath), { recursive: true });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  const originalPath = process.env.PATH;
  process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
  process.stdout.write = ((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await main(
      ["hooks", "retrust", "--key", PLUGIN_KEY, "--codex-home", home, "--bootstrap-ok"],
      pathToFileURL(fakeCliPath).href,
    );
    assert.equal(code, 0, stderr.join(""));
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
    process.env.PATH = originalPath;
  }
  assert.match(stdout.join(""), /\[trusted\] fixture@market:hooks\/sample\.json:stop:0:0/);
  assert.match(stdout.join(""), /backup: .*config\.toml\.bak-/);
  },
);

/**
 * Issue #33 bug A: retrust must not spawn a bare `codex` on Windows.
 *
 * The verification runner is the injected seam, so these drive platform="win32"
 * from any OS and assert on the spawn shape the runner is handed.
 */
test("retrustHooks verifies through a cmd.exe hop when only the Store codex is on PATH", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo store")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  const seen: Array<{ file: string; args: string[]; verbatim?: boolean }> = [];
  const runner: HookTrustRunner = (file, args, options) => {
    seen.push({ file, args, verbatim: options.windowsVerbatimArguments });
    return { status: 0 };
  };
  const storeDir = join("C:\\Program Files", "WindowsApps", "OpenAI.Codex_1.0_x64__a", "app");
  const originalPath = process.env.PATH;
  const originalComSpec = process.env.ComSpec;
  const originalBin = process.env.CODEX_BIN;
  process.env.PATH = storeDir;
  process.env.ComSpec = "C:\\Windows\\system32\\cmd.exe";
  delete process.env.CODEX_BIN;
  try {
    retrustHooks(home, root, PLUGIN_KEY, true, runner, "win32");
  } finally {
    process.env.PATH = originalPath;
    if (originalComSpec === undefined) delete process.env.ComSpec;
    else process.env.ComSpec = originalComSpec;
    if (originalBin !== undefined) process.env.CODEX_BIN = originalBin;
  }
  assert.equal(seen.length, 1);
  // The bare "codex" spawn is what EPERMs on a Codex-desktop host.
  assert.notEqual(seen[0].file, "codex");
  assert.match(seen[0].file, /cmd\.exe$/i);
  assert.deepEqual(seen[0].args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(seen[0].verbatim, true);
  assert.match(seen[0].args[3], /codex/);
  assert.match(seen[0].args[3], /features/);
});

test("retrustHooks honors CODEX_BIN and still passes CODEX_HOME to the runner", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo override")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  const binDir = tempDir("cxc-hook-codexbin-");
  const override = join(binDir, "codex.exe");
  writeFileSync(override, "");
  const seen: Array<{ file: string; codexHome: string | undefined }> = [];
  const runner: HookTrustRunner = (file, _args, options) => {
    seen.push({ file, codexHome: options.env.CODEX_HOME });
    return { status: 0 };
  };
  const originalBin = process.env.CODEX_BIN;
  process.env.CODEX_BIN = override;
  try {
    retrustHooks(home, root, PLUGIN_KEY, true, runner, "win32");
  } finally {
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
  }
  assert.deepEqual(seen, [{ file: override, codexHome: home }]);
});

test("POSIX retrust still spawns a bare codex, unchanged", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo posix")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  const seen: Array<{ file: string; args: string[] }> = [];
  const runner: HookTrustRunner = (file, args) => {
    seen.push({ file, args });
    return { status: 0 };
  };
  const originalBin = process.env.CODEX_BIN;
  delete process.env.CODEX_BIN;
  try {
    retrustHooks(home, root, PLUGIN_KEY, true, runner, "linux");
  } finally {
    if (originalBin !== undefined) process.env.CODEX_BIN = originalBin;
  }
  assert.deepEqual(seen, [{ file: "codex", args: ["features", "list"] }]);
});

/**
 * Issue #33 bug B: a never-trusted install must name the exact recovery command.
 * Nothing in codexclaw writes [hooks.state.*]; only the host Codex does, so the
 * check reports rather than forges.
 */
test("doctor names the bootstrap retrust command when no trust entry exists at all", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo fresh")] }] } });
  const home = makeCodexHome('[plugins."fixture@market"]\nenabled = true\n');
  const check = runHookTrustCheck(root, { codexHome: home, pluginKey: PLUGIN_KEY });
  assert.equal(check.severity, "FAIL");
  assert.match(check.evidence, /untrusted/);
  assert.match(check.evidence, /actual=\(none\)/);
  assert.ok(check.repair, "a fresh install must carry a repair line");
  assert.match(check.repair ?? "", /cxc hooks retrust/);
  assert.match(check.repair ?? "", /--bootstrap-ok/);
  assert.match(check.repair ?? "", new RegExp(PLUGIN_KEY.replace("@", "@")));
  // The remediation must say who owns the write, so nobody hand-forges entries.
  assert.match(check.repair ?? "", /Codex/);
});

test("doctor's drift repair omits --bootstrap-ok, which would be the wrong advice", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo drifted")] }] } });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const home = makeCodexHome(trustSection(entries[0], "sha256:stale"));
  const check = runHookTrustCheck(root, { codexHome: home, pluginKey: PLUGIN_KEY });
  assert.equal(check.severity, "FAIL");
  assert.match(check.evidence, /drifted/);
  assert.match(check.repair ?? "", /cxc hooks retrust/);
  assert.ok(!(check.repair ?? "").includes("--bootstrap-ok"), "drift is not a bootstrap case");
});

test("a fully trusted install carries no repair line", () => {
  const root = makePlugin({ hooks: { Stop: [{ hooks: [command("echo trusted")] }] } });
  const entries = listHookEntries(root, PLUGIN_KEY);
  const home = makeCodexHome(trustSection(entries[0]));
  const check = runHookTrustCheck(root, { codexHome: home, pluginKey: PLUGIN_KEY });
  assert.equal(check.severity, "PASS");
  assert.equal(check.repair, undefined);
});
