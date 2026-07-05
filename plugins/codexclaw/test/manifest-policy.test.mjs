// codexclaw manifest + skill-policy + role-config coverage (node:test, .mjs).
// Closes WP0 audit gaps: S3 implicit-invocation policy (only `dev` is implicit),
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

// Implicit set expanded 2026-07-05 (hook-diet/implicit initiative): dev + 6
// lightweight workflow/capability skills; all dev-* routers stay on-demand.
const IMPLICIT_SET = ["dev", "interview", "loop", "pabcd", "recall", "search", "skill-hub"];

test("S3: implicit set is exactly {dev,+6}; all dev-* routers are on-demand", () => {
  const skillsDir = join(pluginRoot, "skills");
  const implicit = [];
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (!statSync(sd).isDirectory()) continue;
    const yaml = join(sd, "agents", "openai.yaml");
    assert.ok(existsSync(yaml), `skill ${name} missing agents/openai.yaml`);
    const val = readImplicit(yaml);
    assert.notEqual(val, null, `skill ${name} openai.yaml has no allow_implicit_invocation`);
    if (val) implicit.push(name);
  }
  assert.deepEqual(implicit.sort(), IMPLICIT_SET, `implicit set mismatch, got: ${implicit.join(",")}`);
  for (const name of implicit) {
    assert.ok(!name.startsWith("dev-"), `dev-* router ${name} must stay on-demand`);
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

  const body = readFileSync(skillMd, "utf8");

  // AC: exactly three tier headings.
  const tierHeads = body.match(/^### Tier [123] /gm) || [];
  assert.equal(tierHeads.length, 3, `expected exactly 3 tier headings, got ${tierHeads.length}`);

  // AC: no removed cli-jaw backend named as AVAILABLE. They may appear only in
  // the "do not reintroduce" non-goal sentence, so assert each forbidden name,
  // where present, sits on a line that also carries a negation marker.
  const forbidden = ["progrok", "web-AI", "Grok Expert", "GPT Pro", "Exa", "Tavily", "Perplexity", "Brave"];
  for (const name of forbidden) {
    for (const line of body.split("\n")) {
      if (line.includes(name)) {
        assert.match(
          line,
          /do \*\*not\*\*|reintroduce|removed|non-goal|carry over/i,
          `forbidden backend "${name}" appears outside a non-goal line: ${line.trim()}`,
        );
      }
    }
  }

  // AC: source-proof invariant precedes the ladder (discover-vs-prove).
  const proofIdx = body.indexOf("Source-Proof Invariant");
  const ladderIdx = body.indexOf("## The Ladder");
  assert.ok(proofIdx !== -1 && ladderIdx !== -1 && proofIdx < ladderIdx, "source-proof invariant must precede the ladder");

  // AC: Korean intent guard with 8 numbered rules.
  const guardIdx = body.indexOf("Korean Intent Guard");
  assert.ok(guardIdx !== -1, "Korean Intent Guard section missing");
  const guardBlock = body.slice(guardIdx, body.indexOf("## When to stop", guardIdx));
  const numbered = guardBlock.match(/^\d+\. \*\*/gm) || [];
  assert.equal(numbered.length, 8, `expected 8 numbered Korean-guard rules, got ${numbered.length}`);

  // AC: Korean trigger words present.
  for (const t of ["검색", "찾아봐", "찾아줘", "알아봐", "웹검색"]) {
    assert.ok(body.includes(t), `Korean trigger "${t}" missing from search skill`);
  }
});

test("L19: skill-hub catalog enumerates every codexclaw skill (filesystem-derived)", () => {
  const skillsDir = join(pluginRoot, "skills");
  const catalog = readFileSync(join(skillsDir, "skill-hub", "references", "catalog.md"), "utf8");

  // Every skill dir with a SKILL.md must appear as a catalog row. Deriving the
  // set from the filesystem keeps the catalog honest as skills are added.
  for (const name of readdirSync(skillsDir)) {
    const sd = join(skillsDir, name);
    if (!statSync(sd).isDirectory()) continue;
    if (!existsSync(join(sd, "SKILL.md"))) continue;
    assert.match(
      catalog,
      new RegExp(`\\|\\s*${name}\\s*\\|`),
      `skill "${name}" is not catalogued in skill-hub/references/catalog.md`,
    );
  }

  // skill-hub is implicit since the 2026-07-05 expansion (capability discovery row).
  assert.equal(
    readImplicit(join(skillsDir, "skill-hub", "agents", "openai.yaml")),
    true,
    "skill-hub must be allow_implicit_invocation:true (implicit set member)",
  );

  // renderers native-gap note exists and names the missing renderers.
  const renderers = readFileSync(join(skillsDir, "skill-hub", "references", "renderers.md"), "utf8");
  assert.match(renderers, /diagram-html|mermaid|chart-json/, "renderers.md must document the native renderer gap");
});
