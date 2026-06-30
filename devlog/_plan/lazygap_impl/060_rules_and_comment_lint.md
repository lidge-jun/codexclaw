# 060 — Rule Injector + Comment-Lint (runtime impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 060 · class C3 (hook/runtime)

> Source gap: `../lazygap/004` (project rules + edit-time checks). A-gate (Banach, gpt-5.4)
> verified vs codex-rs + shipped code and returned SAFE-TO-WRITE with a key surface correction
> folded below: comment-lint's TRUE-prevention form is **PreToolUse on `apply_patch`**, not
> PostToolUse (which is post-hoc and cannot un-write). Both pieces are daemon-free and fail-open.

## Why

codexclaw's coding discipline lives entirely in `dev/SKILL.md` prose (E7). omo loads project
rules at runtime and lints edits (`../lazygap/004`). 060 adds two small, in-philosophy surfaces:
a rule-injector that surfaces project rules as context, and a comment-lint that actually blocks a
forbidden pattern in a structured edit before it lands.

## Ground Truth (read before edit — codex-rs + shipped baseline)

- Multiple hooks per event all fire: the dispatcher selects ALL matching handlers, not
  first-match (`dispatcher.rs:36-67`, exec `:89-116`; PostToolUse aggregates `post_tool_use.rs:77`).
  So a new edit-scoped hook coexists with the shipped `^request_user_input$` PostToolUse
  (`post-tool-use-capturing-interview-answers.json:3`).
- Canonical structured edit tool is `apply_patch` (`apply_patch.rs:301`). Hook matcher aliases
  `Write`/`Edit` exist but stdin still serializes `tool_name:"apply_patch"` (`hook_names.rs:28`,
  `hook_runtime.rs:157`). There is NO built-in `write`/`edit`/`str_replace` tool in this build.
- For `apply_patch`, the patch text is exposed as `tool_input.command` (`apply_patch.rs:451`,
  `context.rs:245`) — so a static lint can inspect the ADDED lines, both pre- and post-execution.
- PreToolUse on `apply_patch` is the STRONG primitive: it sees the same patch text BEFORE
  execution and can truly block the write (`registry.rs:502-545`). codexclaw already has a
  fail-CLOSED PreToolUse dispatcher (`cli.ts` `handlePreToolUseFailClosed`) + the goal-budget +
  interview-in-goal PreToolUse hooks — the pattern exists.
- PostToolUse `decision:"block"` is POST-HOC: the edit already landed; the runtime marks the run
  Blocked and swaps the tool result for the feedback text (`post_tool_use.rs:243`,
  `registry.rs:607-637`), it does NOT revert the file. So PostToolUse comment-lint is fail-loud
  guidance, not prevention.
- SessionStart SUPPORTS `additionalContext` injection (`schema.rs:382-398`, consumed as
  developer-context `session_start.rs:257`, `hook_runtime.rs:584-603`). codexclaw's existing
  SessionStart provider hook already emits a context line (`provider-bridge/src/cli.ts:37`).
- UserPromptSubmit: all handlers run and all `additionalContext` fragments are kept
  (`user_prompt_submit.rs:68-130`), but there is NO matcher scoping (`dispatcher.rs:64`) — a 2nd
  UserPromptSubmit injector would fire on EVERY prompt (prompt-bloat). Prefer SessionStart.
- Shell/exec edits (`exec_command`/`shell_command`) do NOT surface as `apply_patch`
  (`exec_command.rs:307`, `shell_command.rs:214`) — a structured-patch lint cannot see them. This
  is a stated coverage limit, not a bug.
- PreToolUse fail-closed contract (R-9): the shipped `handlePreToolUseFailClosed` only hard-denies
  `request_user_input` in goal mode. A NEW PreToolUse branch for `apply_patch` must NOT inherit
  that fail-closed-deny default — a lint error must FAIL-OPEN (allow the edit), never deny on a
  hook crash. This is the one delicate wiring point.

## Design (diff-level)

### (A) Rule injector — SessionStart additionalContext (E4)

New manifest `plugins/codexclaw/hooks/session-start-injecting-project-rules.json` →
`cli.js hook session-start-rules` (a NEW SessionStart entry; coexists with the provider one):

```ts
// rules.ts — daemon-free: read project rules, emit as additionalContext. File scan + dedup only.
const RULES_DIR = ".codexclaw/rules";           // *.md files, each a rule block
const FALLBACK = "AGENTS.md";                    // project root fallback
export function buildRulesContext(cwd: string): string {
  // read .codexclaw/rules/*.md (or AGENTS.md), concat, dedup, cap length; "" if none.
  // returns a SessionStart additionalContext envelope, or "" (no rules => no injection).
}
```

- Scope: file scan + dedup + length cap ONLY. No matching engine, no rule DSL, no AI judgement.
- SessionStart-first (NOT UserPromptSubmit) to avoid per-prompt bloat. (If a future need arises,
  UserPromptSubmit can ADD a fragment without collision, but 060 deliberately stays SessionStart.)

### (B) Comment-lint — PreToolUse on apply_patch (E1, TRUE prevention) + PostToolUse fallback

Primary: new manifest `plugins/codexclaw/hooks/pre-tool-use-linting-apply-patch.json` with
`"matcher": "^(apply_patch|Write|Edit)$"` → `cli.js hook pre-tool-use-lint`:

```ts
// comment-lint.ts — STATIC forbidden-pattern scan over apply_patch added lines.
const FORBIDDEN: { re: RegExp; msg: string }[] = [
  { re: /\bas any\b(?![^\n]*\/\/\s*justified:)/, msg: "`as any` without a `// justified:` comment" },
  // ... a small, explicit, static set; NO semantic/AI analysis.
];
export function lintApplyPatch(toolInputCommand: string): { ok: true } | { ok: false; reason: string } {
  // parse the patch text, scan ADDED lines (+ prefix) only, return first violation.
}
```

Wiring: a dedicated PreToolUse branch that is FAIL-OPEN (distinct from the R-9 fail-closed
`request_user_input` deny). On a lint hit → `{"hookSpecificOutput":{"permissionDecision":"deny",
"permissionDecisionReason": reason}}`; on any error/parse miss → allow (empty/allow output).

Fallback (documented, weaker): a PostToolUse `^(apply_patch|Write|Edit)$` entry that emits
`decision:"block"` feedback when the pre-lint was bypassed (e.g. matcher alias drift). Honest
effect: it does NOT un-write the file; it swaps the tool result for repair feedback.

## Honest scope (what 060 does and does NOT claim)

- Rule-injector: surfaces project rules as SessionStart context. It is a DIRECTIVE (E4), not
  enforcement — the model may still ignore a rule; nothing blocks on it.
- Comment-lint PreToolUse: TRULY blocks a forbidden pattern in an `apply_patch` BEFORE it lands
  (E1). Coverage limit: ONLY structured `apply_patch` edits — shell/exec file writes are NOT seen.
- Comment-lint must FAIL-OPEN: a lint crash allows the edit (never deny on hook error). It is the
  one PreToolUse branch that is fail-open, unlike the R-9 fail-closed `request_user_input` deny.
- Static only: a fixed forbidden-pattern set; no semantic AI-slop judgement, no external binary.

## Invariants

- Daemon-free: both pieces are short-lived `node:fs`/string scans under `cwd`.
- Rule-injector emits `""` when no rules exist; never fabricates context.
- Comment-lint is FAIL-OPEN (allow on any error); only a confirmed static match denies.
- Coexists with shipped hooks (dispatcher runs all matchers); does not touch the R-9 fail-closed
  `request_user_input` path.
- No LSP/codegraph/AI matching (that is 090's non-goal).

## Acceptance

| Check | Evidence |
|-------|----------|
| Rules injected | `.codexclaw/rules/*.md` present → SessionStart emits concatenated/deduped context |
| No rules → silent | empty/absent rules dir and no AGENTS.md → `""`, no injection |
| Lint blocks pre-write | an `apply_patch` adding `as any` (no `// justified:`) → PreToolUse deny + reason |
| Lint allows clean | a clean patch, or `as any` WITH `// justified:` → allow |
| Lint fail-open | malformed patch text / hook error → allow (never deny on crash) |
| Coverage limit stated | shell/exec edits are documented as NOT covered (not silently "safe") |
| Coexistence | new PreToolUse + PostToolUse entries fire alongside shipped request_user_input hook |
| Manifests wired | plugin.json lists the new SessionStart + PreToolUse (+ optional PostToolUse) hooks |

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/comment-lint.test.*` (block/allow/fail-open)
- `node --test .../test/rules.test.*` (concat/dedup/empty)
- extend `hook-e2e.test.mjs`: drive `cli.js hook pre-tool-use-lint` with a forbidden patch (deny)
  and a clean patch (allow); drive `session-start-rules` with a seeded rules dir.
- `npm run build` (idempotent) ; `npm test` (full suite green) ; `npm run gate` ; `git diff --check`.

## Sub-passes

- 060.1 — rule-injector (SessionStart) — the lower-risk half; ship first.
- 060.2 — comment-lint PreToolUse on `apply_patch` (fail-open) — the enforcement half; the
  fail-open wiring vs the R-9 fail-closed default is the delicate review point.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm PreToolUse-primary + fail-open wiring + apply_patch-only scope.
- A: gpt-5.4 explorer challenges — does the new PreToolUse branch correctly FAIL-OPEN (not inherit
  R-9 deny)? is the forbidden-pattern set static + deterministic? is the coverage limit stated
  honestly? does the matcher regex match the shipped alias set?
- B: implement rules.ts + comment-lint.ts + the two/three manifests + cli wiring + tests.
- C: build idempotent + unit + e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-060): rule injector + apply_patch comment-lint`, continue.

## Depends on / feeds

Independent of other decades (own surfaces). The rule-injector pairs with `dev/SKILL.md`
discipline; the comment-lint is the first real edit-time E1 gate codexclaw owns. 090 stays the
boundary: no LSP/codegraph/semantic analysis.
