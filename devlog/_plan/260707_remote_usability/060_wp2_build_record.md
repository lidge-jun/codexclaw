# WP2 Build Record — B/C diff-level record

## B: dispatch

- Worker A "Socrates" (inherited model) — bridge scope:
  components/messenger-bridge/{src,test}. db v9 agent_pairing_codes + CAS
  consume + deleteAgent cascade; POST /api/agents/pairing-link (TG-only,
  sha256-at-rest, getMe per mint); POST /api/agents/test-send (heartbeat
  fresh-API pattern, injectable factory); handleStart string-payload consume
  with window fall-through; webhook parity + unpaired-/start binding-order
  fix; full unit tests incl. guard-header 403s.
- Worker B "Kuhn" (inherited model) — GUI scope: gui/src. api.ts
  mintPairingLink/testSend wrappers; pairing.tsx deep-link-capable adapter +
  shared post-pair test-send action; Agents.tsx mint-based open() for TG in
  BOTH CreateAgentWizard and AgentPairingModal, DC flow unchanged.

Contracts frozen in 050 so both proceed in parallel with disjoint scopes.

## B: landed (diff-level)

Bridge (Socrates): db.ts v9 `agent_pairing_codes` (BEGIN/COMMIT/ROLLBACK like
v6-v8) + createAgentPairingCode (returns epoch-ms expiresAt) +
consumeAgentPairingCode (single-use CAS: consumed_at IS NULL AND expires_at >
now in one UPDATE) + deleteAgent cascade row; agent-routes.ts
POST /api/agents/pairing-link (TG-only, randomBytes(16).base64url,
sha256Hex at rest, getMe per mint, url=t.me/<user>?start=<code>) +
POST /api/agents/test-send (heartbeat-pattern injectable
telegramApiFactory/discordApiFactory, newest allowlist row fallback);
telegram-commands.ts handleStart consumes first token of string args with
window fall-through; telegram-webhook.ts unpaired bare /start no longer
pre-creates a binding; +14 tests (mint shape/hash-at-rest, consume ok,
expired, second-use, wrong-agent, deep-link admit without window long-poll +
webhook trio, bare-/start parity, DC-agent 400, test-send happy/400s, guard
403s). Suite 290 -> 304.

GUI (Kuhn): api.ts mintPairingLink/testSend wrappers; pairing.tsx adapter
open() may return {deepLinkUrl, expiresAt} (TG mints; countdown follows code
TTL; retry mints fresh); shared post-pair "Send test message" action (toast
ok/err); Agents.tsx CreateAgentWizard + AgentPairingModal both mint for TG,
DC window flow unchanged; Channels legacy untouched. Vite 46 modules clean.

## C-gate: fresh reviewer "Dewey" (gpt-5.5-xhigh)

Round 1 FAIL: 1 MAJOR — test-send accepted an arbitrary UNPAIRED explicit
chatId (spam vector; test even locked it in); 2 MINOR — sweep method missing
vs frozen contract; expired-state copy hardcoded the 180s legacy window.
Clean bill on the hard stuff: raw code only in mint response, sha256 at rest,
randomBytes(16), CAS correct, guard coverage, webhook same consume path.

Repairs (main session): isAgentAllowed gate BEFORE target resolution +
chan-nope 400 test (explicit-paired 200 kept, send-call list still asserts
exactly 2 sends); db.sweepExpiredPairingCodes (DELETE consumed OR expired,
returns count) + swept-2-kept-live test; neutral expiry copy.

Round 2 (same reviewer) PASS, findings none. Gates: bridge 305/0, repo
npm run build 100 files OK, npm run gate OK, gui vite build clean.
