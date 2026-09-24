import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALIAS_MAP_DATE, MODEL_ALIASES, renderDispatchCard, resolveDispatchAlias } from "../src/dispatch-card.ts";

function catalogEnv(models: unknown[]): NodeJS.ProcessEnv {
  const path = join(mkdtempSync(join(tmpdir(), "cxc-dispatch-card-")), "models.json");
  writeFileSync(path, JSON.stringify({ models }));
  return { CODEX_MODELS_CACHE_PATH: path };
}

test("V1 card uses exact nested helper and dated aliases", () => {
  const env = { ...catalogEnv(Object.values(MODEL_ALIASES)), CODEXCLAW_SPAWN_V1: "1" };
  const card = renderDispatchCard(env);
  assert.match(card, /^\[codexclaw\] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 \(override, not host evidence\)\./);
  assert.match(card, /await tools\.multi_agent_v1__spawn_agent\(/);
  assert.doesNotMatch(card, /ALL_TOOLS/);
  assert.match(card, new RegExp(`Aliases \\(map ${ALIAS_MAP_DATE}`));
  for (const [alias, id] of Object.entries(MODEL_ALIASES)) {
    assert.ok(card.includes(`${alias} -> ${id} (verified in local catalog)`), alias);
  }
});

test("unresolved card resolves and calls in one cell", async () => {
  const card = renderDispatchCard(catalogEnv(Object.values(MODEL_ALIASES)));
  const cell = card.split("First Code Mode cell (resolves and calls):\n", 2)[1]?.split("\nAliases (", 1)[0];
  assert.ok(cell);
  const execute = new Function("ALL_TOOLS", "tools", "text", `return (async () => { ${cell} })();`);
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

test("alias catalog membership and full ID passthrough", () => {
  const env = catalogEnv([{ id: MODEL_ALIASES.deepseek }, { id: MODEL_ALIASES.swe2, disabled: true }, { id: MODEL_ALIASES.kimi, visibility: "hide" }]);
  assert.deepEqual(resolveDispatchAlias("deepseek", env), { id: MODEL_ALIASES.deepseek, verified: true, mapDate: ALIAS_MAP_DATE });
  assert.equal(resolveDispatchAlias("swe2", env).verified, false);
  assert.equal(resolveDispatchAlias("kimi", env).verified, false);
  assert.deepEqual(resolveDispatchAlias("provider/explicit", env), { id: "provider/explicit", verified: false, mapDate: ALIAS_MAP_DATE });
  assert.equal(resolveDispatchAlias("gpt-6-sol", env).id, "gpt-6-sol");
  assert.ok(renderDispatchCard(env).includes(`swe2 -> ${MODEL_ALIASES.swe2} (unverified, map ${ALIAS_MAP_DATE})`));
  const missing = { CODEX_MODELS_CACHE_PATH: join(mkdtempSync(join(tmpdir(), "cxc-dispatch-missing-")), "absent.json") };
  assert.equal(resolveDispatchAlias("deepseek", missing).verified, false);
});

test("cards stay under 1200 characters", () => {
  const env = catalogEnv(Object.values(MODEL_ALIASES));
  assert.ok(renderDispatchCard(env).length <= 1200);
  assert.ok(renderDispatchCard({ ...env, CODEXCLAW_SPAWN_V1: "1" }).length <= 1200);
});
