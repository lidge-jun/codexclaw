# 006 — Apple examples per component (HIG, read 2026-11-21)

User request 2026-11-21: "다른것들도 애플 예시들 찾아서 devlog에 계속 정리해줘". wp1 set the rule
for buttons and accents from one Activity Monitor screenshot; this file collects Apple's own
guidance for the other components the skills cover, so each later phase cites the platform
owner instead of taste.

Method: the HIG's structured data (`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`)
for 46 pages; every "**Lead.** body" paragraph extracted (715 rules, 100 illustrations downloaded). Official illustrations
(light variants, `https://developer.apple.com/tutorials/images/com.apple.HIG/<name>@2x.png`)
are in the catalog PDF only. They are Apple's images and are **not committed** here. Page
URL pattern: `https://developer.apple.com/design/human-interface-guidelines/<slug>`.

## 1. What Apple says about color on controls (checks wp1)

| HIG page | Rule (Apple's lead sentence) | What it means for FE-COLOR-RESTRAINT-01 |
|---|---|---|
| buttons | "Use a button that has a prominent visual style for the most likely action in a view … Keep the number of prominent buttons to one or two per view." The system applies the **accent color to the background** of a prominent button. | Apple does allow one accent-filled primary. Our rule is stricter by user contract (ink primary). The brief-named brand primary exception matches Apple's "one or two per view". Keep the stricter default. |
| buttons, tab-bars | "Avoid applying a similar color to button labels and content layer backgrounds … prefer using the default **monochromatic** appearance." | Monochrome controls are the platform default when content is colorful. Supports neutral controls. |
| toolbars | "**Reduce the use of toolbar backgrounds and tinted controls.**" Use the content layer for color. | Toolbars are neutral. Direct support. |
| toolbars | "**Prefer system-provided symbols without borders.** … Borders (like outlined circle symbols) aren't necessary because the section provides a visible container." | Amend wp1: in a toolbar, glyphs sit **in one shared group container** (the capsule), not each in its own outlined circle. A standalone icon button may keep a neutral circle fill; no outline ring. |
| color | "**Apply color sparingly** to the Liquid Glass material … reserve it for elements that truly benefit from emphasis, such as status indicators or primary actions. To emphasize primary actions, apply color to the background rather than to symbols or text." | Where a brand primary is allowed, color goes on the fill, never on label text or glyphs. Add as a constraint on the exception. |
| color | "**Avoid using the same color to mean different things.**" Brand color on borderless interactive text must not also style noninteractive text. | Add to the color budget check: one hue, one meaning. |
| color | "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information." | Already covered by WCAG 1.4.1 owner; cite HIG too. |
| sidebars | "Make sure any sidebar icon colors you choose **serve a clear purpose**." Default is the accent; fixed colors only "sparingly" for meaning (VIP = yellow star). | Sidebar glyphs default to monochrome in our skills; a fixed color only when it encodes meaning. |
| sf-symbols | Rendering modes Monochrome / Hierarchical (one color, opacity per layer) / Palette / Multicolor; "Confirm that a symbol's rendering mode works well in every context." | Default icon rendering = monochrome or hierarchical (`currentColor` plus opacity steps); multicolor only for content icons. |
| icons | "**Match the weights of interface icons and adjacent text.**" Vector format (PDF/SVG). Alt text for custom icons. | Add: icon stroke weight follows the label's font weight (1.5px at 400, about 1.75 to 2px at 500 to 600). |
| materials | "Don't use Liquid Glass in the content layer." "Use Liquid Glass effects sparingly." | Already in liquid-glass.md; cite. |
| segmented-controls | Use for closely related choices; "clearly show their selection state"; text **or** images, not mixed; nouns for labels; consistent segment size. | Selected segment = neutral step plus weight (wp1). Add the no-mix and noun rules. |
| alerts | "Use the destructive style to identify a button that performs a destructive action people **didn't deliberately choose**." When the person chose Empty Trash, the confirm button is not red. Always include Cancel. | Refines wp1's destructive row: the danger hue appears only when the destructive outcome was not the user's explicit choice. |

## 2. Other components (rules to adopt in wp2 to wp4)

| Component (slug) | Apple rules worth encoding | Target file |
|---|---|---|
| Toolbars (toolbars) | Choose items deliberately; overflow goes to a More menu; window title concise, not the app name; standard Back/Close; consider hiding toolbars for focus | dev-frontend top-bar.md |
| Sidebars (sidebars) | No more than two levels of hierarchy; succinct group labels; disclosure for large trees; let people hide it; content can extend beneath | dev-uiux-design responsive-nav.md |
| Lists and tables (lists-and-tables) | Prefer text in lists; succinct item text; feedback on selection; descriptive column headings; info button only for more info about the row | dev-frontend crud-ui.md |
| Search (search-fields, searching) | Placeholder names what can be searched; search as people type; suggestions; scope bar for defined categories, defaulting broad; tokens for common filters | dev-frontend crud-ui.md, ux-writing-ko.md |
| Menus (menus, context-menus) | Short labels without articles; show unavailable items dimmed; ellipsis when more input is needed; icons sparingly and uniformly within a group; important items first; shallow submenus | dev-frontend dropdown-layer.md |
| Popovers (popovers) | Small amount of information; one at a time; nothing on top of a popover; no warnings in popovers; auto-save when it closes | dev-frontend dropdown-layer.md plus wp4 anchor positioning |
| Sheets (sheets) | One sheet at a time; alternatives for long flows; offer more than a Done button | dev-uiux-design ux-states.md |
| Alerts (alerts) | Use sparingly; not for information only; not for common undoable actions; no alert at launch; direct neutral tone; specific button titles, not "OK" unless purely informational; Cancel present for destructive | dev-uiux-design ux-states.md, copy module wp2 |
| Toggles (toggles) | Toggle for two opposing values; obvious state difference; checkbox for hierarchies; radios for more than two | dev-frontend crud-ui.md |
| Text fields (text-fields) | Hint text states purpose; field size matches expected text; even spacing; predictable tab order; validate when it makes sense; number formatter | dev-frontend crud-ui.md (wp4 `field-sizing`) |
| Progress (progress-indicators, loading) | Prefer determinate; keep it moving; consistent location; let people halt and say what halting costs; show something as soon as possible | dev-uiux-design ux-states.md |
| Charts (charts) | Mark type follows the message; summarize the main message in text; consistent hierarchy; never require interaction to reveal critical information; keyboard reachable | dev-visualizer visual-design.md (wp5) |
| Onboarding (onboarding) | Teach through interactivity; context tips over one long flow; optional tutorial; no licensing text; postpone nonessential setup; ask permission in context; let people try before asking for ratings or purchase | dev-uiux-design ux-states.md |
| Feedback (feedback) | Status feedback integrated into the UI; alerts only for critical actionable information; warn before unexpected irreversible loss; confirm completion of significant tasks; explain why a command cannot run | wp4 agent-action-ux.md |
| Writing (writing) | Determine the voice; match tone to context; be action oriented; consistent capitalization; possessive pronouns sparingly; clear next steps on blank screens; clear error messages | wp2 copy module |
| Typography (typography) | Avoid light weights; minimize typefaces; adjust tracking by size; support text-size changes | dev-frontend aesthetics.md |
| Layout (layout) | Order by importance; align for scanning and indent for hierarchy; group related items; progressive disclosure; **differentiate controls from content** | dev-uiux-design visual-hierarchy.md |
| Dark mode (dark-mode) | No app-specific appearance setting; both modes legible; soften white backgrounds; system label colors | dev-frontend theme-switching.md |

## 3. Amendments this file makes to wp1 (apply in the next B)

1. Toolbar glyphs: group related actions in one neutral capsule with borderless glyphs (HIG
   toolbars). A standalone icon button keeps a neutral fill and no outline ring.
2. Brand-primary exception: the color goes on the button fill only. Label and glyph stay
   white or ink, at most one or two such buttons per view (HIG buttons, color).
3. Destructive: the danger hue only when the destructive outcome was not the user's explicit
   choice (HIG alerts).
4. Icon stroke weight matches the adjacent label weight (HIG icons).
5. One hue, one meaning (HIG color).

## Caveat

The HIG governs Apple platforms. Its Liquid Glass sections assume system materials that the
web does not have; we borrow the restraint rules, not the material.
