# 260707 fork-FSM collision — /fork steals another session's PABCD state

Status: A-audited plan (2 blockers folded)
Work class: C3 (state-integrity bug; CLI + hook + docs)
Session: 019f352b-5a13-7c51-a970-29dd4f6cb971

## Observed

2026-07-06T19:44:53Z ledger: our in-flight cycle was force-`reset` (B -> IDLE)
and re-entered P with a foreign attest ("dev-debugging modularization...") we
never issued. A concurrently /fork-ed Codex session grabbed OUR FSM.

## Root cause (codex-rs evidence, snapshot 121_openai-codex)

1. **A forked session is a NEW session id**: `core/src/session/session.rs:521`
   — `InitialHistory::Forked(_) => ThreadId::default()` (fresh id; only
   `Resumed` keeps the old id).
2. **Fork is INVISIBLE to hooks**: `session.rs:1222-1226` maps
   `Forked(_) -> SessionStartSource::Startup`; the SessionStart hook input
   `source` enum is only `startup|resume|clear|compact`
   (`hooks/src/schema.rs:787`) and carries no `forked_from` field. A plugin
   hook CANNOT distinguish fork from fresh startup. (`thread_manager.rs:590`
   keeps `forked_from_thread_id` internally but never exports it to hook
   stdin.)
3. **The hole is OUR CLI fallback, not the hooks**: hook-driven writes key on
   the hook payload's `session_id` (fork = new id = new file; safe). But
   `orchestrate-cli.ts:86-90` resolves a missing `--session` to the
   **most-recently-modified** `.codexclaw/sessions/*.json`. The forked
   session's agent ran `cxc orchestrate reset` / `P` WITHOUT `--session`;
   most-recent = our file -> foreign reset + foreign P into our FSM. G2 only
   guards *unknown explicit* ids, not the implicit fallback.

So: fork doesn't "share" the FSM; the CLI's implicit most-recent pick lets ANY
concurrent session (forked or just parallel) mutate whichever session file is
newest. /fork makes it likely because the forked transcript contains our
orchestrate context, so its agent naturally runs orchestrate commands.

## Can a hook fix it?

- **Fork DETECTION via hook: NO** (evidence #2 — native gap; worth an upstream
  issue asking for `source: "fork"` or `forked_from` in SessionStart input).
- **Hook MITIGATION: YES — session-id binding injection.** The SessionStart
  hook DOES receive the (new) `session_id`. Extend the existing cxc-ops
  SessionStart affordance to inject one line: "codexclaw session id:
  `<id>` — every `cxc orchestrate` mutating command MUST pass
  `--session <id>`". The agent then targets its own FSM; a fork gets its own
  id injected at ITS SessionStart. Append-only context, no deny — consistent
  with the no-new-guards owner rule.

## Diff-level plan

1. **E2 CLI hardening** — `components/pabcd-state/src/orchestrate-cli.ts`:
   mutating verbs (`I P A B C D reset`) REFUSE the implicit most-recent
   fallback; they require explicit `--session <id>` (or the reserved `cli`
   key). Read-only `status` keeps the fallback. Error message names the fix.
   This closes the cross-session write hole for forks AND plain parallel
   sessions.
2. **Hook mitigation** — `components/cxc-ops/src/map-affordance.ts`
   SessionStart envelope gains the session-id binding line (session_id is
   already on stdin payload; currently only `cwd` is read).
3. **Stop-hook command sync (audit blocker 2)** —
   `components/pabcd-state/src/hook.ts` STOP_NEXT_COMMAND strings (~:536-541)
   currently emit bare `cxc orchestrate <verb>`; add `--session <id>` (the
   hook knows the payload session id — template it in when building the
   block reason) so the continuation never instructs a failing command.
4. **Skill-doc sync (audit blocker 1)** — bare mutating commands taught in
   `skills/dev/SKILL.md:109`, `skills/pabcd/SKILL.md:25,40,102,105`,
   `skills/loop/SKILL.md:18,33,150` gain `--session <id>` in their command
   examples (or an explicit "--session required for mutating verbs" note
   where inline).
5. **Tests** — orchestrate-cli: mutating verb without --session -> error
   (both empty dir and populated dir); status without --session still
   resolves. map-affordance: envelope contains the binding line with the
   payload session id. hook.ts: stop block reason carries --session.
6. **Docs** — structure/60 native-gap row (fork invisible to SessionStart;
   citation path corrected to `hooks/src/schema.rs:786-788`);
   orchestrate skill + INDEX hook table sentence; this devlog.
7. **Upstream note** — one-line TODO in the devlog for a codex-rs issue
   requesting fork visibility in SessionStart input.

## Known limitation (named per audit)

A forked session that SAW our session id in its transcript can still pass
`--session <our-id>` explicitly. Accepted residual risk for this patch:
state files carry no owner/provenance to verify against, and adding one is a
separate design (fork provenance is invisible to hooks — the native gap).
The fix removes the ACCIDENTAL collision path; deliberate cross-session
targeting remains possible and visible in the ledger (`reason:"cli"` rows).

### Hardening round (2026-07-06 20:17 forensics)

The limitation went live within minutes: a 5th foreign mutation arrived at
20:17:09 (P entry, "JS/TS ecosystem debugging refs") carrying OUR session id
through the post-G3 dist — the forked session replayed `--session <parent-id>`
from its transcript, exactly the predicted shape. E2 cannot close this without
owner provenance (separate design); shipped E7+context hardening instead:

- SessionStart binding line now carries the IDENTITY RULE: "this line is the
  ONLY source of your session id; a different id in your transcript belongs to
  ANOTHER session."
- `cxc-pabcd` Control surfaces gains SESSION-IDENTITY-01 (STRICT): only the id
  from your own SessionStart line may be passed to mutating verbs; loop SKILL
  points to it.
- Sibling-CLI sweep (corrected by audit round 2): divergence/metric CLIs
  hard-require `--session` — no implicit-fallback hole. BUT two explicit-id
  write surfaces share the residual risk: `goalplan init --session <id>`
  writes `state.slug` into ANY passed id (goalplan-cli.ts:120-123), and the
  Stop hook keys enrichment + D-close goalplan advance on that slug
  (hook.ts:607-620, 496-520) — a fork replaying the parent's id can corrupt
  the parent's goalplan binding. `freeze` (non-dry-run) writes a
  project-global `.codexclaw/interview/freeze.json` manifest under a
  `default` session key (freeze-cli.ts:54-57, 93-95). Both are covered by
  SESSION-IDENTITY-01 (E7) rather than an E2 gate; E2 closure for all of
  these needs owner provenance in state files (same separate design).

## Audit synthesis (REVIEW-SYNTHESIS-01)

Reviewer FAIL, 2 blockers, both ACCEPTED: (1) skill docs teach bare mutating
commands that would error post-fix — doc sync added as step 4; (2) the live
Stop hook's STOP_NEXT_COMMAND strings would instruct failing commands —
hook.ts sync added as step 3 (this was the highest-risk miss: HOTL loops
would break on the hook's own advice). Minors adopted: chat free-pass
confirmed safe (hook.ts:447 keys on payload.session_id, never
resolveSession); SessionStart session_id confirmed in schema
(hooks/src/schema.rs:485-508); codex-rs citation path corrected; residual
explicit-id risk named above.

## Accept criteria

- `cxc orchestrate P` (no --session) in a dir with existing sessions ->
  refuses, names `--session`; with `--session <valid>` -> works.
- SessionStart e2e emits the binding line with the real session id.
- Full suite green; existing G2/free-pass semantics unchanged (hook writes
  still keyed by hook session_id).
- Ledger forensics documented (this doc) so the foreign P in our session is
  explained.
