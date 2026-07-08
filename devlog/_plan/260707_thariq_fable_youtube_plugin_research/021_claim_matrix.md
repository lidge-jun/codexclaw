# 021 - Claim Matrix

## Verified Claims

| Claim | Source | Confidence | Notes |
|---|---|---|---|
| A YouTube video exists with title "Field Guide to Fable - Thariq Shihipar, Anthropic". | YouTube oEmbed for `https://www.youtube.com/watch?v=9fubhllmsBU` | Tier 2 proven | Proven title/channel/video id only. |
| The video is exposed as an AI Engineer channel video. | YouTube oEmbed for `9fubhllmsBU` | Tier 2 proven | Do not call Thariq the uploader. |
| Thariq announced that his AI Engineer World Fair keynote "A Field Guide to Fable" is live on YouTube. | X oEmbed for `https://x.com/trq212/status/2074163788853760175` | Tier 2 proven | Date shown: July 6, 2026. |
| AI Engineer World's Fair 2026 listed "Field Guide to Fable" as a keynote by Thariq Shihipar. | `https://www.ai.engineer/worldsfair/2026/sessions.json` | Tier 2 proven | Session row includes track/time/room/type/speaker. |
| The official Claude blog article with matching topic is dated July 6, 2026. | `https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns` | Tier 2 content available, blocked verdict caveat | `agbrowse` verdict was blocked due page markers, but returned HTTP 200 content and JSON-LD. |
| Thariq's companion unknowns examples page lists eleven HTML artifacts. | `https://thariqs.github.io/html-effectiveness/unknowns/` | Tier 2 proven | Strong page content proof. |

## Interpreted Claims

| Claim | Basis | Confidence | Guardrail |
|---|---|---|---|
| The YouTube keynote and Claude blog are part of the same Fable/unknowns guidance cluster. | Matching title/topic/date/person plus companion examples. | Strong inference | Do not treat the blog as a verbatim transcript. |
| The useful Codexclaw import is unknown-management discipline, not model-specific hype. | Blog structure and examples page lifecycle. | Strong inference | Keep recommendations as workflow changes, not Fable-only assumptions. |
| The user likely meant "Thariq's keynote is on YouTube", not "Thariq personally uploaded it". | YouTube oEmbed channel is AI Engineer; Thariq X says his keynote is live. | Strong inference | Use precise wording. |

## Unverified Or Blocked Claims

| Claim | Status | Reason |
|---|---|---|
| YouTube upload timestamp from the watch page is July 6, 2026 09:00:06 -07:00. | Unverified in main pass | Search-lane explorer reported it, but main-agent tooling did not reproduce it. |
| Full video transcript content. | Blocked / not obtained | timedtext/list/embed attempts did not return transcript text. |
| Video description links. | Not obtained | oEmbed does not include description; watch-page extraction unavailable in this pass. |
| A separate Thariq-authored "loop engineering guide" video exists. | Not proven | Current evidence points to Fable keynote plus official loop materials, not a distinct proven Thariq loop-engineering video. |

## Codexclaw-Relevant Content Claims

| Practice | Source basis | Codexclaw mapping |
|---|---|---|
| Unknown taxonomy | Official Claude blog and companion examples | Add unknown taxonomy to P/A docs and search-ledger rows. |
| Blindspot pass | Official Claude blog and examples page | Use in P before code changes in unfamiliar surfaces. |
| Interview for ambiguities | Official Claude blog and examples page | Maps to `cxc-interview` / HITL PABCD; in HOTL, record open assumptions instead of asking. |
| References as rich context | Official Claude blog | Maps to repo-local source references and `cxc map` before implementing. |
| Implementation notes | Official Claude blog and examples page | Maps to B-phase deviation log and cycle log updates. |
| Pitch/explainer and quiz | Official Claude blog and examples page | Maps to D/C evidence for reviewer/user understanding. |
