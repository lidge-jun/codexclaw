import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPromptArchitecture, ELIGIBLE } from "../scripts/check-prompt-architecture.mjs";

// Fixture plugin root: skills/<name>/SKILL.md (+ optional references) and an optional baseline.
function fixture(skills, baseline = null) {
  const root = mkdtempSync(join(tmpdir(), "cxc-prompt-arch-"));
  for (const [name, files] of Object.entries(skills)) {
    for (const [rel, text] of Object.entries(files)) {
      const p = join(root, "skills", name, rel);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, text);
    }
  }
  mkdirSync(join(root, "scripts"), { recursive: true });
  if (baseline) writeFileSync(join(root, "scripts", "prompt-architecture-baseline.json"), JSON.stringify(baseline));
  return root;
}
const skill = (desc, body = "# S\n") => "---\nname: x\ndescription: " + JSON.stringify(desc) + "\n---\n" + body;
const run = (root) => checkPromptArchitecture({ pluginRoot: root });

test("the repository passes its own prompt-architecture gate", () => {
  const result = checkPromptArchitecture();
  assert.deepEqual(result.violations, []);
});

test("a clean fixture passes", () => {
  const root = fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "# A\n\nSee [ref](references/r.md#steps).\n"), "references/r.md": "# R\n\n## Steps\n" } });
  assert.deepEqual(run(root).violations, []);
});

test("an over-budget description fails", () => {
  const root = fixture({ alpha: { "SKILL.md": skill("x".repeat(321)) } });
  assert.match(run(root).violations.join("\n"), /description alpha: 321 chars exceeds 320/);
});

test("a missing link target and a missing anchor fail; explicit {#id} anchors resolve", () => {
  const root = fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "[a](references/nope.md) [b](references/r.md#absent) [c](references/r.md#custom)\n"), "references/r.md": "# R\n\n## Title {#custom}\n" } });
  const v = run(root).violations.join("\n");
  assert.match(v, /references\/nope\.md does not exist/);
  assert.match(v, /#absent is not a heading/);
  assert.doesNotMatch(v, /#custom/);
});

test("links inside code are ignored", () => {
  const root = fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "\x60[x](missing.md)\x60\n\n\x60\x60\x60md\n[y](missing.md)\n\x60\x60\x60\n") } });
  assert.deepEqual(run(root).violations, []);
});

test("a rule ID defined in two files fails; a mention is not a definition", () => {
  const root = fixture({
    alpha: { "SKILL.md": skill("Use for alpha.", "**FOO-BAR-01 (STRICT)** do it.\n"), "references/r.md": "## FOO-BAR-01 again\n" },
    beta: { "SKILL.md": skill("Use for beta.", "Follow FOO-BAR-01 from alpha.\n") },
  });
  const v = run(root).violations;
  assert.equal(v.length, 1);
  assert.match(v[0], /rule FOO-BAR-01: defined in 2 files/);
});

test("frozen legacy definitions may not gain a file, and a stale freeze entry fails", () => {
  const skills = { alpha: { "SKILL.md": skill("Use for alpha.", "## FOO-BAR-01\n") }, beta: { "SKILL.md": skill("Use for beta.", "**FOO-BAR-01 (DEFAULT)**\n") }, gamma: { "SKILL.md": skill("Use for gamma.", "## FOO-BAR-01 copy\n") } };
  const grown = run(fixture(skills, { idDefinitions: { "FOO-BAR-01": ["skills/alpha/SKILL.md", "skills/beta/SKILL.md"] } }));
  assert.match(grown.violations.join("\n"), /new definition in skills\/gamma\/SKILL\.md/);
  const stale = run(fixture({ alpha: skills.alpha }, { idDefinitions: { "FOO-BAR-01": ["skills/alpha/SKILL.md", "skills/beta/SKILL.md"] } }));
  assert.match(stale.violations.join("\n"), /legacy baseline entry no longer needed/);
});

test("router baseline: exact size only, eligible skills only", () => {
  const eligible = "legacy-router";
  const policy = { descriptions: new Set(), routers: new Set([eligible]) };
  const run = (root) => checkPromptArchitecture({ pluginRoot: root, eligible: policy });
  const big = skill("Use for it.", "x".repeat(11000));
  const size = Buffer.byteLength(big);
  assert.deepEqual(run(fixture({ [eligible]: { "SKILL.md": big } }, { routers: { [eligible]: size } })).violations, []);
  assert.match(run(fixture({ [eligible]: { "SKILL.md": big } }, { routers: { [eligible]: size - 10 } })).violations.join("\n"), /growth needs a reviewed baseline change/);
  assert.match(run(fixture({ [eligible]: { "SKILL.md": big } }, { routers: { [eligible]: size + 10 } })).violations.join("\n"), /lower the record/);
  assert.match(run(fixture({ [eligible]: { "SKILL.md": big } })).violations.join("\n"), /exceeds 10240/);
  assert.match(run(fixture({ newcomer: { "SKILL.md": big } }, { routers: { newcomer: size } })).violations.join("\n"), /outside the frozen eligible set/);
});


test("reviewer-reproduced false greens now fail", () => {
  // Inline-code rule ID in a heading, defined in two files.
  const headingDup = run(fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "## \x60FOO-BAR-01\x60 rule\n") }, beta: { "SKILL.md": skill("Use for beta.", "## \x60FOO-BAR-01\x60 again\n") } }));
  assert.match(headingDup.violations.join("\n"), /rule FOO-BAR-01: defined in 2 files/);
  // Emphasized class and the "(CLASS, ID" lead-in both count as definitions.
  const decorated = run(fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "FOO-BAR-01 (**STRICT**) must do.\n") }, beta: { "SKILL.md": skill("Use for beta.", "**Lead (DEFAULT, FOO-BAR-01):** do.\n") } }));
  assert.match(decorated.violations.join("\n"), /rule FOO-BAR-01: defined in 2 files/);
  // Folded and literal YAML descriptions are measured in full.
  const folded = "---\nname: x\ndescription: >\n  " + "y".repeat(400) + "\n---\n# S\n";
  assert.match(run(fixture({ alpha: { "SKILL.md": folded } })).violations.join("\n"), /description alpha: 400 chars exceeds 320/);
  const literal = "---\nname: x\ndescription: |\n  " + "z".repeat(200) + "\n  " + "z".repeat(200) + "\n---\n# S\n";
  assert.match(run(fixture({ alpha: { "SKILL.md": literal } })).violations.join("\n"), /description alpha: 401 chars exceeds 320/);
  const shortYaml = fixture({ alpha: { "SKILL.md": skill("Use for alpha."), "agents/openai.yaml": "interface:\n  display_name: a\n  short_description: >\n    " + "s".repeat(150) + "\n" } });
  assert.match(run(shortYaml).violations.join("\n"), /short_description alpha: 150 chars exceeds 100/);
  // Reference-style link definitions are resolved.
  const refStyle = run(fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "| a | [owner][r] |\n\n[r]: references/nope.md\n") } }));
  assert.match(refStyle.violations.join("\n"), /references\/nope\.md does not exist/);
});

test("a heading with an inline-code rule ID is a valid link target", () => {
  const root = fixture({ alpha: { "SKILL.md": skill("Use for alpha.", "See [r](references/r.md#foo-bar-01-rule).\n"), "references/r.md": "## \x60FOO-BAR-01\x60 rule\n" } });
  assert.deepEqual(run(root).violations, []);
});


test("YAML continuation forms cannot hide description length", () => {
  const long = (head, body) => "---\nname: x\ndescription: " + head + "\n" + body + "\n---\n# S\n";
  const cases = [
    long("> # summary", "  " + "a".repeat(401)),
    long(">2-", "   " + "b".repeat(401)),
    long('"' + "c".repeat(200), "  " + "c".repeat(200) + '"'),
    long("d".repeat(200), "  " + "d".repeat(200)),
  ];
  for (const text of cases) {
    const v = run(fixture({ alpha: { "SKILL.md": text } })).violations.join("\n");
    assert.match(v, /description alpha: \d+ chars exceeds 320/, text.slice(0, 40));
  }
  const yaml = "interface:\n  short_description: | # label\n    " + "e".repeat(150) + "\n  display_name: a\n";
  assert.match(run(fixture({ alpha: { "SKILL.md": skill("Use for alpha."), "agents/openai.yaml": yaml } })).violations.join("\n"), /short_description alpha: 150 chars exceeds 100/);
});


test("no skill is eligible for a size exception any more", () => {
  assert.equal(ELIGIBLE.descriptions.size, 0);
  assert.equal(ELIGIBLE.routers.size, 0);
});
