# 005 — Loop Continuation Patterns: Ralph, autoresearch, long-running harnesses → cxc-loop

Status: RESEARCH (design input for cxc-loop; NO code change) · 2026-07-01 · cxc-search Tier 1 discovery

> The operator's point: the divergence work is also a LOOP improvement, so it must be
> recorded against `cxc-loop` (`plugins/codexclaw/skills/loop/SKILL.md`), not only as a
> PABCD-phase change. This doc surveys the established autonomous-loop patterns (Ralph,
> autoresearch, long-running agent harnesses) and maps each to a concrete `cxc-loop`
> improvement. Upstream: `004_ipabcd_divergence_flow.md`, `structure/50_emergence_gap.md`.

## Source-Proof status

Tier 1 (hosted search) candidates below. Ralph is informal practitioner lore (blog +
gist), so treat specifics as candidate claims; the *patterns* recur across multiple
independent sources (Anthropic, OpenAI, the SICA paper) which raises confidence. Open the
primary URLs (Tier 2) before quoting an exact phrasing or metric.

## Reference sources

### R1 — "Ralph" (Geoffrey Huntley)
- Primary: ghuntley.com/ralph, ghuntley.com/loop, ghuntley.com/how-to-ralph-wiggum.
- Core idea: the simplest possible autonomous loop — run the SAME prompt in a fresh agent
  context, over and over (`while true; do cat PROMPT.md | agent; done`), with a durable
  on-disk plan/spec the agent reads and updates each pass. Each iteration starts clean
  (no context rot); continuity lives in FILES, not in the chat history.
- Key lessons that recur: one task per loop, a fixed source-of-truth file the loop reads
  every pass, the agent records progress to disk so the NEXT fresh pass resumes, and you
  accept that some passes are wasted (it is a search, not a straight line).

### R2 — autoresearch loop (jawcode)
- Primary (in-repo): `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/autoresearch/{prompt.md,prompt-setup.md,tools/log-experiment.ts}`.
- Core idea: an autonomous experiment loop that keeps iterating "until the user interrupts
  or the configured max iteration count is reached," with durable session state
  (baseline/best/notes/ideas) injected into the prompt every iteration, and explicit
  keep/discard/crash/checks_failed logging that commits or reverts the worktree.
- This is Ralph made rigorous: same loop, but with a true-objective METRIC, an ideas
  backlog (`update_notes append_idea`), and a confidence floor before keeping.

### R3 — Long-running / long-horizon agent harnesses (vendors)
- Primary: Anthropic engineering "Building agents with the Claude Agent SDK" / long-running
  agent guidance; OpenAI long-horizon execution notes.
- Recurring patterns: persist state to the filesystem (not context), compact/summarize
  across context resets, an explicit stop/continue decision per turn, and verification
  gates between segments. Maps directly onto codexclaw's Stop hook + `.codexclaw/` state.

### R4 — Self-Improving Coding Agent (SICA)
- Primary: arXiv:2504.15228 "A Self-Improving Coding Agent."
- Core idea: an agent edits its OWN toolset/workflow and measures the effect on a
  benchmark across iterations — a loop whose objective is improving the harness itself.
  Relevant as the upper bound of "loop that optimizes against a true metric."

## What `cxc-loop` says today (the gap)

`plugins/codexclaw/skills/loop/SKILL.md` (48 lines) is a pure HOTL PABCD-continuation
contract: "one work-phase = one PABCD cycle," Stop blocks premature termination via coarse
signals (active goal + in-flight cycle + `MAX_STOP_BLOCKS` stagnation cap). It has:

- NO durable plan/spec file the loop re-reads each pass (Ralph's core).
- NO true-objective metric or baseline/best memory across passes (autoresearch's core).
- NO ideas backlog or kept-candidate archive.
- A stagnation cap that counts TURNS, not objective non-improvement (already noted in
  `50_emergence_gap.md`).

So the loop today keeps the agent *moving*; it does not make the loop *converge on a
measured objective* or *diverge on plateau*. That is exactly the emergence gap, now stated
in loop terms.

## Mapped improvements to cxc-loop (with honest E-tier)

| # | Pattern (source) | cxc-loop improvement | Tier |
| - | ---------------- | -------------------- | ---- |
| L1 | Durable plan/spec the loop re-reads (R1, R3) | Loop reads a fixed `.codexclaw/plan/*` each pass; progress written to disk so a fresh pass resumes without chat history | E7 doctrine + E2 (Stop can name the file to read) |
| L2 | True-objective metric + baseline/best memory (R2, R4) | Persist an operator/`evaluate.sh` metric per work-phase in the ledger; loop carries baseline/best across passes | E2 / CLI |
| L3 | Plateau → diverge, not just turn-cap (R2, novelty search) | Replace/augment `MAX_STOP_BLOCKS` turn-cap with a metric-delta check: N non-improving passes → Stop injects "diverge/step-back" instead of releasing | **E2 (key)** |
| L4 | Ideas backlog + kept-candidate archive (R2) | `update_notes append_idea`-style backlog + a kept-candidate archive (the QD archive from `002`) persisted under `.codexclaw/` | E2 data model |
| L5 | keep/discard with confidence (R2) | Loop's per-pass record is keep/discard on the metric (revert worktree on discard), with a noise-floor confidence before keep | E7 + E2 ledger |
| L6 | Fresh-context resilience (R1, R3) | Loop survives context compaction by reloading plan+metric+archive from disk, not memory (codexclaw already compacts; wire the reload) | E2 (SessionStart/Stop) |

## Honest framing (carried from the diagnosis)

- These are LOOP improvements, but most are E7 (doctrine the agent follows) plus a few E2
  Stop/CLI levers. The one true runtime lever is **L3** — a metric-delta plateau check in
  the Stop hook. Everything else is the agent maintaining files the loop re-reads.
- Ralph itself is E-tier "prose + a shell while-loop"; codexclaw's equivalent is the Stop
  hook continuation, which is stronger (it gates termination) but still cannot author the
  next approach — it can only refuse "more of the same."
- No server, no background daemon: the loop is fresh passes + filesystem state, exactly
  Ralph's model, which fits codexclaw's no-server philosophy (`structure/00`).

## Open questions (for Interview)

- Does `cxc-loop` adopt a Ralph-style durable PROMPT/spec file, or keep relying on the
  PABCD plan docs as the re-read source?
- Where does the plateau metric-delta check live — Stop hook only, or a `cxc` CLI the loop
  calls each pass?
- Is the kept-candidate archive shared with the divergence layer (`004`) or loop-local?
