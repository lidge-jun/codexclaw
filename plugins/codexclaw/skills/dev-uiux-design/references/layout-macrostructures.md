## 1. Layout Composition Patterns

Select the layout that matches the product surface. Provide the CSS grid template.

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
