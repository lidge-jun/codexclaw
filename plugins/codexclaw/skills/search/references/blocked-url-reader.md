# Blocked / Hard-to-Read Source Reader (Tier 2 helper)

Tactics for reaching and validating a candidate URL that resists a plain read.
This is **Tier 2 Browser Use / Computer Use guidance, not a fourth tier**, and it
is invoked only after a candidate URL already exists. It never replaces hosted
web search and never becomes an auto-escalation.

## When to apply

A candidate source is blocked, JS-rendered, PDF-only, table-only, paywalled, or
returns a shell/redirect instead of content, yet the fact still needs primary
confirmation.

## Tactics (in order of preference)

1. **Render fully**: open in Browser Use and let the page hydrate before reading;
   many "empty" pages are JS-rendered and resolve after load.
2. **Screenshot + DOM read**: capture the rendered DOM and a screenshot together
   so layout-bound content (tables, figures) is not lost.
3. **PDF path**: open the PDF directly in Browser Use; read text and, when the
   evidence is a table or figure, capture the page image.
4. **Canonical/source swap**: if a portal shell hides content (e.g. a Naver
   wrapper), follow to the canonical origin URL and read that instead.
5. **OS-UI reach (Computer Use)**: only when browser chrome or an OS dialog the
   in-app browser cannot reach is genuinely required.

## Stop conditions

Stop when the primary claim, date, and source identity are confirmed, or when the
URL is conclusively dead/unreadable — then return to the candidate list rather
than inventing access. Do not vendor CloakBrowser, agent-browser, or any hidden
provider to force a read.
