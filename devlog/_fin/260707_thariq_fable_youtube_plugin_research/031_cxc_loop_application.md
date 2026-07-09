# 031 - Applying Fable Unknowns To Cxc Loop

## Mapping To PABCD

| Fable unknowns practice | Cxc-loop location | Concrete use |
|---|---|---|
| Unknown taxonomy | P | Add a short unknowns table to research-heavy plans. |
| Blindspot pass | A or early P | Reviewer asks what the plan does not know, not just whether syntax/files are right. |
| Brainstorm/prototype | P for open-ended or UI/domain uncertainty | Generate candidate approaches before implementation, but collapse before B unless objective is optimization. |
| Interview | HITL I/P only | Ask user when answer changes architecture; in HOTL, record open assumptions instead. |
| References | P | Use source code, event pages, videos, docs, or examples as first-class references. |
| Implementation notes | B | Maintain deviation notes whenever reality forces a plan change. |
| Pitch/explainer | D/C | Package conclusions so reviewers inherit fewer unknowns. |
| Quiz | C/D | Use a short quiz/report when the operator must understand a large change before merge. |

## What This Research Added

This unit itself is a worked example:

- Cycle 1 created the roadmap and evidence protocol before searching deeply.
- Cycle 2 treated YouTube snippets as candidates and promoted only opened sources.
- Cycle 3 recorded transcript unavailability instead of inventing video content.
- Cycle 4 maps the findings into plugin/native attachment surfaces instead of leaving them in chat.
- Cycle 5 will normalize the final conclusion and open questions.

## Suggested Loop Template

For future current-source research:

1. P: write source-proof schema and decide what counts as direct, adjacent, inferred, and blocked evidence.
2. A: have an independent reviewer check the schema for overclaim risk.
3. B: collect sources and update a claim ledger while preserving failed fetches.
4. C: run a confidence normalization check:
   - no snippet-only claim is Tier 2.
   - blocked sources remain blocked.
   - subagent-only claims are either reproduced or explicitly demoted.
   - user wording is corrected to the precise proven wording.
5. D: close with a terminal outcome and open questions.

## Proposed Codexclaw Follow-Up

Create a follow-up implementation unit only if we want this reusable in the shipped plugin:

- Add `references/fable-unknowns-loop.md` under the relevant skill directory.
- Reference it from `cxc-loop` or `cxc-pabcd` only as an optional pattern for C5 research and long-horizon implementation.
- Add a short source-proof checklist to `cxc-search` only if repeated future work shows the current ladder misses YouTube/oEmbed cases.

## Guardrails

- Keep Fable guidance model-agnostic where possible. The durable lesson is unknown discovery, not one model's brand.
- Keep HOTL loops honest: when a goal is active, do not ask user questions; record open assumptions and proceed conservatively or close NEEDS_HUMAN.
- Use exact terminal outcomes. If a video transcript remains unavailable, the content-analysis subgoal is partially blocked even when the broader research is DONE.
