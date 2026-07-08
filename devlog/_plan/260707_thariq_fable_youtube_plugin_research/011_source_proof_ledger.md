# 011 - Source Proof Ledger

Observed date: 2026-07-07 in Asia/Seoul. Some public sources are dated 2026-07-06 in US time.

| Claim id | Claim | URL | Source type | Proof method | Confidence | Notes |
|---|---|---|---|---|---|---|
| YT-1 | A YouTube video exists for "Field Guide to Fable - Thariq Shihipar, Anthropic". | `https://www.youtube.com/watch?v=9fubhllmsBU` | YouTube public endpoint | `agbrowse fetch` resolved oEmbed, HTTP 200 | Tier 2 proven | oEmbed returns title, provider, type, thumbnail, embed HTML. |
| YT-2 | The YouTube channel/uploader exposed by oEmbed is AI Engineer. | `https://www.youtube.com/watch?v=9fubhllmsBU` | YouTube public endpoint | `agbrowse fetch` oEmbed | Tier 2 proven | `author_name` is AI Engineer; `author_url` is `https://www.youtube.com/@aiDotEngineer`. |
| X-1 | Thariq announced on July 6, 2026 that his AI Engineer World Fair keynote "A Field Guide to Fable" is live on YouTube. | `https://x.com/trq212/status/2074163788853760175` | X public oEmbed | `agbrowse fetch` X oEmbed, HTTP 200 | Tier 2 proven | This proves Thariq's own announcement and date. |
| AIENG-1 | AI Engineer World's Fair 2026 had a keynote named "Field Guide to Fable" by Thariq Shihipar. | `https://www.ai.engineer/worldsfair/2026/sessions.json` | Official event JSON | `agbrowse fetch` plus JSON extraction | Tier 2 proven | Session row gives day/time/room/type/track/speaker. |
| AIENG-2 | The public schedule page with query param was not readable through HTTP-only fetch. | `https://www.ai.engineer/worldsfair/schedule?track=Autoresearch` | Official event web app | `agbrowse fetch --browser never` | Blocked candidate | JSON endpoint provides better proof than the schedule page in this environment. |
| AIENG-3 | The public schedule PDF was reported by a search-lane explorer as matching the keynote, but main-agent `agbrowse` did not reproduce readable content. | `https://www.ai.engineer/worldsfair/schedule.pdf` | Official event PDF | `agbrowse fetch --browser never` | Blocked candidate in main proof | Do not use the PDF as primary proof in this unit; use `sessions.json`. |
| CLAUDE-1 | The official Claude blog "A Field Guide to Claude Fable: Finding Your Unknowns" is dated July 6, 2026. | `https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns` | Official Claude/Anthropic blog | `agbrowse fetch` HTTP 200 with title/json-ld/content, verdict blocked due page markers | Tier 2 content available, with blocked verdict caveat | JSON-LD gives `datePublished: Jul 06, 2026`; page body names Thariq as author. |
| CLAUDE-2 | The official Anthropic Fable page exists and frames Claude Fable 5 as frontier intelligence for hard knowledge and coding work. | `https://www.anthropic.com/claude/fable` | Official Anthropic product page | `agbrowse fetch`, HTTP 200 | Tier 2 proven for Fable context | Product context only; not direct proof of the keynote. |
| YT-3 | A related official Claude YouTube video exists titled "Claude Fable 5: Working At The Frontier". | `https://www.youtube.com/watch?v=fQ3BuPPfovk` | YouTube public endpoint | `agbrowse fetch` oEmbed, HTTP 200 | Tier 2 proven for related video | Related Fable launch/context source, not Thariq keynote. |
| THARIQ-1 | Thariq's companion unknowns examples page exists and lists 11 HTML artifacts. | `https://thariqs.github.io/html-effectiveness/unknowns/` | Thariq-owned GitHub Pages candidate | `agbrowse fetch`, HTTP 200 | Tier 2 proven for page content | Ownership inferred from `thariqs.github.io`; not separately identity-verified beyond URL/name continuity. |
| THARIQ-2 | `thariq.io` exposes a public feed titled "Thariq Shihipar". | `https://thariq.io` | Thariq-owned profile/feed candidate | `agbrowse fetch` resolved `https://www.thariq.io/rss.xml` | Tier 2 for feed existence | Feed links appear to use `example.me`, so do not use it for content claims without more identity proof. |
| X-0 | A February 27, 2026 Thariq X post exists and contains a link only. | `https://x.com/trq212/status/2027463795355095314` | X public oEmbed | `agbrowse fetch` X oEmbed | Tier 2 for post existence, weak for target | The linked target was not expanded in this pass. |

## Tool Evidence Notes

- `agbrowse fetch 'https://www.youtube.com/watch?v=9fubhllmsBU' --json --browser never` returned `ok: true`, `verdict: strong_ok`, `source: public_endpoint`, and final URL `https://www.youtube.com/oembed?...`.
- `agbrowse fetch 'https://x.com/trq212/status/2074163788853760175' --json --browser never` returned `ok: true`, `verdict: strong_ok`, `source: public_endpoint`, and final URL `https://publish.x.com/oembed?...`.
- `yt-dlp` was not installed in this workspace, so YouTube upload-date extraction was not attempted through that route.
- A search-lane explorer reported YouTube watch metadata with timestamp `2026-07-06 09:00:06 -07:00`; the main pass did not independently reproduce that timestamp, so final claims should prefer "live on YouTube as of Thariq's July 6, 2026 announcement" over a watch-page upload timestamp.

## Evidence Boundaries

- Search-result snippets were used only to discover URLs.
- The YouTube watch page did not yield direct page metadata beyond oEmbed in this pass.
- Avoid wording that makes Thariq the uploader. Use "Thariq's keynote is live on YouTube" or "AI Engineer channel video featuring Thariq."
