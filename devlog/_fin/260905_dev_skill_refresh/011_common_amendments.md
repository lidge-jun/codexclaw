# wp1 — A audit amendments

Dependency: owning decade plan. These exact edits run AFTER its original operations.

## MODIFY plugins/codexclaw/skills/search/references/blocked-url-reader.md

Before:

`````text
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


`````

After:

`````text
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


`````

## MODIFY plugins/codexclaw/skills/qa/SKILL.md

Before:

`````text
The QA tool ladder (QA-TOOL-LADDER-01 — in-app browser > chrome > computer-use,
agbrowse for public-URL shape checks only) is canonically owned by
`dev-testing` §4.6.
`````

After:

`````text
Browser selection (QA-TOOL-LADDER-01) is owned by
[portable browser routing](../dev/references/browser-routing.md). Suitable available
Aside, agbrowse and native browser capabilities may drive built UI; none is required.
`````

## MODIFY plugins/codexclaw/skills/qa/SKILL.md

Before:

`````text
  Playwright suites, CI gates — and the exploratory-tier TOOL ROUTING
  (which browser/computer-use tool drives which surface, §4.6 TEST-CU-QA-01).
`````

After:

`````text
  Playwright suites and CI gates. Browser selection lives in the shared dev policy;
  `dev-testing` §4.7 connects that policy to exploratory tests.
`````

## MODIFY plugins/codexclaw/skills/qa/SKILL.md

Before:

`````text
Tool choice for the browser/CU rows follows QA-TOOL-LADDER-01 (`dev-testing`
§4.6);
`````

After:

`````text
Tool choice for the browser/CU rows follows the shared portable browser policy;
`````
