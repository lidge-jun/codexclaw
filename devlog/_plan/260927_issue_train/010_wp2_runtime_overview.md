# wp2 — Runtime issue train (#255, #252, #253, #254, #251, #250)

This work phase makes idle Codex sessions passive, provides a PABCD off switch, and narrows continuation and delegation gates to the sessions they govern. Six independent builder branches should land in this order: `011` lazy state, `012` switch, `013` idle release, `014` turn budget, `015` worker gate, `016` trigger narrowing. Rebase each later branch on the just merged predecessor, rerun its targeted tests, then run the complete phase gate. All anchors below refer to branch `codex/issue-train-0927` at `958441a9`; each builder must recheck them after predecessor merges.

## Phase contract

- `011` owns first-write identity and the SessionStart audit. It must land first because every later hook can encounter a missing state file.
- `012` owns the off switch in hook dispatch. The safety guards remain active; see its explicit allowlist.
- `013` makes active but unbound goals release at IDLE without writing counters.
- `014` makes the absolute Stop cap apply to one real user turn. Native Stop continuations do not create new UserPromptSubmit inputs: `/tmp/cxc-perm/codex-src/codex-rs/core/src/session/turn.rs:666-683`, `/tmp/cxc-perm/codex-src/codex-rs/core/src/hook_runtime.rs:682-707`.
- `015` gates registered executor unconditionally and legacy worker only under an armed PABCD cycle.
- `016` leaves explicit command parsing unchanged and eliminates incidental natural-language arming.

## Shared-file merge map

| Path | Planned owners | Conflict resolution |
| --- | --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/hook.ts` | 011, 013, 014, 016 | Preserve 011's missing-state behavior; apply 013 around `handleStop` guard 2a, 014 around `handleUserPromptSubmit` and `bumpStopCounter`, then 016 detector replacements. |
| `plugins/codexclaw/components/pabcd-state/src/cli.ts` | 012, possibly 011 | Keep 012 dispatch guard above the PABCD-only branches while preserving 011's mutating CLI identity checks. |
| `plugins/codexclaw/components/pabcd-state/src/state.ts` | 011, 014 | Keep `ensureState` exclusive-create contract and add 014's `stopBlockTurnId` to `State`, default, and strict reconstruction. |
| `plugins/codexclaw/components/pabcd-state/test/hook*.test.ts` | 011–016 | Merge by named tests; update existing expectations instead of retaining contradictory tests. |

No builder may overwrite another branch's full file. Resolve conflicts in the listed order; run the named tests after each merge. The PABCD hook dispatch is `cli.ts:329-488`; state serialization is `state.ts:486-615`; test globs are in root `package.json:24`.

## Verifier reality check (PLAN-VERIFIER-REAL-01)

These commands were run before the plan was written on this HEAD:

| Command | Exit | Observes |
| --- | ---: | --- |
| `node --test plugins/codexclaw/components/pabcd-state/test/state.test.ts plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts` | 0; 153 pass, 0 fail | Existing state, Stop, and evidence test files directly. It cannot prove any new tests or production behavior. |
| `node plugins/codexclaw/scripts/inventory.mjs --check` | 0; 29 skills, 29 hooks, 9 components | Package inventory, not the behavior or prose in these seven docs (`inventory.mjs:356-365`). |

The builders run `node --test <named touched test files>` after each fix, then `npm run build` to regenerate committed `dist` from changed sources (`package.json:22`), `npm test` for the root suite (`package.json:24`), `npm run gate` for repository gate checks (`package.json:23`), and `node plugins/codexclaw/scripts/inventory.mjs --check --tests <measured total>` using the actual full-suite count (`inventory.mjs:416-421`, `.github/workflows/ci.yml:62`). `npm run build` was deliberately not run during this docs-only delegation because it writes outside the seven authorized files. The builder must inspect the resulting dist diff and update any published test count only from the measured suite, never a guessed increment. Human review must check the policy prose; inventory and the gate do not validate this plan's reasoning.

## Activation and boundary matrix

| Scenario | Expected |
| --- | --- |
| Fresh `SessionStart`, no `.codexclaw` | No directory or state file created (`011`). |
| First verified mutating command | Exclusive state creation; failed native verification leaves no state (`011`). |
| `CODEXCLAW_PABCD=off` or project `pabcd.enabled=false` | PABCD hooks silent; independent safety guards still run (`012`). |
| Active host goal, no bound plan, IDLE Stop | Release without counter write (`013`). |
| Bound goal, IDLE Stop | Existing bounded arming behavior (`013`). |
| 25 Stop continuations in one user turn | Release on the 25th, with one nonblocking message; a later real user turn gets a fresh total (`014`). |
| Plain worker without armed cycle | Release without attempt/tombstone; executor or armed worker uses receipt gate (`015`). |
| Incidental interview/build/verify/persistence wording | No trigger, context, or `loopArmSeen` write; explicit CodexClaw request still works (`016`). |

## Out of scope

No relocation to `CODEXCLAW_HOME`, blanket `.gitignore`, change to explicit `orchestrate` parser grammar, new hook registration, or relaxation of worktree/memory/automation safety gates. No source or test change is made in this planning pass.
