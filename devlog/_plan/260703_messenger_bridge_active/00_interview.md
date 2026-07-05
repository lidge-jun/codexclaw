# messenger_bridge — Telegram/Discord bridge for codexclaw (cxc serve)

Status: INTERVIEW CLOSED (answers captured 2026-07-03) → P · class C3 overall;
security slice (remote full-permission exec + token/allowlist) is C4

## What the user wants (captured 2026-07-03)

1. **`cxc serve`** — a resident server process that hosts the messenger bridge and
   spawns the Codex agent per incoming message. Needed because Telegram/Discord
   bots require a live process (long polling / gateway socket).
2. **`cxc gui` stays a separate command** — the GUI carries other settings too;
   serve and gui are independent entry points. **`cxc service`** joins the family
   (daemon install, launchd-style) so serve can run persistently.
3. **Stock-codex-friendly**: plain `codex` + cxc state only. No custom harness,
   no app-server dependency — per-message `codex exec` spawn with the default
   model, capture the session/thread id from the first turn, then
   `codex exec resume <id>` for continuity. (User explicitly rejected app-server;
   design rationale in 01_research doc.)
4. **One channel first**: Telegram OR Discord, not both in the first pass.
5. **Connection UX (GUI)**: paste bot token → click Connect → prompt
   "press /start in your chat room" → spinner → handshake detected → pass;
   failure path: re-enter token / close. Familiar, cli-jaw-like UX.
6. **Agents are unlimited, centrally managed**: create as many agents as desired,
   manage them from one place; a chat message routes to an agent and its
   remembered Codex session.
7. **GUI overhaul**: current GUI (single Subagents page) is outdated; needs a
   full dev-skills-driven redesign (dev-uiux-design + dev-frontend discipline).

## Interview answers (2026-07-03, user verbatim → interpretation)

- [x] Q1 Channel — "아니 님아 둘다하고 gui에서 하나만 선택하는거라고":
      implement BOTH Telegram and Discord adapters; the GUI activates exactly
      one channel at a time (single-active-channel toggle).
- [x] Q2 Agent model — "자동 1:1 버그시 sqlite 자동 압축후 지속":
      chat ↔ Codex session auto-binds 1:1 on first message. The binding (and
      bridge state) persists in SQLite. When a session degrades (context
      overflow / resume failure), auto-compact and continue the same logical
      agent rather than dying. INTERPRETATION to confirm in P: "자동 압축" maps
      to codex auto-compact (`-c model_auto_compact_token_limit`) plus a
      fallback re-seed (new thread + summarized history) when resume is
      unrecoverable.
- [x] Q3 Permission mode — "전부 full": all bridge-spawned runs use
      `--dangerously-bypass-approvals-and-sandbox`. Consequence: the chat-id
      allowlist (/start handshake) + token custody become the ONLY security
      boundary → that slice is C4 with dev-security review mandatory.
- [x] Q4 Phase split — "전부 프로덕션 급으로해야되니까 세세하게 나눠서":
      production-grade quality bar, finely split work-phases (one PABCD cycle
      each). GUI overhaul is in scope as its own phases.
- [~] Q5 Serve/GUI topology — not explicitly answered; adopting the recommended
      default: `cxc serve` exposes API + GUI static on one port; `cxc gui`
      remains a separate convenience/dev entry. Flag at P approval.

## Constraints (from repo + prior session evidence)

- codexclaw philosophy: no own agent harness, no external orchestrator server
  (README.md). exec-spawn per message fits; a resident bot process is still
  required and `cxc serve` is that (accepted deviation, scoped to the bridge).
- `codex exec resume <session_id>` shares the `~/.codex` rollout store with
  interactive codex — "rich context" continuity comes free; recall component
  already reads these rollouts.
- Same-thread turns cannot run concurrently → per-chat serialization + busy
  queueing is mandatory (cli-jaw `sequentialize` pattern).
- Chat-side auth: allowlist of chat ids captured at /start handshake; token
  stored in cxc state (never committed).

## Reference implementations

- cli-jaw Telegram: `700_projects/cli-jaw/src/telegram/bot.ts` (grammY,
  per-chat sequentialize, allowlist, typing + status-edit UX, queueing via
  orchestrator gateway).
- cli-jaw codex exec branch: `src/agent/args.ts:224` (new: `exec ... --json`),
  `args.ts:347` (resume: `exec resume <sessionId> ... --json`).
- External bridges: see 01_research doc.
