# wp1 — resolver, durable/volatile consolidation, evidence guard (PR1)

Status: PLANNED

## New module: `pabcd-state/src/state-root.ts`

Pure node:* module, no imports from other pabcd-state files except `codexclaw-dir.ts`.

    export type StateMode = "repo" | "local" | "external" | "none";
    export const DEFAULT_OWNER_ALLOWLIST = ["lidge-jun", "goat-si", "lidge-ai"];
    export interface StateRoot {
      mode; reason;            // reason: "env CODEXCLAW_STATE_MODE", "config state.projects[...]", "auto: owner acme not in allowlist", ...
      cwd; volatileDir;        // <cwd>/.codexclaw
      durableDir;              // repo/local: <cwd>/.codexclaw; external: <base>/<id>/state; none: <cwd>/.codexclaw/durable-disabled (never created)
      devlogDir;               // repo/local: <cwd>/devlog; external: <base>/<id>/devlog; none: null
      projectId; projectDir; stateBase; originKey; owner; warnings: string[];
    }
    export function normalizeRemoteUrl(url): { key: "host/owner/repo", owner } | null
    export function readGitInfo(cwd): { worktreeRoot, commonDir, originUrl } | null   // file-based, no spawn
    export function deriveProjectId(cwd, git): { projectId, originKey, owner }
    export function readStateConfig(env, cwd): StateConfig                            // trusted user config only
    export function resolveStateRoot(cwd, env = process.env): StateRoot
    export function durableDir(cwd, env?): string
    export function evidenceDir(cwd, env?): string      // durableDir/evidence
    export function devlogDir(cwd, env?): string | null
    export class DurableStateDisabledError extends Error
    export function ensureDurableDir(cwd, env?): string // repo/local: ensureCodexclawDir; external: mkdir 0700 + project.json (wx); none: throw
    export function ensurePrivacyExcludes(cwd, env?): void   // local/external/none: append "/<rel>/.codexclaw/" (+ "/<rel>/devlog/" for local) to <commonDir>/info/exclude once
    export function durableLabel(cwd, ...segments): string   // relative to cwd when inside, else absolute
    export function clearStateRootCache(): void

Caching: git info is cached per realpath(cwd) per process; the config file and the legacy-marker check are re-read on every call (one stat + one small read).

## Consolidation (every durable site goes through the resolver)

| File | Today | Change |
|---|---|---|
| state.ts | `appendLedger`, `interviewsDir` join cwd/STATE_DIR | `ensureDurableDir` + `durableDir`; `appendLedger`/`appendInterviewEvent` are no-ops in `none`; `ensureState` calls `ensurePrivacyExcludes` (best-effort) |
| hook.ts:501, orchestrate-cli.ts:448 | read `cwd/.codexclaw/ledger.jsonl` | `durableDir` |
| hook.ts:1521/1545/1589, steering.ts:314, goal-gate.ts:248/290 | literal `.codexclaw/goalplans/...`, `.codexclaw/evidence-unrecordable/` | `durableLabel` |
| goalplan.ts:320 `goalplanDir` | `resolve(cwd, STATE_DIR)` | `resolve(durableDir(cwd))`; symlink + containment checks unchanged; writers call `ensureDurableDir` |
| interview-ledger.ts | cwd/STATE_DIR/interviews | `durableDir` |
| freeze-cli.ts / freeze.ts | cwd/STATE_DIR/{plan,interview} | `durableDir` |
| receipt-cli.ts:70 | cwd/STATE_DIR/evidence/<s>/test-receipt.json | `evidenceDir` |
| render-observations.ts:193 | cwd/STATE_DIR/evidence/<s>/qa | `evidenceDir` |
| subagent-evidence.ts:86/100/220/329/407/454/466 | evidence, evidence-attempts, evidence-unrecordable under cwd | `durableDir`/`evidenceDir`; marker writability probe uses `ensureDurableDir` (a `none` mode probe fails → existing "unreadable" deny path, D10) |
| source-receipt.ts:101/190 | `resolve(cwd, ".codexclaw", "evidence")` | `evidenceDir` |
| evidence-cli.ts:69 | message | label of the resolved root |
| goalplan-cli.ts:738, receipt-cli.ts:88, scan-cli.ts:312, memory-cli.ts, cli.ts header | help text | "<durable root>/..." wording + `cxc state path` pointer |
| subagent-config/final-gate-guard.ts:119-183 | goalplan read under cwd | resolver copy `state-root.ts` in subagent-config (cross-component imports are banned), parity test pins the copy |
| cxc-ops/reset.ts | wipes ledger/interviews/goalplans under cwd | resolver copy in cxc-ops; durable scopes act on `durableDir`, refuse in `none` with a message |

Copies: `subagent-config/src/state-root.ts` and `cxc-ops/src/state-root.ts` are byte-identical to pabcd-state's; `plugins/codexclaw/test/codexclaw-dir-copies.test.mjs` gains the same assertion for state-root.ts.

## Evidence guard (security-relevant)

`hasValidReceipt(cwd, path)` keeps all checks; only `evidenceRoot(cwd)` changes to `resolve(evidenceDir(cwd))`. Relative receipt paths still resolve against cwd. New tests: external root accepts a real file under `<base>/<id>/state/evidence/<s>/`; rejects a symlink leaf there; rejects a file whose parent dir is a symlink to outside; rejects `../` escapes; rejects a receipt under the legacy `<cwd>/.codexclaw/evidence` in external mode; `none` mode rejects everything. `parseArtifactManifest` uses the same root.

## Tests (new file `pabcd-state/test/state-root.test.ts`)

- normalizeRemoteUrl: scp, ssh://, https with credentials, trailing `.git`/slash, case; garbage → null.
- project id: two linked worktrees of one repo (real `git worktree add` in a temp dir) → same id; deleting one worktree leaves the external state readable from the other; no-origin fallback stable across worktrees.
- modes: env override, config project override, config mode, auto allowlisted → repo, auto foreign → external, auto foreign with legacy ledger → local + warning, no origin → repo, config inside cwd ignored, relative env roots ignored.
- local/external write `info/exclude` once (idempotent), never in repo mode.
- none: `appendLedger` no-op, `ensureDurableDir` throws `DurableStateDisabledError`, hook process exits 0 for SessionStart/UserPromptSubmit/Stop payloads.
- repo mode paths are byte-identical to the old ones (existing ~3.8k tests are the main regression net).

All tests run under the test runner's scratch `CODEXCLAW_HOME`, so the default external base is a temp dir.

## Verifier

`node --test plugins/codexclaw/components/pabcd-state/test/state-root.test.ts` and the touched suites, `npm run build`, `npm test`, `npm run gate`.


## Inventory fold-in (research/01)

- All sites in research/01 §1 are covered by the table above; `goalplanDir` callers (orchestrate-cli.ts:438, hook.ts:491, schema marker, lock dir) follow automatically because they go through `goalplanDir`. The goalplan lock and tmp files therefore live next to the external plan, which is what concurrent checkouts sharing one plan need.
- `freeze.ts` message strings (130/133) and `freeze-cli.ts` help (81/82) get labels.
- `cxc-ops/doctor.ts` keeps checking the volatile `.codexclaw`; the "state lives on" WSL residency check gains the durable dir when it differs (report-only).
- `skills/qa/scripts/validate-evidence.mjs` usage text and the qa evidence contract move to wp3 (documentation of the root); the script already takes the directory as an argument.
- Tests: no existing fixture adds an `origin` remote, so every existing test resolves to `repo` mode (auto, no origin) and keeps its paths.

