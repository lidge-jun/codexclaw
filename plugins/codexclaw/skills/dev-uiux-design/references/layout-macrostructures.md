## 1. Layout Composition Patterns

Select the layout that matches the product surface. Provide the CSS grid template.

## Composition Trait Vocabulary

Traits are neutral descriptors that can modify a macrostructure or compositional pattern. They are not complete recipes and do not replace responsive or accessibility gates.

- **big-type:** Type scale, crop, wrapping, or orientation materially organizes space. This is a trait; use `compositional-patterns.md` Poster Hero or Specimen-as-Hero only when the complete recipe matches.
- **fullscreen:** One scene or utility owns the viewport. This does not imply a viewport lock, Fixed-Canvas Wheel Navigation, or a single-screen implementation; preserve direct content access and mobile fallback.
- **horizontal-spatial:** Content is explored laterally or across a spatial field rather than only in vertical document order. This does not duplicate Spatial Portfolio Canvas, Fixed-Canvas Wheel Navigation, or Edge-Peek Continuation Cue; use those canonical patterns when their full contracts match.
- **unusual-layout:** The composition intentionally departs from familiar document flow. This is a retrieval trait, never permission to obscure hierarchy, navigation, keyboard order, or core content.
- **poster:** Alias pointer only — use `compositional-patterns.md` **Poster Hero** for the canonical recipe and gates.
- **index/roster:** Alias pointer only — use `compositional-patterns.md` **Editorial Index / Roster** for the canonical recipe and gates.

### Sidebar + Content (Dashboard default)
```css
display: grid;
grid-template-columns: 256px 1fr; /* 64px when collapsed */
grid-template-rows: auto 1fr;
```
**Use:** Dashboards, admin panels, docs. **Mobile collapse:** Sidebar becomes hamburger overlay or bottom nav.

### Holy Grail (Three-column)
```css
display: grid;
grid-template-columns: 200px 1fr 200px;
grid-template-areas: "header header header" "left main right" "footer footer footer";
```
**Use:** Traditional websites with left/right sidebars. **Mobile collapse:** Stack vertically, hide sidebars behind toggles.

### Responsive Card Grid
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
gap: 24px;
```
**Use:** Product listings, galleries, feature grids. **Mobile collapse:** Automatic — 1 col mobile, 2 tablet, 3+ desktop. Zero media queries.

### Dashboard (Sidebar + Metrics + Content)
```css
.shell { display: grid; grid-template-columns: 256px 1fr; }
.metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.content { display: grid; grid-template-columns: repeat(12, 1fr); gap: 24px; }
```
**Metric cards:** Primary number 28-32px, comparison 14px, ONE visual element per card (sparkline OR trend arrow, not both).

### Bento Grid
```css
display: grid;
grid-template-columns: repeat(4, 1fr);
grid-auto-rows: minmax(180px, auto);
gap: 16px;
/* Feature items span 2 cols or 2 rows */
```
**Use:** Feature showcases, portfolio, marketing sections. **Mobile collapse:** Stack to single column, feature items full-width.

### Master-Detail
```css
display: grid;
grid-template-columns: 320px 1fr;
```
**Use:** Email, chat, file managers, list-with-preview. **Mobile collapse:** List view only, tap opens detail full-screen.

---
