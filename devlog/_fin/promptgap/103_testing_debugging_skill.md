# 103 — Testing / Debugging Skill Reinforcement (CORE ASK)

Gap class: PROMPT/SKILL · evidence: explorer #103

> codexclaw has the right categories, but the enforcement language is still softer than the
> best reference material. The biggest misses are not tooling breadth; they are **discipline
> pressure**: multiple-hypothesis RCA, toggle-proof before fix, CI/failure-loop persistence,
> and risk-tier minimums stated inline instead of left in refs. (Postmortem closure was an
> earlier draft target but A-gate confirmed it already exists at `dev-debugging/SKILL.md:270`.)

## The principle (LOCKED)

- `dev-debugging` must force **root-cause proof**, not just careful investigation.
- `dev-testing` must force **risk-tier verification shape**, not just offer harness menus.
- CI / flake language must punish blind retry and "one more push" behavior harder.
- Postmortem closure already exists (`dev-debugging/SKILL.md:270-280`); the residual question
  is placement/visibility, not existence.

## Parity table

| reference 실측 | codexclaw 실측 | 격차 | jaw식 보강 (our way) |
| --- | --- | --- | --- |
| `omo/skills/debugging/SKILL.md:3,8-13,61-76` + `omo/.../02-investigate.md:7-37` | `plugins/codexclaw/skills/dev-debugging/SKILL.md:30-35,120-156` | omo requires a real hypothesis discipline: minimum 3 orthogonal hypotheses, distinguishing evidence, and parallel investigation. codexclaw asks for one explicit hypothesis plus one-variable testing, but does not force anti-confirmation structure. | Add a strict RCA gate: before root-cause claim, write `H1/H2/H3`, one falsifier for each, and collapse duplicates. Root-cause claims without disconfirming evidence are non-compliant. |
| `omo/.../06-fix.md:7-46` | `plugins/codexclaw/skills/dev-debugging/SKILL.md:158-174,178-217` | codexclaw says "address the root cause" and "one logical change", but omits omo's stronger confirmation test: same repro twice + toggle proof + causal mechanism writeup. That leaves room for correlation fixes. | Upgrade "root cause" wording to: confirmed only when captured value matches prediction, repro repeats, and toggling suspected cause removes then restores the bug. Require a one-paragraph mechanism before patching. (A-gate fix: dropped a misattributed `jawcode/.../system-prompt.md:360-363` cite that supports disconfirmation, not toggle-proof; omo `06-fix.md` carries the full weight.) |
| `jawcode/.../ci-green-request.md:1-24` | `plugins/codexclaw/skills/dev-testing/SKILL.md:170-214` | CI guidance is organized, but still static. jaw's prompt is harsher: do not stop after one fix attempt, inspect failing job first, treat each push as a fresh attempt, and loop until latest HEAD is green. codexclaw does not encode that persistence shape in the testing router. | Add a CI-green loop block under CI/flake handling: watch latest HEAD, inspect failing job before edit, make minimal correct fix, run local verification when it reduces next-fail risk, push, re-watch latest HEAD, repeat until green. |
| `cli-jaw/skills_ref/dev-debugging/SKILL.md:270-291` + `cli-jaw/.../postmortem-template.md:1-53` | `plugins/codexclaw/skills/dev-debugging/SKILL.md:270-280` + `references/postmortem-template.md` | NOT a gap (A-gate correction). codexclaw already ships a full "Post-Mortem Discipline" section with the same trigger criteria (customer-impacting, >1h diagnosis, 3+ failed attempts, systemic bug class), template routing, and "at least one prevention action item" at `dev-debugging/SKILL.md:270-280`; `dev/SKILL.md:145` even routes "postmortem" here. The original draft cited `:241-266` (escalation only) and stopped one section short. | Residual nit only: the section sits low in the file. Optionally promote the trigger line nearer the escalation block so it is not skipped. No new content. |
| `cli-jaw/.../crud-test-matrix.md:7-43` | `plugins/codexclaw/skills/dev-testing/SKILL.md:63-68,387-431` | codexclaw references risk-tier verification and has a final checklist, but the inline router text is still vague compared with the matrix: C2/C3/C4 minimums and "one happy + one negative per changed op" live in the ref, not in the operating language. | Inline the minimums in the router: C2 = focused integration/contract + UI smoke if UI changed; C3 = affected suites; C4 = full relevant gates + negatives + durable evidence. Also state the CRUD default directly: one happy + one negative per changed operation. |
| `omo/skills/programming/SKILL.md:98-104` (anti-flake) + `jawcode/.../system-prompt.md:360` ("Do not retry the identical action blindly") | `plugins/codexclaw/skills/dev-testing/SKILL.md:202-214,272-294` | codexclaw has decent anti-flake fragments, but lacks one loud universal sentence at the top level: time-based flake is a bug, not a testing inconvenience; blind retry is forbidden unless state is re-read and the cause is understood. | Promote anti-flake language out of the smell table into general rules: no sleep-based synchronization, no retry-as-fix, no green-on-retry acceptance without deterministic cause and harness correction. (A-gate fix: narrowed the `system-prompt.md` cite to :360, the line that actually states the no-blind-retry rule.) |

## Reinforcement shape

1. Add a **strict RCA evidence gate** near the top of `dev-debugging`: minimum three hypotheses, at least one falsifier, and no root-cause claim without disconfirming evidence.
2. Add a **toggle-proof clause** to `dev-debugging` Phase 4 entry conditions: same repro twice, suspected cause toggled off/on, mechanism written causally.
3. Add a **CI green loop** block to `dev-testing` that mirrors jaw's "latest HEAD is the source of truth" persistence model.
4. **Do NOT re-add postmortem discipline** — it already ships at `dev-debugging/SKILL.md:270-280` with `references/postmortem-template.md`. At most promote the trigger line nearer the escalation block. (Corrected after A-gate flagged the original "missing" claim as a false gap.)
5. Pull the **risk-tier minimums** from `crud-test-matrix.md` into the router body so the operator sees the required floor without opening the ref first.
6. Promote **anti-flake / anti-blind-retry** language from scattered tables into top-level rules so "retry until green" reads as process failure, not normal cleanup.

Status: RESEARCH, text-only.
