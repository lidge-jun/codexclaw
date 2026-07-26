// validate-evidence tests (WP13 / plan 070).
//
// Lives here rather than beside the script because the npm test glob collects
// test/*.test.mjs — a test the suite never runs guards nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidence } from "../skills/qa/scripts/validate-evidence.mjs";
import { parseSourceBoundReceipt } from "../components/pabcd-state/src/source-receipt.ts";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function identity(over = {}) {
  return { kind: "resolved", commitSha: "abc1234", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z", ...over };
}

function checks(over = {}) {
  return { signature: true, nonEmpty: true, dimensionsMatch: true, composited: true, ...over };
}

/** A real 8x8 PNG: signature plus an IHDR chunk carrying the dimensions. */
function pngBytes(width = 8, height = 8) {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  return Buffer.concat([PNG_MAGIC, ihdr]);
}

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "cxc-qa-"));
  mkdirSync(join(root, ".codexclaw", "evidence", "s1", "qa"), { recursive: true });
  return root;
}

function qaDir(root) {
  return join(root, ".codexclaw", "evidence", "s1", "qa");
}

/**
 * Write one scenario. `artifacts` maps a filename to its bytes; passing a
 * filename without bytes means "referenced but never created".
 */
function scenario(root, id, verdict, artifacts = {}) {
  const dir = join(qaDir(root), id);
  mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(artifacts)) {
    if (bytes !== null) writeFileSync(join(dir, name), bytes);
  }
  writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict));
  return dir;
}

function webVerdict(over = {}) {
  return {
    scenario: "s",
    criterion: "c",
    surface: "web",
    verdict: "PASS",
    artifactRefs: ["shot.png"],
    note: "n",
    capturedAt: "2026-01-01T00:00:00.000Z",
    sourceSnapshotAt: identity(),
    captureChecks: checks(),
    ...over,
  };
}

test("V1: a valid web verdict with a real PNG passes", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  const r = validateEvidence(qaDir(root));
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("V2/V3: capturedAt must be present and RFC3339", () => {
  for (const value of [undefined, "2026", "yesterday"]) {
    const root = workspace();
    const v = webVerdict();
    if (value === undefined) delete v.capturedAt;
    else v.capturedAt = value;
    scenario(root, "a", v, { "shot.png": pngBytes() });
    const r = validateEvidence(qaDir(root));
    assert.equal(r.ok, false, `capturedAt=${String(value)} should fail`);
    assert.match(r.errors.join(" "), /capturedAt/);
  }
});

test("V4/V5/V27: sourceSnapshotAt must be a full SourceIdentity", () => {
  const cases = [
    ["missing", undefined],
    ["no kind", { commitSha: "x", dirty: false, capturedAt: "2026-01-01T00:00:00.000Z" }],
    ["no capturedAt", { kind: "resolved", commitSha: "x", dirty: false }],
    ["dirty not boolean", identity({ dirty: "yes" })],
  ];
  for (const [label, value] of cases) {
    const root = workspace();
    const v = webVerdict();
    if (value === undefined) delete v.sourceSnapshotAt;
    else v.sourceSnapshotAt = value;
    scenario(root, "a", v, { "shot.png": pngBytes() });
    assert.equal(validateEvidence(qaDir(root)).ok, false, label);
  }
});

test("V6/V7/V24/V25/V26: captureChecks shape on a web verdict", () => {
  const root1 = workspace();
  scenario(root1, "a", webVerdict({ captureChecks: checks({ composited: false }) }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root1)).ok, false, "a false check fails");

  const root2 = workspace();
  const missing = webVerdict();
  delete missing.captureChecks;
  scenario(root2, "a", missing, { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root2)).ok, false, "absent captureChecks fails");

  const root3 = workspace();
  scenario(root3, "a", webVerdict({ captureChecks: {} }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root3)).ok, false, "an empty object is not four passing checks");

  const root4 = workspace();
  scenario(root4, "a", webVerdict({ captureChecks: checks({ signature: "true" }) }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root4)).ok, false, "a string is not a boolean");

  const root5 = workspace();
  scenario(root5, "a", webVerdict({ captureChecks: checks({ future: true }) }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root5)).ok, true, "extra keys stay allowed");
});

test("V8/V9/V10/V22/V23: non-visual surfaces neither need nor consult captureChecks", () => {
  for (const surface of ["http", "cli", "tui"]) {
    const root = workspace();
    const v = webVerdict({ surface, artifactRefs: ["capture.txt"] });
    delete v.captureChecks;
    scenario(root, "a", v, { "capture.txt": "output\n" });
    assert.equal(validateEvidence(qaDir(root)).ok, true, `${surface} without captureChecks`);
  }

  const root2 = workspace();
  scenario(root2, "a", webVerdict({ surface: "cli", artifactRefs: ["capture.txt"], captureChecks: checks({ signature: false }) }), {
    "capture.txt": "output\n",
  });
  assert.equal(validateEvidence(qaDir(root2)).ok, true, "a false check on cli is ignored");

  const root3 = workspace();
  scenario(root3, "a", webVerdict({ surface: "http", artifactRefs: ["capture.txt"], captureChecks: "garbage" }), {
    "capture.txt": "output\n",
  });
  assert.equal(validateEvidence(qaDir(root3)).ok, true, "garbage captureChecks on http is ignored");
});

test("V11/V12: artifacts must exist and be non-empty on every surface", () => {
  const root1 = workspace();
  scenario(root1, "a", webVerdict(), { "shot.png": null });
  const missing = validateEvidence(qaDir(root1));
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(" "), /artifact is missing: shot\.png/);

  const root2 = workspace();
  scenario(root2, "a", webVerdict({ surface: "cli", artifactRefs: ["capture.txt"] }), { "capture.txt": "" });
  assert.equal(validateEvidence(qaDir(root2)).ok, false, "an empty cli capture fails too");
});

test("V13/V14/V15: PNG checks apply to .png refs on visual surfaces only", () => {
  const root1 = workspace();
  scenario(root1, "a", webVerdict(), { "shot.png": "not a png" });
  const bad = validateEvidence(qaDir(root1));
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(" "), /PNG signature/);

  const root2 = workspace();
  scenario(root2, "a", webVerdict({ artifactRefs: ["shot.png", "net.har"] }), {
    "shot.png": pngBytes(),
    "net.har": "{}",
  });
  assert.equal(validateEvidence(qaDir(root2)).ok, true, "a .har alongside a .png is only existence-checked");

  const root3 = workspace();
  const v = webVerdict({ surface: "http", artifactRefs: ["shot.png"] });
  delete v.captureChecks;
  scenario(root3, "a", v, { "shot.png": "not a png" });
  assert.equal(validateEvidence(qaDir(root3)).ok, true, "surface decides, not the extension");
});

test("V16: IHDR dimensions are reported, not judged", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes(1440, 900) });
  const r = validateEvidence(qaDir(root));
  assert.equal(r.ok, true);
  assert.match(r.notes.join(" "), /1440x900/);
});

test("V18: a corrupt verdict.json fails with the parse error", () => {
  const root = workspace();
  const dir = join(qaDir(root), "a");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "verdict.json"), "{not json");
  const r = validateEvidence(qaDir(root));
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /not valid JSON/);
});

test("V19/V20/V21: gui behaves like web", () => {
  const root1 = workspace();
  scenario(root1, "a", webVerdict({ surface: "gui" }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root1)).ok, true);

  const root2 = workspace();
  const missing = webVerdict({ surface: "gui" });
  delete missing.captureChecks;
  scenario(root2, "a", missing, { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root2)).ok, false);

  const root3 = workspace();
  scenario(root3, "a", webVerdict({ surface: "gui", captureChecks: checks({ nonEmpty: false }) }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root3)).ok, false);
});

test("V29: --emit-receipt writes a receipt carrying the shared identity", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  const r = validateEvidence(qaDir(root), { emitReceipt: true, now: () => "2026-02-02T00:00:00.000Z" });
  assert.equal(r.ok, true, r.errors.join("; "));
  const receipt = JSON.parse(readFileSync(r.receiptPath, "utf8"));
  assert.equal(receipt.kind, "qa");
  assert.equal(receipt.sourceIdentity.commitSha, "abc1234");
  assert.equal(receipt.createdAt, "2026-02-02T00:00:00.000Z");
});

test("V30: a failing run deletes the receipt an earlier passing run left", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  const first = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(first.ok, true);
  const receiptPath = first.receiptPath;
  assert.equal(parseSourceBoundReceipt(receiptPath, root, "qa").kind, "qa");

  // now break one scenario without touching the source
  scenario(root, "b", webVerdict({ captureChecks: checks({ composited: false }) }), { "shot.png": pngBytes() });
  const second = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(second.ok, false);
  assert.equal(second.receiptPath, null);
  const after = parseSourceBoundReceipt(receiptPath, root, "qa");
  assert.ok("error" in after, "the stale receipt must be gone");
});

test("V31: scenarios run against different trees do not produce a receipt", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  scenario(root, "b", webVerdict({ sourceSnapshotAt: identity({ commitSha: "def5678" }) }), { "shot.png": pngBytes() });
  const r = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /different tree/);
});

test("V31b: identities differing only in capturedAt are the same tree", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  scenario(root, "b", webVerdict({ sourceSnapshotAt: identity({ capturedAt: "2026-06-06T06:06:06.000Z" }) }), {
    "shot.png": pngBytes(),
  });
  const r = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("V32: the emitted receipt satisfies the final gate's parser", () => {
  const root = workspace();
  scenario(root, "a", webVerdict(), { "shot.png": pngBytes() });
  const r = validateEvidence(qaDir(root), { emitReceipt: true });
  const parsed = parseSourceBoundReceipt(r.receiptPath, root, "qa");
  assert.ok(!("error" in parsed), `parser rejected the receipt: ${JSON.stringify(parsed)}`);
  assert.equal(parsed.sourceIdentity.commitSha, "abc1234");
  // and it must not pass as a test receipt
  assert.ok("error" in parseSourceBoundReceipt(r.receiptPath, root, "test"));
});

test("V17: the CLI entry point prints usage without a directory", async () => {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills", "qa", "scripts", "validate-evidence.mjs");
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync("node", [script], { encoding: "utf8", stdio: "pipe" });
    assert.fail("expected a non-zero exit");
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(String(err.stderr), /usage: validate-evidence\.mjs/);
  }
});
