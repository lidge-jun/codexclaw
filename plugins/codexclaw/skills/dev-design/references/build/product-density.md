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

