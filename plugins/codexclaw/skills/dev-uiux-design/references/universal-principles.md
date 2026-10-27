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
| First run | J-03 | Accounts and permissions when needed | Where the business model allows, the product can be tried before sign-up; where payment or identity must come first, sign-up asks only what the first use needs. Permission prompts appear in the feature's context. | managing-accounts, onboarding |
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
