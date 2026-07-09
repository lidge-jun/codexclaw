# 020 - Video Content Notes

## Direct Video Evidence

Directly proven from YouTube public oEmbed:

- Video id: `9fubhllmsBU`.
- Title: "Field Guide to Fable - Thariq Shihipar, Anthropic".
- Channel exposed by oEmbed: AI Engineer.
- Provider: YouTube.
- Type: video.

Directly proven from Thariq's public X oEmbed:

- Thariq announced on July 6, 2026 that his AI Engineer World Fair keynote "A Field Guide to Fable" is live on YouTube.

Directly proven from AI Engineer's official 2026 sessions JSON:

- "Field Guide to Fable" was a keynote.
- Speaker: Thariq Shihipar.
- Track: Autoresearch.
- Main Stage, 9:05am-9:25am, Day 3 / Session Day 2.

## Transcript / Description Availability

The main-agent pass did not obtain a public transcript or YouTube description body.

Attempts:

- `agbrowse fetch https://www.youtube.com/api/timedtext?v=9fubhllmsBU&lang=en` resolved to YouTube oEmbed metadata rather than transcript text.
- `agbrowse fetch https://video.google.com/timedtext?type=list&v=9fubhllmsBU` returned blocked/no readable content.
- `agbrowse fetch https://www.youtube.com/embed/9fubhllmsBU` returned only a minimal YouTube page title/body.
- `yt-dlp` was not installed, so no watch-page extraction was attempted through that tool.

Therefore, this unit does not claim detailed video transcript content.

## Adjacent Official Content

The official Claude blog post and companion examples page provide the best content-grounded interpretation of the keynote topic.

Official Claude blog:

- URL: `https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns`
- Title: "A Field Guide to Claude Fable: Finding Your Unknowns".
- Date: July 6, 2026.
- Author statement in page body: written by Thariq Shihipar, member of technical staff, Anthropic.
- Core structure:
  - classify unknowns into known knowns, known unknowns, unknown knowns, and unknown unknowns.
  - pre-implementation practices: blind spot pass, brainstorming/prototype, interviews, references, implementation plans.
  - during implementation: implementation notes.
  - post implementation: pitches/explainers and quizzes.
  - Fable launch video anecdote: the launch video was edited end-to-end using Claude Code, with transcription, Remotion prototype, and color-grading unknowns as examples.

Companion examples page:

- URL: `https://thariqs.github.io/html-effectiveness/unknowns/`
- Title: "Know your unknowns - examples".
- It presents eleven self-contained HTML artifacts for finding unknowns before, during, and after implementation.
- It maps the same lifecycle:
  - 8 pre-implementation demos.
  - 1 during-implementation demo.
  - 2 post-implementation demos.
- Examples include blindspot pass, color grading explainer, design directions, toolbar mock, churn brainstorm, interview, reference port, tweakable plan, implementation notes, pitch doc, and change quiz.

## Conservative Interpretation

Because the keynote title, official blog title, X announcement, and companion page all align around "Field Guide to Fable" and unknowns, it is reasonable to interpret the YouTube keynote as the talk-form counterpart of the same guidance. It is not reasonable, without transcript access, to attribute every blog detail to the video verbatim.

## What To Carry Forward

For Codexclaw, the portable content is:

- Treat unknowns as first-class loop artifacts.
- Ask for blindspot passes before implementation when the territory is unfamiliar.
- Keep implementation notes during B when reality deviates from the plan.
- Produce post-implementation explainers and quizzes as D/C evidence, especially for large agentic changes.
- Use references and prototypes as cheap unknown-discovery tools before expensive implementation.
