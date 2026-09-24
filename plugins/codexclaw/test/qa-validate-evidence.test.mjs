// validate-evidence tests (WP13 / plan 070).
//
// Lives here rather than beside the script because the npm test glob collects
// test/*.test.mjs — a test the suite never runs guards nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidence, sha256Tree } from "../skills/qa/scripts/validate-evidence.mjs";
import { buildGoalplan, writeGoalplan, readGoalplan, validateGoalplan } from "../components/pabcd-state/src/goalplan.ts";
import { compareSource } from "../components/pabcd-state/src/source-identity.ts";
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

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function desktopFixture(root, id = "desktop", identityChange = (value) => value) {
  const dir = join(qaDir(root), id);
  const app = join(dir, "Demo.app");
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  mkdirSync(join(app, "Contents", "Resources"), { recursive: true });
  writeFileSync(join(app, "Contents", "Info.plist"), "<plist>Demo</plist>");
  writeFileSync(join(app, "Contents", "MacOS", "Demo"), "demo executable\n");
  writeFileSync(join(app, "Contents", "Resources", "a.txt"), "resource A\n");
  writeFileSync(join(dir, "Demo.zip"), "archive bytes\n");
  const identityRecord = identityChange({
    version: 1,
    bundlePath: "Demo.app",
    bundleExecutable: "Demo",
    bundleIdentifier: "com.example.demo",
    coveredRowIds: ["D-PACKAGE"],
    components: [
      { id: "app", kind: "app", path: "Demo.app", sha256: sha256Tree(app) },
      { id: "exe", kind: "executable", path: "Demo.app/Contents/MacOS/Demo", sha256: hash("demo executable\n"), architectures: ["arm64", "x86_64"] },
      { id: "archive", kind: "archive", path: "Demo.zip", sha256: hash("archive bytes\n") },
      { id: "dmg", kind: "dmg", applicable: false, reason: "not packaged" },
      { id: "updater", kind: "updater", applicable: false, reason: "not packaged" },
    ],
    signing: { mode: "ad-hoc", entitlements: { "com.apple.security.app-sandbox": false } },
    toolchain: { xcodeSelectPath: "/Applications/Xcode.app", sdk: "macosx", swiftcVersion: "6.0" },
  });
  writeFileSync(join(dir, "artifact-identity.json"), JSON.stringify(identityRecord));
  writeFileSync(join(dir, "verdict.json"), JSON.stringify(webVerdict({
    scenario: "D-PACKAGE", surface: "cli", artifactRefs: ["artifact-identity.json"],
    desktopArtifact: true, criterionIds: ["c-3"],
  })));
  return { dir, app, identity: identityRecord };
}

test("desktop artifact identity binds a real app, verdict and criterion", () => {
  const root = workspace();
  desktopFixture(root);
  const result = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(result.ok, true, result.errors.join("; "));
  const parsed = parseSourceBoundReceipt(result.receiptPath, root, "qa");
  assert.ok(!("error" in parsed), JSON.stringify(parsed));
  assert.deepEqual(parsed.artifactManifest.map((entry) => entry.kind), ["verdict", "artifact-identity"]);
  assert.deepEqual(parsed.artifactManifest[1].criterionIds, ["c-3"]);
});

test("referenced identity without desktopArtifact is validated and bound without criterion IDs", () => {
  const root = workspace();
  const { dir } = desktopFixture(root);
  const verdict = JSON.parse(readFileSync(join(dir, "verdict.json"), "utf8"));
  delete verdict.desktopArtifact;
  delete verdict.criterionIds;
  writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict));
  const result = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(result.ok, true, result.errors.join("; "));
  const parsed = parseSourceBoundReceipt(result.receiptPath, root, "qa");
  assert.ok(!("error" in parsed), JSON.stringify(parsed));
  assert.equal(parsed.artifactManifest[1].criterionIds, undefined);
});

test("desktop verdict requires identity and unique criterion IDs", () => {
  for (const ids of [undefined, [], ["c-3", "c-3"], ["bad"]]) {
    const root = workspace();
    const { dir } = desktopFixture(root);
    const verdict = JSON.parse(readFileSync(join(dir, "verdict.json"), "utf8"));
    verdict.criterionIds = ids;
    writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict));
    const result = validateEvidence(qaDir(root), { emitReceipt: true });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /criterionIds/);
    assert.equal(result.receiptPath, null);
  }
  const root = workspace();
  const { dir } = desktopFixture(root);
  const verdict = JSON.parse(readFileSync(join(dir, "verdict.json"), "utf8"));
  verdict.artifactRefs = ["Demo.zip"];
  writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict));
  assert.match(validateEvidence(qaDir(root)).errors.join(" "), /exactly one artifact-identity/);
});

test("identity schema and component bytes fail before receipt creation", () => {
  for (const change of [
    (i) => { i.coveredRowIds = ["D-OTHER"]; },
    (i) => { i.components[1].sha256 = "BAD"; },
    (i) => { i.components = {}; },
    (i) => { i.signing = { mode: "Developer ID", entitlements: {} }; },
    (i) => { i.signing.entitlements.bad = { nested: true }; },
    (i) => { delete i.toolchain.sdk; },
    (i) => { i.components[2] = { id: "archive", kind: "archive", applicable: false, reason: "none" }; },
  ]) {
    const root = workspace();
    desktopFixture(root, "desktop", (identityRecord) => { change(identityRecord); return identityRecord; });
    const result = validateEvidence(qaDir(root), { emitReceipt: true });
    assert.equal(result.ok, false, `invalid identity passed: ${change}`);
    assert.equal(result.receiptPath, null);
  }
});

test("bundle tree digest changes with bytes and resource path", () => {
  const root = workspace();
  const { app } = desktopFixture(root);
  const first = sha256Tree(app);
  writeFileSync(join(app, "Contents", "Resources", "a.txt"), "changed");
  assert.notEqual(sha256Tree(app), first);
  assert.match(validateEvidence(qaDir(root)).errors.join(" "), /tree digest does not match/);
  writeFileSync(join(app, "Contents", "Resources", "a.txt"), "resource A\n");
  renameSync(join(app, "Contents", "Resources", "a.txt"), join(app, "Contents", "Resources", "b.txt"));
  assert.notEqual(sha256Tree(app), first);
});

test("app requires a directory, plist, consistent paths and digest", () => {
  for (const breakBundle of [
    ({ app }) => { rmSync(app, { recursive: true }); writeFileSync(app, "plain file"); },
    ({ app }) => { unlinkSync(join(app, "Contents", "Info.plist")); },
    ({ dir, identity: record }) => { record.bundlePath = "Other.app"; writeFileSync(join(dir, "artifact-identity.json"), JSON.stringify(record)); },
    ({ dir, identity: record }) => { record.components[1].path = "Demo.zip"; writeFileSync(join(dir, "artifact-identity.json"), JSON.stringify(record)); },
    ({ dir, identity: record }) => { delete record.components[0].sha256; writeFileSync(join(dir, "artifact-identity.json"), JSON.stringify(record)); },
  ]) {
    const root = workspace();
    const fixture = desktopFixture(root);
    breakBundle(fixture);
    assert.equal(validateEvidence(qaDir(root)).ok, false, String(breakBundle));
  }
});

test("bundle escaping symlink is rejected; internal symlink is hashed", (t) => {
  const root = workspace();
  const { app } = desktopFixture(root);
  try { symlinkSync("../MacOS/Demo", join(app, "Contents", "Resources", "link")); }
  catch { t.skip("file symlinks unavailable"); return; }
  const internal = sha256Tree(app);
  assert.match(internal, /^[0-9a-f]{64}$/);
  const outside = join(root, "outside.txt");
  writeFileSync(outside, "outside");
  unlinkSync(join(app, "Contents", "Resources", "link"));
  symlinkSync(outside, join(app, "Contents", "Resources", "link"));
  assert.match(validateEvidence(qaDir(root)).errors.join(" "), /bundle symlink escapes the bundle/);
});

test("manifest detects changed verdict, identity and receipt-only criterion edits", () => {
  for (const target of ["verdict.json", "artifact-identity.json"]) {
    const root = workspace();
    const { dir } = desktopFixture(root);
    const result = validateEvidence(qaDir(root), { emitReceipt: true });
    assert.equal(result.ok, true, result.errors.join("; "));
    writeFileSync(join(dir, target), readFileSync(join(dir, target), "utf8") + " ");
    assert.match(parseSourceBoundReceipt(result.receiptPath, root, "qa").error, /digest does not match/);
  }
  const root = workspace();
  desktopFixture(root);
  const result = validateEvidence(qaDir(root), { emitReceipt: true });
  const receipt = JSON.parse(readFileSync(result.receiptPath, "utf8"));
  receipt.artifactManifest[1].criterionIds = ["c-4"];
  writeFileSync(result.receiptPath, JSON.stringify(receipt));
  assert.match(parseSourceBoundReceipt(result.receiptPath, root, "qa").error, /criterionIds do not match/);
});

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
  let result;
  try {
    execFileSync("node", [script], { encoding: "utf8", stdio: "pipe" });
    result = { exited: 0, stderr: "" };
  } catch (err) {
    result = { exited: err.status, stderr: String(err.stderr) };
  }
  // Asserting outside the catch: an assert.fail inside it is itself caught, and
  // then the assertion reads its own AssertionError instead of the child's exit,
  // which is how a genuinely broken entry point read as a code mismatch.
  assert.equal(result.exited, 2, "the entry point must run and reject a missing directory");
  assert.match(result.stderr, /usage: validate-evidence\.mjs/);
});

test("bound QA receipts retain the root and reject mixed worktrees", () => {
  const root = workspace();
  const sourceRoot = resolve(root, "worktree");
  scenario(root, "a", webVerdict({ sourceSnapshotAt: identity({ sourceRoot }) }), { "shot.png": pngBytes() });
  const receipt = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(receipt.ok, true, receipt.errors.join("; "));
  const parsed = parseSourceBoundReceipt(receipt.receiptPath, root, "qa");
  assert.equal(parsed.sourceIdentity?.sourceRoot, sourceRoot);
  scenario(root, "b", webVerdict({ sourceSnapshotAt: identity({ sourceRoot: resolve(root, "other") }) }), { "shot.png": pngBytes() });
  assert.equal(validateEvidence(qaDir(root)).ok, false);
});

test("malformed QA source roots are refused", () => {
  for (const sourceRoot of [123, "", "relative/path"]) {
    const root = workspace();
    scenario(root, "a", webVerdict({ sourceSnapshotAt: identity({ sourceRoot }) }), { "shot.png": pngBytes() });
    assert.equal(validateEvidence(qaDir(root)).ok, false);
  }
});


test("bound QA receipt survives final goalplan validation and root removal fails", () => {
  const root = workspace();
  const source = identity({ sourceRoot: resolve(root, "worktree") });
  scenario(root, "a", webVerdict({ sourceSnapshotAt: source }), { "shot.png": pngBytes() });
  const qa = validateEvidence(qaDir(root), { emitReceipt: true });
  assert.equal(qa.ok, true, qa.errors.join("; "));
  const testPath = join(root, ".codexclaw", "evidence", "test.json");
  writeFileSync(testPath, JSON.stringify({ kind: "test", sourceIdentity: source }));
  const base = buildGoalplan({ objective: "bound final QA" });
  const plan = { ...base, schemaVersion: 2,
    workPhases: [{ id: "wp1", title: "done", status: "done", tasks: [], criteriaIds: ["c-1"] }],
    criteria: [{ id: "c-1", scenario: "visual", expectedEvidence: "capture", capturedEvidence: qa.receiptPath, status: "met", surface: "web" }],
    finalGate: { status: "approved", reviewRoundId: "r1", sourceIdentity: source, testReceiptPath: testPath, qaReceiptPath: qa.receiptPath, verdict: "pass", qaRequired: true, updatedAt: source.capturedAt },
    reviewRounds: [{ roundId: "r1", purpose: "final_gate", planPath: "plan.md", planSha256: "c".repeat(64), status: "approved", openedAt: source.capturedAt, lane: { launchId: "r1-x", verdict: "pass", sourceIdentity: source } }],
  };
  writeGoalplan(root, plan);
  const restored = readGoalplan(root, plan.slug);
  const context = { cwd: root, captureSourceIdentity: () => source, compareSource, readReceipt: (path, kind) => parseSourceBoundReceipt(path, root, kind) };
  const result = validateGoalplan(restored, context);
  assert.equal(result.ok, true, result.reasons.join("; "));
  const bytes = JSON.parse(readFileSync(qa.receiptPath, "utf8"));
  delete bytes.sourceIdentity.sourceRoot;
  writeFileSync(qa.receiptPath, JSON.stringify(bytes));
  const invalid = validateGoalplan(restored, context);
  assert.equal(invalid.ok, false);
  assert.match(invalid.reasons.join("; "), /QA receipt.*different source/);
});
