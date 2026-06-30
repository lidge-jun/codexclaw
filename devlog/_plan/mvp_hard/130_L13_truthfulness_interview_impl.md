# L13 / 130 — Truthfulness + Interview Hardening Implementation Loop

Status: P (plan) · 2026-06-30 · implements interview-confirmed D1'/D2'/D3'
Source interview: `../260629_codexclaw_mvp/080.1_interview_contradiction_register.md` (2-round Mind rescan, 0 direction-reversal)

> Three work-phases, each a full PABCD cycle. DONE = shipped + tested only.
> Contradiction re-verification uses adaptive Mind dispatch (1..N, not fixed 5).

## WP1 (D1') — Honest chat-search removal

Premise locked in interview: there is NO native `thread/search` CLI/agent surface to "steer to";
the wrapper was built precisely because it is absent. So removal = retire the wrapper and record
native thread/search as a non-goal. `cxc-search` already owns the native search ladder.

Diff-level changes:
1. `plugins/codexclaw/components/cxc-ops/src/cli.ts` — remove `import ... chat-search.ts` (line ~13),
   remove `case "chat-search"` dispatch (lines ~37-41), remove `parseChatSearchArgs` (lines ~50-58),
   drop `chat-search "<term>"` from the `default` usage string (line ~44).
2. Delete `plugins/codexclaw/components/cxc-ops/src/chat-search.ts`.
3. `plugins/codexclaw/components/cxc-ops/test/cxc-ops.test.ts` — remove the chat-search section
   (the 7 chat-search/parseChatSearchArgs tests + their imports at lines ~8-9, ~127-167).
   ADD a positive test: `main(["chat-search"])` falls to default usage (exit 0) AND the usage string
   does NOT contain `chat-search` (proves the subcommand is gone, since unknown != error here).
4. `bin/codexclaw.mjs` — remove `chat-search` from help (line ~116) and any dispatch hint (lines ~11, ~64, ~90).
5. `plugins/codexclaw/components/cxc-ops/package.json:6` — drop the `chat-search (...)` clause from `description`.
6. `plugins/codexclaw/test/build.test.mjs:36` — add `"cxc-ops"` to `COMPONENTS` so dist idempotence +
   import-rewrite + placeholder checks cover it (catches dangling imports after removal).
7. Docs: rewrite `../mvp_res/204_L20.4_cxc_chat_search_wrapper.md` and the chat-search line in
   `../mvp_res/200_L20_clijaw_command_mapping.md` to "wrapper retired; native thread/search exposes no
   CLI/agent surface = explicit non-goal; repo/log/config lookups route through `cxc-search`." Update
   `structure/INDEX.md` rows and the L10 chat-search line in `100_L10_...md`.

Exit (C): `npm test` green (chat-search tests gone, new absent-test green), `npm run build` idempotent,
`git diff --check` clean, no remaining `chatSearch`/`parseChatSearchArgs` symbol references in code.

## WP2 (D2') — scan-evidence + I→P soft-gate

Root cause (Ontologist): readiness is a state predicate over tracker shape; "a scan ran" is an EVENT with
no schema home. Fix puts durable scan evidence in the interview ledger, not just a hot counter.

Diff-level changes (design, hardened in this WP's own P/A):
1. `interview.ts` — extend `InterviewTracker` with scan-evidence (`scanRounds`, `lastScanRoundId`);
   `isInterviewReady` = existing data-shape AND `scanRounds >= 1` (scan actually ran).
2. `.codexclaw/interviews/<sessionId>.jsonl` — append `scan_started` / `scan_completed` / `rescan_completed`
   events as the durable evidence of record (hot counter is a cache of this).
3. `fsm.ts` I→P — convert hard block to SOFT gate: if high contradictions remain OR no scan ran, return a
   warn+advise-block outcome that the main agent MAY override explicitly.
4. `state.ts` — extend `LedgerEntry` with `actor`/`override`/`scanEvidence` fields so an override is auditable;
   keep the `flags.interview` single-source derive (state.ts:94-96) and add a durable override path that the
   derive respects.
5. goal-mode reconciliation: when Interview is suppressed (`goal-gate.ts` hard-deny of `request_user_input`),
   the soft-gate is NOT applied; document the boundary explicitly and test it.

Exit (C): unit tests assert (a) scan-not-run blocks/ warns, (b) scan-ran + clean allows, (c) override path
logs to ledger with actor/override fields, (d) goal-mode suppressed path bypasses soft-gate. Build idempotent.

## WP3 (D3') — 2-axis status migration

Not a word-swap: `mvp_hard/000_INDEX.md` ledger gets a real second column.

Diff-level changes:
1. Migrate the loop ledger table to `| Ln | decade | scope | decision-state | impl-state |`.
   `decision-state` uses the LOCKED mvp_res legend (FROZEN/PLANNED/ANALYZED/DEFERRED/BLOCKED/DONE);
   `impl-state` is DONE only when shipped+tested.
2. L9/L11/L12 → decision-state DONE, impl-state PLANNED/DEFERRED (runtime not shipped).
   L2-L8/L10 → reflect their true impl-state.
3. Rewrite the "COMPLETE" prose block + `README.md:44` to match the two axes (no aggregate "L2-L11 COMPLETE" lie).
4. `roadmap.html` self-declares "generated from both ledgers" (`:108`), so it canNOT be excluded — either
   correct its mvp_hard rows to show decision vs impl, or regenerate. Decide in WP3's P.
5. Clean the existing drift: `020/030/031/040` docs say `Status: P` while INDEX marks L2-L4 DONE.

Exit (C): all status surfaces (INDEX ledger, COMPLETE prose, README, roadmap.html) mutually consistent;
`git diff --check` clean. (A status-token sync test is a stretch goal, noted by Evaluator.)

## Loop discipline
- Each WP = one full PABCD with `--attest`. Adaptive Mind audit in A.
- Per-phase devlog evidence; `npm test` + `npm run build` + `git diff --check` green before D.
- Atomic conventional commits; no push/reset without explicit approval.
