# 020 — wp2: dev-frontend WCAG 2.2 AA owner and visual audit loop

Branch: `docs/frontend-skill-audit-frontend` from the wp1 branch head, PR 2 of the manual
chain (base = wp1 branch). Re-verify anchors at this cycle's P.

## Scope

IN: `plugins/codexclaw/skills/dev-frontend/` and the fixture evidence under this unit's
`evidence/axe-fixture/`. OUT: uiux files (only linked to, the wp1 files exist by now), WCAG
wording fixes in older files (wp3), any repository dependency (axe and Playwright run from a
scratch directory).

## File change map

| Op | Path (under plugins/codexclaw/skills/dev-frontend/) | Change |
|---|---|---|
| NEW | references/core/wcag22-aa.md | Full content A |
| NEW | references/core/visual-audit-loop.md | Full content B |
| MODIFY | SKILL.md | Two router rows (diff C) |
| MODIFY | references/core/topic-index.md | Two index rows (diff D) |
| MODIFY | references/core/role-boundaries.md | Audit handoff paragraph (diff E) |
| MODIFY | references/core/visual-verification.md | Pointer to the audit loop (diff F) |
| MODIFY | references/core/preflight-full.md | WCAG owner line (diff G) |
| MODIFY | references/core/anti-slop-enforcement.md | Audit pointer (diff G2) |
| NEW | devlog/_plan/261028_frontend_skill_audit/evidence/axe-fixture/{before.html,after.html,axe-wcag22.cjs,run.log,before.png,after.png} | Seeded fixture proof (section H, full content there) |

## A. NEW references/core/wcag22-aa.md

~~~~markdown
# WCAG 2.2 AA conformance check

Read when someone asks whether a web UI meets WCAG 2.2 AA (or KWCAG, which follows it),
before stating any accessibility conformance, and for the accessibility part of a
[visual audit loop](visual-audit-loop.md). This file owns the criterion list, levels and the
verdict. Widget patterns stay in [a11y patterns](a11y-patterns.md), contrast tokens in
[color system](color-system.md); both link here for levels. Native apps follow their
platform's guidance through [mobile native](../stacks/mobile-native.md); the axe command below
covers web content only.

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[What's new in 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/),
[axe-core rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md).
Checked 2026-10-28.

## Verdict rules

FE-WCAG22-01 (STRICT): never state "meets WCAG 2.2 AA" from an automated run, a Lighthouse
score or a screenshot. A conformance statement needs every criterion in the table below
marked PASS or N/A with evidence for the stated scope. Otherwise report what was shown, for
example "axe reports 0 violations for wcag22aa tags; 31 criteria not manually verified", and
list failures.

FE-WCAG22-02 (DEFAULT): state the scope before testing: pages or routes; states (default,
error, loading, empty, dialog open, signed in and out); viewports (at least 1280 and 320 CSS
px); themes; input methods. WCAG conformance applies to whole pages and whole processes, so a
multi-step flow is in or out as a unit.

Record one row per criterion: PASS, FAIL, N/A with the reason, or NOT TESTED. FAIL rows
become S1 rows in the visual audit loop's violation ledger.

## Automated pass

Run axe through Playwright with an explicit browser context. The script exits 1 when
violations exist:

```js
// axe-wcag22.cjs — run: node axe-wcag22.cjs <url-or-file-url>
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(process.argv[2]);
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  console.log(JSON.stringify(r.violations.map(v => ({ id: v.id, nodes: v.nodes.length }))));
  await browser.close();
  process.exit(r.violations.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
```

Install the two packages in a scratch directory and point Node at it, so the project gains
no dependency:

```sh
mkdir -p /tmp/axe-wcag22 && (cd /tmp/axe-wcag22 && npm init -y >/dev/null && npm i playwright@1 @axe-core/playwright@4)
NODE_PATH=/tmp/axe-wcag22/node_modules node /absolute/path/axe-wcag22.cjs "file:///absolute/path/page.html"
```

The subshell keeps the working directory unchanged; pass the script's own path.

Two traps, both observed on 2026-10-28 with axe-core 4.14: AxeBuilder fails with "Please use
browser.newContext()" on a page from `browser.newPage()`, and
`npx @axe-core/cli <url> --tags <same tags> --exit` exits 2 when its bundled ChromeDriver does
not match the installed Chrome. Use the CLI only after
`npx browser-driver-manager install chrome` or with `--chromedriver-path`; exit 2 is a tool
failure, never a pass.

Drive the page into each in-scope state before `analyze()` (dialog open, errors shown), not
only first load. Record the command, URL and state, axe version and violations by rule id.
"Needs review" results are manual items, not passes. Adding axe or Playwright to a project is
a new dependency; the scratch install above keeps an audit from adding one.

Automated rules decide only part of the criteria. Everything marked "manual" below needs a
person or a scripted interaction.

## Manual setup

- **Keyboard:** Tab, Shift+Tab, Enter, Space, Esc and arrow keys through every flow.
- **Zoom and reflow:** 200% text zoom (1.4.4); 1280 px at 400% zoom, equal to 320 CSS px (1.4.10).
- **Text spacing:** line height 1.5, paragraph spacing 2 em, letter spacing 0.12 em, word spacing 0.16 em (1.4.12).
- **Screen reader:** VoiceOver or NVDA smoke pass for names, roles, states and status messages.
- **Contrast:** measure rendered colors; for translucent surfaces use the worst-case background.

## New in 2.2

Check these every time; they are the criteria older checklists miss.

| SC | Level | Pass evidence |
|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Tab through with sticky headers and footers, cookie banners and chat widgets open; the focused element is never entirely hidden. `scroll-padding` equal to sticky chrome height is the usual fix. |
| 2.5.7 Dragging Movements | AA | Every drag (sortable list, slider, map, board) can be completed with single clicks or taps: buttons, a "move to" menu, or clicking positions. |
| 2.5.8 Target Size (Minimum) | AA | Targets are at least 24 by 24 CSS px, or spaced so a 24 px circle centred on each target overlaps no other target or circle. Exceptions: an equivalent control elsewhere, inline text links, user-agent default controls, essential presentation. axe `target-size` plus measured boxes for dense toolbars and pagination. |
| 3.2.6 Consistent Help | A | Help mechanisms repeated across pages (contact, chat, help link, self-service) keep the same relative order. Compare at least two pages. |
| 3.3.7 Redundant Entry | A | Information already entered in the same process is filled in or selectable (for example "same as shipping"), except where re-entry is essential, for security, or the data expired. Walk the whole form. |
| 3.3.8 Accessible Authentication (Minimum) | AA | A cognitive function test (remembering a password, transcribing a code, solving a puzzle) in any authentication step passes only with one of: another method without such a test; a mechanism that assists, such as paste into password and code fields and `autocomplete` so password managers can fill; recognising objects; or identifying non-text content the user provided. Check each login, sign-up and recovery step. |

4.1.1 Parsing is obsolete in 2.2 and is not reported.

## Criterion table (31 A + 24 AA = 55)

| SC | Name | Level | axe rules | Manual check |
|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | image-alt, input-image-alt, object-alt, role-img-alt, svg-img-alt, aria-meter-name, aria-progressbar-name | Alt text conveys purpose; decorative images are hidden |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | audio-caption | Transcript or alternative exists |
| 1.2.2 | Captions (Prerecorded) | A | video-caption | Captions are accurate and synchronised |
| 1.2.3 | Audio Description or Media Alternative | A | — | Visual information is in description or text |
| 1.2.4 | Captions (Live) | AA | — | Live media has synchronised captions |
| 1.2.5 | Audio Description (Prerecorded) | AA | — | Key visual information is described |
| 1.3.1 | Info and Relationships | A | list, listitem, definition-list, dlitem, td-headers-attr, th-has-data-cells, aria-required-children, aria-required-parent, p-as-heading | Headings, lists, tables and groups are marked up as such |
| 1.3.2 | Meaningful Sequence | A | — | Reading order preserves meaning |
| 1.3.3 | Sensory Characteristics | A | — | Instructions do not rely on shape, position, colour or sound alone |
| 1.3.4 | Orientation | AA | css-orientation-lock | Works in portrait and landscape |
| 1.3.5 | Identify Input Purpose | AA | autocomplete-valid | Personal-data fields carry correct `autocomplete` |
| 1.4.1 | Use of Color | A | link-in-text-block | State and meaning have a non-colour cue |
| 1.4.2 | Audio Control | A | no-autoplay-audio | Auto-playing audio can be paused or muted |
| 1.4.3 | Contrast (Minimum) | AA | color-contrast | 4.5:1 text; 3:1 large text (24 px, or 18.66 px bold) |
| 1.4.4 | Resize Text | AA | meta-viewport | 200% text zoom loses no content or function |
| 1.4.5 | Images of Text | AA | — | No text rendered as image outside the exceptions |
| 1.4.10 | Reflow | AA | — | 320 CSS px: no two-direction scrolling or lost content |
| 1.4.11 | Non-text Contrast | AA | — | Component boundaries and states needed to identify them, and meaningful graphics, reach 3:1 |
| 1.4.12 | Text Spacing | AA | avoid-inline-spacing | Spacing overrides above cause no clipping |
| 1.4.13 | Content on Hover or Focus | AA | — | Popovers are dismissible, hoverable and persistent |
| 2.1.1 | Keyboard | A | scrollable-region-focusable, frame-focusable-content, server-side-image-map | Every function works by keyboard |
| 2.1.2 | No Keyboard Trap | A | — | Focus can leave every widget by keyboard |
| 2.1.4 | Character Key Shortcuts | A | — | Single-key shortcuts can be turned off, remapped, or apply only on focus |
| 2.2.1 | Timing Adjustable | A | meta-refresh | Time limits can be turned off, adjusted or extended |
| 2.2.2 | Pause, Stop, Hide | A | blink, marquee | Auto-moving or auto-updating content can be paused |
| 2.3.1 | Three Flashes or Below Threshold | A | — | Nothing flashes more than three times per second |
| 2.4.1 | Bypass Blocks | A | bypass | Skip link or landmarks bypass repeated blocks |
| 2.4.2 | Page Titled | A | document-title | Titles describe topic or purpose |
| 2.4.3 | Focus Order | A | — | Tab order preserves meaning and operation |
| 2.4.4 | Link Purpose (In Context) | A | link-name, area-alt | Link text plus context gives the purpose |
| 2.4.5 | Multiple Ways | AA | — | More than one way to reach each page |
| 2.4.6 | Headings and Labels | AA | — | Headings and labels describe topic or purpose |
| 2.4.7 | Focus Visible | AA | — | Every focused element shows a visible indicator |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | — | See "New in 2.2" |
| 2.5.1 | Pointer Gestures | A | — | Multipoint or path gestures have a single-pointer alternative |
| 2.5.2 | Pointer Cancellation | A | — | Actions fire on release or can be aborted |
| 2.5.3 | Label in Name | A | label-content-name-mismatch | Accessible name contains the visible label |
| 2.5.4 | Motion Actuation | A | — | Shake or tilt functions have a UI alternative and can be disabled |
| 2.5.7 | Dragging Movements | AA | — | See "New in 2.2" |
| 2.5.8 | Target Size (Minimum) | AA | target-size | See "New in 2.2" |
| 3.1.1 | Language of Page | A | html-has-lang, html-lang-valid, html-xml-lang-mismatch | Page language is correct |
| 3.1.2 | Language of Parts | AA | valid-lang | Passages in another language are marked |
| 3.2.1 | On Focus | A | — | Focus alone causes no context change |
| 3.2.2 | On Input | A | — | Changing a value causes no unannounced context change |
| 3.2.3 | Consistent Navigation | AA | — | Repeated navigation keeps its order |
| 3.2.4 | Consistent Identification | AA | — | Same function, same name and icon |
| 3.2.6 | Consistent Help | A | — | See "New in 2.2" |
| 3.3.1 | Error Identification | A | — | The field in error and the error are described in text |
| 3.3.2 | Labels or Instructions | A | label, form-field-multiple-labels | Inputs have labels and needed instructions |
| 3.3.3 | Error Suggestion | AA | — | Known corrections are suggested |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | — | Submissions are reversible, checked, or confirmed |
| 3.3.7 | Redundant Entry | A | — | See "New in 2.2" |
| 3.3.8 | Accessible Authentication (Minimum) | AA | — | See "New in 2.2" |
| 4.1.2 | Name, Role, Value | A | button-name, link-name, label, select-name, aria-* name and attribute rules, nested-interactive, frame-title (29 rules tagged wcag412) | Custom widgets expose name, role, state and value |
| 4.1.3 | Status Messages | AA | — | Status updates reach assistive technology without moving focus |

## Product rules beyond AA

These are codexclaw defaults, labelled so they are never reported as WCAG AA results.

- Honour `prefers-reduced-motion` for non-essential motion. WCAG 2.3.3 Animation from
  Interactions is Level AAA; auto-moving content falls under 2.2.2 (A).
- 44 by 44 CSS px touch targets for touch-primary UI, the size of 2.5.5 (AAA). The AA floor
  is 2.5.8 above.
- A Lighthouse accessibility score is a smoke signal and never a conformance result.
~~~~

## B. NEW references/core/visual-audit-loop.md

~~~~markdown
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
~~~~

## C. MODIFY SKILL.md (after the "Performance, accessibility" row, line 30)

~~~~diff
 | Performance, accessibility, forms, state, platform or errors | [Platform and runtime](references/core/platform-runtime.md) |
+| WCAG 2.2 AA questions or any accessibility conformance statement | [WCAG 2.2 AA](references/core/wcag22-aa.md) |
+| Auditing a rendered UI: violation ledger, before/after evidence, fix proof | [Visual audit loop](references/core/visual-audit-loop.md) |
 | API consumption, security UI or contract fixtures | [Backend contracts](references/core/backend-contracts.md) |
~~~~

## D. MODIFY references/core/topic-index.md (after the a11y-patterns row)

~~~~diff
 | `a11y-patterns.md`        | Interactive widgets, modals, forms   | ARIA patterns, focus management, keyboard nav, screen reader testing               |
+| `wcag22-aa.md`            | Accessibility conformance questions or claims | 55 WCAG 2.2 A/AA criteria, axe tag script, manual procedures, the six 2.2 additions, verdict rules |
+| `visual-audit-loop.md`    | Auditing and fixing a rendered UI with evidence | Violation ledger, verifier and pass rule per violation, before/after captures, closure gate, PR section, cxc-loop routing |
~~~~

## E. MODIFY references/core/role-boundaries.md (append)

~~~~diff
 > tell detection and removal (FE-AI-TELL-01).
+
+**Audit handoff:** when `dev-uiux-design` hands over an
+[experience audit](../../../dev-uiux-design/references/experience-audit.md), record its rendered
+gaps in the [visual audit loop](visual-audit-loop.md) ledger with their GAP-ids. Accessibility
+verdicts follow [WCAG 2.2 AA](wcag22-aa.md).
~~~~

## F. MODIFY references/core/visual-verification.md (after line 3)

~~~~diff
 Do not declare frontend work complete from code alone. Render and inspect the UI.
+
+This file owns viewports and capture mechanics. An audit that tracks many violations with
+before/after pairs and per-violation verifiers runs the [visual audit loop](visual-audit-loop.md)
+on top of it.
~~~~

## G. MODIFY references/core/preflight-full.md (Performance & verification list)

~~~~diff
 - [ ] Accessibility deep pass: modals trap focus, live regions — a11y-patterns.md
+- [ ] Accessibility conformance stated only per [WCAG 2.2 AA](wcag22-aa.md) verdict rules (FE-WCAG22-01)
~~~~

## G2. MODIFY references/core/anti-slop-enforcement.md (after the "Read `anti-slop.md` for full rules" line)

~~~~diff
 Read `anti-slop.md` for full rules. Key standards:
+
+A visual audit that records violations and fixes them with before/after proof runs the
+[visual audit loop](visual-audit-loop.md); the rules below supply its rule ids.
~~~~

## H. Seeded fixture proof (goalplan c-6)

NEW files under `devlog/_plan/261028_frontend_skill_audit/evidence/axe-fixture/`:

`before.html` (two 12×12 px pagination links, one image without `alt`):

~~~~html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Pagination fixture (before)</title>
<style>body{font:16px system-ui,sans-serif;margin:16px} nav a{display:inline-block;background:#dfe6fb;color:#1d3a9e;text-align:center;text-decoration:none}</style></head>
<body>
<main>
  <h1>Monthly report</h1>
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='90'%3E%3Crect width='240' height='90' fill='%23f4f6fb'/%3E%3Crect x='14' y='50' width='26' height='30' fill='%234a6cf7'/%3E%3Crect x='52' y='38' width='26' height='42' fill='%234a6cf7'/%3E%3Crect x='90' y='44' width='26' height='36' fill='%234a6cf7'/%3E%3Crect x='128' y='26' width='26' height='54' fill='%234a6cf7'/%3E%3Crect x='166' y='30' width='26' height='50' fill='%234a6cf7'/%3E%3Crect x='204' y='14' width='26' height='66' fill='%234a6cf7'/%3E%3C/svg%3E" width="240" height="90">
  <nav aria-label="Pages">
    <a href="#1" style="width:12px;height:12px;font-size:8px;line-height:12px">1</a><a href="#2" style="width:12px;height:12px;font-size:8px;line-height:12px">2</a>
  </nav>
</main>
</body>
</html>
~~~~

`after.html` (44 px minimum targets with spacing, image has `alt`):

~~~~html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Pagination fixture (after)</title>
<style>body{font:16px system-ui,sans-serif;margin:16px} nav a{display:inline-block;background:#dfe6fb;color:#1d3a9e;text-align:center;text-decoration:none}</style></head>
<body>
<main>
  <h1>Monthly report</h1>
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='90'%3E%3Crect width='240' height='90' fill='%23f4f6fb'/%3E%3Crect x='14' y='50' width='26' height='30' fill='%234a6cf7'/%3E%3Crect x='52' y='38' width='26' height='42' fill='%234a6cf7'/%3E%3Crect x='90' y='44' width='26' height='36' fill='%234a6cf7'/%3E%3Crect x='128' y='26' width='26' height='54' fill='%234a6cf7'/%3E%3Crect x='166' y='30' width='26' height='50' fill='%234a6cf7'/%3E%3Crect x='204' y='14' width='26' height='66' fill='%234a6cf7'/%3E%3C/svg%3E" width="240" height="90" alt="Sales by month, January to June, rising from 30 to 66">
  <nav aria-label="Pages">
    <a href="#1" style="min-width:44px;min-height:44px;line-height:44px">1</a>
    <a href="#2" style="min-width:44px;min-height:44px;line-height:44px">2</a>
  </nav>
</main>
</body>
</html>
~~~~

`axe-wcag22.cjs`: byte-for-byte the script in content A.

Run from the repository root (scratch install outside the repository):

~~~~sh
mkdir -p /tmp/axe-wcag22 && (cd /tmp/axe-wcag22 && npm init -y >/dev/null && npm i playwright@1 @axe-core/playwright@4)
F=devlog/_plan/261028_frontend_skill_audit/evidence/axe-fixture
{ NODE_PATH=/tmp/axe-wcag22/node_modules node $F/axe-wcag22.cjs "file://$PWD/$F/before.html"; echo "before exit=$?";
  NODE_PATH=/tmp/axe-wcag22/node_modules node $F/axe-wcag22.cjs "file://$PWD/$F/after.html"; echo "after exit=$?"; } | tee $F/run.log
~~~~

Expected: before prints `[{"id":"image-alt","nodes":1},{"id":"target-size","nodes":2}]` and
`before exit=1`; after prints `[]` and `after exit=0`. Verified on 2026-10-28 with these exact
files in `/tmp/fxtest` (axe-core 4.14.0, Chrome 156). Earlier probes recorded two traps now in
content A: `npx @axe-core/cli` exited 2 on a ChromeDriver 152 / Chrome 156 mismatch, and
AxeBuilder rejected a page from `browser.newPage()` ("Please use browser.newContext()").

C also saves 390 px screenshots of both fixtures as `before.png` and `after.png` for the PR 2
before/after section (Playwright `page.screenshot({ fullPage: true })` from the same scratch
install).

## Accept criteria (goalplan c-1, c-4, c-6)

| Criterion | Observable proof |
|---|---|
| c-1 | `wcag22-aa.md` table has 55 rows, 31 A and 24 AA (count with `rg -c '^\| [0-9]\.[0-9]+\.[0-9]+ \| .* \| A \|'` and the AA variant); new-in-2.2 table has 6 rows; 4.1.1 named obsolete |
| c-4 | `visual-audit-loop.md` defines FE-VISUAL-AUDIT-01..03, ledger columns, verifier table with pass rules, closure gate, PR section and cxc-loop routing |
| c-6 | `run.log` shows before exit 1 with target-size and image-alt, after exit 0, from the committed script |
| Gates | same verifier set as 010, all exit 0 |


## wp2 P revalidation (2026-10-28)

Branch docs/frontend-skill-audit-frontend created from the wp1 head. Stale check: every
context and removal line in diffs C-G2 is present verbatim in dev-frontend (script as in 006).
Amendment carried from wp1 C: content B "Before" column reuses experience-audit EV-ids
(UX-AUDIT-08). experience-audit.md exists, so content B's link to it resolves. No other change.

Architect: ALIGNED (EV-id reuse keeps D4/D6 ownership).

## wp2 B deviation (2026-10-28)

The first fixture screenshots did not show the defect: unstyled links hid the 12 px versus
44 px target difference and the missing chart.png rendered a broken icon. Section H now
carries the fixture with a link background and an inline SVG chart. axe results are
unchanged (before image-alt + target-size, exit 1; after [], exit 0).

## Review follow-up: KWCAG (2026-10-28)

PR #328 review (chatgpt-codex-connector, P2, discussion_r4391610430): the opening line called
KWCAG something "which follows" WCAG 2.2, implying this 55-criterion checklist decides KWCAG.
KWCAG 2.2 (KS X OT0003, 2022) is based on WCAG 2.1 and has 33 inspection items. Fixed: the
equivalence is removed and FE-WCAG22-03 (STRICT) requires the KWCAG item list or an explicit
item-by-item mapping before a KWCAG verdict.
