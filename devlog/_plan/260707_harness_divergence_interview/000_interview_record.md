# 000 - Harness Divergence Interview Record

Date: 2026-07-07
Mode: HITL interview (I phase, conversational; formal `cxc orchestrate` arming deferred
to the spec unit kickoff).
Participants: owner (jun) + main session (model persona: claude-fable-5).
Context: follow-up to `260707_codex_rs_native_tooling_research` and
`260707_thariq_fable_youtube_plugin_research`. Topic: how to fold Fable-style
unknown-discovery/loop practices into Codexclaw given effectively unlimited
high-effort subagents.

## Frozen Decisions

### D1. Loop archetype: BOTH (spike then spec)

Owner selected: run a divergence spike first to gather candidate directions, then
collapse into a spec unit with a verifiable DONE. Open-ended forever-optimization
was rejected (sprawl / false-DONE risk).

### D2. Subagent budget goes to P/A unknowns swarm first

Owner selected: parallel blindspot/unknowns passes before and during planning are
the first lane for cheap subagents. C/D adversarial verification swarm and
worktree prototype lanes were offered and not chosen as the first investment.

Correction from owner (this session): "xhigh" is not a specific model-wiring
requirement. Treat it as the generic subagent concept available to the current
session. Do NOT build gpt-5.5-xhigh-specific store plumbing; the existing
`.codexclaw/subagents.json` role/model/effort resolver already covers model
choice, and the spec must stay model-agnostic.

### D3. Phase boundaries stay; divergence is conceptual by default

Owner selected boundary-keeping (I/P/A/B/C/D intact, divergence inside P), and
then pushed back on the assistant's initial 3-round agent-roundtable proposal as
too expensive. Agreed simplification:

- Tier 1 (default): 2-3 explorer subagents each write a ONE-PAGE conceptual
  direction doc (no code, no worktrees). Front-matter is mandatory: assumptions,
  risks, kill-criteria. The MAIN session does the critique/triage directly --
  it holds the most context, so a separate cross-critique round is waste.
- Collapse gate (light): N candidate docs with filled front-matter. Critique
  round is NOT a gate condition.
- Tier 2 (rare escalation): parallel worktree implementation + cross-critique
  ONLY when both hold: (a) the choice is load-bearing and candidates genuinely
  conflict, (b) judging requires running code (perf assumptions, live API
  contracts). Expected frequency: 0-1 per unit.

Rationale: token cost may be ~free, but wall-clock and main-session triage
attention are not. The real budget is attention. This also matches Thariq's
field guide more faithfully: its "prototypes" are mostly conceptual artifacts
(design directions, mocks); code-level parallel spikes are the exception.

### D4. Topology constraint acknowledged: star, not mesh

No nested orchestration (subagents cannot spawn or message each other). Any
agent-to-agent exchange is file-mediated through shared `.codexclaw/divergence/`
candidates and devlog docs, scheduled by the main session. Human touchpoints:
interview at entry, collapse review at exit (skippable under an active HOTL goal).
Owner asked whether agents-only divergence (interview excepted) is designable:
answer recorded as yes-with-star-topology; groupthink risk mitigated by assigning
distinct lenses per explorer (conservative / radical / adversarial) and capping
rounds.

## Evidence Trail

- Existing machinery confirmed sufficient: divergence mode/candidates/collapse in
  `plugins/codexclaw/skills/loop/SKILL.md` (divergence section, ~L268-326);
  per-role model + reasoning_effort in
  `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts` (store
  resolver owns effective model).
- Prior research context: `260707_codex_rs_native_tooling_research/300_recommendations.md`
  (Priority 6, Fable-inspired unknowns workflow) and
  `260707_thariq_fable_youtube_plugin_research/031_cxc_loop_application.md`
  (PABCD mapping table).
- Assistant's initial over-heavy proposal (3-round roundtable with mandatory
  cross-critique gate) and the owner's cost pushback are both recorded here
  deliberately as a plan-deviation example of the very pattern being adopted.

## Open Questions (for owner)

- OQ1. Landing repo: write the spec/guidance upstream in `pabcd_initiative`
  (design SOT) first and port to codexclaw, or edit codexclaw skills directly?
  Traceability favors upstream-first; speed favors direct.
- OQ2. Spec blast radius: guidance-only (skill text + reference doc + goalplan
  template) vs also code (a real collapse-gate check in `pabcd-state`).
  Guidance-only is cheap and reversible; a coded gate is real enforcement but
  touches shared hook logic and needs tests.

## Next

- On owner answers to OQ1/OQ2: open the spec unit (P), arm formal orchestration
  with the current session id, and run the Tier-1 conceptual divergence spike as
  its own first work-phase (self-testing the new lane).
