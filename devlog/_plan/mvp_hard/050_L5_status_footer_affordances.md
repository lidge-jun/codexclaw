# L5 / 050 — Phase Footer Directive + status/D Affordances + Ledger Audit

Status: P (plan) · 2026-06-30 · mvp_hard loop L5 · class C3 (UX/contract, no new persistence)

> Much of L5's original gap list already landed in L3b/L4: `status`/`reset` chat +
> CLI affordances exist, and ledger-on-transition fires on both paths. The remaining
> NET-NEW L5 work is the user-visible PABCD state surface the user explicitly asked
> for: codex has no status UI, so the model must print the phase at the end of each
> reply, driven by a hook-injected footer directive.

## Goal (L5)

1. **Phase footer directive** — a one-line directive appended to every injected phase
   directive AND every stage-header injection, instructing the model to end its reply
   with `IPABCD: <phase> (<LABEL>)`. Resting states are `IDLE` and the work phases
   `I/P/A/B/C`; `D` is the closing transition, shown only on the turn the cycle closes,
   never as a persistent resting badge (the next resting state is `IDLE`).
2. **`status` affordance polish** — the chat `orchestrate status` path currently
   returns just `buildStageHeader`. Return a one-line human status: phase + label +
   gate-flag summary (so a user typing `orchestrate status` sees the real state).
3. **`D` close affordance** — make `orchestrate d` (chat human free-pass) and the loose
   path render the DONE summary directive AND immediately reflect that the resting
   state becomes IDLE in the footer (footer shows `IDLE` once D closes).
4. **Ledger audit** — confirm/test ledger entries carry `from/to/reason/ts` on every
   transition path (chat `reason:"chat"`, CLI `reason:"cli"`, reset `reason:"reset"`);
   no net-new code expected, just a coverage assertion that the audit trail is complete.

## Reference (verified)

- `buildStageHeader` + `STAGE_LABELS` (footer reuses the label map)
  ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:125)).
- `phaseDirective`/`interviewDirective` (footer appends to these)
  ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts:102)).
- chat status currently returns bare stage header
  ([hook.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/hook.ts) handleOrchestrateCommand status branch).
- CLI status renderer (parity for the wording)
  ([orchestrate-cli.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts)).

## File change map (IN scope)

1. MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`
   - NEW `export function phaseFooter(phase: Phase): string` →
     `"At the end of your reply, print one line: IPABCD: <phase> (<LABEL>). After D closes the cycle, show IDLE."`
     (D maps to its label but the directive tells the model the resting state is IDLE.)
   - NEW `export function withFooter(directive: string, phase: Phase): string` that
     appends the footer to a directive (single blank line between).
   - Apply `withFooter(...)` where directives/stage-headers are injected: the parser
     wire (`handleOrchestrateCommand`), mode-1 explicit trigger, mode-2 phase-change,
     and mode-3 stage-header. Keep the footer SHORT (it is injected every turn).
   - status branch: return a one-line status string (phase + label + flags) instead
     of the bare stage header.
2. MODIFY tests:
   - `test/hook.test.ts`: footer present in an injected directive; footer names the
     current phase; after `orchestrate d` the footer/status reflects the DONE→IDLE
     close; status returns the richer line.
   - `test/orchestrate-apply.test.ts` or a small new test: ledger completeness — every
     transition path yields an entry with from/to/reason/ts.

## Scope boundary

- IN: footer directive + status polish + ledger coverage assertions in hook/apply.
- OUT: Stop-continuation loop (L6); goalplan/loop skills (L7). No new state fields, no
  schema change. The footer is a PROMPT directive (codex has no render hook), so this
  is the honest mechanism — not a fake UI badge.

## Accept criteria (testable)

- An injected phase directive (e.g. for P) contains both the PLAN directive body and a
  footer line mentioning `IPABCD: P`.
- `orchestrate status` (chat) returns a one-line status naming the phase + flags.
- After `orchestrate d` closes a cycle, the next resting representation is `IDLE`
  (footer/status does not show `D` as a persistent state).
- Ledger entries on chat/cli/reset paths all carry `from`,`to`,`reason`,`ts`.
- `npm test` green at 270+; `npm run build` idempotent.

## Risk / rollback

- Risk: footer injected every turn bloats context. Mitigation: keep it to ONE short
  line; it rides the existing stage-header/dedup path so it is not double-injected.
- Risk: model ignores the footer (it's a directive, not enforced). Accepted: codex has
  no output-rewriting hook; a directive is the only honest mechanism (documented).
- Rollback: drop `withFooter` application + revert status branch; pure additive.

## Audit focus (for A gate)

- Does appending the footer to mode-3 stage-header (injected EVERY turn) risk noise or
  break the `hasStageMarkerForPhase` dedup that keys on the stage marker text?
- Is the D→IDLE footer wording unambiguous so the model does not show `D` as resting?
- Does the richer status string stay parseable / not break existing status tests?

## Audit verdict (A gate — independent reviewer, 2026-06-30)

Verdict: **PLAN OK with fixes**. Confirmed LOW: dedup is safe (footer is appended, so
`hasStageMarkerForPhase`'s `tail.includes("[codexclaw — <phase>: <LABEL>]")` still
matches) and one-line footer bloat is acceptable. Folded into the build scope:

1. **HIGH — D must actually close to IDLE (not persist as phase "D")**: chat
   `orchestrate d` currently writes `phase:"D"` and stays there. The user's rule is
   "D is the closing transition; resting state is IDLE". Implementation: when the
   human applies the `D` verb (entering D from C) the apply path advances C->D AND then
   closes D->IDLE in the SAME action — i.e. `applyHumanTransition(.., "D")` returns the
   cleared-IDLE state (flags reset, orchestrationActive false) and a ledger entry, and
   the hook injects the DONE summary directive on that turn while the resting state is
   IDLE. (Mirror the fsm D->IDLE close path; do NOT leave a dangling D.) The footer on
   that turn shows the DONE directive but the persisted/resting phase is IDLE.
   - Test: chat `orchestrate d` from C leaves persisted `phase:"IDLE"` with flags
     cleared; a ledger entry records the close.
   - Note: the CLI `orchestrate d` (agent-gated) still advances C->D via `transition()`
     and a SEPARATE `orchestrate reset`/next-P closes it — keep CLI semantics as-is
     (gated), only the chat human-D auto-closes. Document this asymmetry.
2. **MEDIUM — update ALL exact-match `additionalContext` tests** to expect
   `withFooter(...)`, not raw `phaseDirective()`/`buildStageHeader()`:
   `hook.test.ts:106,196,217,235,300` AND `hook-continuation.test.ts:88,101` (the plan
   missed the continuation file). The status-branch test (hook.test.ts:270) only checks
   nonempty/no-ledger, so the richer status string is safe there.
3. **MEDIUM — ledger completeness coverage** for chat (`reason:"chat"`), CLI
   (`reason:"cli"`), reset (`reason:"reset"`), and the new D-close entry: assert each
   carries `ts`,`from`,`to`,`reason`.

### D-close decision (resolved)

Chat human `orchestrate d` = "I'm done, close the cycle" → C->D->IDLE atomic close.
Agent CLI `orchestrate d` = gated advance to D only (the agent then resets/re-plans);
this preserves the gated evidence contract. The footer/status NEVER shows `D` as a
resting badge — after a chat D the resting phase is IDLE.
