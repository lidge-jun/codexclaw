import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate, manifestPath, parseInstallManifest } from "../src/activate.ts";
import { deactivate } from "../src/deactivate.ts";
import { readTableKey } from "../src/toml-edit.ts";
import { type CodexRunner } from "../src/features.ts";

// wp1-B: installation turns `memories.dedicated_tools` on by itself. The whole safety
// argument for doing that rests on the round trip — the key is recorded with its
// PRE-INSTALL value, and `cxc disable` puts that value back. These tests are that
// argument's proof, so each one asserts the manifest AND the file after deactivate.

const KEY = "memories.dedicated_tools";

/**
 * A fake `codex` that rewrites config.toml in place, like the real
 * `codex features enable` does. Rewriting matters here: activate writes the managed key
 * AFTER the feature pass precisely because this CLI re-reads and rewrites the file, and a
 * fake that regenerated it from scratch would hide an ordering bug instead of catching it.
 */
function makeFakeCodex(configPath: string) {
  const state: Record<string, boolean> = {
    multi_agent: false,
    goals: false,
    hooks: false,
    default_mode_request_user_input: false,
  };
  const writeConfig = () => {
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    const lines = existing.length > 0 ? existing.replace(/\n$/, "").split("\n") : [];
    if (!lines.some((l) => /^\s*\[features\]\s*$/.test(l))) lines.push("[features]");
    const headerIdx = lines.findIndex((l) => /^\s*\[features\]\s*$/.test(l));
    let end = lines.length;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (/^\s*\[/.test(lines[i])) {
        end = i;
        break;
      }
    }
    for (const [k, v] of Object.entries(state)) {
      const re = new RegExp(`^(\\s*)${k}\\s*=\\s*(?:true|false)\\s*$`);
      let found = -1;
      for (let i = headerIdx + 1; i < end; i++) {
        if (re.test(lines[i])) {
          found = i;
          break;
        }
      }
      if (found >= 0) lines[found] = `${k} = ${v}`;
      else {
        lines.splice(end, 0, `${k} = ${v}`);
        end += 1;
      }
    }
    writeFileSync(configPath, `${lines.join("\n")}\n`, "utf8");
  };
  const run: CodexRunner = (args) => {
    if (args[0] === "features" && args[1] === "list") {
      const out = Object.entries(state)
        .map(([k, v]) => `${k} stable ${v}`)
        .join("\n");
      return { stdout: out, stderr: "", exitCode: 0 };
    }
    if (args[0] === "features" && (args[1] === "enable" || args[1] === "disable")) {
      state[args[2]] = args[1] === "enable";
      writeConfig();
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "unknown", exitCode: 1 };
  };
  return { run, state };
}

function setup(config: string) {
  const home = mkdtempSync(join(tmpdir(), "cxc-auto-"));
  const configPath = join(home, "config.toml");
  writeFileSync(configPath, config, "utf8");
  return { home, configPath, fake: makeFakeCodex(configPath) };
}

function record(home: string) {
  const m = parseInstallManifest(readFileSync(manifestPath(home), "utf8"));
  assert.ok(m, "the manifest must parse");
  return m?.tableKeys?.[KEY];
}

test("install turns the key on and records that it did not exist before", () => {
  const { home, configPath, fake } = setup("[memories]\ngenerate_memories = true\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });

  assert.equal(readTableKey(readFileSync(configPath, "utf8"), "memories", "dedicated_tools"), "true");
  const rec = record(home);
  assert.ok(rec, "an unrecorded write would be unrevertable, which is the whole risk");
  assert.equal(rec?.priorValue, null, "absent before install -> deactivate removes the line");
  assert.equal(rec?.appliedValue, "true");
  assert.equal(rec?.setByCodexclaw, true);
});

test("round trip: enable writes the key, disable removes it and leaves the table alone", () => {
  const { home, configPath, fake } = setup("[memories]\ngenerate_memories = true\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });

  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.deepEqual(r.restoredKeys, [KEY]);
  const after = readFileSync(configPath, "utf8");
  assert.equal(/dedicated_tools/.test(after), false, "the key codexclaw added is gone");
  assert.match(after, /generate_memories = true/, "the user's own key in the same table survives");
  assert.match(after, /\[memories\]/, "the table header is never removed");
});

test("a user who already turned it on keeps their true after disable", () => {
  const { home, configPath, fake } = setup("[memories]\ndedicated_tools = true\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });

  const rec = record(home);
  assert.equal(rec?.priorValue, "true");
  assert.equal(rec?.setByCodexclaw, false, "we changed nothing, so we own nothing");

  deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(
    readTableKey(readFileSync(configPath, "utf8"), "memories", "dedicated_tools"),
    "true",
    "uninstalling codexclaw must not take away a switch the user set themselves",
  );
});

test("a user's explicit false is restored, not deleted", () => {
  const { home, configPath, fake } = setup("[memories]\ndedicated_tools = false\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });
  assert.equal(readTableKey(readFileSync(configPath, "utf8"), "memories", "dedicated_tools"), "true");

  const rec = record(home);
  assert.equal(rec?.priorValue, "false");
  assert.equal(rec?.setByCodexclaw, true);

  deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(
    readTableKey(readFileSync(configPath, "utf8"), "memories", "dedicated_tools"),
    "false",
    "the line comes back with the user's value, it is not removed",
  );
});

test("re-running enable keeps the ORIGINAL prior value, so history cannot be rewritten", () => {
  const { home, configPath, fake } = setup("[memories]\ndedicated_tools = false\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T01:00:00.000Z" });

  const rec = record(home);
  assert.equal(rec?.priorValue, "false", "the second run must not record our own true");
  assert.equal(rec?.setByCodexclaw, true, "ownership from the first run is not lost by a no-op re-run");

  deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(readTableKey(readFileSync(configPath, "utf8"), "memories", "dedicated_tools"), "false");
});

test("the key survives the feature pass that rewrites config.toml", () => {
  const { home, configPath, fake } = setup("[memories]\ngenerate_memories = true\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });
  const after = readFileSync(configPath, "utf8");
  assert.match(after, /dedicated_tools = true/);
  assert.match(after, /hooks = true/, "the feature pass really did run and rewrite the file");
});

test("an unrelated later edit does not strand the key: the backup corroborates the removal", () => {
  const { home, configPath, fake } = setup("[memories]\ngenerate_memories = true\n");
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });
  writeFileSync(configPath, `${readFileSync(configPath, "utf8")}\n# user edit\n`, "utf8");

  const r = deactivate({ run: fake.run, codexHome: home, configPath });
  assert.equal(r.fileDrifted, true);
  assert.deepEqual(r.restoredKeys, [KEY], "the activation backup shows the key was absent before install");
  const after = readFileSync(configPath, "utf8");
  assert.equal(/dedicated_tools/.test(after), false);
  assert.match(after, /# user edit/, "the foreign line survives verbatim");
});

test("a value form codexclaw refuses to rewrite is left to its owner and recorded nowhere", () => {
  const { home, configPath, fake } = setup('[memories]\ndedicated_tools = "oops\n');
  activate({ run: fake.run, codexHome: home, configPath, now: () => "2026-09-09T00:00:00.000Z" });

  assert.match(readFileSync(configPath, "utf8"), /dedicated_tools = "oops/, "untouched");
  assert.equal(record(home), undefined, "nothing recorded means deactivate will not touch it either");
});
