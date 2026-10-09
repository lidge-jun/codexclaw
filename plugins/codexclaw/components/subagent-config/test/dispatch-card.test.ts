import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALIAS_MAP_DATE, DISPATCH_CARD_MAX, DISPATCH_OWNER, MODEL_ALIASES, RESOLVER_CELL, renderDispatchCard, resolveDispatchAlias } from "../src/dispatch-card.ts";

function catalogEnv(models: unknown[]): NodeJS.ProcessEnv {
  const path = join(mkdtempSync(join(tmpdir(), "cxc-dispatch-card-")), "models.json");
  writeFileSync(path, JSON.stringify({ models }));
  return { CODEX_MODELS_CACHE_PATH: path };
}

test("V1 card names the exact nested helper, the owner and dated aliases", () => {
  const env = { ...catalogEnv(Object.values(MODEL_ALIASES)), CODEXCLAW_SPAWN_V1: "1" };
  const card = renderDispatchCard(env);
  assert.match(card, /^\[codexclaw\] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 \(override, not host evidence\)\./);
  assert.match(card, /tools\.multi_agent_v1__spawn_agent/);
  assert.doesNotMatch(card, /ALL_TOOLS/);
  assert.ok(card.includes(DISPATCH_OWNER));
  assert.match(card, new RegExp("Aliases \\(map " + ALIAS_MAP_DATE));
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) assert.ok(card.includes(alias + "=" + id), alias);
});

test("unresolved card points at the resolver instead of carrying it", () => {
  const card = renderDispatchCard(catalogEnv(Object.values(MODEL_ALIASES)));
  assert.match(card, /family unresolved at SessionStart/);
  assert.ok(card.includes(DISPATCH_OWNER));
  assert.match(card, /managed fallback first/);
  assert.doesNotMatch(card, /ALL_TOOLS|spawn_agent\$/);
});

test("the resolver cell resolves the family and calls once", async () => {
  const execute = new Function("ALL_TOOLS", "tools", "text", "return (async () => { " + RESOLVER_CELL + " })();");
  const families: Record<string, string[]> = {
    multi_agent_v1__spawn_agent: ["multi_agent_v1__send_input", "multi_agent_v1__close_agent"],
    collaboration_spawn_agent: ["collaboration_followup_task", "collaboration_send_message"],
    spawn_agent: ["followup_task", "interrupt_agent"],
  };
  for (const [name, companions] of Object.entries(families)) {
    const calls: unknown[] = [];
    const tools = { [name]: async (args: unknown) => { calls.push(args); return { ok: true }; } };
    const output: unknown[] = [];
    await execute([{ name }, ...companions.map((c) => ({ name: c }))], tools, (value: unknown) => output.push(value));
    assert.equal(calls.length, 1);
    assert.deepEqual(output, [{ ok: true }]);
    const args = calls[0] as Record<string, unknown>;
    assert.equal(args.model, MODEL_ALIASES.deepseek);
    assert.equal(args.reasoning_effort, "low");
    assert.equal(typeof args.message, "string");
    const v2 = name !== "multi_agent_v1__spawn_agent";
    assert.equal("task_name" in args, v2);
    // A V2 spawn without fork_turns is a full-history fork, which rejects model overrides.
    assert.equal(args.fork_turns, v2 ? "none" : undefined);
  }
  for (const names of [[], [{ name: "multi_agent_v1__spawn_agent" }, { name: "collaboration_spawn_agent" }]]) {
    const calls: unknown[] = [];
    await assert.rejects(execute(names, { multi_agent_v1__spawn_agent: () => calls.push(1) }, () => {}), /expected one spawn_agent helper/);
    assert.equal(calls.length, 0);
  }
  await assert.rejects(execute([{ name: "other_spawn_agent" }], {}, () => {}), /collab family unresolved/);
  await assert.rejects(execute([{ name: "spawn_agent" }, { name: "send_input" }, { name: "followup_task" }], {}, () => {}), /collab family unresolved/);
});

test("delegation.md carries the resolver cell verbatim under the card's anchor", () => {
  const doc = readFileSync(fileURLToPath(new URL("../../../skills/pabcd/references/delegation.md", import.meta.url)), "utf8");
  assert.match(doc, /^#{2,4} SessionStart dispatch card$/m);
  assert.ok(doc.includes(RESOLVER_CELL), "delegation.md must contain RESOLVER_CELL exactly");
});

test("alias catalog membership and full ID passthrough", () => {
  const env = catalogEnv([{ id: MODEL_ALIASES.deepseek }, { id: MODEL_ALIASES.swe2, disabled: true }, { id: MODEL_ALIASES.kimi, visibility: "hide" }]);
  assert.deepEqual(resolveDispatchAlias("deepseek", env), { id: MODEL_ALIASES.deepseek, verified: true, mapDate: ALIAS_MAP_DATE });
  assert.equal(resolveDispatchAlias("swe2", env).verified, false);
  assert.equal(resolveDispatchAlias("kimi", env).verified, false);
  assert.deepEqual(resolveDispatchAlias("provider/explicit", env), { id: "provider/explicit", verified: false, mapDate: ALIAS_MAP_DATE });
  assert.equal(resolveDispatchAlias("gpt-6-sol", env).id, "gpt-6-sol");
  assert.ok(renderDispatchCard(env).includes("swe2=" + MODEL_ALIASES.swe2 + "?"));
  const missing = { CODEX_MODELS_CACHE_PATH: join(mkdtempSync(join(tmpdir(), "cxc-dispatch-missing-")), "absent.json") };
  assert.equal(resolveDispatchAlias("deepseek", missing).verified, false);
});

test("cards stay under the cap", () => {
  const env = catalogEnv(Object.values(MODEL_ALIASES));
  assert.ok(renderDispatchCard(env).length <= DISPATCH_CARD_MAX);
  assert.ok(renderDispatchCard({ ...env, CODEXCLAW_SPAWN_V1: "1" }).length <= DISPATCH_CARD_MAX);
});
