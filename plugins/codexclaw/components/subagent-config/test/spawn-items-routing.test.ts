/**
 * spawn-items-routing.test.ts — regression coverage for the native v1 items path.
 *
 * `items` and `message` are mutually exclusive native input forms. The hook must
 * route and guard a valid items-only spawn without collapsing its attachments into
 * a synthetic message.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SCOPE_GUARD_MARKER,
  runSpawnAttachHook,
} from "../src/spawn-attach-hook.ts";

type Item = Record<string, unknown>;

function workspaceWithConfig(roles: Record<string, unknown>): string {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-items-routing-"));
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "subagents.json"), JSON.stringify({ roles }));
  return cwd;
}

function itemsPayload(cwd: string, toolInput: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd,
    session_id: "items-root-session",
    ...extra,
    tool_input: toolInput,
  });
}

function allowedInput(output: string): Record<string, unknown> {
  const parsed = JSON.parse(output) as { hookSpecificOutput?: { permissionDecision?: string; updatedInput?: Record<string, unknown> } };
  assert.equal(parsed.hookSpecificOutput?.permissionDecision, "allow");
  assert.ok(parsed.hookSpecificOutput?.updatedInput);
  return parsed.hookSpecificOutput.updatedInput!;
}

function textItems(items: Item[]): Array<Item & { type: "text"; text: string }> {
  return items.filter((item): item is Item & { type: "text"; text: string } => item.type === "text" && typeof item.text === "string");
}

test("items-only spawn routes the CXC-ROLE packet while preserving native attachments and one-of input", (t) => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "explorer-configured", effort: "high", promptOverride: null },
    reviewer: { mode: "model", model: "reviewer-configured", effort: "low", promptOverride: null },
  });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

  const skill: Item = { type: "skill", name: "cxc-dev", path: "/fixture/skills/dev/SKILL.md" };
  const image: Item = { type: "image", image_url: "data:image/png;base64,QUJD" };
  const packet: Item = { type: "text", text: "CXC-ROLE: explorer\n\nTASK: map the owner for $cxc-dev" };
  const quotedTask: Item = { type: "text", text: "Quoted task after an attachment:\nCXC-ROLE: reviewer\nTASK: review this quote only" };
  const inputItems = [skill, packet, image, quotedTask];

  const updated = allowedInput(runSpawnAttachHook(itemsPayload(cwd, {
    agent_type: "explorer",
    items: inputItems,
  })));

  assert.ok(!("message" in updated), "items and message remain native one-of fields");
  assert.equal(updated.model, "explorer-configured", "configured explorer model reaches the items spawn");
  assert.equal(updated.reasoning_effort, "high", "configured explorer effort reaches the items spawn");
  assert.ok(Array.isArray(updated.items));
  const outputItems = updated.items as Item[];
  assert.deepEqual(outputItems.map(item => item.type), inputItems.map(item => item.type), "attachment positions relative to text are retained");
  assert.deepEqual(
    outputItems.filter((item) => item.type !== "text"),
    [skill, image],
    "all non-text attachments survive unchanged and in order",
  );
  assert.ok(
    textItems(outputItems).some((item) => item.text.includes(SCOPE_GUARD_MARKER)),
    "items-only spawn receives the v1 scope guard",
  );
  assert.ok(
    textItems(outputItems).some((item) => item.text.includes("CXC-ROLE: explorer") && item.text.includes("[$cxc-dev](skill://")),
    "normalization stays inside its text item",
  );
  assert.ok(
    textItems(outputItems).some((item) => item.text.includes(quotedTask.text as string)),
    "a later text item remains a quote rather than becoming a routing header",
  );
  assert.equal(runSpawnAttachHook(itemsPayload(cwd, updated)), "", "normalized skill text is not re-expanded");
});

test("items-only spawn preserves explicit caller routing and full-history restrictions", (t) => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "configured-model", effort: "high", promptOverride: null },
  });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const items: Item[] = [{ type: "text", text: "CXC-ROLE: explorer\n\nTASK: inspect the route" }];

  const explicit = allowedInput(runSpawnAttachHook(itemsPayload(cwd, {
    agent_type: "explorer",
    model: "caller-model",
    reasoning_effort: "low",
    items,
  })));
  assert.ok(!("message" in explicit));
  assert.equal(explicit.model, "caller-model");
  assert.equal(explicit.reasoning_effort, "low");

  const fullHistory = allowedInput(runSpawnAttachHook(itemsPayload(cwd, {
    agent_type: "explorer",
    fork_context: true,
    items,
  })));
  assert.ok(!("message" in fullHistory));
  assert.ok(!("model" in fullHistory), "full-history v1 fork cannot receive a model override");
  assert.ok(!("reasoning_effort" in fullHistory), "full-history v1 fork cannot receive an effort override");
  assert.ok(textItems(fullHistory.items as Item[]).some((item) => item.text.includes(SCOPE_GUARD_MARKER)));
});

test("attachment-only items receive routing and a guard without losing attachments, then become idempotent", (t) => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "attachment-model", effort: "medium", promptOverride: null },
  });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const attachments: Item[] = [
    { type: "skill", name: "cxc-dev-testing", path: "/fixture/skills/dev-testing/SKILL.md" },
    { type: "image", image_url: "data:image/png;base64,REVG" },
  ];
  const first = allowedInput(runSpawnAttachHook(itemsPayload(cwd, {
    agent_type: "explorer",
    items: attachments,
  })));

  assert.ok(!("message" in first));
  assert.equal(first.model, "attachment-model");
  assert.equal(first.reasoning_effort, "medium");
  assert.deepEqual((first.items as Item[]).filter((item) => item.type !== "text"), attachments);
  assert.ok(textItems(first.items as Item[]).some((item) => item.text.includes(SCOPE_GUARD_MARKER)));
  assert.equal(
    runSpawnAttachHook(itemsPayload(cwd, first)),
    "",
    "re-delivery does not duplicate the guard or mutate a routed items packet",
  );
});

test("items-only recursive spawn remains denied before attachment handling", (t) => {
  const cwd = workspaceWithConfig({ explorer: { mode: "default", model: null, promptOverride: null } });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));

  const output = runSpawnAttachHook(itemsPayload(cwd, {
    agent_type: "explorer",
    items: [{ type: "image", image_url: "data:image/png;base64,R0hJ" }],
  }, { agent_id: "child-thread", agent_type: "explorer" }));
  const parsed = JSON.parse(output) as { hookSpecificOutput?: { permissionDecision?: string } };
  assert.equal(parsed.hookSpecificOutput?.permissionDecision, "deny");
});

test("items boundaries keep fences and marker fragments separate", (t) => {
  const cwd = workspaceWithConfig({ explorer: { mode: "model", model: "boundary-model", effort: "low", promptOverride: null } });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const items = [{ type: "text", text: "TASK: inspect\n```\n$cxc-dev" },
    { type: "image", image_url: "fixture" }, { type: "text", text: "$cxc-dev" },
    { type: "text", text: "[CXC-DIS" }, { type: "text", text: "PATCH:missing:missing]" }];
  const updated = allowedInput(runSpawnAttachHook(itemsPayload(cwd, { agent_type: "explorer", items })));
  const texts = textItems(updated.items as Item[]);
  // Existing skill inlining may append a body; the fenced original stays literal.
  assert.ok(texts[0].text.includes("```\n$cxc-dev"));
  assert.ok(!texts[0].text.includes("```\n[$cxc-dev]"));
  assert.match(texts[1].text, /\[\$cxc-dev\]\(skill:\/\//);
  assert.equal(updated.model, "boundary-model");
});

test("items prompt override applies once and malformed items are left to native validation", (t) => {
  const cwd = workspaceWithConfig({ explorer: { mode: "model", model: "prompt-model", effort: "medium", promptOverride: "Keep discovery bounded." } });
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const items of [[{ type: "image", image_url: "fixture" }], [{ type: "text", text: "TASK: locate" }]]) {
    const first = allowedInput(runSpawnAttachHook(itemsPayload(cwd, { agent_type: "explorer", items })));
    assert.equal(runSpawnAttachHook(itemsPayload(cwd, first)), "");
    assert.ok(textItems(first.items as Item[]).some(item => item.text.includes("Keep discovery bounded.")));
  }
  for (const items of [[], [null], [{ type: "text", text: 42 }], "invalid"]) {
    assert.equal(runSpawnAttachHook(itemsPayload(cwd, { agent_type: "explorer", items })), "");
  }
});
