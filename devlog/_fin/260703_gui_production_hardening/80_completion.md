# 80 — Completion record: GUI production hardening (all 7 slices shipped)

- Date: 2026-07-03 · Goal 830da736-3b0 · 7 work-phases, each a full PABCD cycle
  with employee-audited plans (slices 40/50/70 multi-round) and employee-verified
  builds. Suite: 644/644 green.

## DOD → evidence

| # | DOD | Slice | Evidence |
|---|-----|-------|----------|
| 1 | Subagents dropdown works e2e + errors surfaced | 10 | live CDP: checkbox→gpt-5.5 persisted, select→gpt-5.4, revert; commits 27d0c69/06be57e |
| 2 | Wizard shows /start wait + pairing | 20 | render precedence + unpaired-recovery + expiry surfacing; 50128d1 |
| 3 | N named agents, dedicated tokens, concurrent | 40+50 | v4 schema + diff-based multi-adapter controller; live-DB migration rehearsal; 46411cb..1748d66 |
| 4 | Card model/effort/options apply next turn | 60 | fake-codex argv echo asserts -m/-c reach the child; fresh-row read per turn; 0face11/8a3caae |
| 5 | ocx models in catalog | 30 | throwaway serve: ocx-active, 11 entries incl. anthropic/*; dd5a89b |
| 6 | Per-agent heartbeat | 70 | fail-closed scheduler + HEARTBEAT_OK silence; 5/5 suite; 0f457df |

## User action required (the one thing code cannot do)

The LIVE `cxc serve` (user's terminal, port 7717) still runs the pre-hardening
dist. On the next restart it will: migrate the real bridge.db to v4 (rehearsed on
a .backup copy — telegram-1 seeded with the existing token/pairing/session), start
one adapter per enabled agent, serve the new GUI pages, and begin heartbeats for
any agent configured on its card.

## Residual limitations (documented, deliberate)

- Full Telegram pairing e2e needs a second account — state machine covered by
  unit tests + live server semantics verified.
- Discord mention gate falls back to respond-all (with a one-time log) if READY
  lacks the bot user id.
- Heartbeat lastRun is in-memory: a restart grants one fresh interval.
- v3-dist-on-v4-file downgrade window: legacy rows stay unique (partial index);
  agent rows for the same chat may be picked arbitrarily by old SELECTs.
