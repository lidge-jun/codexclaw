# Implementation Audit Synthesis — parallel1 batch (wp1, wp2, wp8)

Date: 2026-07-07. Phase: A (audit gate), HOTL goal loop, session
`019f397d-9ad5-75b1-adeb-ab8734bb6c71`.
Reviewer: independent gpt-5.5-xhigh explorer ("Fermat"). Verdict: **FAIL** (4 blockers,
4 advisories) -> plan amended (diff-specs.md AMENDMENT A1) -> re-verdict requested.

## Per-blocker RCA + decision (REVIEW-SYNTHESIS-01)

### B1 — WP1 spec assumed greenfield; adapter is not greenfield
RCA: diff-specs WP1 was written from the research gap matrix, not from a live-tree
read. `telegram-adapter.ts` ALREADY ships: callback_query ack branch (~:134-176),
`setMyCommands` call, inline `/start /delete /status /reset /cwd /model /help`
(~:281-343, :487-500) with `pendingDeletes` two-step confirm TTL.
ACCEPT. Decision: WP1 = merge-and-extend. Diff deltas:
- `src/telegram-commands.ts`: EXTRACT inline handlers -> `CommandDef[]`
  (behavior-preserving; side effects identical), ADD `/new /stop /retry /effort`.
- adapter callback branch: REPLACE ack-only with `handleCallback()` router
  (must still `answerCallbackQuery` on every path).
- adapter `setMyCommands`: REPLACE with `registerTelegramCommands(api)` from
  `buildCommandDefs()` (registration list stays in sync with dispatch table).
- Existing 556-line adapter test file must keep passing; test moves allowed,
  coverage weakening not allowed.

### B2 — /api/metrics + /api/events are dead stubs
RCA: routes exist (`server.ts:94-113`) but `BridgeController` (built at `cli.ts:67-80`)
never implements optional `metricsSnapshot`/`recentEvents`; `metrics.ts`/`event-log.ts`
are standalone. ACCEPT. Decision: wp8 wires `MetricsRegistry` + `EventLog` instances
into `bridge-controller.ts`, implements both methods, records lifecycle/message/turn/
error events at controller level only. Deep adapter instrumentation deferred to WP5
(cross-blocker conflict resolution: avoids wp8/wp5 double-writing adapter files).

### B3 — agentStatuses exists but not in the server contract
RCA: `BridgeController.agentStatuses()` exists (`bridge-controller.ts:99-107`);
`BridgeControllerLike` (`server.ts:27-37`) doesn't expose it. ACCEPT. Decision:
extend contract with optional `agentStatuses?()` + `GET /api/agents/statuses` route.

### B4 — Sessions page data contract underspecified
RCA: GUI `BindingRow` (api.ts:121-128) omits `agent_id/workdir/model` present in
`db.ts:38-49`; job history endpoint already exists as `GET /api/bindings/jobs`
(`connect-routes.ts:168-174`). ACCEPT. Decision: extend GUI type; reuse jobs endpoint
via `getBindingJobs(id)`; db.ts gains ONLY `resetBindingSession(id)` +
`setBindingWorkdir(id, cwd)` — model/effort columns reserved for wp3 (conflict guard).

## Advisories folded in
- A6: wp2 applicationId from READY `application.id`, fallback `getMe()`.
- A7: `activity` + `database` glyphs added to `gui/src/ui/icons.tsx` IconName;
  reuse `Card/Button/StatusDot/Modal` from `ui/kit.tsx`.
- A8 confirmed: write sets disjoint; test infra = injected `fetchImpl`/`WsFactory`;
  `node --test 'test/*.test.ts'` auto-discovers new files (bare `node --test` HANGS
  on recursive discovery — always pass the glob).

## Batch decision (P-level amendment)
One PABCD cycle covers one executionOrder batch (parallel1 = wp1+wp2+wp8, 3 parallel
gpt-5.5-xhigh workers, disjoint write sets). Baseline before B: 151 pass / 0 fail (5.4s).
