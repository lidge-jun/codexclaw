## 3. Evidence contract

Artifacts live under `.codexclaw/evidence/<sessionId>/qa/<scenario-id>/`:

- `invocation.txt` — the exact command(s)/steps, copy-pasteable.
- the artifact(s) — capture, screenshot, response, transcript.
- `verdict.json` — `{ "scenario": "<id>", "criterion": "<what this proves>",
  "surface": "http|cli|tui|web|gui", "verdict": "PASS|FAIL|NA",
  "artifactRefs": ["<relative paths>"], "note": "<one line>",
  "capturedAt": "<RFC3339>", "sourceSnapshotAt": { "kind": "resolved|unavailable",
  "commitSha": "<sha>", "dirty": <bool>, "capturedAt": "<RFC3339>",
  "treeHash": "<sha256, dirty only>" } }`.
  On `web` and `gui` only, also `"captureChecks": { "signature": <bool>,
  "nonEmpty": <bool>, "dimensionsMatch": <bool>, "composited": <bool> }` —
  all four keys (QA-CAPTURE-INTEGRITY-01 in `visual-qa.md`).
  A desktop row that depends on a built artifact also sets
  `"desktopArtifact": true` and `"criterionIds": ["c-3"]` (its goalplan
  criteria) and lists exactly one `artifact-identity.json` in `artifactRefs`.
  The identity schema is DESKTOP-ARTIFACT-01 in cxc-dev-devops
  [native-desktop-acceptance.md](../../dev-devops/references/native-desktop-acceptance.md).

Rules:

- Every PASS names at least one non-empty artifact in `artifactRefs`.
- `capturedAt` and `sourceSnapshotAt` are required on every surface: knowing
  when evidence was captured, and against which tree, does not depend on what
  kind of surface produced it (QA-EVIDENCE-FRESHNESS-01).
- `inferred` and `partial` verdicts DO NOT EXIST — a scenario either ran
  against the real surface or it did not.
- A scenario that cannot run is a FAIL carrying the blocker and the missing
  prerequisite, not a skip.
- `NA` is legal only when the class structurally cannot apply to the surface
  (e.g. viewport class on a headless API), always with a recorded reason.
- This directory is shared with the SubagentStop receipt gate's root
  (`.codexclaw/evidence/`); main-session QA artifacts do not interact with
  worker receipts (the gate validates only the worker's own
  `EVIDENCE_RECORDED:` marker path).
- A worker that CANNOT write there was dispatched wrong, not gated wrong: read-only
  lanes belong on `agent_type:"explorer"`, which the gate never touches. The retry
  budget is terminal, so a mis-routed worker is released rather than trapped — but its
  verdict stays unresolved and blocks goal completion until a receipt settles it.

After every scenario is done, emit the aggregate receipt:

```
node plugins/codexclaw/skills/qa/scripts/validate-evidence.mjs \
  .codexclaw/evidence/<sessionId>/qa/ --emit-receipt
```

It validates every `verdict.json`, confirms they all describe the same tree,
and writes `.codexclaw/evidence/<sessionId>/qa-receipt.json`. Validated verdict
and identity files are hashed into typed `artifactManifest` entries
(`path`, `sha256`, `kind`, optional `criterionIds`), rechecked whenever the
receipt is read. A schemaVersion 2+ plan with a recorded final gate needs an
identity entry for each non-native desktop criterion; default v1 plans rely on
this ingress validation only. Any failure
leaves no receipt behind, including deleting one an earlier run produced —
a receipt that outlives the QA it attests to is worse than none.

Current limitation: the final gate does not pick this file up on its own. Until
the `final-gate` lifecycle CLI exists, point `finalGate.qaReceiptPath` at that
path by editing the goalplan directly. Remove this paragraph when that CLI lands.
