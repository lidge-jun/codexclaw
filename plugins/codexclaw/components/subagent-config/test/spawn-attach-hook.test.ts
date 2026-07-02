/**
 * spawn-attach-hook.test.ts — WP1 mention-channel E3 spawn-attach hook.
 *
 * Proves: ALWAYS-ON message rewrite (no env opt-in) that prepends link-form
 * `[$cxc-*](skill://...)` mentions for v1-shaped AND v2-shaped spawn inputs, a
 * FULL-REPLACEMENT updatedInput (entire original input, only `message` changed, no
 * `items` added), per-folder dedupe against mentions already in the message, and
 * no-op on items-present / missing message / non-spawn / malformed input. The hook
 * must NEVER deny and NEVER throw.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mentionedFolders, runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

function spawnPayload(toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd: process.cwd(),
    tool_input: toolInput,
  });
}

function updatedInputOf(out: string): Record<string, unknown> {
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  return parsed.hookSpecificOutput.updatedInput;
}

test("WP1 hook: v1-shape spawn => message rewrite with link-form mentions, no env needed", () => {
  const out = runSpawnAttachHook(
    spawnPayload({ message: "review the frontend diff", agent_type: "explorer", model: "x" }),
  );
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  // full replacement: original keys preserved, no items channel added
  assert.equal(ui.agent_type, "explorer");
  assert.equal(ui.model, "x");
  assert.ok(!("items" in ui), "mention channel must not add items");
  const message = ui.message as string;
  assert.match(message, /\[\$cxc-dev\]\(skill:\/\/.*\/dev\/SKILL\.md\)/);
  assert.match(message, /\[\$cxc-dev-frontend\]\(skill:\/\/.*\/dev-frontend\/SKILL\.md\)/, "frontend surface inferred");
  assert.ok(message.endsWith("review the frontend diff"), "original message preserved at the end");
});

test("WP1 hook: v2-shape spawn (task_name) => also rewritten (message is schema-safe on v2)", () => {
  const out = runSpawnAttachHook(spawnPayload({ task_name: "t", message: "audit the backend plan" }));
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.task_name, "t");
  assert.match(ui.message as string, /\[\$cxc-dev-backend\]\(skill:\/\//);
});

test("WP1 hook: v2-shape spawn (fork_turns) => also rewritten", () => {
  const out = runSpawnAttachHook(spawnPayload({ fork_turns: 3, message: "debug the security check" }));
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.fork_turns, 3);
  assert.match(ui.message as string, /\[\$cxc-dev-security\]\(skill:\/\//);
});

test("WP1 hook: items already present => no-op (structured channel chosen, never double-attach)", () => {
  const out = runSpawnAttachHook(spawnPayload({ message: "x", items: [{ type: "text", text: "TASK: x" }] }));
  assert.equal(out, "");
});

test("WP1 hook: plain $cxc mention already in message => that folder deduped", () => {
  const out = runSpawnAttachHook(
    spawnPayload({ message: "$cxc-dev is loaded; review the frontend diff", agent_type: "explorer" }),
  );
  assert.notEqual(out, "");
  const message = updatedInputOf(out).message as string;
  assert.doesNotMatch(message, /\[\$cxc-dev\]\(/, "already-mentioned dev must not re-attach");
  assert.match(message, /\[\$cxc-dev-frontend\]\(/, "unmentioned surface still attaches");
});

test("WP1 hook: plugin-native $codexclaw:cxc mention also dedupes", () => {
  const out = runSpawnAttachHook(
    spawnPayload({ message: "$codexclaw:cxc-dev-frontend review the frontend diff", agent_type: "explorer" }),
  );
  assert.notEqual(out, "");
  const message = updatedInputOf(out).message as string;
  assert.doesNotMatch(message, /\[\$cxc-dev-frontend\]\(/);
  assert.match(message, /\[\$cxc-dev\]\(/, "base dev skill still attaches");
});

test("WP1 hook: link-form skill:// mention also dedupes", () => {
  const out = runSpawnAttachHook(
    spawnPayload({
      message: "already loaded: [$cxc-dev](skill:///abs/skills/dev/SKILL.md) — review the frontend diff",
      agent_type: "explorer",
    }),
  );
  assert.notEqual(out, "");
  const message = updatedInputOf(out).message as string;
  // exactly one dev link (the pre-existing one), no second attach of dev
  assert.equal((message.match(/\[\$cxc-dev\]\(/g) ?? []).length, 1);
  assert.match(message, /\[\$cxc-dev-frontend\]\(/);
});

test("WP1 hook: all resolved skills already mentioned => no-op", () => {
  const out = runSpawnAttachHook(
    spawnPayload({ message: "$cxc-dev only, no surface keywords here", agent_type: "explorer" }),
  );
  assert.equal(out, "");
});

test("WP1 hook: missing or non-string or empty message => no-op (never invent a message)", () => {
  assert.equal(runSpawnAttachHook(spawnPayload({ agent_type: "explorer" })), "");
  assert.equal(runSpawnAttachHook(spawnPayload({ message: 42, agent_type: "explorer" })), "");
  assert.equal(runSpawnAttachHook(spawnPayload({ message: "   ", agent_type: "explorer" })), "");
});

test("WP1 hook: non-spawn tool => allow untouched", () => {
  const out = runSpawnAttachHook(
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "shell", tool_input: { message: "frontend" } }),
  );
  assert.equal(out, "");
});

test("WP1 hook: malformed / empty input => allow untouched, never throws", () => {
  assert.equal(runSpawnAttachHook(""), "");
  assert.equal(runSpawnAttachHook("{not json"), "");
  assert.equal(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "spawn_agent" })), "");
});

test("WP1 hook: worker agent_type maps to executor baseline skills", () => {
  const out = runSpawnAttachHook(spawnPayload({ message: "implement the data layer", agent_type: "worker" }));
  const message = updatedInputOf(out).message as string;
  assert.match(message, /\[\$cxc-dev\]\(/);
  assert.match(message, /\[\$cxc-dev-data\]\(/, "data surface inferred");
});

test("WP1 mentionedFolders: recognizes all three mention shapes", () => {
  const found = mentionedFolders(
    "$cxc-dev and $codexclaw:cxc-dev-testing and [$cxc-search](skill:///x/skills/search/SKILL.md)",
  );
  assert.deepEqual([...found].sort(), ["dev", "dev-testing", "search"]);
});
