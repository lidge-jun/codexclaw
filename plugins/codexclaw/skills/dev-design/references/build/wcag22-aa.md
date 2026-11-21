# WCAG 2.2 AA conformance check

Read when someone asks whether a web UI meets WCAG 2.2 AA, before stating any WCAG
conformance, and for the accessibility part of a
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

FE-WCAG22-03 (STRICT): this checklist does not decide KWCAG. KWCAG 2.2 (KS X OT0003, 2022) is
a separate Korean standard built on WCAG 2.1 with 33 inspection items and its own numbering, so a
KWCAG verdict needs the KWCAG item list, or an explicit item-by-item mapping to this table that
names unmapped items, before anything is called KWCAG-conformant. Sources:
[RRA standard listing](https://www.rra.go.kr/ko/reference/kcsList_view.do?nb_seq=5247&nb_type=6),
[item overview](https://a11ykr.github.io/docs/kwcag2/).

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
