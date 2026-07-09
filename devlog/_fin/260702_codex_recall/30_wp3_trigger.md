---
created: 2026-07-02
tags: [codexclaw, recall, skill, hook, trigger, plan]
aliases: [recall WP3 trigger plan]
---

# WP3 — trigger integration: make agents actually run recall

cli-jaw's search is only useful because its AGENTS.md § Memory Lookup Scope DIRECTS the
agent: "when a term from prior work is unfamiliar or context seems lost, run these
searches before asking the user." WP3 ports that trigger discipline to codexclaw's two
native surfaces (skills + hooks). Class: C2-C3 (new skill + one hook, no schema risk).

## Deliverables

1. **NEW skill `skills/recall/`** (`cxc-recall`): SKILL.md teaching when to search
   (unfamiliar prior-work terms, post-compact context loss, "그때/지난번/last time"
   recall questions), the two commands with flags, output reading, and escalation
   (chat → memory → ask user). `agents/openai.yaml` with `allow_implicit_invocation:
   false` (on-demand, like every non-dev skill). Catalog row in
   `skill-hub/references/catalog.md` (manifest-policy test enumerates skills).

2. **NEW hook `hooks/user-prompt-submit-suggesting-recall.json`** → recall component
   `src/hook.ts` (compiled `dist/hook.js`): reads the Codex UserPromptSubmit JSON from
   stdin; when the prompt matches past-work recall intent (Korean: 그때/지난번/저번
   세션/예전에 했/기억나/뭐였지; English: last time|session, previously, what did we
   do, remember when) AND does not already contain a `cxc chat|memory search` call,
   emits `hookSpecificOutput.additionalContext` (pabcd-state envelope parity: CRLF
   normalize, trim, 32k cap, empty string = no injection) with a short directive to run
   `cxc chat search` / `cxc memory search` before asking the user. Stateless; FAIL-OPEN
   (any error → empty output). Manifest `hooks` array += the new file;
   `hook-e2e.test.mjs` hook count 13 → 14.

3. **Tests**: hook intent detection table (KO/EN positive/negative, already-contains-
   command suppression, malformed stdin fail-open), envelope shape, and a manifest
   presence check rides the existing build/gate validators.

## Verification (C gate)

Full suite + gate green; live: echo a recall-intent payload into
`node .../recall/dist/cli.js hook user-prompt-submit` and see the directive; a neutral
prompt yields empty output.
