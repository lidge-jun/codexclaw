# #255 — Ignore local runtime state when CodexClaw creates `.codexclaw`

**Partial fix.** Keep `handleSessionStart` and `ensureState` exactly as they behave today: a fresh SessionStart with PABCD policy enabled creates `.codexclaw/sessions/<id>.json`. Do not introduce lazy state creation, `verifiedCreateState`, `sessionStateFileExists`, `writeExistingState`, or CLI identity changes. When CodexClaw itself first creates `<cwd>/.codexclaw`, create `<cwd>/.codexclaw/.gitignore` exclusively. This addresses the reporter's offered ignore-file alternative without changing session or gate semantics (issue #255, severity low).

Lazy creation is **DEFERRED** to its own design. The round-3 audit found that absent session state changes the executor evidence gate and goal-complete gate (`plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:215-236`), while guarded writes would have to preserve `writeState`'s atomic conditional publication (`plugins/codexclaw/components/pabcd-state/src/state.ts:607-617`). This phase does not make those changes.

## File change map

### ADD helper in `plugins/codexclaw/components/pabcd-state/src/state.ts`

Export `ensureCodexclawDir(cwd): string`. Attempt `mkdirSync(join(cwd, STATE_DIR))` **without** `recursive`; only the caller that successfully creates that exact directory writes `.gitignore` with `writeFileSync(path, GITIGNORE_TEXT, { flag: "wx" })`. Ignore `EEXIST` from the directory creation and from the exclusive file creation; propagate other errors. An existing `.codexclaw` directory is never modified, even if it lacks `.gitignore`; an existing `.gitignore` is never overwritten. Do not use an `existsSync` precheck to decide ownership. Concurrent callers may race; one creates the directory and at most one publishes the ignore file. Keep `ensureState`'s exclusive session-file publication unchanged (`state.ts:359-410`).

Use these exact bytes (including the final newline):

```gitignore
# CodexClaw wrote this when it created .codexclaw; everything here is local runtime state.
*
!.gitignore
!rules/
!rules/*.md
```

`rules/*.md` is the one deliberate exception: `rules.ts:4-6,20-29` reads user-authored project rules there, so they must remain eligible for a commit. The directory re-include makes Git traverse it and the `*.md` re-include exposes only the files the reader accepts. Goalplans are generated and mutated local loop state (`goalplan.ts:13,850-888`; `skills/loop/references/durable-goalplan.md:45-48`), so do not re-include `goalplans/` or its ledger. Other sessions, evidence, ledgers, and local configs stay ignored.

### ROUTE all project-local first creators through the helper

Call `ensureCodexclawDir(cwd)` before any recursive child-directory creation. Keep the existing child `mkdirSync` and publication behavior. The `rg -n 'mkdirSync' plugins/codexclaw/components/*/src` inventory gives these project-local writers:

| Owner | First-create path | Action |
| --- | --- | --- |
| `pabcd-state/src/state.ts` | `ensureState:377`, `writeState:609`, lock:656, ledger:683, interview ledger:740 | Call helper before each child creation; SessionStart still calls `ensureState` (`hook.ts:572-575`). |
| `pabcd-state/src/{friction,render-observations,edit-shape}.ts` | `friction:127`, `render-observations:72,127`, `edit-shape:166` | Replace root `mkdirSync` with helper. |
| `pabcd-state/src/{metrics,divergence,interview-ledger,subagent-evidence}.ts` | `metrics:132,138`, `divergence:123,194`, `interview-ledger:220`, `subagent-evidence:217,338,353` | Call helper before child creation; no evidence-gate behavior change. |
| `pabcd-state/src/{receipt-cli,session-source,goalplan,freeze-cli,release-cli,worktree-guard}.ts` | `receipt-cli:181`, `session-source:183`, `goalplan:853,877` (lock `:754` needs an existing plan), `freeze-cli:118`, `release-cli:135`, `worktree-guard:527` | Call helper before project-local child creation; keep existing file/lock rules. |
| `pabcd-state/src/rule-impact-ledger.ts` | `:101-106` takes an arbitrary output path | When the resolved path is under the target cwd's `.codexclaw`, call helper first; thread cwd through the caller if needed. Arbitrary output paths retain their existing behavior. |
| `cxc-ops/src/{map-affordance,activation-trace}.ts` | recovery root `map-affordance:241-249`; trace `activation-trace:130-139` | Use helper when creating the project-local root; preserve recovery/trace best-effort behavior. `scouting-bundle.ts:126` only reads sessions. |
| `bg-wake/src/store.ts` | `ensureDir:45-48` | Call helper before `bg/`; this can be the first writer even without SessionStart. Orphan adoption itself writes only after finding an existing record (`registry.ts:236-249`). |
| `subagent-config/src/store.ts` | `writeRaw:251-259` via project `storePath` | Route project-local `subagents.json` writes through helper; do not apply it to a user-global home path. |
| `subagent-config/src/fallback-dispatch.ts` | `directory:70-78` creates `.codexclaw/dispatches/<session>` | Replace only the root `.codexclaw` creation with the helper; retain its existing symlink and child-directory checks. The lock-directory calls at `:137,256` have `directory()` as a prerequisite and cannot be first. |
| `messenger-bridge/src/{db,event-log}.ts` | `db:1038-1039` and `bridge-controller:93` → `event-log:55` | Route these cwd-local writes through helper. `service.ts` and `token-intake.ts` mkdir calls target home/service locations; `event-log` can accept an explicit project cwd or have its caller ensure the root. |

The other `mkdirSync` results do not first-create `<cwd>/.codexclaw`: `plan-cli.ts:178-184` writes `devlog/_plan`; `recall/src/index-db.ts:20-22,90-94` and `skill-search/src/cache.ts:16,49` write the user-global cache; `config-guard`, `subagent-config/src/role-registration.ts:47-67`, and `subagent-config/src/spawn-attach-hook.ts:365-380` target `CODEX_HOME` or a temporary directory; `messenger-bridge/src/service.ts` writes its home service directory. `release-cli.ts` can also accept an arbitrary `--candidate` path: call the helper only for the default project-local release path, preserving arbitrary output behavior. `rule-impact-ledger.ts` likewise accepts an arbitrary path. Recheck each path and import/build boundary in the implementation branch before changing it. If another cwd-local first writer appears, route it through this same helper.

### MODIFY tests

- `pabcd-state/test/state.test.ts`: fresh-cwd `handleSessionStart` returns `""` and creates both the default session file and `.codexclaw/.gitignore` with the **exact bytes** above. Keep the existing `ensureState` default/exclusive-create assertions (`state.test.ts:27-68`).
- Existing `.codexclaw` without `.gitignore` stays without it after `ensureState`; an existing `.gitignore` keeps its exact bytes. Concurrent first creators tolerate `EEXIST`; after both finish, one ignore file has exact content and session state remains valid.
- In a temporary Git repository, `git check-ignore` reports `sessions/<id>.json` and the ledger ignored, while `.gitignore` and `rules/example.md` are not ignored. Test a `goalplans/<slug>/goalplan.json` path as ignored too. Use `git check-ignore -q` exit statuses, not an ungrounded visual inspection.
- Add focused first-writer tests for representative independent components (at least `cxc-ops` PostCompact recovery, bg-wake `ensureDir`, and a non-state PABCD writer); assert the same ignore file. No source/test edit occurs in this docs-only phase.

**Verification for the implementation branch:** focused `node --test` on touched component test files, `npm run build`, `npm test`, `npm run gate`, and the inventory check named in 010. Re-run `rg -n 'mkdirSync' plugins/codexclaw/components/*/src` and account for every project-local writer after the patch. The fix is partial because the directory and session file still appear at SessionStart; no promise of a read-only session source is made.


## Audit round 4 amendments (supersede conflicting text above)

1. **Parent ignore rules.** A nested `.gitignore` cannot re-include files under a directory that an ancestor ignores. The `!rules/*.md` re-include therefore works only when no ancestor ignores `.codexclaw/`. When a project root ignores `.codexclaw/` (this repository does, `.gitignore:4`), committing rules needs a root-level exception in that project; codexclaw never edits a project's root `.gitignore`. Tests: in a temp git repo with no parent rule, `git check-ignore` ignores `sessions/x.json` and `ledger.jsonl` and does not ignore `rules/a.md`; with a root `.codexclaw/` rule, both are ignored and the helper still writes its own file unchanged.
2. **Atomic first creation.** `ensureCodexclawDir(cwd)` never exposes a `.codexclaw` without its `.gitignore`. When `<cwd>/.codexclaw` is absent it creates a staging directory `<cwd>/.codexclaw.staging-<pid>-<uuid>`, writes `.gitignore` inside it, then `renameSync(staging, <cwd>/.codexclaw)`. If the rename fails because the target now exists (EEXIST, ENOTEMPTY, EPERM on Windows after a concurrent winner), it removes only its own staging directory and continues with the existing folder. Any other failure removes the staging directory and rethrows to the caller's existing error path. An existing `.codexclaw` is never modified by the helper, so a user-created folder stays untouched. Tests: `failure before rename leaves neither .codexclaw nor staging` (inject a throwing writer), `concurrent winner keeps its .gitignore` (pre-create the target between staging and rename via an injected rename), `existing folder without .gitignore is left alone`.
3. **Module placement and build order.** Components do not import each other (no `../../<component>` imports exist) and `build.mjs:75-90` compiles each component on its own. The helper therefore lives in one small self-contained file, `src/codexclaw-dir.ts`, copied byte-identically into every component that can be a first creator (pabcd-state, cxc-ops, bg-wake, subagent-config, messenger-bridge, per the inventory above). A new test `plugins/codexclaw/test/codexclaw-dir-copies.test.mjs` asserts the copies are byte-identical, so drift fails CI. Order of verification: `npm run build` first, then the focused tests, then the full suite, inventory with the measured total, and gate.

## wp2 final publication rule (supersedes "Audit round 4 amendments" item 2 and every earlier recovery text)

`ensureCodexclawDir(cwd)`:

1. `mkdirSync(join(cwd, ".codexclaw"))` without `recursive`. EEXIST means the folder already exists: return without touching it, whatever it contains, including an empty folder, a folder without `.gitignore`, or a symlink. No recovery or repair of existing folders happens anywhere, so no `lstat` policy is needed.
2. Only after a successful `mkdirSync`, write `.gitignore` with flag `wx`. EEXIST here is success when the existing file's bytes equal the helper's content (a concurrent creator of the same folder); any other EEXIST content is left alone without error.
3. If the write fails with another error, remove the folder this call created with `rmdirSync` (which refuses a non-empty folder), then rethrow.

Residual risk: a process that dies between steps 1 and 2 leaves an empty `.codexclaw` without `.gitignore`, and later writers will not repair it. This is accepted for a low-severity issue; a user can delete the empty folder.

Tests: `fresh cwd gets .codexclaw/.gitignore with exact bytes`; `existing empty .codexclaw is left alone`; `existing .codexclaw symlink is left alone and its target gets nothing`; `existing .gitignore is never overwritten`; `identical EEXIST on the ignore write is success`; `ignore write failure removes the empty folder it created and rethrows`.
