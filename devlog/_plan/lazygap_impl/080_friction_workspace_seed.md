# 080 — Friction Ledger + Workspace Path-Hint + Seed Ontology (impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 080 · class C3 (runtime/state)

> Source gap: `../lazygap/001` cli-jaw orchestrator-internals addendum ("the three cleanest
> imports"). A-gate (Curie, gpt-5.4) verified vs cli-jaw + codex-rs + shipped code and returned
> BLOCKERS on the friction CAPTURE premise (read-points are sound). All constraints folded; the
> friction piece is written with its real, limited observability stated up front.

## Why

cli-jaw carries orchestrator context codexclaw lacks: a friction ledger (repeated tool:error →
escalate→stop), workspace path-hints on dispatch, and a structured seed ontology. The host-native
boundary says these live as project-local files + hook logic, never a server. 080 ports the three
as pure functions + `.codexclaw/` files.

## Ground Truth (read before edit — cli-jaw + codex-rs + shipped)

### Friction (the one with a hard observability limit)

- cli-jaw `friction.ts`: `normalizeError` + `sha256(tool:normalizedError)` → `retry`(1) /
  `escalate`(>=2) / `stop`(>=3), in-memory `Map` + oscillation `verdictHistory`
  (`cli-jaw/src/orchestrator/friction.ts`).
- codex-rs `PostToolUseCommandInput` carries ONLY `tool_name, tool_input, tool_response,
  tool_use_id` — NO `error`, `success`, or `exit_code` field (`schema.rs:315`).
- Post hooks run only when the registry kept a `post_tool_use_payload`, else skipped
  (`registry.rs:582`).
- `apply_patch` correctness failures return a MODEL error and NEVER reach PostToolUse
  (`apply_patch.rs:573`).
- `exec_command` reports `success_for_logging()==true` even on nonzero exit, so PostToolUse fires,
  but the hook only sees `tool_response` as TRUNCATED output text — NOT an exit code
  (`context.rs:322,356`).
- codexclaw's shipped PostToolUse is matcher `^request_user_input$` only
  (`post-tool-use-capturing-interview-answers.json:3`) and `handlePostToolUse` early-returns
  unless `tool_name==='request_user_input'` (`hook.ts`).
- CONSEQUENCE: a clean "every tool failure → friction signature" capture is NOT shippable. 080's
  friction capture is HEURISTIC: a broader PostToolUse matcher observes shell `tool_response`
  text and pattern-matches failure markers (error/Traceback/non-zero hints) — it cannot see
  apply_patch failures or true exit codes. This limit is stated, not hidden.
- MATCHER NAME: both `exec_command` and `shell_command` normalize to `tool_name:
  HookToolName::bash()` ("Bash") in the PostToolUse payload (`unified_exec.rs:91`,
  `shell_command.rs:251`). So the capture matcher MUST be `^Bash$`, NOT
  `^(exec_command|shell_command)$` — the latter would match nothing.

### Friction read points (sound)

- PreToolUse has `cwd`+`session_id` (`schema.rs:280`, `goal-gate.ts:17`) → can read
  `.codexclaw/friction.jsonl` locally, no goal-DB.
- Stop has `cwd` and already reads `.codexclaw` state (`hook.ts:456`, `state.ts:87`). Reading
  friction in Stop does NOT change arming IFF it happens AFTER the goal-active arming guard
  (`hook.ts:470`). Before that guard would alter arming — forbidden.

### Workspace path-hint

- cli-jaw `workspace-context.ts:33` `buildResolvedPathHints`: token→abs + `existsSync`/
  `realpathSync` symlink-escape flag. Pure transform, no server.
- Attachment surface = the spawn-wrapper `items` (`spawn-wrapper.ts:203,267`), the per-dispatch
  payload channel — NOT `UserPromptSubmit.additionalContext` (that's main-session phase injection,
  `hook.ts:211,236`). NOT a project-root registry (Codex owns cwd, host-native).
- CONSTRAINT: `items` is v1-spawn-only; v2 spawn rejects unknown `items` (`multi_agents_spec.rs:543`,
  `multi_agents_tests.rs:1063`). Same v1/v2 split as 020 — so path-hint rides 020's E5 builder.

### Seed ontology

- cli-jaw `seed.ts:18,33` OntologyEntity/Field/Relationship + `buildSeedFromEvidence` + render
  (structured, optional).
- codexclaw `interview.ts:20,59`: `DIMENSIONS=['goal','constraint','success','ontology']`,
  `ontology` is a label-only `DimensionScore` today.
- Additive-SAFE: `EvidenceBundle.dimensions` stores only `InterviewTracker["dimensions"]`
  (`freeze.ts:21`), and `planHash` hashes plan FILES not the tracker (`freeze.ts:47`) — so a new
  `ontologySchema` field breaks neither.
- BUT it must be threaded through `InterviewTracker`, `defaultInterview` (`interview.ts:126`),
  `reconstructInterview` (`:137`), `normalizeInterview` (`:270`) — else it's dropped on the
  `readState`/`writeState` round-trip (`state.ts:87,135`).

## Design (diff-level)

### (1) Friction ledger — `.codexclaw/friction.jsonl` (HEURISTIC capture, real read gate)

```ts
// friction.ts — port cli-jaw's normalize+hash+verdict; persist to a JSONL ledger under cwd.
export type FrictionVerdict = "retry" | "escalate" | "stop";
export function normalizeError(s: string): string;                 // lowercase, strip L:C, paths, cap 500 (cli-jaw parity)
export function frictionKey(tool: string, normalized: string): string; // sha256(`${tool}:${normalized}`)
export function recordFriction(cwd: string, tool: string, errorText: string): FrictionVerdict; // append/increment
export function readFrictionVerdict(cwd: string, tool: string, errorText: string): FrictionVerdict | null; // read-only
```

- CAPTURE (heuristic): a broader PostToolUse matcher `^Bash$` (both exec_command and
  shell_command normalize to `Bash`) → `handlePostToolUse` extension that scans `tool_response`
  text for failure markers and calls `recordFriction`. Honest limit: misses apply_patch failures
  + true exit codes (stated above).
- READ (real gate): PreToolUse may DENY a tool call whose (tool,error) signature is at `stop`
  (E1); Stop may ESCALATE-block when friction is high — BUT only AFTER the goal-active arming
  guard (`hook.ts:470`), never before (would change arming).
- All local `.codexclaw/friction.jsonl`; no goal-DB; FAIL-OPEN (read error → no verdict → allow).

### (2) Workspace path-hint — on the spawn-wrapper items (v1)

```ts
// extend spawn-wrapper: resolve repo-path tokens in the task to abs paths + flag symlink-escape.
export function buildPathHints(cwd: string, taskText: string): { token: string; abs: string; outsideRepo: boolean }[];
// attach as a `{ type:"text", text:"Resolved paths: ..." }` item alongside the existing skill items.
```

- Pure `existsSync`/`realpathSync`; rides 020's E5 builder (v1 `items`). v2 spawn → skip the item
  (graceful), same v1/v2 handling as 020. NOT a project registry.

### (3) Seed ontology — additive interview field

```ts
// interview.ts — additive, optional; threaded through default/reconstruct/normalize.
export interface OntologyEntity { name: string; fields: string[]; relationships: { to: string; kind: string }[]; }
export interface InterviewTracker { /* ...existing... */ ontologySchema?: OntologyEntity[]; }
// defaultInterview: ontologySchema: undefined ; reconstruct/normalize: tolerant parse, preserve.
```

- Does NOT alter `EvidenceBundle.dimensions` or `planHash` (verified). It enriches the `ontology`
  dimension from a label into a structured artifact; freeze can OPTIONALLY surface it later.

## Invariants

- Friction CAPTURE is heuristic + documented-limited (no apply_patch failures, no exit codes);
  never claimed as complete tool-failure observability.
- Friction READ never changes Stop arming (consulted only after the goal-active guard); FAIL-OPEN.
- All new state is project-local `.codexclaw/` (friction.jsonl); no goal-DB, no server.
- Path-hint is a pure existsSync/realpath transform on the spawn payload (v1 items; v2 skips).
- Seed ontology is additive + round-trip-safe (threaded through reconstruct/normalize); does not
  touch freeze planHash or the evidence-bundle shape.

## Acceptance

| Check | Evidence |
|-------|----------|
| Friction verdict math | retry/escalate/stop at count 1/≥2/≥3 matches cli-jaw; sha256 key stable |
| Capture limit stated | doc + code comment state apply_patch failures + exit codes are NOT observable |
| PreToolUse deny on stop | a (tool,error) at `stop` → PreToolUse deny (fail-open on read error) |
| Stop escalate after arming | friction read happens only after the goal-active guard; arming unchanged |
| Path-hint resolves | repo tokens → abs; symlink-outside flagged; attaches to v1 items, v2 skips |
| Seed round-trips | ontologySchema survives writeState→readState (reconstruct/normalize threaded) |
| Freeze unaffected | planHash + EvidenceBundle.dimensions unchanged by the new field |
| No-server/no-DB | all state local; no goal-DB access on any path |

## Verification

- `node --test .../test/friction.test.*` (verdict math + jsonl persist + fail-open)
- `node --test .../test/spawn-wrapper.test.*` (path-hint item on v1, skipped on v2)
- `node --test .../test/interview.test.*` (ontologySchema round-trip)
- extend `hook-e2e.test.mjs`: PostToolUse `Bash` failure → friction recorded; PreToolUse
  deny on a `stop` signature.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## Sub-passes

- 080.1 — friction ledger (capture heuristic + PreToolUse/Stop read gate). The only piece with a
  stated observability limit; ship with the limit documented in code.
- 080.2 — workspace path-hint on the spawn-wrapper items (depends on 020's builder).
- 080.3 — seed ontology schema threaded through the interview tracker.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm the friction capture limit is stated, not hidden.
- A: gpt-5.4 explorer challenges — does friction read stay AFTER the Stop arming guard? does the
  capture doc honestly state it misses apply_patch + exit codes? is the ontology field threaded
  through reconstruct/normalize? is path-hint v1/v2-aware?
- B: implement friction.ts + broader PostToolUse capture + PreToolUse/Stop read + path-hint +
  ontology threading + tests.
- C: build idempotent + unit + e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-080): friction ledger + path-hint + seed ontology`.

## Depends on / feeds

080.2 depends on `020` (spawn items builder). Friction read-gate complements `040` (Stop) without
changing its arming. Seed ontology feeds `030` (a richer freeze→goalplan criteria seed later).
This is the cli-jaw orchestrator-internals closeout; the remaining cli-jaw context (plan
auto-inject) stays E4/E7 doctrine per `../lazygap/001` (runtime force impossible).
