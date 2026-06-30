/**
 * spawn-wrapper.test.ts — L9.1 production spawn payload builder.
 *
 * Proves the wrapper consumes resolveSpawnConfig at spawn time: model override
 * applied, default inherits (no model key), promptOverride replaces TOML body,
 * agent_type mapping, real TOML parse, and total/fail-safe behavior.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { setRole } from "../src/store.ts";
import {
  ROLE_AGENT_TYPE,
  parseRoleToml,
  readRoleToml,
  buildSpawnPayload,
  resolveSpawnPayload,
  resolveAttachedSkillFolders,
  buildSpawnItems,
  skillItem,
  resolveSpawnPayloadWithSkills,
  SURFACE_SKILL,
} from "../src/spawn-wrapper.ts";
import { resolveSpawnConfig } from "../src/store.ts";

const here = dirname(fileURLToPath(import.meta.url));
// Real shipped role TOMLs: plugins/codexclaw/agents/*.toml.
const AGENTS_DIR = resolve(here, "..", "..", "..", "agents");
const SKILLS_DIR = resolve(here, "..", "..", "..", "skills");

function tmp() {
  return mkdtempSync(join(tmpdir(), "cxc-spawn-"));
}

test("agent_type mapping: explorer/reviewer -> explorer, executor -> worker", () => {
  assert.equal(ROLE_AGENT_TYPE.explorer, "explorer");
  assert.equal(ROLE_AGENT_TYPE.reviewer, "explorer");
  assert.equal(ROLE_AGENT_TYPE.executor, "worker");
});

test("parseRoleToml reads model sentinel + triple-quoted developer_instructions", () => {
  const text = [
    'name = "x"',
    'model = "default"   # comment',
    'developer_instructions = """',
    "Role: tester.",
    "Body line with `backtick` and ## marker.",
    '"""',
  ].join("\n");
  const f = parseRoleToml(text);
  assert.equal(f.model, "default");
  assert.match(f.developerInstructions, /Role: tester\./);
  assert.match(f.developerInstructions, /backtick/);
  assert.ok(!f.developerInstructions.includes('"""'));
});

test("readRoleToml reads a real shipped role TOML body", () => {
  const f = readRoleToml(AGENTS_DIR, "explorer");
  assert.match(f.developerInstructions, /read-only codebase explorer/i);
});

test("readRoleToml on a missing file returns safe defaults (never throws)", () => {
  const f = readRoleToml(tmp(), "explorer");
  assert.equal(f.model, null);
  assert.equal(f.developerInstructions, "");
});

test("buildSpawnPayload: model override is applied for a model-mode resolution", () => {
  const payload = buildSpawnPayload({
    role: "reviewer",
    task: "review the diff",
    resolution: { role: "reviewer", model: "grok-4", usesMainModel: false, promptOverride: null },
    developerInstructions: "Role: reviewer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.equal(payload.model, "grok-4");
  assert.match(payload.message, /Role: reviewer\./);
  assert.match(payload.message, /TASK: review the diff/);
});

test("buildSpawnPayload: default mode OMITS the model key (inherit main model)", () => {
  const payload = buildSpawnPayload({
    role: "explorer",
    task: "find X",
    resolution: { role: "explorer", model: null, usesMainModel: true, promptOverride: null },
    developerInstructions: "Role: explorer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.ok(!("model" in payload), "default mode must not set a model key");
});

test("buildSpawnPayload: promptOverride REPLACES the TOML developer_instructions", () => {
  const payload = buildSpawnPayload({
    role: "executor",
    task: "apply patch",
    resolution: { role: "executor", model: null, usesMainModel: true, promptOverride: "CUSTOM PROMPT" },
    developerInstructions: "Role: executor (TOML body).",
  });
  assert.equal(payload.agent_type, "worker");
  assert.match(payload.message, /CUSTOM PROMPT/);
  assert.ok(!payload.message.includes("TOML body"), "override must replace the TOML body");
});

test("buildSpawnPayload: empty prompt + empty task still yields a TASK: message", () => {
  const payload = buildSpawnPayload({
    role: "explorer",
    task: "",
    resolution: { role: "explorer", model: null, usesMainModel: true, promptOverride: null },
    developerInstructions: "",
  });
  assert.equal(payload.message, "TASK: ");
});

test("resolveSpawnPayload: end-to-end uses persisted store config + real TOML", () => {
  const cwd = tmp();
  // configure a model for reviewer in the store
  setRole(cwd, "reviewer", { mode: "model", model: "model-reviewer" });
  const payload = resolveSpawnPayload(cwd, "reviewer", "audit this", AGENTS_DIR);
  assert.equal(payload.agent_type, "explorer");
  assert.equal(payload.model, "model-reviewer");
  assert.match(payload.message, /adversarial reviewer/i); // from the real reviewer.toml
  assert.match(payload.message, /TASK: audit this/);

  // default role omits model and inherits the main model
  const def = resolveSpawnPayload(cwd, "explorer", "find Y", AGENTS_DIR);
  assert.ok(!("model" in def));
  assert.equal(resolveSpawnConfig(cwd, "explorer").usesMainModel, true);
});

// ---- L15: skill-routing attachment (items channel) ----

test("L15: resolveAttachedSkillFolders prepends role base, adds surfaces, dedups", () => {
  // explorer base = [dev]; architecture surface -> dev-architecture
  const a = resolveAttachedSkillFolders("explorer", ["architecture"]);
  assert.deepEqual(a, ["dev", "dev-architecture"]);

  // reviewer base = [dev, dev-code-reviewer]; security surface adds dev-security;
  // code-review surface maps to dev-code-reviewer which is already present -> dedup
  const r = resolveAttachedSkillFolders("reviewer", ["security", "code-review"]);
  assert.deepEqual(r, ["dev", "dev-code-reviewer", "dev-security"]);
});

test("L15: explicit skill folder wins even with no matching surface (e.g. search)", () => {
  const f = resolveAttachedSkillFolders("explorer", [], ["search"]);
  assert.deepEqual(f, ["dev", "search"]);
});

test("L15: SURFACE_SKILL maps every surface to an on-disk skill folder", () => {
  for (const folder of Object.values(SURFACE_SKILL)) {
    const it = skillItem(SKILLS_DIR, folder);
    assert.equal(it.type, "skill");
    assert.equal(it.name, `cxc-${folder}`);
    assert.match(it.path, new RegExp(`/skills/${folder}/SKILL\\.md$`));
  }
});

test("L15: buildSpawnItems emits skill items (existing only) + trailing task text", () => {
  const items = buildSpawnItems({
    role: "explorer",
    task: "investigate the FSM",
    skillsDir: SKILLS_DIR,
    surfaces: ["architecture"],
  });
  // first items are skills, last is the task text
  const skills = items.filter((i) => i.type === "skill");
  const texts = items.filter((i) => i.type === "text");
  assert.ok(skills.some((s) => s.name === "cxc-dev"));
  assert.ok(skills.some((s) => s.name === "cxc-dev-architecture"));
  assert.equal(texts.length, 1);
  assert.equal(texts[0].text, "TASK: investigate the FSM");
  // every attached skill path must exist on disk (buildSpawnItems filters dangling)
  for (const s of skills) {
    assert.equal(s.type, "skill");
  }
});

test("L15: buildSpawnItems drops a dangling explicit folder that has no SKILL.md", () => {
  const items = buildSpawnItems({
    role: "explorer",
    task: "x",
    skillsDir: SKILLS_DIR,
    explicitSkillFolders: ["this-skill-does-not-exist"],
  });
  assert.ok(!items.some((i) => i.type === "skill" && i.name === "cxc-this-skill-does-not-exist"));
  // dev base still attaches; task text present
  assert.ok(items.some((i) => i.type === "skill" && i.name === "cxc-dev"));
  assert.equal(items.at(-1)?.type, "text");
});

test("L15: resolveSpawnPayloadWithSkills keeps role prompt in message + attaches items", () => {
  const cwd = tmp();
  const payload = resolveSpawnPayloadWithSkills({
    cwd,
    role: "explorer",
    task: "find the goal gate",
    agentsDir: AGENTS_DIR,
    skillsDir: SKILLS_DIR,
    surfaces: ["debugging"],
  });
  // role prompt still in message (single source, not duplicated into items)
  assert.match(payload.message, /TASK: find the goal gate/);
  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.some((i) => i.type === "skill" && i.name === "cxc-dev-debugging"));
  // the task text rides in items too (as the trailing text item)
  assert.equal(payload.items.at(-1)?.type, "text");
});

test("020: INTENT_ROLE maps each intent to a base role (no new roles)", async () => {
  const { INTENT_ROLE } = await import("../src/spawn-wrapper.ts");
  assert.equal(INTENT_ROLE["red-team"], "reviewer");
  assert.equal(INTENT_ROLE.review, "reviewer");
  assert.equal(INTENT_ROLE.implement, "executor");
  assert.equal(INTENT_ROLE.debug, "executor");
  assert.equal(INTENT_ROLE.investigate, "explorer");
  assert.equal(INTENT_ROLE.research, "explorer");
});

test("020: routeDispatch('red-team', frontend) -> reviewer + dev/code-reviewer/frontend skills", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const { role, items } = routeDispatch({
    intent: "red-team",
    surfaces: ["frontend"],
    task: "red-team this diff",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(role, "reviewer");
  const names = items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(names.includes("cxc-dev"));
  assert.ok(names.includes("cxc-dev-code-reviewer"));
  assert.ok(names.includes("cxc-dev-frontend"));
  assert.equal(items.at(-1)?.type, "text");
  assert.match(items.at(-1)?.text ?? "", /TASK: red-team this diff/);
});

test("020: routeDispatch('research') -> explorer + explicit skill honored", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const { role, items } = routeDispatch({
    intent: "research",
    explicitSkillFolders: ["search"],
    task: "investigate X",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(role, "explorer");
  const names = items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(names.includes("cxc-search"));
});

test("070: routeDispatch('research') auto-attaches cxc-search + cxc-ultraresearch (no explicit needed)", async () => {
  const { routeDispatch, INTENT_EXTRA_SKILL_FOLDERS } = await import("../src/spawn-wrapper.ts");
  assert.deepEqual(INTENT_EXTRA_SKILL_FOLDERS.research, ["search", "ultraresearch"]);
  const { role, items } = routeDispatch({
    intent: "research",
    task: "survey the landscape",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(role, "explorer");
  const names = items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(names.includes("cxc-search"), "research auto-attaches cxc-search");
  assert.ok(names.includes("cxc-ultraresearch"), "research auto-attaches cxc-ultraresearch");
  assert.ok(names.includes("cxc-dev"), "explorer base dev skill still present");
});

test("070: non-research intents do NOT auto-attach ultraresearch", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const { items } = routeDispatch({ intent: "review", task: "review the diff", skillsDir: SKILLS_DIR });
  const names = items.filter((i) => i.type === "skill").map((i) => i.name);
  assert.ok(!names.includes("cxc-ultraresearch"), "review must not attach ultraresearch");
});

test("080.2: buildPathHints resolves existing repo tokens + flags none-existent", async () => {
  const { buildPathHints } = await import("../src/spawn-wrapper.ts");
  const repo = resolve(here, "..", "..", "..", "..", ".."); // codexclaw repo root
  const hints = buildPathHints(repo, "please read package.json and plugins/codexclaw and ghost-nope.xyz");
  const tokens = hints.map((h) => h.token);
  assert.ok(tokens.includes("package.json"), "existing file token resolved");
  assert.ok(tokens.includes("plugins/codexclaw"), "existing dir token resolved");
  assert.ok(!tokens.includes("ghost-nope.xyz"), "non-existent token dropped");
  for (const h of hints) assert.equal(h.outsideRepo, false, "in-repo paths not flagged");
});

test("080.2: path-hint item is opt-in (cwd) and placed before the trailing TASK", async () => {
  const { buildSpawnItems } = await import("../src/spawn-wrapper.ts");
  const repo = resolve(here, "..", "..", "..", "..", "..");
  // no cwd => exactly one text item (the task), back-compat
  const noHint = buildSpawnItems({ role: "explorer", task: "touch package.json", skillsDir: SKILLS_DIR });
  assert.equal(noHint.filter((i) => i.type === "text").length, 1);
  // with cwd => a path-hint text item precedes the TASK text item
  const withHint = buildSpawnItems({ role: "explorer", task: "touch package.json", skillsDir: SKILLS_DIR, cwd: repo });
  const texts = withHint.filter((i) => i.type === "text");
  assert.equal(texts.length, 2, "path-hint + task");
  assert.match(texts[0].text, /Resolved paths:/);
  assert.match(texts.at(-1).text, /^TASK:/);
});
