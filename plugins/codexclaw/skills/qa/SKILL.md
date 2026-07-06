---
name: cxc-qa
description: "MUST USE after building or changing any user-facing surface (web UI, TUI, CLI, HTTP API) before claiming done — manual, surface-driving QA: real invocations on real surfaces, captured artifacts, adversarial classes, and teardown receipts feeding the PABCD C gate. Automated suites are dev-testing's job; this skill proves the surface actually works when driven. Triggers: manual QA, QA this, does it actually work, drive the UI, smoke test, visual QA, screenshot check, TUI alignment, CJK clipping, 수동 QA, 실제로 되는지 확인, 동작 확인, 직접 돌려봐."
metadata:
  short-description: "Manual surface-driving QA gate: faithful channels, evidence matrix, adversarial classes, teardown receipts."
---

# cxc-qa — Manual Surface QA Gate

Prove a built surface works by DRIVING it, not by inferring from green tests.
No scenario closes on a status string; it closes on a captured artifact from a
real surface, an adversarial pass, and a teardown receipt. Everything in this
skill is E7 discipline (agent-followed, not hook-enforced); the one shipped E2
touchpoint is noted in §7. Lineage: lazycodex `visual-qa` / `review-work` /
`lazycodex-qa-executor` (vendored at `devlog/.lazycodex/`), translated to
codexclaw's no-server, Codex-native-tool model.

## Modular References

| File | When to Read | What It Covers |
| --- | --- | --- |
| `references/visual-qa.md` | ANY visual surface verdict (web UI, TUI) | Companion-skill grounding (QA-VISUAL-COMPANION-01), objective-metrics-first rule (QA-VISUAL-METRIC-01), oracle judge limits + rubric, extended adversarial classes (reflow/zoom/dark/reduced-motion/CJK), TUI harness addendum, source URLs |

The QA tool ladder (QA-TOOL-LADDER-01 — in-app browser > chrome > computer-use,
agbrowse for public-URL shape checks only) is canonically owned by
`dev-testing` §4.6.

## 0. Scope split (single ownership)

- `cxc-dev-testing` owns AUTOMATED verification: unit, contract, E2E,
  Playwright suites, CI gates — and the exploratory-tier TOOL ROUTING
  (which browser/computer-use tool drives which surface, §4.6 TEST-CU-QA-01).
- `cxc-qa` (this skill) owns the manual QA PROCEDURE: scenario matrix,
  faithful channels, evidence contract, adversarial classes, oracle passes,
  teardown receipts.
- Both feed PABCD C. Neither replaces the other: a green suite without a
  driven surface can still ship a broken border or a dead route; a driven
  surface without a suite has no regression guard. Promote a QA flow to a
  deterministic test (dev-testing §4.1) when it must stay guarded.

## 1. Trust nothing

Executor claims, previous logs, transcript memory, and evidence summaries are
untrusted until you inspect or reproduce them. A remembered "it worked" is not
evidence (FAMILY-PROOF-01). Every PASS points at a non-empty artifact you (or
your dispatched QA worker) captured THIS round.

## 2. Surface detection + faithful channels

State the exact surface and invocation BEFORE running each scenario. Use the
channel faithful to the surface — CLI output parsed from the wrong layer is
not evidence of the layer you changed:

| Surface | Faithful channel | Artifact |
| --- | --- | --- |
| HTTP API | `curl -i` (headers + body) | response capture |
| CLI | real invocation, stdout/stderr + exit code captured | terminal capture |
| TUI | `tmux capture-pane -p` (+ `-e` ANSI copy), REAL terminal width stated — see `references/visual-qa.md` §TUI | plain + ANSI captures |
| Web UI | browser skill / Playwright screenshot at a STATED viewport, inspected via `view_image` — full workflow in `references/visual-qa.md` | screenshot(s) |
| Desktop GUI | computer-use + screenshots (per-app approval; never drive terminals/Codex itself) | screenshots + action log |

Tool choice for the browser/CU rows follows QA-TOOL-LADDER-01 (`dev-testing`
§4.6); the inspect -> act -> re-inspect protocol applies. Data-shaped behavior
may use parsed CLI/data output as its channel.

## 3. Evidence contract

Artifacts live under `.codexclaw/evidence/<sessionId>/qa/<scenario-id>/`:

- `invocation.txt` — the exact command(s)/steps, copy-pasteable.
- the artifact(s) — capture, screenshot, response, transcript.
- `verdict.json` — `{ "scenario": "<id>", "criterion": "<what this proves>",
  "surface": "http|cli|tui|web|gui", "verdict": "PASS|FAIL|NA",
  "artifactRefs": ["<relative paths>"], "note": "<one line>" }`.

Rules:

- Every PASS names at least one non-empty artifact in `artifactRefs`.
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

## 4. Adversarial classes

For each scenario, probe every APPLICABLE class and record the observable
result per class (own row in the matrix):

1. Empty/absent input (no args, empty body, blank field).
2. Malformed input (bad flag, invalid JSON, wrong type, unknown enum).
3. Boundary size (longest plausible value, zero-length list, max count).
4. Repeat/concurrent invocation (double-submit, rerun idempotence).
5. (web/TUI only) Narrow viewport / narrow terminal width + CJK text
   (clipping, baseline drop, wide-char column drift, border misalignment).

Class 5 findings feed the visual pass in §5. N/A classes follow the §3 rule.

## 5. Oracle passes (depth scales by work class)

- **C2**: run the matrix yourself; one self-review pass over the artifacts
  before writing verdicts.
- **C3+ with a visual surface**: dispatch TWO parallel read-only reviewer
  passes (`spawn_agent`, explorer role, DISPATCH-TASK-01 packet; paste the
  captures/screenshot paths + script/tool observations into each prompt —
  do not make the oracle re-derive context):
  Both passes are rubric-bound: attach `cxc-dev-frontend` (anti-slop +
  visual-verification checklist ARE the rubric) and, for design-direction
  judgments only, `cxc-dev-uiux-design`; every PASS cites the rule ids it
  checked (QA-VISUAL-COMPANION-01, `references/visual-qa.md`). Capture the
  objective evidence layer FIRST (viewport matrix, DOM text extraction for
  text/CJK claims, console errors — QA-VISUAL-METRIC-01).
  - Pass A — design-system + functional integrity: is this a real, coherent
    implementation driven by reused primitives (not a mock-only screen or a
    pasted raster), and do the intended features actually work?
  - Pass B — visual fidelity + CJK precision: open the screenshots/captures
    directly; hunt clipping, baseline drop, glyph breakage, KO/JA/ZH
    precision, border/box-drawing drift.
  Synthesize both into one PASS / REVISE / FAIL in the MAIN session. On FAIL,
  REVIEW-SYNTHESIS-01 applies before any re-dispatch; revision rounds reuse
  the same oracle (DISPATCH-ACTOR-01), and the final C gate gets a fresh one.
- Long passes: require `WORKING: <task> - <phase>` progress messages and
  `BLOCKED: <reason>` from dispatched QA workers; a wait timeout is not a
  failure signal (a running child is alive). A lane that crashed or returned
  no deliverable is INCONCLUSIVE — never counted as PASS.

## 6. Teardown receipts

Every resource the QA pass spawned — dev-server PIDs, ports, tmux sessions,
browser tabs, containers, temp dirs — gets its own teardown line WITH proof:
`lsof -i :<port>` empty, `tmux ls` clean, `ps` check, `rm` + absent check.
A stateless pass records an explicit "no resources spawned" line with what was
checked. No QA asset is left running after the verdict.

## 7. Binding to PABCD C

A user-facing surface change closes C with BOTH: the automated gate
(dev-testing) AND this skill's QA matrix — any FAIL verdict blocks the C>D
claim until repaired (LOOP-REPAIR-01 counts apply) or the criterion is
re-scoped through a P-phase amendment, never silently. This is E7 discipline:
no hook reads verdict.json. The E2 touchpoint: QA delegated to a `worker`
subagent rides the existing SubagentStop receipt gate — the worker cannot
finish without a non-empty receipt under `.codexclaw/evidence/`.

## v2 candidates (deliberately not shipped)

- Node-only ports of lazycodex's `image-diff` / `tui-check` scoring scripts
  (objective similarity/overflow JSON as oracle reference input). v1 uses
  direct `view_image` inspection + inline width checks; vendor scripts only
  if field friction shows the inline checks miss real defects.
- A review-work-style multi-lane orchestrator: not planned — the A gate,
  C adversarial review, REVIEW-SYNTHESIS-01, and this skill already cover
  those lanes without a 5-spawn token bill.
