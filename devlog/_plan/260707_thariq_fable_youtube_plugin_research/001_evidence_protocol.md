# 001 - Evidence Protocol

## Search Classification

This task is current/public comprehensive research. The cxc-search ladder applies:

- Tier 1: hosted web search discovers candidate URLs.
- Tier 2: open the original source with `web.open`, `agbrowse fetch`, or browser fallback.
- Tier 3: subagent search lanes are allowed because the user requested deeper looped investigation and evidence-heavy docs.

## Source Types

- Primary official: Claude / Anthropic / AI Engineer / YouTube page controlled by channel or event organizer.
- Primary social: Thariq-owned site/profile/newsletter/page when source ownership is clear.
- Secondary credible: conference schedule pages, GitHub/repo docs, search-indexed video metadata, reputable writeups.
- Candidate only: search snippets, blocked pages, unverified mirrors, pages where author/channel identity is unclear.

## Claim Ledger Fields

Each source ledger row should record:

- Claim id.
- Claim.
- URL.
- Source type.
- Date observed.
- Proof method.
- Confidence: Tier 2 proven, Tier 1 candidate, blocked candidate, or contradicted.
- Notes and open questions.

## YouTube Proof Rules

- Prefer the actual YouTube watch URL and channel metadata.
- If the watch page is blocked or fails to render, record the tool/error and try independent corroboration.
- Do not use transcript text unless it is public and accessible without login. Avoid long verbatim excerpts.
- Distinguish "published by Thariq" from "featuring Thariq" and "conference uploaded a recording."

## Plugin Attachment Rules

"Plugin attachment" is interpreted through existing Codex/Codexclaw surfaces:

- Skill attachment: pass `cxc-search`, `cxc-loop`, and relevant skills to subagents through `$cxc-*` mentions or structured skill items.
- Browser plugin fallback: use in-app browser or Chrome control only when `agbrowse` cannot prove a JS-heavy page.
- Codexclaw plugin docs: keep reusable guidance in a numbered devlog unit first; do not alter shipped plugin skills until a separate implementation task.
- Native future: if the research suggests reusable behavior, record candidate surfaces such as `ToolContributor`, `ContextContributor`, `TurnLifecycleContributor`, or tool lifecycle events for later Codex-rs-native work.

## Audit Criteria

- No claim promoted from snippet-only evidence.
- Every blocked source has a fallback attempt or an explicit reason to stop.
- Every PABCD cycle records P, A, B, C, and D artifacts in `090_pabcd_cycle_log.md`.
- Final docs separate evidence, interpretation, and recommendation.
