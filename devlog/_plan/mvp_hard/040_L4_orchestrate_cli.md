# L4 / 040 — `cxc orchestrate` Terminal CLI (agent-gated path)

Status: DONE (impl shipped + tested) · 2026-06-30 · mvp_hard loop L4 · class C3 (persistence, shares state with the hook)

> L3b gave the HUMAN (chat) path its free-pass wire. L4 gives the AGENT/terminal path:
> `cxc orchestrate <verb> [--attest <json>]` over the SAME `.codexclaw` file state, but
> GATED — forward transitions go through the un-weakened `transition()` + `validateAttest`,
> so an agent must supply real evidence. This completes the invocation-source split:
> chat = free-pass (L3b), CLI = gated (L4).

## Goal (L4)

A `cxc orchestrate` subcommand that reads/writes the same per-session state files and
drives the FSM through the gated `transition()`. Mirrors `jaw orchestrate <phase>`.

```
cxc orchestrate <I|P|A|B|C|D|status|reset> [--attest <json>] [--session <id>] [--cwd <path>] [--json]
```

## Reference (verified)

- cxc-ops CLI shape (subcommand switch, pluginRootFrom, direct-exec guard)
  ([cli.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/cxc-ops/src/cli.ts:22)).
- session files live at `.codexclaw/sessions/*.json`; reset enumerates them
  ([reset.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/cxc-ops/src/reset.ts:54)).
- gated `transition()` + `validateAttest` (agent path) — reused UNCHANGED
  ([fsm.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/fsm.ts:78)).
- the L3a parser + L3b apply helper (the verb grammar / control verbs)
  ([orchestrate-grammar.ts](/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/orchestrate-grammar.ts:1)).
- root CLI dispatch (`bin/codexclaw.mjs`) — add an `orchestrate` case
  ([codexclaw.mjs](/Users/jun/Developer/new/700_projects/codexclaw/bin/codexclaw.mjs:56)).

## Session selection (CLI has no codex session id)

The hook gets `session_id` from codex; the terminal CLI does not. Strategy:
- `--session <id>` explicit wins.
- else pick the most-recently-modified `.codexclaw/sessions/*.json` (the active session).
- else (no sessions yet) use a default key `"cli"` and create it. This mirrors how a
  human would drive the same repo's loop from a terminal.

## File change map (IN scope)

1. NEW `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`
   - `export interface OrchestrateCliArgs { verb: OrchestrateVerb; attest: Attestation | null; attestError?: string; session?: string; cwd: string; json: boolean; }`
   - `export function parseOrchestrateCliArgs(argv: string[], cwd: string): OrchestrateCliArgs | { error: string };`
     (reuse the grammar's verb whitelist + brace-balanced `--attest` extraction by
     calling a small shared helper, or re-parse the joined argv through
     `parseOrchestrateCommand("orchestrate " + argv.join(" "))`).
   - `export function runOrchestrateCli(args): { code: number; output: string };`
     - resolves the session (above), `readState`.
     - `status` → render current phase + flags (+ `--json`).
     - `reset` → same cleared-IDLE write as the human path (reset is a control
       override, not an attest-gated edge), ledger reason "reset".
     - phase verb → AGENT-GATED: call `transition(state, verb, attest)` (the
       un-weakened gate). On `ok:false` (missing/placeholder attest, illegal edge),
       return code 1 + the reason. On ok, `writeState` + `appendLedger(reason:"cli")`.
   - Pure-ish: does its own IO (readState/writeState/appendLedger) like a CLI command,
     but no network. Under 200 lines.
2. MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`
   - add an `orchestrate` kind branch (alongside `freeze`) that calls
     `parseOrchestrateCliArgs` + `runOrchestrateCli` and writes output, exits with code.
3. MODIFY `bin/codexclaw.mjs`
   - add `case "orchestrate":` that delegates to the compiled pabcd-state CLI
     (`components/pabcd-state/dist/cli.js orchestrate <args...>`), like cxcOps delegation.
   - update the default help line to include `orchestrate`.
4. NEW `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`
   - arg parse: verb/attest/session/json/`--cwd`; bad verb → error.
   - AGENT-GATED: `orchestrate a` (P->A) WITHOUT attest → code 1 (gated, unlike the
     human free-pass); WITH a real `--attest` → advances, ledger reason "cli".
   - `orchestrate c --attest {...,exitCode:1}` for C->D rejected (failing check).
   - `status` renders phase; `reset` clears to IDLE.
   - session resolution: explicit `--session`, latest-mtime pick, default "cli".

## Scope boundary

- IN: orchestrate-cli.ts, cli.ts orchestrate branch, bin dispatch, tests.
- OUT: phase footer directive + rich status formatting (L5); Stop-continuation (L6);
  goalplan/loop (L7). L4 does NOT modify `transition()`, `fsm.ts`, or the hook.
- KEY CONTRAST: L4 is the GATED path (uses `transition()` with attest). It must NOT
  reuse L3b's `applyHumanTransition` free-pass for phase verbs (only for reset/status
  control semantics, which are identical).

## Accept criteria (testable)

- `cxc orchestrate status` prints the current phase for the active session.
- `cxc orchestrate a` (from P) with NO `--attest` exits non-zero with a "requires an
  attestation" reason (agent gate); with `--attest '{"from":"P","to":"A","did":"..."}'`
  it advances to A and appends a ledger entry with reason "cli".
- An illegal edge (`cxc orchestrate c` from IDLE) exits non-zero (adjacency refused).
- `cxc orchestrate reset` returns the session to IDLE and clears gate flags.
- The hook and CLI operate on the SAME session file (a CLI advance is visible to the
  next hook read).
- `npm test` green at 258+; `npm run build` idempotent.

## Risk / rollback

- Risk: session ambiguity (multiple session files). Mitigation: deterministic
  latest-mtime pick + explicit `--session` override; document the rule.
- Risk: the CLI accidentally using the human free-pass and letting an agent skip
  evidence. Mitigation: phase verbs route through `transition()` (gated); a test
  asserts P->A without attest FAILS via the CLI even though it would pass via chat.
- Rollback: delete orchestrate-cli.ts + its test, revert the cli.ts branch and the
  bin case. The hook (L3b) is independent.

## Audit focus (for A gate)

- Is the session-selection deterministic and safe when `.codexclaw/sessions/` is
  empty or has many files? Does default "cli" collide with a real codex session id?
- Does reusing `parseOrchestrateCommand("orchestrate " + argv.join(" "))` correctly
  handle a `--attest` JSON that contains spaces when passed as separate argv tokens
  (the shell may split it)? Should the CLI read `--attest` as the rest-of-argv joined,
  or require a single quoted arg? Decide and test.
- Confirm phase verbs use the GATED `transition()`, not the human free-pass.

## Audit verdict (A gate — independent reviewer, 2026-06-30)

Verdict: **PLAN OK with fixes**. Confirmed: phase verbs route through gated
`transition()` (validates attest before canEnter), so CLI `P->A` without attest fails
correctly. Folded into the build scope:

1. **HIGH — structural argv parsing (NOT `argv.join(" ")`)**: `parseOrchestrateCommand`
   is prompt/line-oriented; do not reuse it for argv. The CLI parses argv structurally:
   first token = verb; scan for `--attest` and consume the NEXT single argv token as the
   exact JSON string (the shell already quoted it into one token), then JSON.parse +
   coerceAttest. `--session`/`--cwd`/`--json` are parsed as flag+value. The brace-balanced
   extractor from grammar is reused only to validate, not to re-split.
2. **HIGH — session semantics (no silent `cli` divergence)**: the hook keys state by
   the codex `session_id`; a CLI default `"cli"` would write a DIFFERENT file. Fix:
   - `status`/read with no session + empty dir → report "no active session".
   - a MUTATING verb (phase/reset) with no `--session` and no existing session → exit
     non-zero asking for `--session` (do NOT silently create a divergent `cli` session).
   - `"cli"` is allowed ONLY when explicitly passed `--session cli` (terminal-only state,
     documented as such). The "hook and CLI share state" claim holds only when they use
     the same session id (explicit `--session <codex-id>` or latest-mtime pick of a real
     hook-created session).
3. **MEDIUM — deterministic latest-mtime pick**: handle missing/empty dir without
   throwing; ignore non-`.json` and `*.tmp`; tie-break equal mtimes by filename; never
   rewrite a raw id to its sanitized form as the selected id. Tests: missing dir, empty
   dir, equal-mtime tie-break, explicit `--session` overrides latest.
4. **MEDIUM — malformed `--attest`**: when `--attest` is present but unparseable/
   uncoercible, the CLI exits non-zero with the parse error (not a generic "missing
   evidence"), and control verbs (status/reset) ignore a stray `--attest`. Add a test.
5. **LOW — root-bin integration test**: add a test that actually invokes
   `bin/codexclaw.mjs orchestrate ...` (spawnSync) and asserts exit code + output, not
   only `runOrchestrateCli()` in-process. `cli.ts` reads kind from argv[2]; the
   orchestrate branch parses `process.argv.slice(3)` like the freeze branch.
