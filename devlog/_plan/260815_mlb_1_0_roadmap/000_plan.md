# MLB 1.0 Roadmap — Implementation Plan

## Objective

Register and implement the codexclaw MLB 1.0 roadmap: 8 execution issues covering
docs, operations, capability lock, typed dispatch, rule impact ledger, reference league,
scouting bundle, and release gate.

## Constraints

- codexclaw is a thin Codex-native harness — no replacement runtime machinery
- Preserve 13-skill dev family, progressive disclosure, C0/C1 fast paths
- No frontend/UIUX, PABCD FSM runtime, or design-grammar changes
- Each issue is one PABCD work-phase cycle

## Registration (complete)

- Milestone: MLB 1.0 — Native Thin Harness (milestone #1)
- Master issue: #22
- Execution issues: #14 (docs), #15 (ops), #16 (caplock), #17 (dispatch),
  #18 (rules), #19 (league), #20 (bundle), #21 (release)
- Draft PR: #23 (docs/native-thin-harness.md + docs/roadmap-mlb-1.0.md)

## Dependency-ordered phase map

### Phase 1 (010): docs(architecture) — issue #14
- docs-only: draft PR #23 already contains the deliverables
- Verify links and content, close issue via PR merge or verification

### Phase 2 (020): ops(release) — issue #15
- Implement unified cxc doctor typed result with --json
- Add lifecycle evidence matrix (install/upgrade/recovery/uninstall)
- Deterministic fixtures and CI coverage
- Component: cxc-ops (plugins/codexclaw/components/cxc-ops/)
- Dependencies: none new

### Phase 3 (030): architecture(native) — issue #16
- Add versioned capability lock fixture
- Wire into #7 capability resolver
- Deterministic present/absent/malformed/unsupported tests
- Dependencies: #7 (closed, resolver exists)

### Phase 4 (040): feat(dispatch) — issue #17
- Define DispatchPacket and DispatchReceipt schemas
- Schema validation
- V1/V2 adapter tests
- Component: subagent-config (plugins/codexclaw/components/subagent-config/)
- Dependencies: none new

### Phase 5 (050): measurement(rules) — issue #18
- Opt-in rule impact recording schema
- Analysis/classification report
- Dependencies: #11 activation traces (closed)

### Phase 6 (060): measurement(league) — issue #19
- Pin representative repository snapshots
- Controlled comparison framework
- First baseline report
- Dependencies: none new

### Phase 7 (070): ops(diagnostics) — issue #20
- Implement cxc doctor --bundle
- Sentinel-secret scanning tests
- Windows/POSIX path redaction tests
- Dependencies: #15 doctor implementation

### Phase 8 (080): release(1.0) — issue #21
- Machine-readable candidate manifest schema
- Link all required receipts
- Supported-platform gate verification
- Dependencies: all previous phases

## Verifiers

- npm test: run test suite (exit 0)
- npm run build: build plugin (exit 0)
- npm run gate: run gate checks (exit 0)
- gh issue list: verify issue state
- gh pr view 23: verify PR state
