# 20 — cxc-qa modularization: per-surface references

Status: P-phase plan (round 3)
Owner steering (2026-07-07): "다른 dev 스킬들은 모듈화 많잖아, qa는 필요없는거야?"
— round 2 extracted only visual depth; HTTP-API and CLI/TUI rows stayed
one-liners. Complete the modularization to the dev-* router pattern.

## Gap read

qa/SKILL.md §2 gives HTTP/CLI one table row each; TUI mechanics live half in
§2, half in visual-qa.md. Real depth exists and is currently unwritten:
API QA needs auth/contract/idempotency/error-shape scenarios (dev-backend
§envelope, dev-testing backend-testing.md are neighbors, not owners of the
DRIVE-the-surface procedure); CLI/TUI QA needs exit-code/stderr/signal/env
discipline and tmux session mechanics beyond one capture command.

## Diff-level plan (C2 docs-only)

1. NEW `qa/references/http-api-qa.md` (~90L): faithful-channel rules
   (`curl -i` capture discipline, never trust client SDK output for wire
   claims); scenario axes — auth states (anon/authed/expired/wrong-scope),
   contract shape vs dev-backend envelope (error.code not error.message),
   idempotency/repeat (POST double-submit, retry-after), boundary payloads
   (empty body, oversized, wrong content-type), status-code truth table
   capture; artifact naming under the §3 contract; adversarial mapping to
   SKILL §4 classes; teardown (started server PIDs/ports).
2. NEW `qa/references/cli-tui-qa.md` (~90L): CLI — exit code + stdout/stderr
   SEPARATION capture (2>&1 loses the distinction; capture both split and
   merged when the claim needs it), env/locale matrix (LANG, NO_COLOR, TERM),
   signal behavior (Ctrl-C cleanup), non-TTY vs TTY mode (pipe vs terminal);
   TUI — tmux session lifecycle (new-session -d, fixed -x/-y dims, send-keys,
   capture-pane -p/-e, kill-session receipt), width/wide-char gates (moved
   POINTER from visual-qa.md TUI addendum: harness table VHS/teatest stays
   there as visual-artifact concern, mechanics live here); interaction
   scripting rules (wait-for patterns, never sleep-and-hope).
3. `qa/SKILL.md`: Modular References table gains 2 rows; §2 HTTP/CLI/TUI rows
   point to the references; §4 gains one line mapping surface->reference for
   class details. Body stays <170L.
4. `visual-qa.md` TUI addendum: keep harness guidance, add pointer that
   session mechanics moved to cli-tui-qa.md (no duplication).
5. Devlog: this doc.

OUT: no hooks, no new rule-id explosion (2 new ids max: QA-HTTP-01,
QA-CLI-01 as section anchors), no dev-backend/dev-testing edits, no vendored
tools.

## Accept criteria

- Both references exist <100L each, E7-labeled, single-owner clean
  (wire-driving procedure here; test strategy stays dev-testing; envelope
  definition stays dev-backend — pointers only).
- SKILL.md table lists 3 references; §2 rows point; body <170L.
- rg gate: QA-HTTP-01 / QA-CLI-01 anchors present; no duplicated envelope or
  harness content (spot rg for "response envelope" in qa/ shows pointer only).
- npm test green.
