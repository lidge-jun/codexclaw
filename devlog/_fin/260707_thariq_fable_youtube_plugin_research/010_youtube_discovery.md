# 010 - YouTube Discovery

## Finding

The strongest current conclusion is:

Thariq Shihipar publicly stated on X on July 6, 2026 that his AI Engineer World's Fair keynote, "A Field Guide to Fable", is live on YouTube. The YouTube video id is `9fubhllmsBU`; YouTube oEmbed identifies the title as "Field Guide to Fable - Thariq Shihipar, Anthropic" and the channel/uploader as AI Engineer.

This means the precise wording should be:

- Verified: Thariq's Fable keynote is live on YouTube.
- Verified: The YouTube upload is on the AI Engineer channel, not proven as a personal Thariq-channel upload.
- Verified: AI Engineer's official 2026 sessions JSON lists "Field Guide to Fable" as a keynote by Thariq Shihipar.
- Not yet proven: YouTube upload date from the watch page itself. The July 6, 2026 public date is proven through Thariq's X post and the official Claude blog date, not through YouTube metadata.

## Candidate And Proof URLs

### YouTube video

- URL: `https://www.youtube.com/watch?v=9fubhllmsBU`
- Proof method: `agbrowse fetch ... --json --browser never` and `--browser auto`.
- Result: `agbrowse` resolved YouTube's public oEmbed endpoint and returned HTTP 200.
- Proven metadata:
  - title: "Field Guide to Fable - Thariq Shihipar, Anthropic"
  - author/channel: "AI Engineer"
  - author URL: `https://www.youtube.com/@aiDotEngineer`
  - type: video
  - provider: YouTube
- Confidence: Tier 2 proven for existence/title/channel/video id.

### Thariq X post announcing YouTube availability

- URL: `https://x.com/trq212/status/2074163788853760175`
- Proof method: `agbrowse fetch ... --json --browser never`.
- Result: X public oEmbed returned HTTP 200.
- Proven metadata:
  - author: Thariq
  - author URL: `https://x.com/trq212`
  - date visible in embed: July 6, 2026
  - public text says his AI Engineer World Fair keynote "A Field Guide to Fable" is live on YouTube.
- Confidence: Tier 2 proven for Thariq-authored announcement and date.

### AI Engineer official sessions JSON

- URL: `https://www.ai.engineer/worldsfair/2026/sessions.json`
- Proof method: `agbrowse fetch ... --json --browser never`, plus local JSON extraction.
- Proven row:
  - conference: AI Engineer World's Fair 2026
  - dates: June 29 - July 2, 2026
  - session title: Field Guide to Fable
  - day: Day 3 - Session Day 2
  - time: 9:05am-9:25am
  - room: Main Stage
  - type: keynote
  - track: Autoresearch
  - speaker: Thariq Shihipar
- Confidence: Tier 2 proven for event/session identity.

### AI Engineer schedule PDF

- URL: `https://www.ai.engineer/worldsfair/schedule.pdf`
- Proof method: main-agent `agbrowse fetch ... --json --browser never`.
- Result: blocked / no readable content in this environment.
- Search-lane note: an explorer reported PDF text confirming the same keynote, but because the main proof attempt could not reproduce the content, this unit uses the sessions JSON as the primary event proof.
- Confidence: blocked candidate in this unit.

### Related official Claude Fable video

- URL: `https://www.youtube.com/watch?v=fQ3BuPPfovk`
- Proof method: `agbrowse fetch ... --json --browser never`.
- Result: YouTube oEmbed returned HTTP 200.
- Proven metadata:
  - title: "Claude Fable 5: Working At The Frontier"
  - author/channel: "Claude"
  - author URL: `https://www.youtube.com/@claude`
- Confidence: Tier 2 proven for related official Fable video; not the Thariq keynote.

### Official Anthropic Claude Fable product page

- URL: `https://www.anthropic.com/claude/fable`
- Proof method: `agbrowse fetch ... --json --browser never`.
- Result: HTTP 200 with readable page text.
- Proven metadata:
  - title: "Claude Fable"
  - page describes Claude Fable 5 and announcement/update dates including June 9, 2026 and July 1, 2026.
- Confidence: Tier 2 proven for Fable product context; not direct proof of Thariq keynote.

### Thariq earlier event-link X post

- URL: `https://x.com/trq212/status/2027463795355095314`
- Proof method: X public oEmbed.
- Proven metadata:
  - author: Thariq
  - date: February 27, 2026
  - post contains a link only.
- Confidence: Tier 2 for existence/date/author, weak for content because the target shortlink was not expanded in this pass.

## What The User's Claim Means

The user's "Thariq uploaded a YouTube video" is directionally right if interpreted as "Thariq's Fable keynote is now available on YouTube." It is more precise to say:

The YouTube video is exposed through the AI Engineer channel metadata, and Thariq announced it publicly as his keynote.

## Open Questions

- Can the YouTube watch page itself expose an upload date without `yt-dlp` or a logged-in browser?
- Does the video description include links to the Claude blog, companion examples, or slides?
- Is there a separate "loop engineering guide" video, or is that phrase the user's label for the Fable keynote plus unknowns workflow?
