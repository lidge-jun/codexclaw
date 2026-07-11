# 050 — C-Phase Evidence

- Date: 2026-07-10
- Session: 019f485b-2210-79b1-97df-66c00662ca55

## Build + full suite (main session, fresh)

- `npm run build` -> "build OK — 101 files compiled, layout validated."
- `npm test` -> `tests 1012 / pass 1012 / fail 0`, exit=0 (duration ~29s).

## Worker receipts (B phase)

- Worker 1 (Zeno, subagent-config + hook-e2e):
  `.codexclaw/evidence/260710_worker1_skill_mention_injection.md` — 115/115, exit 0.
- Worker 2 (Sagan, pabcd directives + docs):
  `.codexclaw/evidence/260710_worker2_skill_mention_injection.md` — 33/33 hook.test.ts,
  stale-claim rg sweep exit=1 (no matches).

## Live activation probe (C-ACTIVATION-GROUNDING-01)

PROBE-F (agent 019f488b, gpt-5.6-sol, spawned AFTER rebuild through the live
dev-symlinked plugin): spawn message contained the previously-broken bare
`$cxc-search`. Child reported:
1. injected `<skill>` body present — YES
2. first heading: `# search — Unified Search Hub`
3. received token: `[$cxc-search](skill:///Users/.../skills/search/SKILL.md)`

=> PreToolUse normalization rewrote the bare slug to the link form in production,
and codex-rs injected the body. Before the patch the identical form (PROBE-B,
agent 019f4860-fc31) reported NO injection.

## Adversarial C-gate review

Fresh reviewer (Kierkegaard, gpt-5.6-sol), 6 rounds over the uncommitted diff:
r1 FAIL(4H: 1 rebutted pre-existing D1 provenance, 3 accepted) -> repairs ->
r2 FAIL(3H) -> root-cause restructure -> r3 FAIL(3H) -> FAILSAFE-SPAN-01
amendment (080) -> r4 FAIL(3H) -> escalation clause fired, conservative
line-based scanner rebuild (090) -> r5 FAIL(2H fence-state) -> byte-matched
opener-prefix close + uncapped fence-toggle strip -> r6 **PASS** ("No
blockers... remaining ambiguity conservatively over-protected as required by
FAILSAFE-SPAN-01"). Syntheses: 060/070/080/090/100.

## Final state

- Full suite after each repair: 1016 -> 1019 -> 1023 -> 1027 -> 1029 pass, 0
  fail (final `npm test` exit=0).
- Perf floods: unmatched-[ / tilde / paren-in-title ~0ms; standalone repair
  flood 14.1ms (1s budget).
- PROBE-G (agent 019f48c5, post-rebuild live spawn): bare `$cxc-search`
  arrived normalized to the skill:// link form and the child quoted
  `# search — Unified Search Hub` — end-to-end activation proof on the final
  scanner.
