# Product Density

Choose density before choosing visual style. Many frontend failures happen because a working tool is treated like a campaign page.

## Density Profiles

| Profile | Surface | Default |
| --- | --- | --- |
| D1 | Campaign / editorial | expressive type, large media, low density |
| D2 | Landing / brand | strong first-viewport asset, concise copy |
| D3 | Consumer app | mobile-first, short labels, sticky actions |
| D4 | Productivity tool | task-first, moderate density, clear states |
| D5 | SaaS dashboard | dense panels, filters, tables, saved views |
| D6 | Admin / ops | compact controls, stable navigation, repeat actions |
| D7 | Finance / analytics | high trust, tabular numbers, explainable changes |
| D8 | Developer console | code/data density, logs, inspectable state |

### Cross-Density Enforcement (MANDATORY)

If Design Read declares page kind != SaaS/dashboard/admin:
- Stats rows (e.g., "368 오름 / 1,950m 한라산") — BANNED
- Metric comparison grids — BANNED
- Feature checkbox tables — BANNED
- Use narrative content blocks instead of data-dump sections

## Rules

- D1-D2 may use hero-scale typography and strong imagery.
- D3-D4 should prioritize the main workflow within the first viewport.
- D5-D8 should avoid decorative card stacks and oversized headings.
- Dense does not mean cramped. Use separators, hierarchy, table density controls, and stable toolbars.
- Keep repeated-work UI predictable. Surprise belongs in campaigns, not operations.

## Work-Tool Density Baseline (FE-DENSITY-01, DEFAULT, measured 2026-11-21)

D4-D8 surfaces (dashboards, CRM, admin, consoles) use these numbers unless the product's own
design system says otherwise. Measured on live consoles (Cloudflare, Vercel, GitHub, OpenAI and
Anthropic platform, 2026-11-21; median list/table row 29-34px, panel radius 6-8px) and published
systems (Carbon data table rows 24/32/40/48/64 with 40 default and 64 only for two-line rows;
Salesforce Lightning table cell padding 4px 8px and template gutters 12px).

| Property | Value |
|---|---|
| Body and table text | 13-14px, weight 400-500; labels 12px |
| Table and list rows | 32-40px, one line; 48px+ only when a row must hold two lines, and then secondary text goes in its own column |
| Cell padding | 6-10px vertical, 12-16px horizontal |
| Panel padding | 12-16px |
| Gutters between panels | 12-16px; prefer one surface split by 1px hairlines over separate floating cards |
| Radius | 4-8px panels, 6px controls |
| Page title | 18-20px, 600; section titles 13-14px, 600 |
| KPI | numbers 20-24px inside one row split by hairlines, never four floating cards |

Check on the render: median table row height, body size, panel gutters and whether the first
viewport shows the main table or work queue. A page that reads like a landing page with charts
(roomy cards, two-line rows, 24px+ gaps) fails this rule even when every color is right.

## Dashboard Defaults

Prefer:

- tables with sort/filter
- split panes
- compact metric rows
- visible state and timestamps
- saved filters/views
- inline editing when safe
- clear empty/loading/error states

Avoid:

- every metric boxed in a separate floating card
- giant hero headers
- chart decoration with no decision value
- one-note color palettes
- motion that slows repeated workflows

