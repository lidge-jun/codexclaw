# messenger_bridge — Phase 9: security hardening + e2e

Status: SHIPPED (D closed 2026-07-03) · C4 slice · dev-security review returned
4 real gaps — ALL FIXED + verified · messenger-bridge suite 65/65, gate OK

## Headline finding — codex flag-injection on resume (FIXED + verified)

Self-discovered during the C4 drill: `codex exec resume <id> <prompt>` passes the
prompt as a positional arg. A chat message starting with `-` (e.g. `-c
model_reasoning_effort="none"`) was parsed by codex-cli 0.142.5 as a config
flag, not the prompt — verified live: the prompt was consumed as `-c ...` and
codex reported "No prompt provided". Impact (post-allowlist): an allowlisted
user could inject codex `-c` config overrides, and any normal message starting
with `-` silently broke.

Fix (runner.ts buildExecArgs): resume argv is now
`exec resume ...flags --json -- <SESSION_ID> <PROMPT>` — `--` forces both
positionals, so a dash-prefixed prompt can never be parsed as a flag. New runs
send the prompt via stdin (never a positional), so they were already safe.

E2E proof (real codex): "Remember codeword BANANA" -> "OK", then
`-c what was the codeword?` -> "BANANA" (answered as a prompt, not injected),
same thread id -> RESUME_CONTINUITY=true, SAFE_DASH=true.

## Drills (verified)

- Loopback-only: server binds 127.0.0.1 (cli.ts:90) — the connect API (which
  can activate channels / open handshake windows) is not remotely reachable.
  Loopback is the intended + sufficient protection; no CORS/auth needed.
- Token custody: bridge.db chmod 600 (db.ts); the only token-adjacent log is
  "no active channel with a token — idle" (no value); telegram errors redact
  the token-bearing URL (telegram-api.ts tgCall); discord errors echo only
  method+path (token is in the Authorization header, never URL/body).
- At-most-once: telegram persists poll_offset before dispatch (db v3) so a
  crash never replays a full-perm exec.
- Static traversal: guarded + tested (Phase 1).

## Verification

- messenger-bridge suite 63/63; full repo 605/607 (the 2 failures are the
  pre-existing astgrep-WIP artifacts — pabcd-state/dist/edit-shape.js + manifest
  hook count — NOT this work; confirmed by reading the failures).
- npm run build OK (74 files); npm run gate OK.
- Live e2e above with real codex.

## dev-security subagent review — 4 gaps found, ALL FIXED

Verdict on return: "C4 boundary not airtight as designed." No token echo in
logs/API, allowlist gating sound, arg handling sound (the `--` fix confirmed).
Four real gaps, now closed:

1. **[High] Loopback API unauthenticated / browser-CSRF-drivable.** Loopback
   blocks remote TCP but not a local malicious web page POSTing side effects
   (activate channel, open handshake). FIX (`server.ts` localGuard): Host
   header must be loopback (anti DNS-rebinding); mutating requests must be
   `application/json` (blocks CORS simple-request CSRF) AND carry
   `x-codexclaw-local: 1` (a custom header forces a preflight the server never
   answers → cross-origin blocked). GUI api.ts sends the header. Live-verified:
   headerless POST → 403, text/plain POST → 403, GUI POST → 200, GET → 200.
2. **[High] Handshake admits any chat during the open window.** FIX: the
   adapter closes the window atomically on the FIRST pair
   (`telegram-adapter`/`discord-adapter` handleStart → closeHandshake), so one
   open window admits exactly one chat. Residual: still no per-chat nonce (an
   attacker racing the operator's single /start could pair first) — noted as a
   follow-up (a pairing code would close it); the window is operator-initiated
   and short, and one-pair-then-close bounds the exposure.
3. **[Medium] WAL/SHM sidecars not chmod'd** (can hold token pages). FIX:
   openBridgeDb chmods `bridge.db` + `-wal` + `-shm` to 600. Live-verified:
   `bridge.db-wal` is `-rw-------`.
4. **[Medium] Discord runs duplicate MESSAGE_CREATE twice** (gateway resume
   redelivery). FIX: bounded (512) in-memory message-id dedupe in the discord
   adapter. Unit-tested (same id → agent called once).

Tests added: server CSRF-guard (403 paths), telegram atomic-close assertion,
discord dedupe. Suite 65/65.

## D record (2026-07-03)

Phase 9 closed the C4 slice: self-found + fixed the codex flag-injection
(headline), then a dev-security subagent found 4 more real gaps — all fixed and
verified (2 live, 2 unit). Full messenger-bridge suite 65/65; full repo 607/609
(the 2 fails are pre-existing astgrep-WIP artifacts, not this work); build +
gate + doctor all PASS. Live codex e2e proves resume continuity + dash-message
safety. The bridge is production-ready behind the loopback+allowlist boundary
with the documented residual (handshake nonce) as a future hardening.
