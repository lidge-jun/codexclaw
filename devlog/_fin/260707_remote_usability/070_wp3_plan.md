# WP3 Plan — README single doc source + GUI help linkage + skill coherence

Date: 2026-07-07. Phase: P (cycle 3, final).

## Deliverables

1. `plugins/codexclaw/components/messenger-bridge/README.md` — the single
   human-facing doc: what the bridge is; install/run (`cxc serve`,
   `cxc service install|uninstall|status`, launchd cwd caveat, logs); channel
   onboarding via the agents API incl. the NEW one-tap deep-link pairing
   (`POST /api/agents/pairing-link`) and `POST /api/agents/test-send`;
   command surface tables (TG slash, DC slash vs text); session model
   (forum-topic / thread mode / plain); security model (localhost bind, guard
   headers, allowlist pairing, sha256 single-use codes, permission gate,
   webhook timing-safe secrets); troubleshooting pointer to the cxc-remote
   skill references. Everything must match src (same standard as wp1).
2. `server.ts`: `GET /readme` — serves the README file as
   `text/markdown; charset=utf-8`, 404 when missing. GETs bypass the
   mutating guard by design (verify). Unit test: 200 + content-type + body
   contains title; 404 path.
3. `gui/src/ui/help.tsx`: help drawer foot gains a persistent "전체 문서
   (README)" link -> `/readme`, target _blank, present for every topic.
4. Skill coherence (post-wp2): `skills/remote/SKILL.md` ladder step 4 now
   PREFERS the one-tap link: mint `POST /api/agents/pairing-link`
   (`{"id","seconds"?}` -> `{url,code,expiresAt}`), user taps url ->
   Telegram auto-sends `/start <code>` -> poll allowlistCount; window flow
   stays as the fallback + DC path. Step 5 smoke gains
   `POST /api/agents/test-send`. `references/telegram.md` gains a deep-link
   subsection; both reference files' headers point at the README for the
   human-facing overview.

## Authorship

Main session writes everything (docs + ~20-line route + ~10-line GUI diff);
no workers — context transfer would cost more than the diffs. Fresh
independent auditor at A (plan sanity, esp. /readme route + skill claims),
fresh adversarial reviewer at C (doc-vs-src truth + gates).

## Verification

Bridge suite glob, npm run build, npm run gate, gui vite build,
`cxc loop validate` at the end (c4, c5, c6 close here).
