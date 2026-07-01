# L8 / 080 - Post-Loop UX Hardening + Truth Sweep

Status: DONE · 2026-06-30 · mvp_hard loop L8 · class C2/C3 (post-loop UX/docs truth sweep, minimal runtime UX)

## Goal

L2-L7 closed the explicit PABCD control surface, but several user-facing docs still described
that surface as future work. L8 reconciles the shipped reality and fixes the one remaining
rough UX edge in the Stop-continuation message.

## Scope

1. **Truth sweep after L2-L7**:
   - mark L5-L7 plan docs as DONE;
   - move L8-L12 into the canonical `000_INDEX.md` ledger table;
   - update `README.md` and `structure/INDEX.md` so they no longer understate the shipped
     runtime or describe Stop / `cxc orchestrate` as future.
2. **Stop-continuation next action**:
   - replace the generic `<next>` placeholder with phase-specific commands;
   - use `cxc orchestrate reset` for phase D because D is not a resting state and the CLI
     supports `reset`, not `IDLE`.
3. **Regression coverage**:
   - assert B/C/D Stop messages contain concrete commands and no `<next>` placeholder.

## File Change Map

- NEW `devlog/_plan/mvp_hard/080_L8_post_loop_ux_hardening.md`
- MODIFY `devlog/_plan/mvp_hard/000_INDEX.md`
- MODIFY `devlog/_plan/mvp_hard/050_L5_status_footer_affordances.md`
- MODIFY `devlog/_plan/mvp_hard/060_L6_stop_continuation.md`
- MODIFY `devlog/_plan/mvp_hard/070_L7_goalplan_loop_skills.md`
- MODIFY `README.md`
- MODIFY `structure/INDEX.md`
- MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`
- MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`
- MODIFY `plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`

## Phase Command Map

| Current phase | Stop-continuation next action |
|---------------|-------------------------------|
| I | `cxc orchestrate P --attest '{"from":"I","to":"P","did":"interview complete with recorded requirements"}'` |
| P | `cxc orchestrate A --attest '{"from":"P","to":"A","did":"diff-level plan written with files and acceptance criteria"}'` |
| A | `cxc orchestrate B --attest '{"from":"A","to":"B","did":"independent audit PASS; blockers folded into plan"}'` |
| B | `cxc orchestrate C --attest '{"from":"B","to":"C","did":"implementation completed and verifier reviewed it"}'` |
| C | `cxc orchestrate D --attest '{"from":"C","to":"D","did":"checks passed","checkOutput":"<test tail>","exitCode":0}'` |
| D | `cxc orchestrate reset` after the DONE summary is recorded |

## Audit Verdict

Independent reviewer `Tesla` returned **PASS**. Required constraints were folded into the
build: define the explicit phase-to-command mapping, route D to `cxc orchestrate reset`, add
tests proving no `<next>` placeholder remains, and update stale passive Stop comments.

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts`
  - PASS: 17/17, including `L8: Stop continuation prints concrete next commands, never <next>`.

Full suite/build verification is recorded at the L8 C gate.

## Out of Scope

- No L9 subagent/model spawn-wrapper implementation.
- No L10 memory/chat/project command implementation.
- No L11 docs website build.
- No L12 Interview ledger/PostToolUse runtime.
