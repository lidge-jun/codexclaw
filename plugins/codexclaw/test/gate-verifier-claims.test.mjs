/**
 * gate-verifier-claims.test.mjs — WP1/100 (E8-WARN). Covers `checkVerifierClaims`, the
 * report-only gate check that flags plan documents naming a verifier command which cannot
 * verify anything.
 *
 * Every fixture calls `checkVerifierClaims(tempRoot)` DIRECTLY, never `runGate(tempRoot)`:
 * on a synthetic tree `checkStatusSync` (no INDEX) and `checkCounts` (no manifest) would
 * fire for unrelated reasons and drown the signal (audit blocker 5).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkVerifierClaims, runGate, REPO_ROOT } from "../scripts/gate.mjs";

/** Build a throwaway repo root containing `devlog/<bucket>/<unit>/<name>` with `body`. */
function fixture(body, { bucket = "_plan", withTsconfig = false, name = "010_x.md", extra } = {}) {
  const root = mkdtempSync(join(tmpdir(), "cxc-vclaims-"));
  const unit = join(root, "devlog", bucket, "260101_unit");
  mkdirSync(unit, { recursive: true });
  writeFileSync(join(unit, name), body);
  if (withTsconfig) writeFileSync(join(root, "tsconfig.json"), "{}\n");
  if (extra) for (const [rel, content] of Object.entries(extra)) {
    const p = join(root, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content);
  }
  return root;
}

test("WP1: inline `검증 명령` line with tsc --noEmit WARNs when no root tsconfig exists", () => {
  const root = fixture("# doc\n\n검증 명령: `npm test`, `npx tsc --noEmit`, `npm run gate`.\n");
  try {
    const res = checkVerifierClaims(root);
    assert.equal(res.ok, true, "this check never blocks");
    assert.equal(res.warnings.length, 1);
    assert.match(res.warnings[0], /010_x\.md:3/);
    assert.match(res.warnings[0], /no root tsconfig\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: the same claim is silent once a root tsconfig.json exists", () => {
  const root = fixture("검증 명령: `npx tsc --noEmit`.\n", { withTsconfig: true });
  try {
    assert.deepEqual(checkVerifierClaims(root).warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: `적지 않는다` on the claim line is an explicit opt-out", () => {
  const root = fixture("검증 명령: `npx tsc --noEmit` — **적지 않는다.** 아무것도 검사하지 않는다.\n");
  try {
    assert.deepEqual(checkVerifierClaims(root).warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: bulleted `검증 명령` blocks are parsed, and the list ends at the first non-bullet", () => {
  const root = fixture([
    "검증 명령:", "",
    "- `npx tsc --noEmit` — bad", "- `npm run gate` — fine", "",
    "## 범위 밖", "", "- `npx tsc --noEmit` — must NOT be read (outside the block)", "",
  ].join("\n"));
  try {
    const res = checkVerifierClaims(root);
    assert.equal(res.warnings.length, 1, `expected exactly the in-block claim, got ${JSON.stringify(res.warnings)}`);
    assert.match(res.warnings[0], /:3:/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: prose, tables and code fences mentioning the command are NOT read", () => {
  const root = fixture([
    "`npx tsc --noEmit`을 실측했다.", "",
    "| 현재 root `npx tsc --noEmit` | exit 1 |", "",
    "```bash", "npx tsc --noEmit", "```", "",
  ].join("\n"));
  try {
    assert.deepEqual(checkVerifierClaims(root).warnings, [], "only `검증 명령` lines are candidates");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: devlog/_fin is out of scope", () => {
  const root = fixture("검증 명령: `npx tsc --noEmit`.\n", { bucket: "_fin" });
  try {
    assert.deepEqual(checkVerifierClaims(root).warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: a tree without devlog/ (installed payload shape) passes silently", () => {
  const root = mkdtempSync(join(tmpdir(), "cxc-vclaims-nodevlog-"));
  try {
    const res = checkVerifierClaims(root);
    assert.equal(res.ok, true);
    assert.deepEqual(res.warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: `node --test <missing>` WARNs unless that exact path is marked 신규", () => {
  const missing = "plugins/codexclaw/test/not-yet.test.mjs";
  const bare = fixture(`검증 명령: \`node --test ${missing}\`.\n`);
  try {
    assert.equal(checkVerifierClaims(bare).warnings.length, 1);
    assert.match(checkVerifierClaims(bare).warnings[0], /does not exist/);
  } finally { rmSync(bare, { recursive: true, force: true }); }

  const marked = fixture(
    `| \`${missing}\` | 신규 테스트 |\n\n검증 명령: \`node --test ${missing}\`.\n`,
  );
  try {
    assert.deepEqual(checkVerifierClaims(marked).warnings, [], "file-change-map 신규 row exempts it");
  } finally { rmSync(marked, { recursive: true, force: true }); }
});

test("WP1: 신규 on a DIFFERENT path does not exempt this one", () => {
  const root = fixture([
    "| `plugins/codexclaw/test/other.test.mjs` | 신규 테스트 |", "",
    "검증 명령: `node --test plugins/codexclaw/test/missing.test.mjs`.", "",
  ].join("\n"));
  try {
    assert.equal(checkVerifierClaims(root).warnings.length, 1, "exemption is path-bound, not document-wide");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: an existing test path and a glob are both silent", () => {
  const root = fixture([
    "검증 명령: `node --test plugins/codexclaw/test/ok.test.mjs`.", "",
    "검증 명령: `node --test plugins/codexclaw/test/*.test.mjs`.", "",
  ].join("\n"), { extra: { "plugins/codexclaw/test/ok.test.mjs": "// present\n" } });
  try {
    assert.deepEqual(checkVerifierClaims(root).warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("WP1: runGate exposes warnings additively and keeps ok/exit driven by violations only", () => {
  const res = runGate(REPO_ROOT);
  assert.equal(res.ok, true, "live tree must stay violation-free");
  assert.ok(Array.isArray(res.warnings), "runGate gained a warnings array");
  assert.ok(Array.isArray(res.violations));
  // The live tree currently carries dead-verifier claims; they must NOT become violations.
  for (const w of res.warnings) assert.ok(!res.violations.includes(w));
  assert.equal(res.checks.verifierClaims.ok, true);
});
