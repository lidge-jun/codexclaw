---
created: 2026-07-02
tags: [codexclaw, recall, agent-adoption, dev-skill, hooks, plan]
aliases: [recall WP6 agent adoption plan]
---

# WP6 — agent-side adoption: recall is for agents, not users

Owner directive (2026-07-02): the recall surface must be USED BY AGENTS automatically —
a CLI a human occasionally types is not the product. cli-jaw achieves this with an
always-loaded AGENTS.md § Memory Lookup Scope; codexclaw's equivalents are the
always-on `dev` skill, hook context injection, and spawn-time skill attachment.

Class: C2 (convention-following edits across known surfaces). Deliverables:

1. **`dev` SKILL.md § Recall Lookup Scope** (the big lever): `dev` is implicit for the
   main agent AND the baseline skill attached to every subagent role
   (`ROLE_BASE_SKILLS`: explorer/reviewer/executor). A MUST-level rule: before asking
   the user about prior work — unfamiliar term, lost context, "그때/지난번/last time"
   references — run `cxc chat search "<terms>" --days 0` / `cxc memory search
   "<topic>"`; details in `$cxc-recall`. Mirrors the cli-jaw AGENTS.md directive that
   makes agents actually search.

2. **SessionStart hook** (`session-start-advertising-recall.json` → recall
   `dist/cli.js hook session-start`): inject a 2-line availability note with live
   read-only index status (files count, last ingest) so every session starts knowing
   recall exists. Fail-open "" on any error; no ingest in the hook path.

3. **PostCompact hook** (`post-compact-suggesting-recall.json` → recall
   `dist/cli.js hook post-compact`): compaction IS the context-loss moment — inject a
   directive to recover specifics via recall search instead of asking the user to
   re-explain.

4. **Spawn-time attachment**: add `recall` to `SURFACE_SKILL` in subagent-config so a
   spawn message mentioning recall/past-session work attaches the `$cxc-recall` skill
   to the subagent (same narrow keyword inference as other surfaces).

5. Bookkeeping: manifest hooks 14 → 16, `hook-e2e.test.mjs` count, INDEX.md hook table,
   tests for the two new hook events + surface attachment.

## Landed (same day)

All five deliverables shipped and live-verified:

- `dev` SKILL.md gained **§ Recall Lookup Scope (DEV-RECALL-01, MUST)** — reaches the
  main agent (implicit) and every subagent (dev is the ROLE_BASE_SKILLS baseline for
  explorer/reviewer/executor).
- SessionStart hook injects availability + live read-only index status (observed:
  "Index: 1781 files / 357066 messages, last ingest …").
- PostCompact hook injects the recovery directive at the context-loss moment.
- `SURFACE_SKILL` gained `recall: "recall"` — spawn messages mentioning recall attach
  `$cxc-recall` to the subagent.
- Gates: 530/530 tests + gate.mjs OK; manifest = 16 hooks. The global `cxc` binary is
  an npm-link symlink to this working tree, so agent shells resolve the new commands
  immediately.

Agent-side loop now: session starts knowing recall exists → dev discipline mandates
search-before-asking → user recall idioms trigger a prompt-time nudge → compaction
triggers a recovery nudge → subagents inherit the same rule via baseline `dev` and
surface attachment.
