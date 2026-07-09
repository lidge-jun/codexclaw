# WP3 Build Record — B/C diff-level record

## B: landed (main session, no workers — per 070 Authorship)

- `components/messenger-bridge/README.md` (NEW, ~120 lines): overview, quick
  start (serve/service + launchd cwd caveat + logs), agents-API onboarding
  incl. one-tap pairing-link + window fallback + DC invite URL, test-send
  smoke (paired-only chatId rule), command surface, sessions, security model,
  troubleshooting pointer to skill references.
- `src/server.ts`: BridgeServerOptions.readmePath (test override) +
  defaultReadmePath() (import.meta.url/../README.md — valid from src/ and
  dist/); exact-match GET|HEAD /readme branch AFTER /api/ and webhook
  handling, BEFORE serveStatic (SPA fallback would swallow it), fixed path,
  no pathname-derived file access, text/markdown; 404 when missing.
- `test/server.test.ts`: startHarness gains readmePath param; +2 tests
  (200 + content-type + body; 404 missing). Suite 305 -> 307.
- `gui/src/ui/help.tsx` + `styles.css`: persistent drawer footer link
  "전체 문서 (README)" -> /readme (target _blank, icon `external` — no book
  icon exists in icons.tsx), .help-drawer-foot/.help-drawer-doc-link styles.
- `skills/remote/SKILL.md`: step 4 rewritten — TG preferred one-tap
  pairing-link ({id,seconds} default 600 cap 3600, response
  {ok,url,code,expiresAt}, single-use sha256 TTL, no window needed) with
  window fallback as the only DC path; step 5 gains test-send with the
  paired-only rule; platform-references section points at /readme.
- `skills/remote/references/telegram.md`: deep-link mint subsection in
  Enable-And-Pair + API smoke-test via test-send; README pointer line.
- `references/discord.md` + `references/troubleshooting.md`: README pointer
  lines.

## C-gate: fresh reviewer "Nash" (gpt-5.5-xhigh)

Round 1 FAIL, 2 HIGH doc-accuracy findings (both accepted, README-only
repairs):

1. DC slash parity overstated — shared verbs are TG-slash + DC `!cxc` TEXT;
   only the registered subset exists as DC slash (discord-commands.ts:41 vs
   discord-adapter.ts:58). FIX: split bullet + slash-only list + example
   split.
2. Security exception missed DC `!cxc start` (handled before the allowlist
   gate, discord-adapter.ts:386/390/468). FIX: exception now names TG /start,
   TG /id, DC !cxc start.

Round 2 (same reviewer) PASS, no remaining findings.

## Gates (Nash-run + main re-run)

bridge suite 307/307 fail 0; gui vite 46 modules clean; repo npm run build
100 files OK; npm run gate OK.
