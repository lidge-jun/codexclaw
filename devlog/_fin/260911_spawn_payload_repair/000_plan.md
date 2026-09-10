# Repair spawn payload boundaries

Five PR #130 review findings reproduce at `0b811d3f`: item-by-item skill expansion
exceeds the combined limit, item cleanup changes source whitespace, warning prefixes
break reapplication, quoted dispatch IDs consume another call's claim, and legacy
reviewer recovery instructions omit deliberate role selection. This unit repairs
those paths while preserving the prior routing and discovery work.

Loop: satisfy-spec, one PABCD cycle, C4 care for the dispatch boundary. Trigger:
the user's authorization to fix the five confirmed findings. Goal: exact item content,
bounded unique skill delivery, correct reviewer routing and single-use dispatch.
Non-goals: upstream merge/release, provider changes, new frameworks, price analysis,
or another model behavior benchmark. Stop: five regressions green, independent
review clear, local integration installed, existing PR updated with current CI.
Memory/evidence: this unit and private `pr-review-0b811d3f/reproduction.json` plus
`pr-repair/` logs. DONE requires that evidence; missing capability or failed checks
remain incomplete. Main owns scope; a failed executor follows managed fallback,
and two stopped unsuccessful attempts return the remaining bounded slice to main.
No user-set token/time budget. Bound each child to its packet and tests to isolated
fixtures; use managed job handles for long commands. Only existing role-provider
calls are allowed. Preserve the installed payload before replacement.

Continuity: the previous cycle closed with broad Astra/Sol behavior and current-head
CI passing. Subsequent PR inspection found five uncovered inputs, so its completion
does not close these regressions. No prior success is relabeled as repair evidence.

Threat model: protect caller source/attachments, child configuration, prompt capacity,
and same-session one-use claims. Entrypoint is native spawn hook input. Quoted task
data can contain valid IDs and skill mentions; it must not select dispatch authority.
First producer text/header carries the managed marker; later text and attachments are
data. The native host still owns tool permission and tool-call identity. This repair
does not authenticate arbitrary text or override host controls. Enforcement is the
hook plus dispatch ledger (E3); bypass is a host without active hooks, residual risk
is host delivery, and no universal permission/security guarantee is claimed.

Scope map (all under `plugins/codexclaw`):

- Main: `components/subagent-config/src/spawn-attach-hook.ts`, existing item tests
  and new focused regression tests, generated hook artifact. Keep coupled item
  normalization, all-or-nothing inlining, warning/guard and header extraction together.
- Executor: `components/pabcd-state/src/attest.ts`, `review-round-cli.ts` and their
  tests: use live reviewer role where available; legacy explorer carries
  `CXC-ROLE: reviewer` before `TASK:`. Main does not edit that slice concurrently.
- Main SoT: `agents/README.md` describing the repaired payload contract; this unit's
  numbered evidence. No unrelated guidance or account-catalog edits.

Verifier preflight: the repository test wrapper executed the existing spawn/fallback,
attest and review-round globs: 198 passed, zero failed (`baseline.log`). Those direct
globs observe this unit. Build/gate/inventory commands were executed on the prior
unchanged head and are reused as available commands, then rerun after source changes.
The private hook reproduction confirmed all five failures; it makes no provider calls.

See [implementation and acceptance](010_payload_boundaries.md) for the executable map.
