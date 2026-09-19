# 030 — wp4: memory pipeline (#187, #185, #190, #188, #189, #191)

Six issues, but not six root causes. #185 and #187 share one missing capability:
extraction health is not observable. #190's remedy substantially covers #191's proposed
read fallback. #188 and #189 are genuinely independent. The order below builds the shared
reader first and lets three issues consume it.

Two facts constrain everything here. Live read-only SQL found **224 stage-1 done, 52
exhausted errors, 1 consolidation done** — the issue's "225 done" mixes job kinds. And at
`78245b47af` the host supports memory V1/V2 dual-write including `memories_v2_1.sqlite`
(`memories/write/src/start.rs:40`, `state/src/sqlite.rs:85`), so a reader that assumes V1
is universal is wrong. It must name the store it read or report unsupported.

## Step 1 — #187: the shared status reader

`recall/src/cli.ts:341` accepts memory `search` only; an unknown verb falls through to
usage and exits 0, which is why the capability looks absent rather than broken.
`bin/codexclaw.mjs:589` already forwards memory verbs to recall, so no new dispatcher is
needed. `cxc-ops/src/doctor.ts:332` checks PABCD health and has no memory check at all.

**NEW** `plugins/codexclaw/components/recall/src/memory-status.ts` — one read-only,
schema-aware collector built on the existing `paths.ts:45` and `sqlite.ts:29`. Returns
per-kind job counts, exhausted and error categories, success and coverage timestamps,
artifact metadata, and gate information that is explicitly either sourced or unknown.

**MODIFY** `plugins/codexclaw/components/recall/src/cli.ts` — add a
`kind === "memory" && sub === "status"` branch before the search branch, supporting
`--json`, `--home` and `--cwd`; update usage text and the `bin` help.

**MODIFY** `plugins/codexclaw/components/cxc-ops/src/doctor.ts` — after
`checks.push(checkPabcdHealth(process.cwd()))`, append the same snapshot's health result
through a fail-soft component boundary.

Do not report every session without a job as "pending". Host eligibility depends on
source, age, idle time, memory mode and current-thread exclusion
(`state/src/runtime/memories.rs:204`); report an eligible backlog only when those inputs
are known.

**Verification.** NEW `recall/test/memory-status.test.ts` and
`cxc-ops/test/doctor-memory.test.ts`. Commands:
`node --test plugins/codexclaw/components/recall/test/memory-status.test.ts plugins/codexclaw/components/recall/test/cli-arg-hygiene.test.ts`
and `node --test plugins/codexclaw/components/cxc-ops/test/doctor-memory.test.ts`.
Cover missing and unsupported schemas, no file creation, mixed job kinds and stable JSON.

## Step 2 — #185: the startup banner consumes it

`recall/src/cli.ts:295` reports only the recall index and `hook.ts:643` displays that.
Host `memories/write/src/start.rs:65` skips both phases under the guard, but the issue's
"no logs or signals anywhere" is false: the host increments `skipped_rate_limit` and
`guard.rs:39` logs the skip. Live SQL shows coverage through 2026-09-16 19:41 KST with
the last stage-1 success at 09-17 09:14 KST. Staleness alone does not identify the cause.

**MODIFY** `recall/src/cli.ts:322` — currently
`handleSessionStart(indexStatusLine(), payload.cwd ?? process.cwd(), payload.source)`;
pass a separately collected pipeline snapshot.

**MODIFY** `recall/src/hook.ts:676` — currently `parts.push(sessionNotice(...))`; append
one bounded warning for stale extraction, exhausted jobs, or an evidenced gate. A healthy
state stays silent. Unavailable quota must read "unknown", and a cwd missing from the
global summary must never render as "no memories".

**Verification.** Extend `recall/test/hook.test.ts`:
`node --test plugins/codexclaw/components/recall/test/hook.test.ts`. Cover healthy
silence, stale warning, missing database, unknown quota and compacted budget.

## Step 3 — #190: distinguish empty from unavailable

Mostly already built. Native `ext/memories/src/prompts.rs:27` has no cwd parameter, but
the plugin already compensates: `recall/src/hook.ts:473` enumerates project sessions,
`cwd-context.ts:89` supports same-origin checkouts, and `hook.ts:669` applies a compacted
budget. A fresh in-memory probe passed five normal entries, two compacted entries, silent
empty scope and empty PostCompact output. What is missing is honest empty-state reporting.

**MODIFY** `recall/src/hook.ts` — keep `buildCwdContext(...): string` compatible, add an
internal structured result distinguishing `hits`, `empty` and `unavailable`, and consume
it in `handleSessionStart`. Replace the undifferentiated `if (sessions.length === 0) return ""`
at `:504` and the swallowed failure at `:558`. Emit "no indexed records for this project"
versus "recall unavailable", never "this project has no history".

Keep `handlePostCompact` empty. Host `hooks/src/schema.rs:176` permits only universal
output there, and recovery belongs to SessionStart source `compact`, queued at
`core/src/session/mod.rs:3072`. Implementing it as the issue proposes would break the
PostCompact envelope.

**Verification.**
`node --test plugins/codexclaw/components/recall/test/hook.test.ts plugins/codexclaw/components/recall/test/cwd-context.test.ts`.

## Step 4 — #188: selective requeue

The 52 exhausted jobs are 35 context-window, 5 capacity, 6 incomplete-response, 5
stream-closed and 1 other. Loss is not permanent: `state/src/runtime/memories.rs:996`
decrements retries uniformly and `:728` resets them when the source watermark advances.
There is no plugin substitution point for host extraction input — `phase1.rs:290` reads
the original rollout directly and `prompts.rs:108` applies model-derived truncation.

**NEW** `plugins/codexclaw/components/recall/src/memory-requeue.ts`;
**MODIFY** `recall/src/cli.ts` with an explicit `memory requeue` branch. Default to a
dry-run selection with bounded filters and an explicit apply. In one transaction, update
only supported-schema `memory_stage1` rows still matching
`status='error' AND retry_remaining=0`: restore a bounded retry allowance and clear
backoff while preserving error evidence, watermarks and outputs. Exclude running, done and
consolidation rows.

Transient recovery is the normal path. A context-window requeue without a changed
extraction condition simply repeats the failure, and the document says so rather than
promising 35 recoveries. Changing host extraction or chunking is separate scope.

**Verification.** NEW `recall/test/memory-requeue.test.ts`:
`node --test plugins/codexclaw/components/recall/test/memory-requeue.test.ts`. Cover
dry-run immutability, selection limits, transaction races, unsupported schema, preserved
watermarks and errors, and transient versus context classification. This mutates native
state, so it is C4: full gates and a durable evidence record.

## Step 5 — #189: parent promotion, in prose

Host `memories/write/src/start.rs:30` excludes child-triggered pipelines and
`phase1.rs:159` restricts candidates to interactive sources. But `phase1.rs:411` retains
`InterAgentCommunication` and assistant messages survive filtering at `:444`, so parent
synthesis is already an available promotion route. An automatic global-note writer would
also conflict with `pabcd-state/src/memory-write-gate.ts:30`, which requires an explicit
request.

**MODIFY** `plugins/codexclaw/skills/pabcd/references/delegation.md:18`

- Before: `Subagents return evidence and unresolved judgments; the main session decides and integrates.`
- After: the same, extended so that after checking evidence main records a short ordinary
  synthesis of accepted results, reusable failure causes and procedures, provenance and
  unresolved claims. Child completion is not verification. Durable memory writes keep
  using the existing gate.

**Verification.** Human review only. Documentation cannot prove future extraction.

## Step 6 — #191: report the route, do not guess it

The mismatch is real: `memories/write/src/guard.rs:16` gates on authentication while
`runtime.rs:256` routes extraction through `config.model_provider`. But the issue's
remedy does not work — `guard.rs:50` rejects `rate_limit_reached_type` before the
threshold arithmetic, so threshold zero is not a bypass. And
`provider-bridge/src/detect.ts:51` observes only running state, `defaultProvider` and
port, which is not evidence of effective extraction routing. The host SessionStart input
carries no effective memory flags (`hooks/src/schema.rs:485`).

Decision: preserve provider-bridge's detect-only contract and report the route as unknown
rather than auto-writing global configuration. Diagnostics and read fallback come from
steps 1 and 3, which is why this issue closes as partially addressed with the remainder
recorded, not silently claimed.

The optional scalar prerequisite, if the explicit-configuration half is kept:
**MODIFY** `config-guard/src/toml-edit.ts:25` (`TomlScalar = boolean` becomes
`boolean | number` with finite-integer validation), `managed-keys.ts:65` (add the 0-100
integer key with `autoEnable:false`), `cli.ts:82` (per-key validation instead of
boolean-only parsing) and `config-set.ts:68`/`:138` (typed scalar instead of
`value ? "true" : "false"`). This enables explicit configuration; it is not a resolution
of #191.

**Verification.**
`node --test plugins/codexclaw/components/config-guard/test/toml-edit.test.ts plugins/codexclaw/components/config-guard/test/config-set.test.ts plugins/codexclaw/components/config-guard/test/deactivate-drift.test.ts plugins/codexclaw/components/provider-bridge/test/detect.test.ts`.

## What this phase must not claim

That all six issues are resolved by the shared status work. #188's effectiveness for
context-window failures is unproven, #189 is guidance, and #191 keeps an open remainder
that needs a host-supported control.
