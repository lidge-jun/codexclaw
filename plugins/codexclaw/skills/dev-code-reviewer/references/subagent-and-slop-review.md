## 6. Subagent Review Mode

Parallelize review only when domain breadth exceeds one reviewer's context (e.g., frontend + backend + infra in a single diff, or when the diff spans too many unrelated domains for a single pass). Each subagent receives its file subset, the review process from sections 1-5, and outputs structured findings. The main agent deduplicates, normalizes severity, and presents a unified review.

### AI Tool Integration Awareness

Read `ai-assisted-review.md` for tool coordination, AI-generated-code
checks, re-review policy, and agentic security triggers. Focus manual review on
architecture, intent, and cross-system impact. **STRICT
(REVIEW-AI-EVIDENCE-01):** de-duplicate, reproduce, and severity-normalize AI
findings; they are evidence to inspect, not authority.

### AI Slop Cleanup Checklist (REVIEW-SLOP-01)

Activate for explicit slop cleanup or >=3 slop findings. Lock behavior with green
tests before deletion.

| # | Category | Flag |
|---|----------|------|
| 1 | Obvious comments | Restatement, dead code, vague TODOs |
| 2 | Over-defense | Impossible guards, broad/empty catches |
| 3 | Excess complexity | Deep nesting, nested ternaries, god functions |
| 4 | Needless abstraction | Pass-through or speculative indirection |
| 5 | Boundary violations | Wrong-layer imports or misplaced logic |
| 6 | Oversized modules | >250 pure LOC smell; >400 split rule is canonical |
| 7 | Performance equivalents | Avoidable quadratic work or allocation |
| 8 | Scope leaks | Mutable globals or scattered environment reads |
| 9 | Missing behavior tests | Changed behavior without regression coverage |

**REVIEW-GUARD-REMOVAL-01 (DEFAULT).** Deleting input validation or error handling at a
trust boundary requires a regression test that actually EXERCISES the deleted path. For an
input-validation guard that means malformed/hostile input; for an error handler it means
injecting the fault that reaches it — network timeout, connection reset, filesystem I/O
failure, subprocess failure. Attaching an unrelated input test to satisfy the form does not
meet this bar. Without it the deletion is a **High** blocker: row 2 (Over-defense) above is
not by itself grounds for calling a boundary guard unnecessary. Trust boundaries are where
external input first lands: hook stdin, CLI arguments, file parsing, network responses,
subagent output.

**REVIEW-REMOVED-BACKEND-01 (DEFAULT).** A change touching `search/SKILL.md` gets checked
for removed search backends creeping back in as if they were available: `progrok`,
`web-AI`, `Grok Expert`, `GPT Pro`, `Exa`, `Tavily`, `Perplexity`, `Brave`. These names may
appear only in non-goal or historical framing.

There is no automated check, and there cannot be a useful one: codexclaw owns no registry
of available backends to compare the prose against — `web_search` is host-provided.

Judge by deletion kind. A **replacing/relocating** deletion (the check moved elsewhere) must
stay GREEN after the old guard is removed, and go RED only when the surviving boundary check
is removed too. For a **non-replacing** deletion, a regression that goes RED proves the guard
is load-bearing — do not approve the deletion.

Test adequacy for prose-wording changes follows `dev-testing`'s `TEST-PROMPT-SEAM-01`; that
skill owns test adequacy (see §"Scope" above) and this rule does not restate it.
