/**
 * win-exec-bin.test.mjs - spawn resolution contract for bin/codexclaw.mjs (wp06).
 *
 * bin/codexclaw.mjs has no build step, so it carries its own copy of the three
 * Windows spawn rules (050 section 2). This suite is that copy's contract:
 * PATHEXT resolution, the ComSpec route for .cmd/.bat, and metacharacter
 * escaping. Every case drives the platform and env as parameters, so the whole
 * file runs identically on Windows and on Linux CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const binUrl = pathToFileURL(join(repoRoot, "bin", "codexclaw.mjs")).href + "?win-exec";
const { commandInvocation, envValue, resolveWindowsCommand } = await import(binUrl);

/** A throwaway PATH dir holding the given command files. */
function fakePathDir(names) {
  const dir = mkdtempSync(join(tmpdir(), "cxc-winexec-"));
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), "");
  return dir;
}

test("POSIX is a passthrough", () => {
  const inv = commandInvocation("npm", ["run", "dev"], "linux", {});
  assert.equal(inv.file, "npm");
  assert.deepEqual(inv.args, ["run", "dev"]);
  assert.deepEqual(inv.options, {});
});

test("an .exe resolves and spawns directly, with no cmd.exe hop", () => {
  const dir = fakePathDir(["gh.exe"]);
  // Diagnostics for platform-dependent failures: if resolution ever returns the
  // bare command, show whether the candidate file was actually statable.
  const dbg = { dir, exists: existsSync(join(dir, "gh.exe")), pathKey: Object.keys({ PATH: dir })[0] };
  const inv = commandInvocation("gh", ["auth", "status"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  // The extension case comes from PATHEXT, so compare case-insensitively.
  assert.equal(
    inv.file.toLowerCase(),
    join(dir, "gh.exe").toLowerCase(),
    `resolution failed: ${JSON.stringify({ ...dbg, direct: resolveWindowsCommand("gh", { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" }), inv })}`,
  );
  assert.deepEqual(inv.args, ["auth", "status"]);
  assert.equal(inv.options.windowsVerbatimArguments, undefined);
});

test("a .cmd routes through ComSpec with /d /s /c and verbatim args", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const comspec = "C:\\Windows\\system32\\cmd.exe";
  const inv = commandInvocation("npm", ["run", "dev"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: comspec,
  });
  assert.equal(inv.file, comspec);
  assert.deepEqual(inv.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(inv.options.windowsVerbatimArguments, true);
  assert.match(inv.args[3], /npm\.cmd/i);
});

test("arguments with spaces and metacharacters survive the cmd route", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const inv = commandInvocation("npm", ["run", "C:\\Program Files\\a&b"], "win32", {
    PATH: dir,
    PATHEXT: ".CMD",
    ComSpec: "cmd.exe",
  });
  const line = inv.args[3];
  // The ampersand must be carets-escaped so cmd.exe cannot treat it as a separator.
  assert.ok(line.includes("^&"), `ampersand not escaped in: ${line}`);
  assert.ok(line.includes("Program^ Files"), `space not escaped in: ${line}`);
  assert.ok(!/(^|[^^])&/.test(line), "a bare & would end the command line early");
});

test("envValue finds Path when asked for PATH, and reports genuinely absent keys", () => {
  assert.equal(envValue({ Path: "C:\\bin" }, "PATH"), "C:\\bin");
  assert.equal(envValue({ PATH: "C:\\bin" }, "PATH"), "C:\\bin");
  assert.equal(envValue({ ComSpec: "cmd.exe" }, "COMSPEC"), "cmd.exe");
  assert.equal(envValue({ Path: "C:\\bin" }, "PATHEXT"), undefined);
});

test("PATHEXT defaults when unset, so .EXE is still tried", () => {
  const dir = fakePathDir(["gh.exe"]);
  const inv = commandInvocation("gh", [], "win32", { PATH: dir });
  assert.equal(inv.file.toLowerCase(), join(dir, "gh.exe").toLowerCase());
});

test("an unresolvable command returns the input, leaving ENOENT to the caller", () => {
  const inv = commandInvocation("definitely-not-installed", ["--version"], "win32", {
    PATH: fakePathDir([]),
    PATHEXT: ".EXE",
  });
  assert.equal(inv.file, "definitely-not-installed");
  assert.deepEqual(inv.args, ["--version"]);
});

test("a command carrying a path separator is not PATH-resolved", () => {
  const inv = commandInvocation("C:\\tools\\gh.exe", [], "win32", { PATH: "C:\\bin" });
  assert.equal(inv.file, "C:\\tools\\gh.exe");
  assert.equal(resolveWindowsCommand("./local.exe", { PATH: "C:\\bin" }), "./local.exe");
});

test("cxc gui spawns npm through the resolver and names the failure it hit", () => {
  const src = readFileSync(join(repoRoot, "bin", "codexclaw.mjs"), "utf8");
  const gui = src.slice(src.indexOf('case "gui"'), src.indexOf('case "chat"'));
  // Comment lines mention shell:true to explain the ban; assert against code only.
  const guiCode = gui
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.ok(gui.includes('commandInvocation("npm"'), "gui must route npm through commandInvocation");
  assert.ok(!/spawnSync\("npm"/.test(guiCode), "a bare npm spawn ENOENTs on Windows");
  assert.ok(!/shell:\s*true/.test(guiCode), "shell:true is banned - guiDir may contain spaces");
  // The old branch printed "starting the dashboard" and then exited 1 with no
  // diagnostic, so a launch failure was indistinguishable from a Vite crash.
  assert.ok(gui.includes("res.error"), "a launch failure must be reported, not swallowed");
  assert.match(gui, /not found on PATH/);
});

test("cxc gui exits with a named reason, never a bare 1, when npm cannot be launched", () => {
  // A scrubbed PATH makes npm genuinely unresolvable, which drives the launch-failure
  // branch without ever starting a Vite dev server.
  const res = spawnSync(process.execPath, [join(repoRoot, "bin", "codexclaw.mjs"), "gui"], {
    encoding: "utf8",
    env: { ...process.env, PATH: "", Path: "", PATHEXT: "" },
    timeout: 30_000,
  });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  assert.equal(res.status, 1);
  if (out.includes("dependencies not installed")) {
    assert.match(out, /plugins/, "the hint must name the real directory, not a relative POSIX path");
  } else {
    // The old code printed "starting the dashboard" and then exited 1 in silence.
    assert.match(out, /npm was not found on PATH|npm could not be launched/);
  }
});
