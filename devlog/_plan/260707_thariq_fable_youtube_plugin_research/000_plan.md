# 000 - Thariq Fable YouTube / Plugin Research Plan

## Objective

Investigate the claim that Thariq Shihipar published a YouTube video or keynote about Claude Fable, then record source-proofed findings and Codexclaw plugin-integration implications.

This unit is docs-only. It must not change product code, runtime code, existing cxc skills, or unrelated dirty files.

## Loop Spec

- Work class: C5 research plus C3 durable documentation.
- Loop mode: HOTL goal loop.
- Required work-phases: at least five full PABCD cycles.
- Tool scope: web search, `agbrowse` proof, local repo reads, cxc map, subagent reviewers/search lanes.
- Write scope: only this folder, `devlog/_plan/260707_thariq_fable_youtube_plugin_research/`.
- Non-goals: no dependency installs, no YouTube login, no private scraping, no runtime/plugin implementation.
- Verifier: file listing, source ledger sanity, PABCD cycle log, no placeholder markers, no bare semantic plan filenames, cxc state returns to IDLE.
- Terminal outcomes: DONE when source claims are recorded with confidence tiers and five cycles are logged; BLOCKED if the video exists only as an unopenable candidate; NEEDS_HUMAN if identity/video ambiguity remains; BUDGET_EXHAUSTED if fewer than five cycles complete.

## Planned Work-Phases

1. Cycle 1 - Roadmap and evidence protocol.
   - Write `000_plan.md`, `001_evidence_protocol.md`, and initialize `090_pabcd_cycle_log.md`.
   - Confirm existing related devlog context and current dirty-tree boundaries.
2. Cycle 2 - YouTube and event/source discovery.
   - Search for Thariq, Fable, YouTube, loop engineering, AI Engineer talk, and official/secondary mirrors.
   - Prove candidate URLs with Tier 2 opens where possible.
   - Write `010_youtube_discovery.md` and `011_source_proof_ledger.md`.
3. Cycle 3 - Video/keynote content and claim extraction.
   - Extract public metadata and any legally available summary/transcript snippets.
   - Compare against the official Claude Fable field guide and companion unknowns page.
   - Write `020_video_content_notes.md` and `021_claim_matrix.md`.
4. Cycle 4 - Plugin attachment / Codexclaw integration.
   - Investigate how this should attach through Codexclaw plugin/skill surfaces, including search-skill attachment, browser plugin fallback, and future native contributor ideas.
   - Write `030_plugin_attachment.md` and `031_cxc_loop_application.md`.
5. Cycle 5 - Synthesis, QA, and open questions.
   - Audit all docs, normalize confidence tiers, list final conclusions and next actions.
   - Write `040_final_synthesis.md` and update `090_pabcd_cycle_log.md`.

## Evidence Requirements

- Every factual claim about a public source must name URL, source type, date observed, and confidence.
- Search-result snippets are candidates only. A claim is proven only after opening the source.
- YouTube pages may be JS-rendered or partially inaccessible. If direct opening fails, record the failure and corroborate via independent official/event pages where possible.
- Do not quote long transcript/video text. Use short excerpts only when needed and otherwise summarize.

## Context From Previous Unit

Previous local context exists in `devlog/_plan/260707_codex_rs_native_tooling_research/200_fable_loop_adoption.md`. That unit verified Thariq's official Claude Fable field guide on July 6, 2026, but treated the YouTube / loop-engineering title as not fully verified. This unit is the follow-up proof pass.

## Open Assumptions

- "Thariq" means Thariq Shihipar, author of the official Claude Fable field guide.
- The relevant YouTube item may be a conference/keynote recording rather than a direct upload on a personal channel.
- "플러그인으로 붙는거" means the research should describe plugin/skill/connector attachment paths for Codexclaw, not just summarize a video.
