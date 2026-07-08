# WP3 Audit Synthesis — auditor "Bernoulli" (gpt-5.5-xhigh) — PASS with 4 corrections

All accepted, folded into the build:

1. `/readme` must branch on exact `pathname === "/readme"` AFTER /api/
   handling and BEFORE serveStatic (server.ts:303/328 — SPA fallback would
   otherwise swallow it). GET/HEAD only, fixed path, no pathname-derived
   file access.
2. README path resolution: `resolve(dirname(fileURLToPath(import.meta.url)),
   "..", "README.md")` works from src/ and dist/; make it injectable for the
   404 test (a fixed path becomes untestable once README exists).
3. Docs/skill must state test-send rules: explicit chatId is PAIRED-ONLY
   (agent-routes.ts:281), omitted chatId targets the newest allowlist row and
   400s when none; success `{ok:true, chatId}`.
4. Response shapes include `ok:true` — pairing-link returns
   `{ok, url, code, expiresAt}` (agent-routes.ts:261).

Confirmed clean: GETs bypass the mutating guard (MUTATING excludes GET,
server.ts:190); help drawer flex-column takes a persistent footer
(help.tsx:192, styles.css:469); skill step 4/5 accepts the deep-link
preference without contradicting DC/window fallback (SKILL.md:44).
