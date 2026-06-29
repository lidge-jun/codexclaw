/**
 * ast-grep.test.ts — L22 code-intelligence coverage.
 *
 * Verifies: (1) runAstGrepCheck degrades gracefully (WARN, never throws) when sg
 * or python is absent; (2) the ast-grep skill exists with clean frontmatter +
 * helper; (3) the base .mcp.json declares NO lsp/codegraph server (no-server
 * contract). The live `sg` roundtrip is exercised separately by the helper E2E.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { runAstGrepCheck } from "../src/doctor.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..", "..", "..");

test("runAstGrepCheck: missing helper -> WARN (not FAIL, not throw)", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "cxc-ag-"));
  const res = runAstGrepCheck(emptyRoot);
  assert.equal(res.severity, "WARN");
  assert.match(res.evidence, /not installed/);
});

test("runAstGrepCheck: helper present but sg unresolved -> WARN with install hint", () => {
  // Stub a runner that simulates `python3 doctor` failing to find sg.
  const fakeRunner = (() => ({ status: 1, stdout: "ast-grep binary: NOT FOUND\n", stderr: "" })) as unknown as typeof import("node:child_process").spawnSync;
  // helper file must exist for this branch; use the real plugin root.
  if (!existsSync(join(pluginRoot, "skills", "ast-grep", "scripts", "ast_grep_helper.py"))) return;
  const res = runAstGrepCheck(pluginRoot, fakeRunner);
  assert.equal(res.severity, "WARN");
  assert.match(res.evidence, /provision|not resolved/);
});

test("runAstGrepCheck: helper resolves sg -> PASS with version", () => {
  const fakeRunner = (() => ({
    status: 0,
    stdout: "ast-grep binary: /opt/homebrew/bin/ast-grep\n  version: ast-grep 0.44.0\n",
    stderr: "",
  })) as unknown as typeof import("node:child_process").spawnSync;
  if (!existsSync(join(pluginRoot, "skills", "ast-grep", "scripts", "ast_grep_helper.py"))) return;
  const res = runAstGrepCheck(pluginRoot, fakeRunner);
  assert.equal(res.severity, "PASS");
  assert.match(res.evidence, /0\.44\.0/);
});

test("ast-grep skill: present with clean frontmatter + helper + install ref", () => {
  const skillDir = join(pluginRoot, "skills", "ast-grep");
  assert.ok(existsSync(join(skillDir, "SKILL.md")), "SKILL.md missing");
  assert.ok(existsSync(join(skillDir, "scripts", "ast_grep_helper.py")), "helper missing");
  assert.ok(existsSync(join(skillDir, "references", "install.md")), "install.md missing");
  assert.ok(existsSync(join(skillDir, "agents", "openai.yaml")), "openai.yaml missing");

  const fm = readFileSync(join(skillDir, "SKILL.md"), "utf8").match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "no frontmatter");
  assert.ok(!/^(license|keywords)\s*:/m.test(fm[1]), "forbidden frontmatter field");

  // rg-first guidance present (must not replace ordinary grep).
  assert.match(readFileSync(join(skillDir, "SKILL.md"), "utf8"), /rg first|do not use ast-grep for ordinary grep/i);
});

test("L22 no-server contract: base .mcp.json has no lsp/codegraph server", () => {
  const mcpPath = join(pluginRoot, ".mcp.json");
  const mcp = JSON.parse(readFileSync(mcpPath, "utf8")) as { mcpServers?: Record<string, unknown> };
  const names = Object.keys(mcp.mcpServers ?? {});
  for (const n of names) {
    assert.ok(!/lsp|codegraph/i.test(n), `base .mcp.json must not declare lsp/codegraph server: ${n}`);
  }
});
