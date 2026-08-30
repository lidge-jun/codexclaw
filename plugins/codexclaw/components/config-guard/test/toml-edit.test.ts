import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findKeyLine,
  findTableHeader,
  readTableKey,
  restoreTableKey,
  setTableKey,
  tomlTableBody,
} from "../src/toml-edit.ts";
import { CONFIG_MANAGED_KEYS, findManagedKey, managedKeyId } from "../src/managed-keys.ts";
import { splitLines } from "../src/text-lines.ts";

const LF = "[memories]\ngenerate_memories = true\nuse_memories = true\n";

test("case 1: inserts into an existing table, leaving the existing keys alone", () => {
  const r = setTableKey(LF, "memories", "dedicated_tools", true);
  assert.equal(r.action, "inserted-into-table");
  assert.equal(r.priorValue, null);
  assert.equal(r.changed, true);
  assert.match(r.content, /generate_memories = true/);
  assert.match(r.content, /use_memories = true/);
  assert.match(r.content, /dedicated_tools = true/);
  // inserted inside [memories], not appended after the file
  const lines = splitLines(r.content);
  assert.ok(lines.indexOf("dedicated_tools = true") > lines.indexOf("[memories]"));
});

test("case 2: updates an existing key and reports the prior value", () => {
  const r = setTableKey(LF + "dedicated_tools = false\n", "memories", "dedicated_tools", true);
  assert.equal(r.action, "updated");
  assert.equal(r.priorValue, "false");
  assert.match(r.content, /dedicated_tools = true/);
});

test("case 3: a user comment tail on the key line survives the rewrite", () => {
  const input = "[memories]\ndedicated_tools = false  # 사용자 주석\n";
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "updated");
  assert.equal(r.content, "[memories]\ndedicated_tools = true  # 사용자 주석\n");
});

test("case 4: creates the table at the end without disturbing earlier content", () => {
  const input = "[features]\nmulti_agent = true\n";
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "created-table");
  assert.ok(r.content.startsWith("[features]\nmulti_agent = true\n"));
  assert.match(r.content, /\[memories\]\ndedicated_tools = true/);
});

test("case 5: a CRLF file stays CRLF (no bare LF survives)", () => {
  const crlf = LF.replace(/\n/g, "\r\n");
  const r = setTableKey(crlf, "memories", "dedicated_tools", true);
  assert.equal(r.changed, true);
  assert.equal(r.content.replace(/\r\n/g, "").includes("\n"), false);
  assert.match(r.content, /dedicated_tools = true/);
});

test("case 6: insertion never crosses into the following table", () => {
  const input = "[memories]\ngenerate_memories = true\n\n[features]\nmulti_agent = true\n";
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "inserted-into-table");
  const lines = splitLines(r.content);
  assert.ok(lines.indexOf("dedicated_tools = true") < lines.indexOf("[features]"));
});

test("case 7: writing the value it already has is an exact no-op", () => {
  const input = "[memories]\ndedicated_tools = true\n";
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "noop");
  assert.equal(r.changed, false);
  assert.equal(r.content, input);
});

test("case 8: a '#' inside a quoted value is not mistaken for a comment", () => {
  const input = '[memories]\nnote = "a # b"\n';
  const found = findKeyLine(splitLines(input), 0, "note");
  assert.notEqual(found, "unsupported");
  assert.notEqual(found, null);
  if (found && found !== "unsupported") {
    assert.equal(found.value, '"a # b"');
    assert.equal(found.comment, "");
  }
});

test("case 9: restore with priorValue=null removes only the key line and keeps the header", () => {
  const input = "[memories]\ngenerate_memories = true\ndedicated_tools = true\n";
  const r = restoreTableKey(input, "memories", "dedicated_tools", null);
  assert.equal(r.action, "removed");
  assert.match(r.content, /\[memories\]/);
  assert.match(r.content, /generate_memories = true/);
  assert.equal(/dedicated_tools/.test(r.content), false);
});

test("case 9b: the header survives even when our key was the only one, with a comment kept", () => {
  const input = "[memories]\n# 사용자가 남긴 메모\ndedicated_tools = true\n";
  const r = restoreTableKey(input, "memories", "dedicated_tools", null);
  assert.equal(r.action, "removed");
  assert.match(r.content, /\[memories\]/);
  assert.match(r.content, /# 사용자가 남긴 메모/);
});

test("case 10: restore to a prior value puts that value back", () => {
  const input = "[memories]\ndedicated_tools = true\n";
  const r = restoreTableKey(input, "memories", "dedicated_tools", "false");
  assert.equal(r.action, "updated");
  assert.match(r.content, /dedicated_tools = false/);
});

test("blocker 3: multi-line, literal, array and inline-table values are refused, not rewritten", () => {
  for (const raw of ['"""x\ny"""', "'''x'''", "[1, 2] # c", '{ a = "#" }']) {
    const input = `[memories]\ndedicated_tools = ${raw}\n`;
    const r = setTableKey(input, "memories", "dedicated_tools", true);
    assert.equal(r.action, "unsupported-value", `should refuse: ${raw}`);
    assert.equal(r.changed, false);
    assert.equal(r.content, input);
  }
});

test("blocker 3: a '#' with no leading space still splits as a comment", () => {
  const input = "[memories]\ndedicated_tools = false#c\n";
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "updated");
  assert.equal(r.priorValue, "false");
  assert.match(r.content, /dedicated_tools = true#c/);
});

test("blocker 3: an unterminated quote is refused rather than guessed at", () => {
  const input = '[memories]\ndedicated_tools = "oops\n';
  const r = setTableKey(input, "memories", "dedicated_tools", true);
  assert.equal(r.action, "unsupported-value");
  assert.equal(r.content, input);
});

test("blocker 1: the shared grammar handles dotted headers and header comments", () => {
  const input = "[features.multi_agent_v2]  # tuning\nenabled = true\nmax_concurrent_threads_per_session = 8\n";
  assert.equal(findTableHeader(splitLines(input), "features.multi_agent_v2"), 0);
  const body = tomlTableBody(input, "features.multi_agent_v2");
  assert.ok(body !== null && body.includes("max_concurrent_threads_per_session = 8"));
  // the dot must not act as a wildcard
  assert.equal(findTableHeader(splitLines("[featuresXmulti_agent_v2]\n"), "features.multi_agent_v2"), -1);
});

test("readTableKey reports the live value, or null when absent", () => {
  assert.equal(readTableKey(LF, "memories", "dedicated_tools"), null);
  assert.equal(readTableKey(LF + "dedicated_tools = false\n", "memories", "dedicated_tools"), "false");
  assert.equal(readTableKey("[features]\n", "memories", "dedicated_tools"), null);
});

test("a missing table makes restore a no-op instead of an error", () => {
  const input = "[features]\nmulti_agent = true\n";
  const r = restoreTableKey(input, "memories", "dedicated_tools", null);
  assert.equal(r.action, "noop");
  assert.equal(r.content, input);
});

test("policy: every managed key is autoEnable:false, so installation flips nothing", () => {
  assert.ok(CONFIG_MANAGED_KEYS.length > 0);
  for (const entry of CONFIG_MANAGED_KEYS) {
    assert.equal(entry.autoEnable, false);
    assert.ok(entry.caution.length > 20, `${managedKeyId(entry)} needs a real caution`);
  }
  assert.equal(managedKeyId(CONFIG_MANAGED_KEYS[0]), "memories.dedicated_tools");
  assert.ok(findManagedKey("memories.dedicated_tools"));
  assert.equal(findManagedKey("tools.dangerous"), null);
});

