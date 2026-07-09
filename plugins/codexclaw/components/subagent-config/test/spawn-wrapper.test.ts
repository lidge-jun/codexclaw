/**
 * spawn-wrapper.test.ts — L9.1 production spawn payload builder.
 *
 * Proves the wrapper builds v2-compatible spawn payloads, prepends explicit skill
 * mention blocks, and leaves model routing to the v1 hook path. It also covers role
 * prompts, agent_type mapping, real TOML parsing, and pure routing helpers.
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

test("buildSpawnPayload: model-mode resolution does not emit a v2 model override", () => {
  const payload = buildSpawnPayload({
    role: "reviewer",
    task: "review the diff",
    resolution: { role: "reviewer", model: "grok-4", usesMainModel: false, effort: null, promptOverride: null },
    developerInstructions: "Role: reviewer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.ok(!("model" in payload), "v2 builder leaves model routing to the v1 hook path");
  assert.match(payload.message, /Role: reviewer\./);
  assert.match(payload.message, /TASK: review the diff/);
});

test("buildSpawnPayload: default mode OMITS the model key (inherit main model)", () => {
  const payload = buildSpawnPayload({
    role: "explorer",
    task: "find X",
    resolution: { role: "explorer", model: null, usesMainModel: true, effort: null, promptOverride: null },
    developerInstructions: "Role: explorer.",
  });
  assert.equal(payload.agent_type, "explorer");
  assert.ok(!("model" in payload), "default mode must not set a model key");
});

test("buildSpawnPayload: effort override is not emitted by the v2 builder", () => {
  const withEffort = buildSpawnPayload({
    role: "explorer",
    task: "find X",
    resolution: { role: "explorer", model: null, usesMainModel: true, effort: "high", promptOverride: null },
    developerInstructions: "Role: explorer.",
  });
  assert.ok(!("reasoning_effort" in withEffort));
  assert.ok(!("model" in withEffort));

  const withBoth = buildSpawnPayload({
    role: "executor",
    task: "build X",
    resolution: { role: "executor", model: "gpt-5.4-mini", usesMainModel: false, effort: "xhigh", promptOverride: null },
    developerInstructions: "Role: executor.",
  });
  assert.ok(!("model" in withBoth));
  assert.ok(!("reasoning_effort" in withBoth));
});

test("buildSpawnPayload: promptOverride REPLACES the TOML developer_instructions", () => {
  const payload = buildSpawnPayload({
    role: "executor",
    task: "apply patch",
    resolution: { role: "executor", model: null, usesMainModel: true, effort: null, promptOverride: "CUSTOM PROMPT" },
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
    resolution: { role: "explorer", model: null, usesMainModel: true, effort: null, promptOverride: null },
    developerInstructions: "",
  });
  assert.equal(payload.message, "TASK: ");
});

test("resolveSpawnPayload: end-to-end uses persisted store config + real TOML", () => {
  const cwd = tmp();
  // configure a model for reviewer in the store; v2 payloads still omit it.
  setRole(cwd, "reviewer", { mode: "model", model: "model-reviewer" });
  const payload = resolveSpawnPayload(cwd, "reviewer", "audit this", AGENTS_DIR);
  assert.equal(payload.agent_type, "explorer");
  assert.ok(!("model" in payload));
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

  // reviewer base = [dev, dev-code-reviewer, search]; security surface adds dev-security;
  // code-review surface maps to dev-code-reviewer which is already present -> dedup
  const r = resolveAttachedSkillFolders("reviewer", ["security", "code-review"]);
  assert.deepEqual(r, ["dev", "dev-code-reviewer", "search", "dev-security"]);
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

test("L15/dev2: resolveSpawnPayloadWithSkills prepends role and surface skill mentions", () => {
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
  assert.ok(!("items" in payload), "v2-legal payload must not carry items");
  assert.match(payload.message, /^Load and follow/);
  assert.match(payload.message, /\[\$cxc-dev\]\(skill:\/\//);
  assert.match(payload.message, /\[\$cxc-dev-debugging\]\(skill:\/\//);
  // v2 required fields
  assert.equal(payload.fork_turns, "none");
  assert.match(payload.task_name, /^explorer_[a-z0-9_]+$/);
});

// ---- WP1: mention channel (message-borne skill attachment, v1+v2 portable) ----

test("WP1: skillMention renders link form for a link-safe path", async () => {
  const { skillMention } = await import("../src/spawn-wrapper.ts");
  const m = skillMention(SKILLS_DIR, "dev");
  assert.equal(m, `[$cxc-dev](skill://${join(SKILLS_DIR, "dev", "SKILL.md")})`);
});

test("WP1: skillMention uses the plugin-prefixed name when the path is not link-safe", async () => {
  const { skillMention } = await import("../src/spawn-wrapper.ts");
  assert.equal(skillMention("/tmp/with space", "dev"), "$codexclaw:cxc-dev");
  assert.equal(skillMention("/tmp/with(paren)", "dev"), "$codexclaw:cxc-dev");
});

test("WP1: buildSkillMentionBlock renders role base + surfaces, existing-only", async () => {
  const { buildSkillMentionBlock } = await import("../src/spawn-wrapper.ts");
  const block = buildSkillMentionBlock({
    role: "reviewer",
    skillsDir: SKILLS_DIR,
    surfaces: ["security"],
    explicitSkillFolders: ["this-skill-does-not-exist"],
  });
  assert.match(block, /^Load and follow these codexclaw skills before working:/);
  assert.match(block, /\[\$cxc-dev\]\(skill:\/\//);
  assert.match(block, /\[\$cxc-dev-code-reviewer\]\(skill:\/\//);
  assert.match(block, /\[\$cxc-search\]\(skill:\/\//);
  assert.match(block, /\[\$cxc-dev-security\]\(skill:\/\//);
  assert.doesNotMatch(block, /this-skill-does-not-exist/, "dangling folder dropped");
});

test("WP1: buildSkillMentionBlock dedupes excluded folders and empties out", async () => {
  const { buildSkillMentionBlock } = await import("../src/spawn-wrapper.ts");
  const partial = buildSkillMentionBlock({
    role: "explorer",
    skillsDir: SKILLS_DIR,
    surfaces: ["frontend"],
    excludeFolders: ["dev"],
  });
  assert.doesNotMatch(partial, /\[\$cxc-dev\]\(/);
  assert.match(partial, /\[\$cxc-dev-frontend\]\(/);

  const empty = buildSkillMentionBlock({
    role: "explorer",
    skillsDir: SKILLS_DIR,
    excludeFolders: ["dev"],
  });
  assert.equal(empty, "");
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

test("020/dev2: routeDispatch('red-team', frontend) prepends role and surface mentions", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const out = routeDispatch({
    intent: "red-team",
    surfaces: ["frontend"],
    task: "red-team this diff",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(out.role, "reviewer");
  assert.ok(!("items" in out), "dev2: dispatcher output is v2-shaped (no items)");
  assert.equal(out.fork_turns, "none");
  assert.match(out.task_name, /^reviewer_[a-z0-9_]+$/);
  for (const name of ["cxc-dev", "cxc-dev-code-reviewer", "cxc-search", "cxc-dev-frontend"]) {
    assert.ok(out.message.includes(`$${name}`), `${name} mention present`);
  }
  assert.match(out.message, /TASK: red-team this diff$/);
});

test("020/dev2: routeDispatch('research') honors an explicit skill", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const out = routeDispatch({
    intent: "research",
    explicitSkillFolders: ["search"],
    task: "investigate X",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(out.role, "explorer");
  assert.ok(out.message.includes("$cxc-dev"));
  assert.ok(out.message.includes("$cxc-search"));
  assert.match(out.message, /TASK: investigate X$/);
});

test("070: routeDispatch('research') auto-attaches cxc-search only", async () => {
  const { routeDispatch, INTENT_EXTRA_SKILL_FOLDERS } = await import("../src/spawn-wrapper.ts");
  assert.deepEqual(INTENT_EXTRA_SKILL_FOLDERS.research, ["search"]);
  const out = routeDispatch({
    intent: "research",
    task: "survey the landscape",
    skillsDir: SKILLS_DIR,
  });
  assert.equal(out.role, "explorer");
  assert.ok(out.message.includes("$cxc-dev"));
  assert.ok(out.message.includes("$cxc-search"));
  assert.ok(!out.message.includes("$cxc-ultraresearch"));
  assert.match(out.message, /TASK: survey the landscape$/);
});

test("070: non-research intents do NOT auto-attach ultraresearch", async () => {
  const { routeDispatch } = await import("../src/spawn-wrapper.ts");
  const out = routeDispatch({ intent: "review", task: "review the diff", skillsDir: SKILLS_DIR });
  assert.ok(!out.message.includes("$cxc-ultraresearch"), "review must not attach ultraresearch");
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

// ---- dev2 (260709): v2 spawn schema — task_name required, fork_turns pinned, no items ----

test("dev2: taskNameForRole derives a v2-legal [a-z0-9_]+ name with fallback + cap", async () => {
  const { taskNameForRole } = await import("../src/spawn-wrapper.ts");
  assert.equal(taskNameForRole("explorer", "Find the Goal Gate"), "explorer_find_the_goal");
  assert.match(taskNameForRole("reviewer", "red-team this diff!"), /^reviewer_[a-z0-9_]+$/);
  // non-ASCII-only task degrades to the role fallback
  assert.equal(taskNameForRole("executor", "한글만 있는 작업"), "executor_task");
  // cap at 40 chars, no trailing underscore
  const long = taskNameForRole("executor", "aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd");
  assert.ok(long.length <= 40);
  assert.ok(!long.endsWith("_"));
  for (const n of [taskNameForRole("explorer", "x"), long]) {
    assert.match(n, /^[a-z0-9_]+$/, "v2 task_name charset");
  }
});

test("dev2: buildSpawnPayload emits task_name + fork_turns none (fresh spawn keeps overrides legal)", () => {
  const payload = buildSpawnPayload({
    role: "reviewer",
    task: "audit the plan docs",
    resolution: { role: "reviewer", model: "gpt-5.5", usesMainModel: false, effort: "high", promptOverride: null },
    developerInstructions: "Role: reviewer.",
  });
  assert.equal(payload.fork_turns, "none");
  assert.equal(payload.task_name, "reviewer_audit_the_plan");
  assert.ok(!("model" in payload));
  assert.ok(!("reasoning_effort" in payload));
  assert.ok(!("items" in payload));
});
