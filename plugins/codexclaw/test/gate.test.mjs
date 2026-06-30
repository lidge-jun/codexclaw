/**
 * gate.test.mjs — L18 (E8) enforcement gate. Asserts the live tree is drift-free AND
 * that each check actually fires on synthetic drift (negative controls), so the gate is
 * provably not a no-op. Imports the pure check functions from scripts/gate.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runGate, checkStatusSync, checkForbiddenClaims, checkCounts,
  parseIndexRows, leadingStatusToken, STATUS_TOKENS, FORBIDDEN_PATTERNS, REPO_ROOT,
} from "../scripts/gate.mjs";

test("L18: the live repo passes the full gate (no drift, no false-enforcement, counts match)", () => {
  const result = runGate();
  assert.equal(result.ok, true, `gate must be green on the live tree; violations:\n${result.violations.join("\n")}`);
});

test("L18: parseIndexRows extracts ln/decade/decision/impl", () => {
  const rows = parseIndexRows("| L9 | 090 | scope text | DONE | PLANNED |\nnoise\n| L10 | 100 | x | DONE | DONE |");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { ln: "L9", decade: "090", decision: "DONE", impl: "PLANNED" });
});

test("L18: leadingStatusToken reads the token before qualifiers", () => {
  assert.equal(leadingStatusToken("Status: DONE (parity plan only; runtime deferred) · 2026"), "DONE");
  assert.equal(leadingStatusToken("Status: PLANNED (root-cause) · x"), "PLANNED");
  assert.equal(leadingStatusToken("no status here"), null);
});

test("L18: forbidden-claims regex catches false enforcement but a gate-ok escape clears it", () => {
  const falseLine = "The hook automatically loads the dev skill on every turn.";
  assert.ok(FORBIDDEN_PATTERNS.some((re) => re.test(falseLine)), "should flag false auto-load claim");
  // a true, hook-backed claim with the escape comment must NOT be flagged by the corpus scan
  const dir = mkdtempSync(join(tmpdir(), "gate-fc-"));
  try {
    const sd = join(dir, "plugins", "codexclaw", "skills", "x");
    mkdirSync(sd, { recursive: true });
    writeFileSync(join(sd, "SKILL.md"), "ok line\nThe hook automatically loads the dev skill. <!-- gate-ok: verified false-example w/ escape -->\n");
    const res = checkForbiddenClaims(dir);
    assert.equal(res.ok, true, `escape must clear the claim; got ${res.violations.join("; ")}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("L18: checkForbiddenClaims FIRES on a false claim with no escape (negative control)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-fc2-"));
  try {
    const sd = join(dir, "plugins", "codexclaw", "skills", "x");
    mkdirSync(sd, { recursive: true });
    writeFileSync(join(sd, "SKILL.md"), "The hook automatically injects the dev skill.\n");
    const res = checkForbiddenClaims(dir);
    assert.equal(res.ok, false);
    assert.match(res.violations[0], /false-enforcement claim/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("L18: checkStatusSync FIRES on decision/loop-doc token drift (negative control)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-ss-"));
  try {
    const mh = join(dir, "devlog", "_plan", "mvp_hard");
    mkdirSync(mh, { recursive: true });
    writeFileSync(join(mh, "000_INDEX.md"),
      "| Ln | decade | scope | decision-state | impl-state |\n|--|--|--|--|--|\n| L1 | 010 | x | DONE | DONE |\n");
    writeFileSync(join(mh, "010_x.md"), "# L1\n\nStatus: PLANNED (drift) · 2026\n");
    const res = checkStatusSync(dir);
    assert.equal(res.ok, false);
    assert.match(res.violations[0], /decision-state 'DONE' != loop doc leading status 'PLANNED'/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("L18: checkStatusSync FIRES on a non-LOCKED status token (negative control)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-ss2-"));
  try {
    const mh = join(dir, "devlog", "_plan", "mvp_hard");
    mkdirSync(mh, { recursive: true });
    writeFileSync(join(mh, "000_INDEX.md"),
      "| Ln | decade | scope | decision-state | impl-state |\n|--|--|--|--|--|\n| L1 | 010 | x | WIP | DONE |\n");
    writeFileSync(join(mh, "010_x.md"), "# L1\n\nStatus: WIP · 2026\n");
    const res = checkStatusSync(dir);
    assert.equal(res.ok, false);
    assert.match(res.violations.join("\n"), /not in the LOCKED enum/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("L18: checkCounts FIRES on hook-count mismatch (negative control)", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-cc-"));
  try {
    const cp = join(dir, "plugins", "codexclaw", ".codex-plugin");
    const hd = join(dir, "plugins", "codexclaw", "hooks");
    mkdirSync(cp, { recursive: true });
    mkdirSync(hd, { recursive: true });
    writeFileSync(join(cp, "plugin.json"), JSON.stringify({ hooks: ["./hooks/a.json", "./hooks/b.json"] }));
    writeFileSync(join(hd, "a.json"), "{}");
    const res = checkCounts(dir);
    assert.equal(res.ok, false);
    assert.match(res.violations[0], /hook count mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
