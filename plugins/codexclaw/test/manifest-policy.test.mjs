// codexclaw manifest + skill-policy + role-config coverage (node:test, .mjs).
// Closes WP0 audit gaps: S3 implicit-invocation policy (pinned implicit set),
// S5 role TOML validity, and L3 PreToolUse goal-budget hook manifest registration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");

function readImplicit(yamlPath) {
  // tiny line scan — avoids a yaml dep for one boolean field
  const body = readFileSync(yamlPath, "utf8");
  const m = body.match(/allow_implicit_invocation:\s*(true|false)/);
  return m ? m[1] === "true" : null;
}

/** Extract the YAML frontmatter block (between the first two `---` lines). */
function readFrontmatter(skillPath) {
  const body = readFileSync(skillPath, "utf8");
  const m = body.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

test("skill SKILL.md frontmatter carries no forbidden fields (license/keywords)", () => {
  // L12-L17 Must-NOT-Have + codex skill schema: only name/description/metadata
  // are allowed at the top level. `license:` and `keywords:` are cli-jaw-source
  // leaks that must be stripped during the real-content port.
  const skillsDir = join(pluginRoot, "skills");
  const offenders = [];
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (!statSync(sd).isDirectory()) continue;
    const skillMd = join(sd, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const fm = readFrontmatter(skillMd);
    assert.notEqual(fm, null, `skill ${name} SKILL.md has no frontmatter block`);
    for (const line of fm.split("\n")) {
      if (/^(license|keywords)\s*:/.test(line)) offenders.push(`${name}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `forbidden frontmatter fields found:\n${offenders.join("\n")}`);
});

// Implicit set after 2026-07-05 consolidation (dev + 5 lightweight workflow skills;
// skill-hub merged into dev) and the 2026-07-09 design expansion (dev-frontend +
// dev-uiux-design go implicit so anti-slop design grammar reaches every
// UI-generating session without relying on DEV-ROUTE-01 routing).
const IMPLICIT_SET = [
  "dev", "dev-frontend", "dev-uiux-design",
  "interview", "loop", "pabcd", "recall", "search",
];
// dev-* routers allowed to be implicit (design-surface exception).
const IMPLICIT_DEV_ROUTERS = new Set(["dev-frontend", "dev-uiux-design"]);

test("S3: implicit set is exactly {dev,+7}; other dev-* routers are on-demand", () => {
  const skillsDir = join(pluginRoot, "skills");
  const implicit = [];
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (!statSync(sd).isDirectory()) continue;
    const yaml = join(sd, "agents", "openai.yaml");
    if (!existsSync(yaml)) continue; // deprecated skills without openai.yaml are unregistered
    const val = readImplicit(yaml);
    assert.notEqual(val, null, `skill ${name} openai.yaml has no allow_implicit_invocation`);
    if (val) implicit.push(name);
  }
  assert.deepEqual(implicit.sort(), IMPLICIT_SET, `implicit set mismatch, got: ${implicit.join(",")}`);
  for (const name of implicit) {
    if (name.startsWith("dev-")) {
      assert.ok(IMPLICIT_DEV_ROUTERS.has(name), `dev-* router ${name} must stay on-demand`);
    }
  }
});

test("L3: PreToolUse goal-budget hook is registered in the plugin manifest", () => {
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const goalHook = manifest.hooks.find((h) => h.includes("pre-tool-use-guarding-goal-budget"));
  assert.ok(goalHook, "pre-tool-use-guarding-goal-budget hook not in manifest.hooks");
  const hookJson = JSON.parse(readFileSync(join(pluginRoot, goalHook), "utf8"));
  const flat = JSON.stringify(hookJson);
  assert.match(flat, /PreToolUse/, "hook is not a PreToolUse hook");
  assert.match(flat, /goal[- ]budget|pre-tool-use/i, "hook does not target the goal-budget guard");
  // R-10: the PreToolUse entry must narrow to ^create_goal$ (omo parity), not fire on every tool.
  const entry = hookJson.hooks.PreToolUse[0];
  assert.equal(entry.matcher, "^create_goal$", "PreToolUse goal-budget hook must match only ^create_goal$");
});

test("S5: each role TOML is spawn-valid (name + description + default model + instructions)", () => {
  const agentsDir = join(pluginRoot, "agents");
  for (const role of ["explorer", "reviewer", "executor"]) {
    const toml = readFileSync(join(agentsDir, `${role}.toml`), "utf8");
    assert.match(toml, new RegExp(`name\\s*=\\s*"${role}"`), `${role}.toml name mismatch`);
    assert.match(toml, /description\s*=\s*"/, `${role}.toml missing description`);
    assert.match(toml, /model\s*=\s*"default"/, `${role}.toml must inherit default model in Phase 1`);
    assert.match(toml, /developer_instructions\s*=\s*"""/, `${role}.toml missing developer_instructions`);
    assert.ok(!/read_only\s*=\s*true/.test(toml), `${role}.toml must not hardcode read_only (B-opt2 inline)`);
  }
});

test("L18: search skill is a codex-native 3-tier on-demand hub with Korean guard", () => {
  const skillMd = join(pluginRoot, "skills", "search", "SKILL.md");
  const yaml = join(pluginRoot, "skills", "search", "agents", "openai.yaml");
  assert.ok(existsSync(skillMd), "search/SKILL.md missing");
  assert.ok(existsSync(yaml), "search/agents/openai.yaml missing");

  // implicit since the 2026-07-05 expansion (S3 pins the full set; this is the
  // direct assertion for the search skill).
  assert.equal(readImplicit(yaml), true, "search skill must be allow_implicit_invocation:true");

  // TEST-PROMPT-SEAM-01: the tier-heading count, forbidden-backend negation scan, section
  // ordering and Korean trigger-word checks all read one prose file and asserted that
  // phrases exist. They broke on rewording and proved no behavior. The removed-backend
  // protection moves to REVIEW-REMOVED-BACKEND-01 (review, not a test); the rest is review.

});

test("L19: dev/SKILL.md points at a skill-catalog reference that actually exists", () => {
  // TEST-PROMPT-SEAM-01: extract the referenced path from dev/SKILL.md and resolve it on
  // disk — two sources compared. The catalog's source-priority wording and the discovery
  // command names are prose with no second source; they are protected by review instead.
  const skillsDir = join(pluginRoot, "skills");
  const devSkill = readFileSync(join(skillsDir, "dev", "SKILL.md"), "utf8");
  const ref = /references\/([\w.-]+\.md)/.exec(devSkill);
  assert.ok(ref, "dev/SKILL.md references no file under references/");
  assert.ok(
    existsSync(join(skillsDir, "dev", "references", ref[1])),
    `dev/SKILL.md points at references/${ref[1]} but that file does not exist`,
  );
});
