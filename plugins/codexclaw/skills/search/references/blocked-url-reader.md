# Blocked / Hard-to-Read Source Reader (Tier 2 helper)

Tactics for reaching and validating a candidate URL that resists a plain read.
This is **Tier 2 browse-use-ladder guidance (SEARCH-BROWSE-01), not a fourth tier**, and it
is invoked only after a candidate URL already exists. It never replaces hosted
web search and never becomes an auto-escalation.

## When to apply

A candidate source is blocked, JS-rendered, PDF-only, table-only, paywalled, or
returns a shell/redirect instead of content, yet the fact still needs primary
confirmation.

## Capability-preserving tactics

Select the usable tool through [portable browser routing](../../dev/references/browser-routing.md),
not a fixed plugin-name ladder. No optional browser is mandatory.

1. Confirm the page actually contains the requested source, not RSS, metadata or a shell.
2. Use an available renderer for JS content; inspect DOM and screenshots for layout-bound facts.
3. For PDFs, read text and inspect relevant page images using available PDF/browser tools.
4. Follow a portal wrapper to its canonical source when appropriate.
5. For login-bound content, prefer suitable available Aside or a browser session that
   actually has the required account access. Do not assume cookies transfer to agbrowse
   or native Chrome, and do not create accounts or move credentials merely to complete research.
6. Diagnose tool failure before retrying. A confirmed CDP connection failure may justify
   starting a task-owned session; HTTP/auth/content failures do not. Inspect prior side
   effects before switching readers or repeating an action.
7. Use available computer-use only for GUI-only controls, within current permissions.

## Stop conditions

Stop when the primary claim, date, and source identity are confirmed, or when the
URL is conclusively dead/unreadable — then return to the candidate list rather
than inventing access. Do not vendor CloakBrowser, agent-browser, or any hidden
provider to force a read.
