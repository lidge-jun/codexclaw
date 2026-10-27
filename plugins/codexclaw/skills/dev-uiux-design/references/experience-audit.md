# Experience audit

Read when the user asks to audit an existing product's design or UX, to define the ideal
state of a product, or to list everything wrong with it before fixing it. This file owns the
design-judgment half of an audit: who the users are, what they are trying to do, what the
ideal experience is, and every gap between that and today. The rendered half (WCAG 2.2 AA
verdicts, violation screenshots, before/after verification and PR evidence) belongs to
dev-frontend's visual audit loop.

## Order of work (UX-AUDIT-01, DEFAULT)

1. **Evidence inventory.** List the surfaces and routes in scope, plus the sources available:
   repository docs, analytics, support notes, research the user supplied. Name what was not
   available; an audit that silently skips a source overstates its coverage.
2. **Personas** (below).
3. **Journeys** per persona.
4. **Ideal state** per journey stage.
5. **Gap ledger**: every difference between today and the ideal.
6. **Concept-level anti-slop findings.**
7. **Handoff** to dev-frontend.

Evidence ids (UX-AUDIT-08) run through every step.

Keep each step's output as a file in one audit folder: the folder the user names, else
`<plan unit>/audit/` in a repository with plan units, else `audit-<YYMMDD>/` in the working
directory. Record the path in the first artifact. Steps 2-4 come before any
screenshot review of style: judging a screen before knowing who it serves turns the audit
into taste.

## Evidence ids (UX-AUDIT-08, STRICT)

Every observation the audit relies on gets an evidence id before it is used: `EV-1`, `EV-2`
... in an `evidence.md` list with type (screenshot, recording, analytics, support note,
`path:line`), route, state, viewport and theme where they apply, and the file path. A
rendered observation (layout, copy on screen, a state, a visual default) needs a screenshot
id; code or data may support it but does not replace the capture. Gap and slop rows cite
EV-ids, and dev-frontend's violation rows reuse the same ids as their before evidence, so
every fix traces back to what was seen.

## Personas (UX-AUDIT-02, DEFAULT)

One row per persona, at most three primary personas; more dilute the ideal state.

| Field | Content |
|---|---|
| ID | `PER-1`, `PER-2` ... |
| Role and primary goal | What the person is trying to get done with this product |
| Context of use | Device and viewport, environment, time pressure, frequency (first visit or daily) |
| Expertise | Domain knowledge and product familiarity |
| Access needs | Keyboard only, screen reader, magnification or text scaling, reduced motion, low vision, cognitive load, slow network |
| Locale | Language, script direction, formats |
| Evidence | Source for each field, or `ASSUMED` with the consequence if wrong |

Personas come from product evidence, not demographics invented to look complete. Provisional
personas are allowed when evidence is thin, but every assumption stays visible and travels
into the gap ledger. Include at least one persona with an access need unless the evidence
rules it out; accessibility gaps otherwise disappear from the audit.

## Journeys (UX-AUDIT-03, DEFAULT)

Map each primary persona through the journey stages in
[universal principles](universal-principles.md#journey-stages): first run, navigation, core
task, input, waiting, errors, settings, help, and leaving and returning (J-23, J-24). Per
stage record:

| Stage | Route or screen | User intent | Expected system response | Current friction | Exit risk |
|---|---|---|---|---|---|

Stages the product does not have are marked N/A with a reason. Stages that exist but were not
reviewed are marked NOT REVIEWED; they are coverage gaps, never silent omissions.

## Ideal state (UX-AUDIT-04, DEFAULT)

For each journey stage, write the ideal as observable acceptance: what the persona sees and
can do, at which viewport and state, measured where possible (steps to finish, time to the
first meaningful action, errors recoverable without losing input). Each statement cites the
P- or J-ids it rests on and, where accessibility applies, the WCAG criterion numbers.

Taste words such as "clean", "modern" or "premium" do not belong in an ideal state until they
are translated into properties a reviewer can check. Vendor visual idioms are not ideals: the
ideal is the experience, and the visual direction stays with
[Design Read](design-read.md).

## Gap ledger (UX-AUDIT-05, STRICT)

| Column | Content |
|---|---|
| GAP-id | `GAP-1` ... |
| Persona, stage | `PER-1`, core task |
| Current | What happens today, with its EV-ids (a screenshot EV-id for anything rendered) |
| Ideal | The UX-AUDIT-04 statement it misses |
| User impact | What the persona loses: time, data, access, trust |
| Principles | P/J ids and WCAG criteria |
| Severity | S1-S4, below |
| Fix direction | The intended change, not the implementation |
| Verifier | How a fix will be proven: a visual audit loop verifier, a WCAG procedure, or a task walk-through |

Severity: **S1** blocks the task or excludes a persona, and includes every WCAG A or AA
failure. **S2** causes errors, rework or abandonment risk. **S3** slows or confuses.
**S4** is polish.

List every observed gap, including gaps the team may decide not to fix. Distinct gaps stay
distinct rows; merging them to shorten the list hides work. A difficult fix is never a reason
to omit a gap. A row without evidence is a hypothesis: mark it `UNVERIFIED` and say what
evidence would confirm it. A wontfix decision belongs to the user or product owner and is
recorded with its reason; it does not delete the row.

## Concept-level anti-slop findings (UX-AUDIT-06, DEFAULT)

Record direction-level problems that make the product generic or wrong for its domain:

| SLOP-id | Location | Screenshot EV-id | Generic default observed | Why it fails this persona or domain | Alternative direction | Exception and its evidence |
|---|---|---|---|---|---|---|

Rendered tells with rule ids (gradient budget, card grids, oversized type and similar) are
recorded by dev-frontend in the violation ledger; this table holds the judgment about the
direction behind them. "It is our brand" counts as an exception only with a cited brand
source, the same bar [anti-rationalization](anti-rationalization.md) applies to other
shortcuts.

## Handoff to implementation (UX-AUDIT-07, DEFAULT)

Hand dev-frontend one packet: the evidence list, personas, journey map, ideal-state table,
gap ledger, anti-slop findings, the fix order (S1 first, then journey order within a severity) and the
verifier for each gap. dev-frontend turns each gap with a rendered symptom into violation
ledger rows that carry the GAP-id and its EV-ids, so the before/after evidence traces back to the user
impact that justified the fix.

## Multi-cycle audits

When fixing the ledger takes more than one PABCD cycle, run it under
[cxc-loop](../../loop/SKILL.md): the host goal states the audit scope, the ledger path and
the closure gate, and work phases follow dependency order (tokens and global layout before
shared components, shared components before routes). cxc-loop owns goals, criteria and
cycle mechanics; this file only defines what the audit hands to them.
