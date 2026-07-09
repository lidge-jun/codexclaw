# 030 - Plugin Attachment Analysis

## Short Answer

Yes: this research should attach through the Codexclaw plugin system first, not as a one-off memory in chat.

For now, the correct attachment is:

- a numbered devlog research unit for durable evidence;
- `cxc-search` skill attachment for future source-proof subagents;
- `cxc-loop` / `cxc-pabcd` attachment for repeated evidence-gated research loops;
- optionally a future small skill or reference page that teaches "Fable unknowns workflow" as a repeatable loop pattern.

It should not immediately patch shipped skills or runtime code from this research pass alone.

## Current Plugin-Level Attachment Points

### Skill attachment to subagents

Codexclaw already has an explicit skill-attachment path for subagents.

Local evidence:

- `plugins/codexclaw/skills/dev/SKILL.md` says subagent dispatch should attach `cxc-dev` and relevant surface skills through `$cxc-*` mentions or structured `items`.
- `plugins/codexclaw/skills/search/SKILL.md` has `SEARCH-ATTACH-01`, which says search subagents should receive `cxc-search` as a real skill attachment, not a rewritten inline tool block.
- `structure/10_subagent_skill_routing.md` says the shipped `^spawn_agent$` hook prepends link-form `$cxc-*` mentions into spawn messages, schema-safe across v1/v2 because `message` is shared.
- `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts` owns skill item/mention construction and dispatch shaping.

Implication:

- Future Fable/unknowns research lanes should spawn explorers with `cxc-search` and, when looping, `cxc-loop`.
- The Fable unknowns workflow can become a skill or reference only after this devlog proves stable wording.

### Search proof ladder

This task exercised the existing `cxc-search` plugin discipline.

Local evidence:

- `plugins/codexclaw/skills/search/SKILL.md:70-91` defines `agbrowse` as the primary Tier-2 proof surface, with browser/chrome/computer-use fallback only when needed.
- `structure/60_native_capabilities.md:59-90` describes browser/computer-use and `agbrowse` as the underused proof tier.
- `plugins/codexclaw/components/pabcd-state/src/hook.ts` contains an `agbrowse` request directive for user prompts that explicitly ask to route research through `agbrowse`.

Implication:

- Fable/YouTube claims should continue to be recorded as source-proof ledgers.
- `agbrowse` evidence envelopes are good enough for devlog proof, but YouTube transcript/description extraction may need a browser or explicit user approval for logged-in/private contexts.

### Devlog as plugin-adjacent durable memory

The safest immediate attachment is this devlog unit.

Reason:

- It keeps evidence, confidence, and open questions on disk.
- It avoids pushing volatile current-web findings into core skill text too early.
- It gives future skill edits a source of truth with exact URLs and caveats.

## What Should Become A Reusable Skill Later

Candidate skill/reference title:

- `cxc-fable-unknowns` or `references/fable-unknowns-loop.md`

Minimum contents:

- Unknown taxonomy: known knowns, known unknowns, unknown knowns, unknown unknowns.
- Pre-implementation pattern: blindspot pass, prototype/brainstorm, interview, reference, tweakable plan.
- During implementation pattern: implementation notes / deviation log.
- Post-implementation pattern: pitch/explainer and quiz before merge.
- Evidence discipline: distinguish direct source proof from inferred content clusters.
- PABCD mapping: P = unknown discovery, A = blindspot audit, B = implementation notes, C = quiz/explainer proof, D = pessimistic synthesis.

Do not create the skill yet in this task. This task is docs-only and still has open questions around the exact video transcript.

## Codex-rs Native Future

The previous unit found that the strongest native direction is Codex-rs extension contributors.

Useful native surfaces from `ext/extension-api/src/contributors.rs`:

- `ContextContributor` for adding stable prompt/world-state fragments.
- `TurnInputContributor` for turn-local model input.
- `ToolContributor` for native tools owned by a feature.
- `ToolLifecycleContributor` for observing accepted tool calls without rewriting payloads.
- `TurnLifecycleContributor` and `ThreadLifecycleContributor` for seeding/rehydrating/flush behavior.
- `ApprovalReviewContributor` for host-owned approval review prompts.

How this maps:

- The Fable unknowns workflow should be plugin-skill first.
- Source proof could later become a native `ToolContributor` around web-search with an evidence envelope.
- Unknown taxonomy/context could later become a `ContextContributor` or `TurnInputContributor`.
- Loop evidence could later become `ToolLifecycleContributor` / `TurnLifecycleContributor` events.

## Anti-Patterns

- Do not hardcode Thariq/Fable-specific guidance into every Codexclaw session.
- Do not treat the YouTube video as a transcript source until a transcript is actually retrieved.
- Do not bypass `cxc-search` by relying on YouTube snippets.
- Do not mutate cxc skill text from a single research pass; first capture evidence, then design a follow-up implementation unit.
