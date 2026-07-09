# WP1 Build Record — B/C diff-level record

## B: files + authorship

- `plugins/codexclaw/skills/remote/SKILL.md` — MAIN session. Front-matter per
  sibling convention (name cxc-remote, EN+KO triggers, last-verified
  2026-07-07, short-description). Body: guard-header contract
  (content-type + x-codexclaw-local, 403 otherwise), 6-step ladder
  (health -> token(human) -> POST /api/agents create-validates ->
  handshake open {id,seconds} with allowlistCount-baseline pairing detection ->
  GET /api/bindings + /status smoke -> troubleshooting router), platform
  reference links, scope guard (GUI wizard alternative, /api/connect/* legacy,
  no bridge-code changes).
- `references/telegram.md`, `references/discord.md`,
  `references/troubleshooting.md` — WORKER Maxwell (inherited model), from
  020 synthesis + direct src verification. (Record updated below on merge.)

## Mid-build self-verification catches (main session, before C)

Diff-level corrections applied to SKILL.md after reading
agent-routes.ts:50-230 and connect-routes.ts:50-130:

1. agents handshake is ID-based: open body `{"id","seconds"}`; status
   `?id=<n>` returns `{open, allowlistCount}` — NO pairedChatId on the agents
   surface (that field is legacy /api/connect only). Ladder step 4 rewritten
   to baseline-snapshot -> open -> poll-for-growth.
2. `POST /api/agents` validates server-side -> merged old steps 3+4 (validate
   + create) into one create-validates step; update {"id","token"}
   re-validates.
3. `/api/connect/validate` STORES the token (setChannelToken + kind-agent
   shim) -> scope guard now names the side effect; skill teaches
   /api/agents/* only.

These same corrections were pushed to Maxwell via send_input before his
first write completed.

## Structural additions (main session, pre-C)

- `skills/remote/agents/openai.yaml` — display_name cxc-remote,
  `allow_implicit_invocation: true` (parity with recall).
- `skills/README.md` — `remote/` entry added to the skill-set list.

## C-gate round 1: reviewer "Mendel" (gpt-5.5-xhigh, fresh) — FAIL

Pre-scan by reviewer: bridge suite 290/0. Verdict FAIL: 5 MAJOR, 1 MINOR,
1 ADVISORY; full checked-surface table (60+ rows) in reviewer output. All
accepted except ADVISORY resolved as a recorded decision:

1. MAJOR smoke order — /api/bindings only shows a binding AFTER the first
   gateway command (pairing only admits the chat: telegram-commands.ts:108
   vs :122/:264; discord-adapter.ts:463 vs :284). FIX: SKILL.md step 5
   rewritten: /status first, THEN bindings.
2. MAJOR DC slash syntax — /mode option is named `value`
   (discord-commands.ts:154-156). FIX: SKILL.md + discord.md now teach
   `/mode value:thread|plain` (text form `!cxc mode ...` unchanged).
3. MAJOR GUI pointer — Channels page uses legacy /api/connect/* (api.ts:263);
   named-agent GUI flow is the Agents page (api.ts:276). FIX: scope guard now
   points at Agents, names Channels as the legacy shim.
4. MAJOR status-shape example claimed allowlistCount:0 literally. FIX: both
   references now say fields are exactly open+allowlistCount, expect
   baseline value, `<baseline>` placeholder in the JSON example.
5. MAJOR Message Content verify chain incomplete. FIX: troubleshooting entry
   now does baseline snapshot -> reopen -> !cxc start -> poll growth ->
   !cxc status.
6. MINOR fixed `random-secret` in webhook examples. FIX: telegram.md +
   troubleshooting.md generate `WEBHOOK_SECRET="$(openssl rand -hex 24)"`,
   with a do-not-paste warning.
7. ADVISORY ASCII — DECISION: Korean trigger phrases and em dashes match the
   shipped sibling convention (search/recall front-matter); exempted for
   parity, no change.

Repairs applied by MAIN session (small surgical diffs); worker Maxwell not
re-dispatched. Re-verification sent to the SAME reviewer (Mendel) with this
synthesis + diff summary per reviewer-reuse doctrine.

## C-gate round 2 (Mendel) — FAIL, 1 BLOCKER + 1 ADVISORY

1. BLOCKER: implicit-visible skill set is CANONICAL — dev/SKILL.md:173 defines
   {dev, search, interview, pabcd, recall, loop} and
   plugins/codexclaw/test/manifest-policy.test.mjs:49 hard-codes it; remote
   with allow_implicit_invocation:true broke the test (implicit set mismatch).
   DECISION: respect the policy, do not expand it — remote becomes on-demand
   like the dev-* routers (openai.yaml -> false; README entry reworded).
   Rationale: on-demand skills still activate by description match, so
   "텔레그램 연결해줘" still routes to cxc-remote; expanding the canonical set
   was also outside the declared wp write scope.
2. ADVISORY: {"open":true,"allowlistCount":<baseline>} examples were invalid
   JSON inside ```json fences -> switched to ```text fences (both refs).
   Verified: node --test plugins/codexclaw/test/manifest-policy.test.mjs ->
   pass 6 / fail 0.

## C-gate round 3 (Mendel) — PASS, findings: none

Reviewer confirmed openai.yaml:6 false, README on-demand wording, text fences,
manifest test 6/0. WP1 deliverables final:

- plugins/codexclaw/skills/remote/SKILL.md (front-matter + 6-step ladder)
- plugins/codexclaw/skills/remote/references/telegram.md (124 lines)
- plugins/codexclaw/skills/remote/references/discord.md (128 lines)
- plugins/codexclaw/skills/remote/references/troubleshooting.md (138+ lines)
- plugins/codexclaw/skills/remote/agents/openai.yaml (implicit false)
- plugins/codexclaw/skills/README.md (remote/ entry)

Evidence for c1: Mendel round-1 checked-surface table (60+ claims, all OK
after repairs), round-3 PASS, manifest-policy 6/0, reviewer pre-scan bridge
suite 290/0.
