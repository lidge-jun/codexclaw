### Tier 2 — Source-open proof (SEARCH-BROWSE-01)

Use the shared [portable browser routing](../../dev/references/browser-routing.md).
For public pages, prefer HTTP proof with a usable source reader. If agbrowse resolves
via `../scripts/agbrowse_helper.py doctor`, `agbrowse fetch "<url>" --json --browser never`
is the recommended first attempt, not a prerequisite for all users.

For JS-rendered or inaccessible content, select a suitable available browser. Prefer
Aside for existing authenticated or judgment-heavy flows (deep-research Aside lane:
[references/deep-research.md](deep-research.md)); use agbrowse for independent
parallel extraction; available native browsers are valid alternatives. Local UI QA is
not prohibited on agbrowse. Read current CLI/tool docs rather than assuming tool names,
flags, schemas, platform support, or account access.

**SEARCH-PROOF-01:** Read the requested claim in the actual source. Confirm URL, source
identity, relevant date (or state it is absent), and whether corroboration exists.
An `ok` envelope, matching title, RSS feed, snippet, or navigation shell is not enough.
Use a different reader/rendering path if the actual claim is missing; mark blocked or
unverified when no path proves it. Inspect -> act -> re-inspect (SEARCH-BROWSE-VERIFY-01).
For blocked/JS/PDF/table pages, see `blocked-url-reader.md`.

Do not use plain `agbrowse search "<query>"` as the evidence for discovery: feed actual
hosted search candidates via its documented input, or open known URLs. Never invent
URLs. Optional tool absence does not justify installing drivers without authorization.
Fallbacks preserve session, permission, and evidence boundaries from the shared policy.
