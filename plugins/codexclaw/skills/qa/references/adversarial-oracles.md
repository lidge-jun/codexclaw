## 4. Adversarial classes

For each scenario, probe every APPLICABLE class and record the observable
result per class (own row in the matrix):

1. Empty/absent input (no args, empty body, blank field).
2. Malformed input (bad flag, invalid JSON, wrong type, unknown enum).
3. Boundary size (longest plausible value, zero-length list, max count).
4. Repeat/concurrent invocation (double-submit, rerun idempotence).
5. (web/TUI only) Narrow viewport / narrow terminal width + CJK text
   (clipping, baseline drop, wide-char column drift, border misalignment).

Class 5 findings feed the visual pass in §5. N/A classes follow the [§3 rule](evidence-contract.md#3-evidence-contract).
Surface-specialized class details: `http-api-qa.md` (wire), `cli-tui-qa.md`
(terminal), `visual-qa.md` (extended visual classes).

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
  checked (QA-VISUAL-COMPANION-01, `visual-qa.md`). Capture the
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
