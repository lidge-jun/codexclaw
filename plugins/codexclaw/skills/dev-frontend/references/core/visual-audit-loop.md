# Visual audit loop

Read when auditing a rendered UI for design, anti-slop or accessibility violations and fixing
them; when someone asks for before/after evidence; or when a dev-uiux-design
[experience audit](../../../dev-uiux-design/references/experience-audit.md) hands over a gap
ledger. Viewports and capture mechanics come from
[visual verification](visual-verification.md), rendered rule ids from [anti-slop](anti-slop.md)
and [anti-slop enforcement](anti-slop-enforcement.md), accessibility verdicts from
[WCAG 2.2 AA](wcag22-aa.md), and QA receipts from cxc-qa's
[evidence contract](../../../qa/references/evidence-contract.md).

FE-VISUAL-AUDIT-01 (STRICT): every reported violation has an id, before evidence (or a
recorded reason none can exist), a verifier and a written pass rule before its fix starts. A
violation closes only on an after capture and a passing verifier taken after the last edit.

## 1. Before captures

- Start the product with the repository's own command, as in visual verification's local
  render path; record commit, data or fixture, and external dependencies.
- Write the capture matrix first: routes × states (default, focus, loading, empty, error,
  dialog open, signed in) × viewports (1440, 1024, 768, 390, 320) × theme. Cells that cannot
  be reached are listed with the reason.
- Name files `before/<route>__<state>__<viewport>__<theme>.png`; the after file uses the same
  name under `after/`, so every pair lines up by name.
- Make captures repeatable: reduced motion or disabled animation, fonts loaded
  (`document.fonts.ready`), fixed clock and seeded data.
- Capture the full page plus a crop for each violation region. Open every capture with
  `view_image`; an unread capture proves nothing.
- With no earlier build to capture (a new surface), record "no baseline" and the reason. That
  row has no before image and closes on after evidence plus its verifier.

## 2. Violation ledger

| Column | Content |
|---|---|
| V-id | `V-1` ... |
| Source | Rule id (anti-slop, FE-*), WCAG criterion, GAP-id from the experience audit, or P/J id |
| Where | Route, state, viewport, theme, DOM selector |
| Before | Capture path and crop; reuse the experience audit's EV-id when the violation came from it |
| Severity | S1-S4, the experience audit scale; every WCAG A or AA failure is S1 |
| Verifier | One of the types in section 3 |
| Pass rule | The threshold or expected result, written before the fix |
| Status | open, fixed, verified, or wontfix with the decider and reason; only the user or product owner decides a wontfix |
| After | Capture path and verifier output |

List violations ruthlessly: one row per distinct rule and location, never two rules merged
into one row, and wontfix rows kept rather than deleted. A violation found in an after
capture is a new row with a new id.

## 3. Verifiers and pass rules (FE-VISUAL-AUDIT-02, STRICT)

| Type | Verifier | Pass rule example |
|---|---|---|
| Accessibility | The axe script from WCAG 2.2 AA at the violating state, optionally scoped with AxeBuilder `.include(<selector>)` | 0 violations for the named rule ids |
| Geometry or style | Playwright `getBoundingClientRect` / `getComputedStyle` | Target ≥ 24 × 24 px; `scrollWidth <= clientWidth` at 320 px; computed contrast ≥ 4.5:1 |
| Pixel diff | `toHaveScreenshot` or an image diff against the approved after | `maxDiffPixelRatio` stated in the row |
| Behaviour | Scripted keyboard, drag alternative or form walk | The expected state is reached |
| Visual judgment | `view_image` of the named crop | A written yes/no question answered yes |

Prefer measured verifiers. Use visual judgment only when no property can be measured, and
write its question before the fix so the after capture cannot redefine success.

## 4. Fix and re-verify

- Fix in severity order, then in journey order within a severity.
- After the last edit, recapture every matrix cell of each touched route, not only the fixed
  crop, and rerun every verifier. Regressions get new rows.
- Open each before and after pair together and confirm the change is the intended one.

## 5. Closure (FE-VISUAL-AUDIT-03, STRICT)

The audit is complete when every row is verified or wontfix with a recorded decider, every
S1 row is verified or carries a wontfix decided by the user or product owner (never by the
agent) and is listed under open rows in the report and PR, the final axe run at the final commit reports 0 violations for the
in-scope tags or lists each remaining one as a ledger row, and the visual verification
screenshot report is attached. Rows that were not verified are reported by id.

## 6. Pull request before/after

Each PR that closes ledger rows carries this section:

```md
## Before / After

| V-id | Violation | Before | After | Verifier → result |
|---|---|---|---|---|
| V-3 | Pagination targets 18×18 px at 390 | ![before](<path>) | ![after](<path>) | bbox 44×44 → pass |

After captures: commit <sha>, command <cmd>. Axe at <sha> (WCAG 2.2 A/AA tags): <n> violations,
rule ids <ids or none>. Open rows: <V-ids or none>. Claim conformance only per FE-WCAG22-01.
```

Commit images to the PR branch inside the audit folder, or upload them to the PR; never link
to a local path. Split PRs by dependency (tokens and global layout, then shared components,
then routes) and stack dependent ones as described in
[stacked PRs](../../../dev/references/stacked-prs.md).

## 7. Multi-cycle audits and goals

When the ledger needs more than one PABCD cycle, run it under [cxc-loop](../../../loop/SKILL.md).
Put the audit scope, ledger path and the closure rule from section 5 in the host goal. Register
one criterion per screen-state scenario with `cxc loop add-criterion --surface web`; each
cxc-qa scenario lists the V-ids it closes, so one capture can close several rows while
receipts stay per scenario. Work phases follow the dependency order above, never effort.
