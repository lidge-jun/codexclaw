# Subagent hook guard — implementation record (260709)

Cycle: I (user chose Full guard) → P (000_plan.md) → A (gpt-5.5 reviewer FAIL →
plan amended with fail-closed e2e pair) → B → C → D. Incident forensics:
`jawcode/.codexclaw/evidence/20260709_*attempt/retry*.md` (child retry loop).

### `components/pabcd-state/src/parse.ts` — subagent payload predicate
- **Changes**: added `isSubagentHookPayload(raw)` — true when stdin JSON carries
  a non-empty string `agent_id` or `agent_type` (codex-rs stamps these for
  thread-spawned subagent turns, `hooks/src/schema.rs:270,537`; parent session
  id is reused per `fbfbfe5fc`, so session_id cannot discriminate). Fail-open:
  malformed/empty stdin → false.
- **Impact**: imported by `cli.ts` only.
- **Verification**: 7 unit tests in `test/parse.test.ts`.

### `components/pabcd-state/src/cli.ts` — choke-point early exit
- **Changes**: in the `hook` path, after `readStdin()` and before the
  fail-closed `pre-tool-use` branch: exit 0 when the payload is
  subagent-sourced and the event is not `subagent-stop`. Covers
  user-prompt-submit, stop, pre-tool-use (budget + interview gates),
  pre-tool-use-lint, post-tool-use, post-tool-use-render-observation,
  post-compact. Root fail-closed semantics unchanged (guard fires only on
  well-formed payloads WITH agent fields; codex-rs natively denies non-root
  `request_user_input`).
- **Impact**: all registered pabcd-state hooks; `SubagentStop` evidence gate
  and `subagent-config` spawn-attach hook deliberately untouched.
- **Verification**: e2e in `plugins/codexclaw/test/hook-e2e.test.mjs` —
  (1) UserPromptSubmit + agent fields + trigger prompt → exit 0, empty stdout,
  no `.codexclaw/sessions/` write; (2) discriminating pair with ACTIVE
  `goals_1.sqlite`: root `request_user_input` → DENY envelope, agent-fields
  payload → silent skip.

### `docs-site/src/content/docs/reference/hooks.md` — behavior note
- **Changes**: documented the subagent turn guard above the hook table.
- **Impact**: docs only.
- **Verification**: n/a (prose).

Gate: `npm run build` (100 files OK) + `npm test` → 977/977 pass (see D attest
for fresh output tail).
