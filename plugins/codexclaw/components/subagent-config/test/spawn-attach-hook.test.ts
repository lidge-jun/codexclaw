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
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inferRole, isFullHistoryFork, mentionedFolders, runSpawnAttachHook } from "../src/spawn-attach-hook.ts";

function spawnPayload(toolInput: Record<string, unknown>): string {
  // Isolated cwd: the repo root's own .codexclaw/subagents.json must not leak
  // model injection into tests that assume "no model config".
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd: mkdtempSync(join(tmpdir(), "cxc-spawn-noconfig-")),
    tool_input: toolInput,
  });
}

/** Payload with an explicit cwd (for model-injection tests reading .codexclaw/). */
function spawnPayloadAt(cwd: string, toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd,
    tool_input: toolInput,
  });
}

/** Temp workspace with a .codexclaw/subagents.json for the given roles. */
function workspaceWithConfig(roles: Record<string, unknown>): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-spawn-attach-"));
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "subagents.json"), JSON.stringify({ roles }));
  return cwd;
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

test("WP1 hook: items already present + no model config => no-op (never double-attach)", () => {
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

test("c4: audit-worded explorer spawn upgrades to reviewer and attaches reviewer + search skills", () => {
  const auditMessage =
    "Audit the plan at devlog/_plan/x/000_plan.md adversarially; challenge assumptions and verify references.";
  const out = runSpawnAttachHook(spawnPayload({ message: auditMessage, agent_type: "explorer" }));
  assert.notEqual(out, "");
  const message = updatedInputOf(out).message as string;
  assert.match(message, /\[\$cxc-dev-code-reviewer\]\(skill:\/\/.*\/dev-code-reviewer\/SKILL\.md\)/);
  assert.match(message, /\[\$cxc-search\]\(skill:\/\/.*\/search\/SKILL\.md\)/);
  assert.ok(message.endsWith(auditMessage), "original audit message preserved at the end");
});

test("c4: audit-worded reviewer spawn dedupes pre-mentioned search skill", () => {
  const auditMessage =
    "$cxc-search Audit the plan at devlog/_plan/x/000_plan.md adversarially; challenge assumptions and verify references.";
  const out = runSpawnAttachHook(spawnPayload({ message: auditMessage, agent_type: "explorer" }));
  assert.notEqual(out, "");
  const message = updatedInputOf(out).message as string;
  assert.match(message, /\[\$cxc-dev-code-reviewer\]\(skill:\/\/.*\/dev-code-reviewer\/SKILL\.md\)/);
  assert.equal((message.match(/\[\$cxc-search\]\(/g) ?? []).length, 0, "search link must not be duplicated");
  assert.equal((message.match(/\$cxc-search/g) ?? []).length, 1, "pre-existing search mention preserved once");
});

// ── Model enforcement (subagents.json -> spawn model injection) ──

test("inferRole: worker -> executor; review keywords -> reviewer; default explorer", () => {
  assert.equal(inferRole("worker", "review this"), "executor");
  assert.equal(inferRole("explorer", "audit the plan for blockers"), "reviewer");
  assert.equal(inferRole("explorer", "코드 검증 부탁"), "reviewer");
  assert.equal(inferRole("explorer", "map the codebase"), "explorer");
  assert.equal(inferRole(undefined, "map the codebase"), "explorer");
});

test("model injection: model-mode role config + no caller model => configured model injected", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the frontend codebase", agent_type: "explorer" }));
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "kiro/claude-opus-4.6");
  assert.match(ui.message as string, /\[\$cxc-dev\]\(/, "mention block still attaches");
});

test("model injection: caller-picked model is NEVER overridden", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "map the frontend codebase", agent_type: "explorer", model: "gpt-5.5" }),
  );
  assert.notEqual(out, "");
  assert.equal(updatedInputOf(out).model, "gpt-5.5");
});

test("model injection: default-mode role => no model key added", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the frontend codebase", agent_type: "explorer" }));
  assert.notEqual(out, "");
  assert.ok(!("model" in updatedInputOf(out)), "default mode must inherit the main model");
});

test("model injection: reviewer keyword routes to the reviewer role config", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, promptOverride: null },
    reviewer: { mode: "model", model: "gpt-5.4-mini", promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "review the backend diff", agent_type: "explorer" }));
  assert.equal(updatedInputOf(out).model, "gpt-5.4-mini");
});

test("model injection: empty mention block still yields a model-only updatedInput", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.3-codex-spark", promptOverride: null },
  });
  // all resolved skills already mentioned -> block is empty; model injection must still fire
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "$cxc-dev only, no surface keywords here", agent_type: "explorer" }),
  );
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "gpt-5.3-codex-spark");
  assert.equal(ui.message, "$cxc-dev only, no surface keywords here", "message untouched when block is empty");
});

test("model injection: items present => mentions skipped but model still injected", () => {
  const cwd = workspaceWithConfig({
    executor: { mode: "model", model: "deepseek/deepseek-v4", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, {
      message: "implement it",
      agent_type: "worker",
      items: [{ type: "text", text: "TASK: implement it" }],
    }),
  );
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "deepseek/deepseek-v4");
  assert.equal(ui.message, "implement it", "no mention block on the items channel");
  assert.ok(Array.isArray(ui.items), "items preserved verbatim");
});

// ── Effort enforcement (subagents.json -> reasoning_effort injection) ──

test("effort injection: configured effort rides even a default-mode (main model) role", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the auth module", agent_type: "explorer" }));
  assert.notEqual(out, "");
  const ui = updatedInputOf(out);
  assert.equal(ui.reasoning_effort, "high");
  assert.ok(!("model" in ui), "default mode still inherits the main model");
});

test("effort injection: caller-picked reasoning_effort is NEVER overridden", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "map the auth module", agent_type: "explorer", reasoning_effort: "low" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.reasoning_effort, "low");
  assert.equal(ui.model, "gpt-5.5", "model injection still applies independently");
});

test("effort injection: model + effort configured => both injected together", () => {
  const cwd = workspaceWithConfig({
    executor: { mode: "model", model: "gpt-5.4-mini", effort: "xhigh", promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "implement the parser", agent_type: "worker" }));
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "gpt-5.4-mini");
  assert.equal(ui.reasoning_effort, "xhigh");
});

test("effort injection: no effort configured => reasoning_effort key absent (inherit)", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", effort: null, promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the auth module", agent_type: "explorer" }));
  const ui = updatedInputOf(out);
  assert.ok(!("reasoning_effort" in ui), "null effort must inherit the parent effort");
});

// ── Full-history fork guard (codex-rs rejects model/effort overrides on full forks) ──

test("isFullHistoryFork: v1 fork_context, v2 fork_turns default/all/none/N", () => {
  assert.equal(isFullHistoryFork({ fork_context: true }), true);
  assert.equal(isFullHistoryFork({ fork_context: false }), false);
  assert.equal(isFullHistoryFork({ message: "x" }), false); // bare v1 fresh spawn
  assert.equal(isFullHistoryFork({ task_name: "t" }), true); // v2 default -> "all"
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "all" }), true);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "  " }), true);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "none" }), false);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "3" }), false);
  // Numeric fork_turns is OFF-SCHEMA (codex types it as Option<String>): already invalid
  // upstream, so we report non-full-fork defensively — injecting cannot worsen a payload
  // codex will reject anyway, and no VALID fork is ever turned into a rejected one.
  assert.equal(isFullHistoryFork({ fork_turns: 3 }), false);
});

test("fork guard: v1 fork_context:true => mentions still attach but NO model/effort injection", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "map the frontend codebase", agent_type: "explorer", fork_context: true }),
  );
  assert.notEqual(out, "", "mention attachment still applies on forks");
  const ui = updatedInputOf(out);
  assert.ok(!("model" in ui), "full fork inherits the parent model — never inject");
  assert.ok(!("reasoning_effort" in ui), "full fork inherits the parent effort — never inject");
});

test("fork guard: v2 default fork (no fork_turns) => no injection; explicit none => injection", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", effort: "high", promptOverride: null },
  });
  const fullFork = runSpawnAttachHook(
    spawnPayloadAt(cwd, { task_name: "t", message: "map the codebase" }),
  );
  if (fullFork !== "") {
    const ui = updatedInputOf(fullFork);
    assert.ok(!("model" in ui) && !("reasoning_effort" in ui), "v2 default full fork must not get overrides");
  }
  const fresh = runSpawnAttachHook(
    spawnPayloadAt(cwd, { task_name: "t", fork_turns: "none", message: "map the codebase" }),
  );
  const ui2 = updatedInputOf(fresh);
  assert.equal(ui2.model, "gpt-5.5");
  assert.equal(ui2.reasoning_effort, "high");
});
