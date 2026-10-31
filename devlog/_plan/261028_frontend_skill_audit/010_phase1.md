# 010 — wp1: dev-uiux-design experience audit and universal principles

Branch: `docs/frontend-skill-audit-uiux` from `origin/dev` (c12c71c8), PR 1 of a manual chain.
Re-verify at this cycle's P: rerun the anchors below against the current tree and amend this
doc before B if lines moved.

## Scope

IN: `plugins/codexclaw/skills/dev-uiux-design/` only. OUT: dev-frontend files (wp2), cross
links into dev-frontend files that do not exist yet (wp3), WCAG wording fixes (wp3).

Links from the new uiux files to the two new dev-frontend files are written as plain text in
this phase because those files land in wp2 and the link gate (check 3 in
`check-prompt-architecture.mjs`) fails on a missing target. wp3 turns them into links.

## File change map

| Op | Path (under plugins/codexclaw/skills/dev-uiux-design/) | Change |
|---|---|---|
| NEW | references/universal-principles.md | Full content A below |
| NEW | references/experience-audit.md | Full content B below |
| MODIFY | SKILL.md | Two router rows (diff C) |
| MODIFY | references/topic-index.md | Two index rows (diff D) |
| MODIFY | references/role-boundaries.md | Audit handoff paragraph (diff E) |
| MODIFY | references/ux-preflight.md | Experience audit checklist section (diff F) |

## A. NEW references/universal-principles.md

~~~~markdown
# Universal interface principles

Read when auditing an existing product experience, writing an ideal state, or checking a
design direction against user needs rather than taste. These are audit questions distilled
from Apple's Human Interface Guidelines, read in full on 2026-10-28 (Foundations, Getting
Started, Patterns, and the Components and Inputs pages listed in the sources). Apple's visual
idioms are excluded on purpose: materials and Liquid Glass, SF Symbols specifics, app icon
grids and platform chrome describe one vendor's style, and this file judges experience.

UX-PRINCIPLES-01 (DEFAULT): when a gap ledger row in [experience audit](experience-audit.md)
rests on one of these principles, cite its P- or J-id so a reviewer can trace the claim. A
principle is a question to ask of the rendered product. It is never a conformance verdict:
WCAG 2.2 AA has its own owner in
dev-frontend's WCAG 2.2 AA reference.

HIG pages live at `https://developer.apple.com/design/human-interface-guidelines/<slug>`.

## Foundations

| ID | Principle | Observable check on the rendered UI | HIG slug |
|---|---|---|---|
| P01 | Core task first | The primary task and its starting action are findable on the first screen. | design-principles |
| P02 | User stays in control | Guided flows can be skipped or cancelled; mistakes can be undone or recovered. | design-principles |
| P03 | Consistency and feedback | The same-looking control behaves the same everywhere; save, select and failure each change visible state at once. | design-principles |
| P04 | Clear hierarchy | Reading order, alignment, spacing and grouping express importance and relationships. | layout |
| P05 | Show what is needed | The first view is not crowded, and the entry point to deferred features is visible. | layout |
| P06 | Adapt to size changes | At narrow viewports and enlarged text nothing overlaps, clips or disappears. | layout, typography |
| P07 | Legible type | Secondary text is readable; mixed typefaces do not blur the hierarchy. | typography |
| P08 | Scalable content | Browser text zoom and page zoom keep important content reachable, reflowing vertically when needed. | accessibility |
| P09 | Sufficient contrast | Rendered foreground/background pairs are measured in light and dark themes. | accessibility, dark-mode |
| P10 | More than color | Errors, selection and state remain identifiable without color (label, shape or icon). | color |
| P11 | Several input methods | The main flow completes by keyboard alone; swipe-only actions have a visible alternative. | accessibility |
| P12 | Easy targets | Adjacent controls on small screens can be hit as intended; no dense mis-tap clusters. | accessibility |
| P13 | Alternatives for media | Meaningful images and icons have text alternatives; video has captions or text; sound cues have a visual cue. | accessibility, icons |
| P14 | Motion with a purpose | Animation explains change or gives feedback, never delays repeated actions, and does not block cancel. | motion |
| P15 | Reduced motion | With `prefers-reduced-motion` set, automatic and large motion drops and state stays understandable. | accessibility, motion |
| P16 | Less time pressure | Important messages do not vanish on a timer before they can be read; they can be dismissed or revisited. | accessibility |
| P17 | Plain action language | Button and link text alone predicts the result; jargon and culture-bound idioms are explained or absent. | writing, inclusion |
| P18 | Next step in every state | Empty states offer a starting action; errors show the fix or retry next to the problem. | writing |
| P19 | Inclusive content | Copy and imagery avoid stereotypes and exclusion; a first-time user finds the knowledge they need on screen. | inclusion |
| P20 | Permission at the moment of need | Data and permission requests appear when the related feature starts and say what is used and why. | privacy |
| P21 | Direction and locale | In right-to-left locales reading and navigation flip, while numbers, photos and logos keep their meaning. | right-to-left |
| P22 | Display preferences | Light and dark modes both keep meaning, contrast, edges and text on every screen, images included. | dark-mode |

## Journey stages

| Stage | ID | Principle | Observable check | HIG slug |
|---|---|---|---|---|
| First run | J-01 | Start the core task right away | No intro screens or setup block the first screen before it is useful. | launching |
| First run | J-02 | Short, optional onboarding taught by doing | Onboarding can be skipped and leads to the first meaningful action. | onboarding |
| First run | J-03 | Accounts and permissions when needed | The product can be tried before sign-up; permission prompts appear in the feature's context. | managing-accounts, onboarding |
| Navigation | J-04 | Few, clearly named destinations that keep place | Moving between sections and back preserves position and task context. | tab-bars, sidebars |
| Navigation | J-05 | Frequent actions visible, related actions grouped | Main commands are reachable without long menus or deep submenus. | toolbars, menus |
| Navigation | J-06 | Search location and scope are clear | Search is easy to find and results say what was searched. | searching |
| Core task | J-07 | Buttons predict their result | Purpose, pressed state and availability of each button are clear. | buttons |
| Core task | J-08 | One primary action; destructive actions are hard to hit by accident | The default action and delete-like actions cannot be confused. | buttons, alerts |
| Core task | J-09 | Tables and charts fit the analysis | Lookups use readable lists; relationship views use charts with descriptions and accessible values. | charting-data, lists-and-tables |
| Core task | J-10 | Drag shows targets and has an alternative | Dragging gives feedback, and the same move works by keyboard or menu. | drag-and-drop, gestures |
| Input | J-11 | Ask only what is needed, with good defaults | No unnecessary fields; known choices are offered instead of free typing. | entering-data, pickers |
| Input | J-12 | Explain fields and errors where the input is | Labels persist after typing, tab order is logical, validation says how to fix. | text-fields, entering-data |
| Input | J-13 | Toggles state what they affect | A toggle's label and state are readable without relying on color. | toggles |
| Input | J-14 | Pointer, touch and keyboard all complete the task | No hover-only or gesture-only actions; everything works by keyboard. | pointing-devices, keyboards, gestures |
| Waiting | J-15 | Show status at once and keep unrelated work usable | Placeholders or status replace blank screens; unrelated controls stay usable. | loading |
| Waiting | J-16 | Accurate progress and cancel when possible | Progress matches real work; stalls and cancel results are explained. | progress-indicators |
| Errors | J-17 | Interruption matches importance | Routine status appears near its element; only critical issues use a dialog. | feedback, alerts |
| Errors | J-18 | Dialogs say what happened and what each choice does | Buttons name outcomes instead of a vague OK; a safe cancel exists. | alerts |
| Errors | J-19 | Undo is predictable | Delete and move can be undone, and the undone result is visible. | undo-and-redo, drag-and-drop |
| Settings | J-20 | Good defaults; task options near the task | Setup is not forced before use; view and filter options sit with the view. | settings |
| Settings | J-21 | Account deletion is findable | The account screen shows where deletion starts, what happens and when it completes. | managing-accounts |
| Help | J-22 | Help is short, close to the task and actionable | Help uses on-screen terms and leads to the next action. | offering-help |
| Leaving | J-23 | Work and place survive leaving | After reload or return, drafts, position and playback resume where reasonable. | launching, multitasking, file-management |
| Leaving | J-24 | Notifications and rating prompts respect the task | Promotions and rating prompts never interrupt work; notification types are user-controllable. | managing-notifications, ratings-and-reviews |
~~~~

## B. NEW references/experience-audit.md

~~~~markdown
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

Keep each step's output as a file in one audit folder. In a repository with plan units use
`<plan unit>/audit/`; otherwise ask once where artifacts belong. Steps 2-4 come before any
screenshot review of style: judging a screen before knowing who it serves turns the audit
into taste.

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
task, input, waiting, errors, settings, help, leaving and returning. Per stage record:

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
| Current | What happens today, with an evidence pointer: screenshot id, recording, or `path:line` |
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

| SLOP-id | Location | Generic default observed | Why it fails this persona or domain | Alternative direction | Exception and its evidence |
|---|---|---|---|---|---|

Rendered tells with rule ids (gradient budget, card grids, oversized type and similar) are
recorded by dev-frontend in the violation ledger; this table holds the judgment about the
direction behind them. "It is our brand" counts as an exception only with a cited brand
source, the same bar [anti-rationalization](anti-rationalization.md) applies to other
shortcuts.

## Handoff to implementation (UX-AUDIT-07, DEFAULT)

Hand dev-frontend one packet: personas, journey map, ideal-state table, gap ledger,
anti-slop findings, the fix order (S1 first, then journey order within a severity) and the
verifier for each gap. dev-frontend turns each gap with a rendered symptom into violation
ledger rows that carry the GAP-id, so the before/after evidence traces back to the user
impact that justified the fix.

## Multi-cycle audits

When fixing the ledger takes more than one PABCD cycle, run it under
[cxc-loop](../../loop/SKILL.md): the host goal states the audit scope, the ledger path and
the closure gate, and work phases follow dependency order (tokens and global layout before
shared components, shared components before routes). cxc-loop owns goals, criteria and
cycle mechanics; this file only defines what the audit hands to them.
~~~~

## C. MODIFY SKILL.md (after the Design Read row, line 34)

~~~~diff
 | New pages/components/layouts: before frontend code | [Design Read](references/design-read.md) |
+| Auditing an existing product: personas, journeys, ideal state, gap ledger | [Experience audit](references/experience-audit.md) |
+| Platform-neutral principles for an audit or ideal state (HIG-derived) | [Universal principles](references/universal-principles.md) |
 | Concept generation before implementation | [Concept procedure](references/concept-exploration.md) |
~~~~

## D. MODIFY references/topic-index.md (after the ux-preflight row)

~~~~diff
 | `ux-preflight.md` | **Before delivery** | UX state verification checklist |
+| `experience-audit.md` | Auditing an existing product or defining its ideal state | Personas, journeys, ideal state, gap ledger, concept anti-slop findings, implementation handoff (UX-AUDIT-01..07) |
+| `universal-principles.md` | Judging experience against user needs | 22 foundation principles and 24 journey-stage checks distilled from Apple HIG, Apple visuals excluded |
~~~~

## E. MODIFY references/role-boundaries.md (after line 5, the full "Role separation" line)

~~~~diff
 **Role separation:** This skill owns design judgment: intent discovery, information architecture, UX state meaning, typography/color/layout direction, product personality, brand vocabulary, anti-slop concept/taste judgment (is this direction generic, domain-wrong, or aesthetically derivative?), and design-system decisions. `dev-frontend` owns implementation: HTML/CSS/components, responsive mechanics, accessibility wiring, runtime behavior, rendered tell detection, and rendered verification. After choosing the design direction here, load `dev-frontend` for concrete implementation.
+
+**Audit handoff:** an [experience audit](experience-audit.md) ends with one packet of
+personas, journeys, ideal state, gap ledger and per-gap verifiers. `dev-frontend` records the
+rendered gaps as violations, fixes them and proves each fix with before and after evidence.
~~~~

## F. MODIFY references/ux-preflight.md (append after "## Accessibility Minimum" block, end of file)

~~~~diff
 - [ ] Forms have associated labels
+
+## Experience Audit (when one was run)
+
+- [ ] Every S1 gap in the [experience audit](experience-audit.md) gap ledger is verified fixed, or carries a wontfix decided by the user or product owner (never the agent) and is listed as open
+- [ ] Each ideal-state statement this delivery touches has its verifier evidence attached
~~~~

## Accept criteria (goalplan c-2, c-3)

| Criterion | Observable proof |
|---|---|
| c-2 universal principles | `universal-principles.md` exists with P01-P22 and J-01-J-24, each with an observable check and HIG slug; `rg -n 'Liquid Glass|SF Symbols' ` hits only the exclusion sentence |
| c-3 experience audit | `experience-audit.md` defines UX-AUDIT-01..07 covering evidence inventory, personas, journeys, ideal state, gap ledger with severity and verifier, concept anti-slop table, handoff |
| Routing | Both SKILL.md rows and both topic-index rows resolve (link gate) |
| No dangling links | `check-prompt-architecture.mjs` exit 0 |

## Verifiers (PLAN-VERIFIER-REAL-01, run 2026-10-28 on c12c71c8)

| Command | Exit at baseline | Reads the change target? |
|---|---|---|
| `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` | 0 | Yes: walks every `skills/**/*.md` for links, rule-id uniqueness and router byte budget (script lines 3-15) |
| `node plugins/codexclaw/scripts/gate.mjs` | 0 | Yes: imports the prompt-architecture check and inventory check (gate.mjs imports) |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/{prompt-architecture,skill-catalog,manifest-policy,inventory,packaging}.test.mjs` | 0 (46/46) | Yes: these tests read skills/ (rg 'skills/' in test files) |
| `rg -n 'UX-AUDIT-0[1-7]' plugins/codexclaw/skills` | n/a | Yes: direct path argument |

Content quality (does the procedure make sense) is human review plus the independent A
reviewer; no command observes it.


## wp1 P revalidation (2026-10-28)

Stale check against origin/dev c12c71c8 (no new commits; `git diff origin/dev -- plugins/codexclaw/skills`
empty): every context and removal line in diffs C-F is present verbatim (script in 006 round 1),
and the four new rule-id prefixes still have no definition in skills/. No amendment needed;
B executes A-F as written. Architect reflection on this revalidation: same architect, recorded below.

Architect 01a17e1c-1bae-7400-b95f-83ef964231d2: ALIGNED, no gaps (2026-10-28).

## wp1 C>B rework (2026-10-28)

C verifier (gpt-6-sol, fresh) returned GO-WITH-FIXES (1 blocker): c-3 requires screenshot
evidence ids, but the slop table had no evidence column and gap evidence was optional.
Folded in B: new UX-AUDIT-08 (STRICT) evidence ids (EV-n list, screenshot id required for any
rendered observation, reused by dev-frontend violation rows); Current column and slop table
cite EV-ids; handoff carries the evidence list; artifact folder default when no plan unit
(`audit-<YYMMDD>/`); journey stage "leaving and returning" maps to J-23/J-24; J-03 check
covers products where payment or identity must come first. topic-index row now says
UX-AUDIT-01..08. 020 content B "Before" column reuses EV-ids (amended in 020 now).
