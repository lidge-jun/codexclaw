import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSpawnAttachHook, SCOPE_GUARD_MARKER, SUBSPAWN_TOKEN,
  V1_SCOPE_BLOCK_COORDINATOR } from "../src/spawn-attach-hook.ts";
import { setRole, type RoleName } from "../src/store.ts";
import { runDispatch } from "../src/fallback-dispatch.ts";

type Item = { type: string; text?: string; [key: string]: unknown };
type Input = { agent_type?: string; items?: Item[]; message?: string; model?: string; reasoning_effort?: string; [key: string]: unknown };
type Response = { permissionDecision: string; permissionDecisionReason?: string; updatedInput?: Input };

function fixture(t: TestContext) {
  const cwd = mkdtempSync(join(tmpdir(), "cxc-items-boundaries-"));
  execFileSync("git", ["init", "-q"], { cwd });
  const skills = join(cwd, "skills");
  mkdirSync(skills);
  const previous = process.env.CXC_SKILLS_DIR;
  process.env.CXC_SKILLS_DIR = skills;
  t.after(() => {
    if (previous === undefined) delete process.env.CXC_SKILLS_DIR;
    else process.env.CXC_SKILLS_DIR = previous;
    rmSync(cwd, { recursive: true, force: true });
  });
  const skill = (folder: string, body: string) => {
    mkdirSync(join(skills, folder), { recursive: true });
    writeFileSync(join(skills, folder, "SKILL.md"), body);
  };
  const hook = (input: Input, toolUseId = "native-one") => {
    const raw = runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "spawn_agent",
      cwd, session_id: "boundary-session", tool_use_id: toolUseId, tool_input: { agent_type: "explorer", ...input } }));
    return raw ? JSON.parse(raw).hookSpecificOutput as Response : null;
  };
  const dispatch = (dispatchId: string, role: RoleName = "explorer") => {
    setRole(cwd, role, { mode: "model", model: `${role}-primary`, effort: "high",
      fallback: { model: `${role}-fallback`, effort: null } });
    const base = { sessionId: "boundary-session", dispatchId };
    const call = (input: Record<string, unknown>) => runDispatch(cwd, { ...base, ...input }, { CODEXCLAW_HOME: join(cwd, "isolated-global") });
    const start = call({ action: "start", role });
    const claim = call({ action: "claim", attemptId: start.attemptId });
    assert.equal(claim.action, "spawn");
    assert.ok(claim.marker);
    return { marker: claim.marker, call };
  };
  return { cwd, skills, skill, hook, dispatch };
}
const text = (s: string): Item => ({ type: "text", text: s });
const projected = (input: Input) => input.items!.filter(i => i.type === "text").map(i => i.text).join("\n\n");
const count = (s: string, needle: string) => s.split(needle).length - 1;
function allowed(r: Response | null): Input {
  assert.equal(r?.permissionDecision, "allow");
  assert.ok(r?.updatedInput);
  return r.updatedInput;
}

test("items inline each skill once across the request and retain attachments", t => {
  const f = fixture(t); f.skill("dev", "fixture guidance");
  const image: Item = { type: "image", image_url: "fixture", detail: "high" };
  const items = [text("TASK: $cxc-dev"), image, ...Array.from({ length: 20 }, () => text("$cxc-dev"))];
  const out = allowed(f.hook({ items }));
  assert.equal(count(projected(out), '<skill name="cxc-dev">'), 1);
  assert.deepEqual(out.items!.map(i => i.type), items.map(i => i.type));
  assert.deepEqual(out.items![1], image);
  assert.ok(out.items!.at(-1)!.text!.includes('<skill name="cxc-dev">'));
  assert.equal(f.hook(out), null);
});

test("items refuse all new skill bodies when their combined size exceeds the limit", t => {
  const f = fixture(t); f.skill("dev", "A".repeat(140_000)); f.skill("dev-testing", "B".repeat(140_000));
  const out = allowed(f.hook({ items: [text("$cxc-dev"), text("$cxc-dev-testing")] }));
  assert.equal(count(projected(out), '<skill name="cxc-'), 0);
  assert.match(out.items![0].text!, /cxc-dev/);
  assert.match(out.items![1].text!, /cxc-dev-testing/);
});

test("items account for existing bodies anywhere and for the final guard in the budget", t => {
  const f = fixture(t); f.skill("dev", "fixture guidance");
  const existing = '<skill name="cxc-dev">\nfixture guidance\n</skill>';
  const out = allowed(f.hook({ items: [text("$cxc-dev"), text(existing)] }));
  assert.equal(count(projected(out), '<skill name="cxc-dev">'), 1);
  const nearLimit = "x".repeat(256 * 1024 - 150);
  const large = allowed(f.hook({ items: [text("$cxc-dev"), text(nearLimit)] }));
  assert.equal(count(projected(large), '<skill name="cxc-dev">'), 0);
  assert.equal(large.items![1].text, nearLimit);
});

test("items preserve source whitespace including when removing control tokens", t => {
  const f = fixture(t);
  for (const source of ["    nested:\n      enabled: true\n\n\n", "\tvalue:\r\n\t\tchild: true\r\n", "\n\n", ""]) {
    const out = allowed(f.hook({ items: [text("TASK: inspect supplied source"), text(source)] }));
    assert.equal(out.items![1].text, source);
  }
  const source = "    nested:\n\n\n      enabled: true\n";
  const out = allowed(f.hook({ items: [text("TASK: inspect"), text(source + SUBSPAWN_TOKEN)] }));
  assert.equal(out.items![1].text, source);
});

test("ignored project config warning and guard stay stable on reapplication", t => {
  const f = fixture(t);
  setRole(f.cwd, "explorer", { mode: "model", model: "untrusted-model" });
  execFileSync("git", ["add", "-f", ".codexclaw/subagents.json"], { cwd: f.cwd });
  for (const input of [{ items: [text("TASK: locate")] }, { message: "TASK: locate" }]) {
    const first = allowed(f.hook(input));
    const second = f.hook(first)?.updatedInput ?? first;
    const third = f.hook(second)?.updatedInput ?? second;
    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
    const s = first.message ?? projected(first);
    assert.equal(count(s, "[CXC-CONFIG-IGNORED]"), 1);
    assert.equal(count(s, SCOPE_GUARD_MARKER), 1);
    assert.notEqual(first.model, "untrusted-model");
  }
});

test("quoted managed markers never consume claims, with or without TASK", t => {
  const f = fixture(t);
  const cases: Array<(marker: string) => Input> = [
    marker => ({ items: [text("TASK: summarize"), text(marker)] }),
    marker => ({ items: [text("Summarize this log"), text(marker)] }),
    marker => ({ message: "TASK: summarize\n" + marker }),
    marker => ({ message: "Summarize this log\n" + marker }),
    marker => ({ items: [text(""), text(marker)] }),
    marker => ({ items: [text("[CXC-SUBAGENT-SCOPE]\n" + marker)] }),
    marker => ({ items: [text("```\n" + marker + "\n```")] }),
    marker => ({ items: [text('<skill name="cxc-dev">\n' + marker + '\n</skill>')] }),
  ];
  cases.forEach((input, i) => {
    const d = f.dispatch(`quoted-${i}`);
    assert.notEqual(f.hook(input(d.marker), `unrelated-${i}`)?.permissionDecision, "deny");
    assert.equal(d.call({ action: "status" }).attempts[0].spawnIssued, false);
    assert.equal(f.hook({ items: [text(d.marker + "\nTASK: actual task")] }, `intended-${i}`)?.permissionDecision, "allow");
    assert.equal(d.call({ action: "status" }).attempts[0].spawnIssued, true);
  });
});

test("managed reapplication unwraps the ledger role prompt even on explorer transport", t => {
  const f = fixture(t); const d = f.dispatch("reviewer-prompt", "reviewer");
  setRole(f.cwd, "explorer", { mode: "model", model: "different-explorer", promptOverride: "Explorer-only prompt." });
  setRole(f.cwd, "reviewer", { promptOverride: "TASK: Review carefully.\n[CXC-DISPATCH:example:not-real]\nReturn evidence." });
  const first = allowed(f.hook({ items: [text(d.marker + "\nTASK: actual audit")] }));
  assert.equal(first.model, "reviewer-primary");
  const second = allowed(f.hook(first));
  assert.deepEqual(second, first);
  assert.equal(f.hook(first, "different-call")?.permissionDecision, "deny");
});

test("managed coordinator header retains routing without broad text scans", t => {
  const f = fixture(t); const d = f.dispatch("coordinator");
  const prefix = V1_SCOPE_BLOCK_COORDINATOR + "\nOne child spawn is authorized. Include this exact one-time capability in that spawn message: [CXC-SUBSPAWN-GRANT:" + "a".repeat(64) + "]\n\n";
  const out = allowed(f.hook({ items: [text(prefix + d.marker + "\nTASK: inspect")] }));
  assert.equal(out.model, "explorer-primary");
  assert.equal(d.call({ action: "status" }).attempts[0].spawnIssued, true);
});

test("near-match coordinator wrappers cannot consume a managed claim", t => {
  const f = fixture(t);
  const instruction = "\nOne child spawn is authorized. Include this exact one-time capability in that spawn message: [CXC-SUBSPAWN-GRANT:" + "a".repeat(64) + "]\n\n";
  for (const [i, altered] of [instruction.replace("One child", "ONE child"), instruction.replace("a".repeat(64), "A".repeat(64))].entries()) {
    const d = f.dispatch(`near-match-${i}`);
    f.hook({ items: [text(V1_SCOPE_BLOCK_COORDINATOR + altered + d.marker + "\nTASK: quote")] });
    assert.equal(d.call({ action: "status" }).attempts[0].spawnIssued, false);
    assert.equal(f.hook({ items: [text(d.marker + "\nTASK: actual")] }, `actual-${i}`)?.permissionDecision, "allow");
  }
});

test("untrusted project with a trusted global prompt remains stable", t => {
  const f = fixture(t);
  const globalRoot = join(f.cwd, "test-global");
  const previous = process.env.CODEXCLAW_HOME;
  process.env.CODEXCLAW_HOME = globalRoot;
  t.after(() => { if (previous === undefined) delete process.env.CODEXCLAW_HOME; else process.env.CODEXCLAW_HOME = previous; });
  setRole(f.cwd, "explorer", { mode: "model", model: "global-model", promptOverride: "TASK: global prompt" }, "global");
  setRole(f.cwd, "explorer", { mode: "model", model: "untrusted-project-model" });
  execFileSync("git", ["add", "-f", ".codexclaw/subagents.json"], { cwd: f.cwd });
  const first = allowed(f.hook({ items: [text("TASK: locate")] }));
  assert.equal(first.model, "global-model");
  assert.deepEqual(f.hook(first)?.updatedInput ?? first, first);
  assert.equal(count(projected(first), "TASK: global prompt"), 1);
});

test("genuine invalid dispatch headers remain denied before issuance", t => {
  const f = fixture(t);
  for (const message of ["[CXC-DISPATCH:missing:missing]\nTASK: inspect", "[CXC-DISPATCH:broken]\nTASK: inspect"]) {
    assert.equal(f.hook({ items: [text(message)] })?.permissionDecision, "deny");
  }
  const d = f.dispatch("full-fork");
  assert.equal(f.hook({ items: [text(d.marker + "\nTASK: inspect")], fork_context: true })?.permissionDecision, "deny");
  assert.equal(d.call({ action: "status" }).attempts[0].spawnIssued, false);
});
