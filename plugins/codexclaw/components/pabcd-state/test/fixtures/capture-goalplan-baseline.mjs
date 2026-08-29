// wp2 pre-change baseline generator.
//
// Reads every goalplan the CURRENT parser can find, records its normalized parse
// result, then de-identifies the input so the fixture can be checked in. wp7
// consumes the checked-in JSON and never re-runs this generator (see
// devlog/_plan/260829_goalplan-dependency-execution/070_wp7_regression.md).
//
// Everything that touches the operating corpus lives inside captureBaseline() so a
// dynamic import from goalplan.test.ts evaluates exports only.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GOALPLAN_FILE, goalplanDir, readGoalplanDetailed } from "../../src/goalplan.ts";

const repo = process.cwd();
const sourceRoot = join(repo, ".codexclaw", "goalplans");
const output = join(dirname(fileURLToPath(import.meta.url)), "goalplans-pre-change-baseline.json");
const measuredOn = "2026-08-29";

/**
 * Enum-valued keys keep their literal strings so a de-identified fixture still
 * exercises the same parser branches; every other string is aliased.
 */
const preservedEnumsByKey = new Map([
  ["status", new Set([
    "pending", "in_progress", "done", "blocked", "superseded", "open", "met",
    "launching", "in_flight", "approved", "changes_requested", "inconclusive",
  ])],
  ["surface", new Set(["logic", "web", "tui"])],
  ["source", new Set(["freeze", "none"])],
  ["purpose", new Set(["plan_audit", "final_gate"])],
  ["verdict", new Set(["pass", "near-pass", "fail"])],
  ["kind", new Set([
    "resolved", "unavailable", "parsed", "absent", "unreadable", "invalid-json", "invalid-shape",
  ])],
  ["sourceClass", new Set(["normal", "legacy-text-criterion"])],
  ["field", new Set(["criteria-shape", "other-shape"])],
]);

export function aliasFixtureStrings(value, ordinal, aliases = new Map(), key = "") {
  if (Array.isArray(value)) {
    return value.map((item) => aliasFixtureStrings(item, ordinal, aliases, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
      childKey,
      aliasFixtureStrings(child, ordinal, aliases, childKey),
    ]));
  }
  if (typeof value !== "string" || preservedEnumsByKey.get(key)?.has(value)) return value;
  if (!aliases.has(value)) {
    aliases.set(value, `fixture-${ordinal}-string-${String(aliases.size + 1).padStart(4, "0")}`);
  }
  return aliases.get(value);
}

export function normalizeResult(result) {
  if (result.plan && result.diagnostic === null) return { kind: "parsed" };
  assert.ok(result.diagnostic);
  return result.diagnostic.kind === "invalid-shape"
    ? {
        kind: result.diagnostic.kind,
        field: result.diagnostic.field === "criteria[] entries (each needs scenario/expectedEvidence/status)"
          ? "criteria-shape"
          : "other-shape",
      }
    : { kind: result.diagnostic.kind };
}

export function sourceClass(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.criteria)) return "normal";
  return raw.criteria.some((criterion) => (
    criterion && typeof criterion === "object"
    && typeof criterion.text === "string"
    && typeof criterion.scenario !== "string"
  )) ? "legacy-text-criterion" : "normal";
}

export const PRIVACY_PATTERNS = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /"\/(?!\/)/,
  /"[A-Za-z]:\\\\/,
  /\b[0-9a-f]{40}\b/i,
];

/**
 * Fails when a fixture still carries private data, or when de-identification
 * changed what the parser makes of it. Exported so goalplan.test.ts runs both
 * invariants on every suite instead of only when the generator is invoked.
 */
export function assertFixturesPrivateAndStable(fixtureList, reparseRoot) {
  const serialized = `${JSON.stringify(fixtureList, null, 2)}\n`;
  const hit = PRIVACY_PATTERNS.find((pattern) => pattern.test(serialized));
  if (hit) {
    throw new Error(`baseline privacy scan matched ${hit}`);
  }
  for (const fixture of fixtureList) {
    const dir = goalplanDir(reparseRoot, fixture.alias);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, GOALPLAN_FILE), `${JSON.stringify(fixture.plan, null, 2)}\n`);
    assert.deepEqual(
      normalizeResult(readGoalplanDetailed(reparseRoot, fixture.alias)),
      fixture.expected,
      `fixture ${fixture.ordinal} changed parser result after de-identification`,
    );
  }
}

function captureBaseline() {
  const sourceFiles = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/${GOALPLAN_FILE}`)
    .filter((relativeFile) => existsSync(join(sourceRoot, relativeFile)))
    .sort();

  const fixtures = sourceFiles.map((relativeFile, index) => {
    const ordinal = index + 1;
    const sourceSlug = dirname(relativeFile);
    const raw = JSON.parse(readFileSync(join(sourceRoot, relativeFile), "utf8"));
    assert.equal(typeof raw.slug, "string");
    const alias = `fixture-${ordinal}`;
    const expected = normalizeResult(readGoalplanDetailed(repo, sourceSlug));
    const aliases = new Map([[raw.slug, alias]]);
    const plan = aliasFixtureStrings(raw, ordinal, aliases);
    assert.equal(plan.slug, alias);
    return { ordinal, alias, sourceClass: sourceClass(raw), expected, plan };
  });
  const snapshot = {
    measuredOn,
    sourceCount: fixtures.length,
    manifest: fixtures.map(({ ordinal, alias, sourceClass: cls, expected }) => ({
      ordinal,
      alias,
      sourceClass: cls,
      expected,
    })),
    fixtures,
  };
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (PRIVACY_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("baseline privacy scan found a UUID, absolute path, or 40-character hash");
  }

  const suppliedReparseRoot = process.env.CXC_GOALPLAN_BASELINE_TMP;
  const reparseRoot = suppliedReparseRoot ?? mkdtempSync(join(tmpdir(), "codexclaw-goalplan-baseline-"));
  try {
    assertFixturesPrivateAndStable(fixtures, reparseRoot);
  } finally {
    if (!suppliedReparseRoot) rmSync(reparseRoot, { recursive: true, force: true });
  }

  writeFileSync(output, text);
  const parsed = snapshot.manifest.filter((entry) => entry.expected.kind === "parsed").length;
  const invalid = snapshot.manifest.filter((entry) => entry.expected.kind === "invalid-shape").length;
  console.log(`wrote ${fixtures.length} private-data-free fixtures (${parsed} parsed, ${invalid} invalid-shape) to ${output}`);
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("capture-goalplan-baseline.mjs")) {
  captureBaseline();
}
