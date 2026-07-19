# Blocked / Hard-to-Read Source Reader (Tier 2 helper)

Tactics for reaching and validating a candidate URL that resists a plain read.
This is **Tier 2 browse-use-ladder guidance (SEARCH-BROWSE-01), not a fourth tier**, and it
is invoked only after a candidate URL already exists. It never replaces hosted
web search and never becomes an auto-escalation.

## When to apply

A candidate source is blocked, JS-rendered, PDF-only, table-only, paywalled, or
returns a shell/redirect instead of content, yet the fact still needs primary
confirmation.

## Tactics (in order of preference)

Tool names are the live surfaces from `structure/60_native_capabilities.md`.
agbrowse is the primary surface while it resolves (SEARCH-BROWSE-01); the native
tools below are its fallback tier.

1. **Render fully**: `agbrowse fetch "<url>" --json --browser auto` first (renders
   via local Chrome CDP and returns the evidence envelope); fall back to
   `browser:control-in-app-browser` when agbrowse is unresolvable. Many "empty"
   pages are JS-rendered and resolve after load.
2. **Screenshot + DOM read**: capture the rendered DOM and a screenshot together
   (read the capture back with `view_image`) so layout-bound content (tables,
   figures) is not lost.
3. **PDF path**: open the PDF directly in the in-app browser; read text and, when
   the evidence is a table or figure, capture the page image.
4. **Canonical/source swap**: if a portal shell hides content (e.g. a Naver
   wrapper), follow to the canonical origin URL and read that instead.
5. **Real-profile CDP**: when the block is login/WAF/profile-bound, drive the user's
   actual Chrome — cookies and session state come with it. Scripted path: an agbrowse
   CDP session (`agbrowse start --headed` -> `navigate` -> `snapshot --interactive` ->
   `click eN` -> `stop`; one-shot `agbrowse fetch --browser auto`). Conversational
   path: `chrome:control-chrome`.
   **If any agbrowse command fails (connection refused, no browser, etc.), run
   `agbrowse start` first to launch the local Chrome session, then retry.**
6. **OS-UI reach (`computer-use:computer-use`)**: only when browser chrome or an
   OS dialog no browser tool can reach is genuinely required (per-app approval).

## Stop conditions

Stop when the primary claim, date, and source identity are confirmed, or when the
URL is conclusively dead/unreadable — then return to the candidate list rather
than inventing access. Do not vendor CloakBrowser, agent-browser, or any hidden
provider to force a read.
