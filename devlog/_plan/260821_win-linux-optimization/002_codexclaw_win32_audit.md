# 002 - codexclaw win32 risk audit (read-only)

Scope: `plugins/codexclaw/{components,skills,scripts,bin,hooks}`, `cli/`, `bin/`, `scripts/`.
Method: static read + targeted pattern scan (node walker over non-test, non-dist sources)
plus manual reads of every spawn site, atomic-write path, and the three named GitHub issues.
Nothing was fixed. Line numbers are from the working tree at audit time.

Severity key: **P0** breaks/corrupts on Windows, **P1** wrong behavior or blocked workflow,
**P2** degraded/fragile, **P3** cosmetic or latent.

---

## A. Known open issues (gh #29 / #30 / #31)

### [P1] #30 - `plan init` doubles the date prefix
`plugins/codexclaw/components/pabcd-state/src/plan-cli.ts:54` and `:110`

Problem: `parsePlanCliArgs` runs the raw positional through `deriveSlug` (line 54), and
`runPlanCli` then unconditionally prepends `yymmdd()` (line 110). Users copy the directory
convention and pass an already-prefixed slug. `deriveSlug` (`freeze.ts:60`) lowercases and
maps `[^a-z0-9]+` to `-`, so it does not strip a leading date; it only rewrites the
separator. Reproduced:

```
input:  260821_win-linux-optimization
slug:   260821-win-linux-optimization
unit:   devlog/_plan/260821_260821-win-linux-optimization
```

The underscore also becomes a hyphen, so even the bare-slug path silently mangles
`my_slug` to `my-slug`.

Minimal fix: in `plan-cli.ts`, strip a leading `YYMMDD[_-]` from the positional before
`deriveSlug`, and reuse the caller's date when one was supplied. Concretely, add a
`splitDatePrefix(raw): { date: string | null; rest: string }` helper matching
`/^(\d{6})[_-](.+)$/`, pass `rest` to `deriveSlug`, carry `date` on `PlanCliArgs`, and at
line 110 use `args.date ?? yymmdd()`. Tests belong in
`plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts`: bare slug, prefixed slug,
and a `260821-` hyphen-prefixed variant.

Secondary (same file, [P3]): line 118 writes `0${n}0_phase${n}.md`, so `--phases` above 9
would break the 3-digit convention. Line 48 already caps at 9, so this is latent only.

### [P1] #31 - attest gates reveal required fields one at a time; no `--attest-file`
`plugins/codexclaw/components/pabcd-state/src/attest.ts:174-193` (A>B) and `:194-215` (C>D);
`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:204-214`

Problem 1 (drip-feed): `validateAttest` is a chain of early returns. A>B checks
`auditOutput` (175), then `auditVerdict` (181), then the fail verdict (184), then
`auditResidual` (187), then `hasFailVerdictTail` (190) - each returning the first failure
only. An agent needs up to five round trips to learn the full requirement set, and every
round trip is a fresh CLI invocation. Same shape at C>D: `checkOutput` (195),
`exitCode` presence (204), `exitCode` value (210).

Minimal fix: accumulate into a `reasons: string[]` and return them joined, keeping
`AttestResult.ok` semantics. Order matters for the contradiction checks: gather the
"missing field" reasons first, then only run `hasFailVerdictTail` and the
`auditVerdict === "fail"` refusal when the required fields are present, so the message
never contradicts itself. Preserve every existing reason string verbatim so
`test/attest.test.ts` assertions keep matching on substring.

Problem 2 (no `--attest-file`): `orchestrate-cli.ts:204` only accepts `--attest <json>`
as one argv token. On Windows this is the hard blocker, not a convenience gap - see
section B1 below. Note the repo already has the right precedent in
`goalplan-cli.ts:111-121`, where `--batch-json` accepts either inline JSON or a path
(`raw.startsWith("{")` discriminates, then `readFileSync(resolve(cwd, raw), "utf8")`).

Minimal fix: add `--attest-file <path>` in the same argv loop (after line 214), read with
`readFileSync(resolve(cwdOut, path), "utf8")`, feed the same `JSON.parse` +
`coerceAttest` path, and set `attestError` on read failure. Reject the case where both
`--attest` and `--attest-file` are supplied. Because `--cwd` may be parsed after
`--attest-file` in argv order, resolve the file after the loop completes rather than
inline.

### [P1] #29 - loop criteria are unregistrable after init
`plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:69-71`, `:181-184`;
`plugins/codexclaw/components/pabcd-state/src/steering.ts:45`

Problem: `--criterion` is only read by `init` (parsed at 69, consumed at 183). There is no
`add-criterion`, no `add-work-phase`, and `VERBS` (line 56) is
`{init, show, validate, steer}`. `steer` is the only mutation path and its
`SUPPORTED_OPS` is `new Set(["annotate"])` (`steering.ts:45`), which explicitly rejects
anything else at line 116. So after `loop init`, the plan is frozen.

This is not cosmetic. `buildGoalplan` (`goalplan.ts:584-608`) always sets
`workPhases: []`, and `validateGoalplan` fails an empty plan
(`goalplan.ts:705-708`: "plan is empty: no workPhases[] and no criteria[]"). The
hook tells the agent to "register workPhases[]/criteria[]"
(`hook.ts:1128`) but points at hand-editing `.codexclaw/goalplans/<slug>/goalplan.json`,
because no CLI verb exists. Worse, `schemaVersion 2` requires a `surface` per criterion
(`goalplan.ts:801-803`), and `buildGoalplan` never sets one - so even init-time criteria
fail v2 validation.

Minimal fix (smallest coherent slice): extend `SUPPORTED_OPS` with `add-criterion` and
`add-work-phase` and implement them in `applySteeringBatch`, since that path already has
the lock, the idempotency key, and the ledger entry. Add `--surface` to the `init`
parser and thread it into `buildGoalplan`'s `criteria` map (line 587) so v2 plans are
constructible. Guard the steering refusal rule that already exists: adding a criterion
must never be treated as weakening (`steering.ts` docs, `loop/SKILL.md:230`).

Also note (`goalplan.ts:807`) the error text advertises `cxc loop final-gate open`, but no
`final-gate` verb exists anywhere in `goalplan-cli.ts` or `cli.ts`. That message names a
command the user cannot run - **[P1]**, same family as #29.

---

## B. Windows-specific defects

### B1. [P0] `--attest` JSON is effectively unusable from PowerShell
`plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:204-214`;
help text at `:171-173`; hook-emitted commands at
`plugins/codexclaw/components/pabcd-state/src/hook.ts:1009`

Every documented invocation uses POSIX single quotes:

```
cxc orchestrate A --session <id> --attest '{"from":"P","to":"A","did":"..."}'
```

PowerShell does not treat `'...'` the way sh does for embedded double quotes, and
`cmd.exe` does not honor single quotes at all - the JSON arrives split across argv or
with the quotes literal, and `JSON.parse` throws, yielding
"attest JSON is not valid JSON" (line 213) with no path forward. This is the single
biggest win32 blocker: the primary PABCD advancement verb cannot be driven from the
default Windows shell. It is also why #31's `--attest-file` is a correctness fix on
Windows rather than ergonomics.

Minimal fix: implement `--attest-file` (see #31 above) and make the win32 help/hook text
emit the file form. `hook.ts:1009` and the `ORCHESTRATE_HELP` block at
`orchestrate-cli.ts:157-173` should branch on `process.platform === "win32"` and show a
here-string/file example instead of the single-quoted JSON.

### B2. [P0] `redactPaths` corrupts output on Windows (double-replacement)
`plugins/codexclaw/components/cxc-ops/src/scouting-bundle.ts:30-42`

```ts
const normalizedHome = homeDir.split(sep).join("/");   // C:/Users/x
const windowsHome = homeDir.split("/").join("\\");     // C:\Users\x (unchanged input)
result = result.split(normalizedHome).join("~");
if (sep === "\\") result = result.split(windowsHome).join("~");
result = result.split(homeDir).join("~");              // third pass, same string
```

On win32 `homeDir` is `C:\Users\x`, so `windowsHome === homeDir` and the last two passes
are identical - harmless but dead. The real defect is that this is case-sensitive:
Windows paths routinely appear as `c:\users\x` (lowercased by tools) or with 8.3 short
names (`C:\Users\SUPER~1`), and none of those match, so **the home directory is not
redacted** in the scouting bundle that is meant to be shareable. Secrets scanning
(`scanForSecrets`, line 45) is unaffected, but path leakage is the stated purpose of this
function.

Minimal fix: build a case-insensitive matcher on win32. Replace the triple `split/join`
with a single regex built from the escaped home in both separator forms, using the `i`
flag when `process.platform === "win32"`. Additionally resolve
`realpathSync.native(homeDir)` once and redact that too, to cover the short-name form.

### B3. [P0] `process.env.HOME` is undefined on Windows
`plugins/codexclaw/components/cxc-ops/src/scouting-bundle.ts:75`

`const home = opts.homeDir ?? process.env.HOME ?? "";`

Windows sets `USERPROFILE`, not `HOME` (except under Git Bash). So `home` becomes `""`,
and `redactPaths(text, "")` then does `text.split("").join("~")` - **splitting on the
empty string explodes the string into individual characters and rejoins them with `~`
between every character**. Every section of the bundle becomes unreadable garbage of the
form `p~l~u~g~i~n`. This is a guaranteed-on-Windows total corruption, not a probabilistic
one.

Minimal fix: use `homedir()` from `node:os` (already imported in this file's neighbors)
instead of `process.env.HOME`, and add a defensive early return in `redactPaths` when
`homeDir` is empty. The empty-string guard is worth having regardless, since it turns a
silent corruption into a no-op.

### B4. [P1] `npm run dev` spawn fails with ENOENT on Windows (confirmed)
`bin/codexclaw.mjs:400`

`spawnSync("npm", ["run", "dev"], { cwd: guiDir, stdio: "inherit" })`

**Measured on this machine:** `spawnSync("npm", ["--version"])` returns
`error=ENOENT, status=null` even though both `npm` and `npm.cmd` are on PATH. Node's
`spawn` without `shell: true` does not apply PATHEXT to a bare `npm`, and the
extensionless `npm` on PATH is a shell script it cannot execute. So `cxc gui` fails after
already printing "starting the dashboard", and line 401 maps `status = null` to a bare
exit 1 with no explanation.

Contrast: `git` and `gh` both succeed here because they are `.exe`. The rule is that only
`.cmd`/`.bat` shims break, and `npm`/`npx`/`pnpm`/`yarn` are exactly that.

Minimal fix: `const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";` Do not
reach for `shell: true` here - that reintroduces quoting hazards on `guiDir` paths
containing spaces. Also surface `res.error.code === "ENOENT"` with an install hint,
mirroring the repo's own precedent at `bin/codexclaw.mjs:289-292`.

### B5. [P2] `gh` spawn is install-shape dependent; launch error misattributed
`plugins/codexclaw/components/skill-search/src/cli.ts:77-81`

**Measured on this machine:** `spawnSync("gh", ["--version"])` succeeds (`status=0`),
because the official GitHub CLI installs `gh.exe` and Node resolves `.exe` via PATHEXT.
Only `.cmd` shims (scoop, npm-wrapped distributions) fail. So the ENOENT risk here is
conditional, not guaranteed - which is why this is P2 and B4 is P1.

The unconditional defect is the diagnostic. Line 82 tests `res.status !== 0`, but a failed
launch sets `status = null` and populates `res.error`. Both paths print
"gh CLI missing or not authenticated", so a real ENOENT and an auth failure are
indistinguishable to the user.

Minimal fix: branch on `res.error?.code === "ENOENT"` for the install hint and reserve
the auth wording for a genuine non-zero exit. Optionally probe `gh.cmd` as a fallback.

### B6. [P1] `python3` hits the Store stub, exits 9009, and bypasses the ENOENT hint
`bin/codexclaw.mjs:274` (venv bootstrap), `bin/codexclaw.mjs:253` (ladder default),
`plugins/codexclaw/components/cxc-ops/src/doctor.ts:409` (ast-grep helper)

**Measured on this machine:** `spawnSync("python3", ["--version"])` returns
`error=none, status=9009`. It resolves to
`%LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe` - the Microsoft Store stub, a real
executable that exits 9009 without running Python. The `py` launcher is present at
`C:\Windows\py.exe`.

This is worse than a plain ENOENT. The guard at `bin/codexclaw.mjs:289-292` only prints
its "install Python 3.9+ or set CODEXCLAW_PYTHON" hint when `res.error.code === "ENOENT"`,
and there is no `error` here - just a non-zero status. So `cxc map` exits 9009 with **no
diagnostic at all**. Same shape for the venv bootstrap at line 274 (`mk.status === 0` is
false, so it silently skips) and the doctor ast-grep check at line 409 (WARNs, blaming a
missing helper).

Minimal fix: in `selectRepoMapCommand` (`bin/codexclaw.mjs:238`), make the final rung
platform-aware - on win32 prefer `py -3`, then `python`, then `python3`. That function is
pure and already test-covered offline, so this is contained plus a case in
`plugins/codexclaw/test/repo-map-packaging.test.mjs`. Separately widen the `runRepoMap`
failure branch (line 289) to fire the install hint on status 9009/127 too, so the
silent-exit case gains a message.

### B7. [P1] repomap venv python path is POSIX-only
`bin/codexclaw.mjs:259`

`return join(base, "venvs", "repomap", "bin", "python3");`

Windows venvs put the interpreter at `Scripts\python.exe`, never `bin/python3`. So
`hasVenv` (line 268) is always false on Windows, the opt-in bootstrap at 271-283 creates
a venv and then cannot find it (`pip.status` check at 277 also fails since `venvPython`
does not exist), and line 280 `rmSync` deletes the venv it just built. Every
`CODEXCLAW_MAP_BOOTSTRAP=1` run on Windows is a guaranteed create-then-destroy cycle.

Minimal fix: branch `repoMapVenvPython` on `process.platform`, returning
`join(base, "venvs", "repomap", "Scripts", "python.exe")` on win32. The function already
takes `env` and `home` as parameters for testability; add a platform parameter with a
`process.platform` default so the packaging test can assert both shapes.

### B8. [P2] Hard-coded `/tmp` in the hook bench
`plugins/codexclaw/scripts/hook-bench.mjs:64` (`cwd: "/tmp/bench-cwd"`) and `:85` (`cwd: "/tmp"`)

`/tmp` does not exist on Windows. Line 85 passes it as `spawnSync` `cwd`, which throws
ENOENT and fails the bench outright. Ironically line 114 already does the right thing:
`mkdtempSync(join(tmpdir(), "cxc-bench-"))`.

Minimal fix: replace both literals with `tmpdir()`-derived paths, reusing the `tmpHome`
pattern already in the file.

### B9. [P2] CRLF-blind parsers - 29 call sites split on `"\n"` only
Highest-impact instances (user-authored or foreign-tool text):

- `plugins/codexclaw/components/config-guard/src/multi-agent-v2.ts:56` - parses the user's
  `~/.codex/config.toml`. A CRLF file leaves `\r` on every line, so the table-header regex
  `/^\s*\[features\.multi_agent_v2\]\s*(?:#.*)?$/` still matches (`\s` eats `\r`), but
  `tomlBoolInBody` at line 66 uses `(true|false)\s*(?:#.*)?$` which also tolerates it.
  Fragile rather than broken - but the same file's `activate.ts:63` deliberately handles
  `\r?\n`, so the inconsistency is the real smell.
- `plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts:30` - same TOML parser,
  duplicated.
- `plugins/codexclaw/components/messenger-bridge/src/api-compat.ts:38` and
  `plugins/codexclaw/gui/src/server/middleware.ts:61` - `res.stdout.split("\n")[0].trim()`
  on `where` output. `where.exe` emits CRLF; `.trim()` saves it, but only by accident.
- `plugins/codexclaw/components/pabcd-state/src/comment-lint.ts:54` and
  `edit-shape.ts:83` - split `patchText` from an `apply_patch` tool payload. A CRLF patch
  leaves `\r` on each line, which corrupts the FILE-directive regex match at
  `edit-shape.ts:84` and the lint line content.
- Ledger/JSONL readers: `state.ts:381`, `metrics.ts:74`, `friction.ts:79`,
  `interview-ledger.ts:126`, `divergence.ts:205`, `render-observations.ts:84`,
  `recall/src/rollout.ts:215`. These read files this repo wrote with `\n`, so they are
  safe today; they break only if a Windows editor or `git config core.autocrlf=true`
  rewrites them.

Note `.gitattributes` is `* text=auto eol=lf`, which protects checked-in files but does
**not** protect runtime-generated state under `.codexclaw/` or the user's `config.toml`.

Minimal fix: sweep `.split("\n")` to `.split(/\r?\n/)` at the sites that read foreign
input (TOML, subprocess stdout, patch text) as one mechanical change; leave the
self-written JSONL readers alone or fix them in the same pass for consistency. The
precedent already exists at `attest.ts:116`, `orchestrate-grammar.ts:100`,
`review-round.ts:374`, and `output-formatter.ts:201`.

### B10. [P2] `memory-search` hand-rolls CR stripping instead of splitting correctly
`plugins/codexclaw/components/recall/src/memory-search.ts:202`

`content.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l))` - correct, but
it is a workaround for the pattern in B9, applied in exactly one place. Worth folding
into the same sweep so there is one idiom.

### B11. [P2] `rename`-over-existing can EPERM/EACCES on Windows
Atomic-write sites using `renameSync(tmp, finalPath)` over an existing destination:
`state.ts:305`, `goalplan.ts:542`, `metrics.ts:141`, `divergence.ts:126`,
`release-cli.ts:137`, `subagent-evidence.ts:148`, `subagent-config/src/store.ts:132`,
`cxc-ops/src/hook-trust.ts:356` (the bare `store.ts` here was read as `recall/src/store.ts` by
040; the file lives in `subagent-config` - all other entries are `pabcd-state/src/`)

POSIX `rename(2)` atomically replaces the destination. Windows `MoveFileEx` without
`MOVEFILE_REPLACE_EXISTING` fails, and even with it, the call fails with EPERM/EACCES when
another process holds an open handle on the destination - which is exactly the situation
here, since hooks fire concurrently (SessionStart, UserPromptSubmit, PreToolUse all touch
session state) and antivirus/Windows Search routinely hold transient handles on
just-written JSON. Node's `fs.renameSync` does pass `MOVEFILE_REPLACE_EXISTING`, so the
common case works; the failure is intermittent and load-dependent, which makes it a
nasty class of bug rather than a deterministic one.

Minimal fix: add a shared `renameWithRetry(tmp, final)` helper (small backoff, a few
attempts, retry only on `EPERM`/`EACCES`/`EBUSY`) in one place and route these eight call
sites through it. Note `state.ts:295-314` already has the tmp-cleanup `catch`, so the
helper slots in without changing error semantics.

### B12. [P2] `ensureState` relies on `linkSync` semantics
`plugins/codexclaw/components/pabcd-state/src/state.ts:200-209`

The exclusive-create publish uses `linkSync(tmp, finalPath)` and treats `EEXIST` as
"someone else won" (line 205). Hard links work on NTFS, but fail on FAT32/exFAT (USB
drives, some mounted shares) and across volumes, surfacing as `EPERM` or `ENOTSUP` rather
than `EEXIST` - which line 208 rethrows, and `ensureState` is called from the SessionStart
hook. A throw there kills session bootstrap.

Minimal fix: extend the catch to treat `EPERM`/`ENOTSUP`/`EXDEV` as a fallback signal and
retry with `writeFileSync(finalPath, ..., { flag: "wx" })`, mapping its `EEXIST` to the
same `return false`. Keep the `EEXIST` fast path unchanged so NTFS behavior is untouched.

### B13. [P2] POSIX-only process-tree termination
`plugins/codexclaw/components/messenger-bridge/src/runner.ts:263-274` and `:306-318`

`terminateChild` sends SIGTERM then escalates to SIGKILL only when
`process.platform !== "win32"` (line 268), and `signalProcessTree` falls back to
`child.kill(signal)` on Windows (line 317). Windows has no process groups and no real
signals; `child.kill()` terminates only the direct child, so a `codex` process that
spawned MCP helpers leaves orphans holding the pipe. The comment at 264-266 names exactly
this failure ("a grandchild can retain an inherited stdout/stderr descriptor and prevent
Node's close event") but the mitigation is POSIX-only. Consequence on Windows: the turn
timeout at line 355 fires, `terminateChild` runs, and the promise may still never settle.

Minimal fix: on win32, escalate via `taskkill /pid <pid> /T /F` (spawned with
`shell: false` and an argv array). Gate it behind the existing `SIGKILL_GRACE_MS` timer so
the grace semantics match POSIX.

### B14. [P3] `detectCodexVersion` regex is broken on every platform
`plugins/codexclaw/components/cxc-ops/src/doctor.ts:73`

`res.stdout.match(/(d+.d+.d+)/)` - the backslashes are missing, so this matches a literal
`d` followed by any char, `d`, any char, `d`. For `codex 1.2.3` there is no `d` sequence,
so it falls through to `res.stdout.trim()`. Not Windows-specific, but it is in the
doctor path that Windows users will lean on, and it is a one-character-class fix.

Minimal fix: `/(\d+\.\d+\.\d+)/`. Compare with the correct sibling at line 411
(`/ast-grep\s+(\d+\.\d+\.\d+)/`), which shows the intended form.

### B15. [P3] `friction.normalizeError` lowercases before matching Windows paths
`plugins/codexclaw/components/pabcd-state/src/friction.ts:44-49`

Line 44 lowercases, so the `[a-z]:\\` drive-letter pattern at line 48 works by
construction - fine. But line 49's `/(\/[^\s:]+)+/g` runs after and will also chew
forward-slash fragments inside an already-substituted `/PATH`, and UNC paths
(`\\server\share\...`) match neither pattern, so they survive into the signature.
Low impact (this only affects friction-signature stability), but UNC paths are common on
corporate Windows.

Minimal fix: add a UNC branch `/\\\\[^\s]+/g -> "/PATH"` before the drive-letter rule.

### B16. [P3] `worktree-guard` command parsing assumes POSIX shell syntax
`plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts:220-253` (`tokenize`),
`:262-277` (`stripPrefixes`), `:310-344` (`rm`/`rmdir` handling)

The guard tokenizes on POSIX quoting, strips `sudo`/`env`/`command`/`builtin`, and
recognizes `rm`, `rmdir`, `git worktree remove`. On Windows the destructive commands are
`Remove-Item`, `rd`, `del`, and `rmdir /s`, and PowerShell quoting differs (backtick
escapes, `@'...'@` here-strings). So the worktree-deletion guard - a safety control -
**does not fire for the native Windows forms**. `basename()` at line 256 does handle
backslashes, so path recognition itself is fine; it is the verb table that is POSIX-only.

[CORRECTION r1-20260821124445, folded pre-B] This section originally claimed partial
coverage via aliases and a swallowed `-LiteralPath` target. Both claims are FALSE and were
propagating into 100_closeout. Verified against source:

1. **Aliases do NOT reach the verb table.** Dispatch is `exe === "rm"` (:310) and
   `exe === "rmdir"` (:336) - exact string equality on the tokenized argv[0], which is
   whatever the user literally typed. Only the literal tokens `rm` and `rmdir` dispatch.
   `del`, `erase`, `ri`, `rd`, and `Remove-Item` have ZERO coverage today. (An alias is
   resolved by the PowerShell host, not by this guard, which reads the raw command
   string.) Coverage is zero for the Windows forms, not partial.
2. **`-LiteralPath` does NOT drop the target.** Trace `rm -LiteralPath C:\proj -Recurse`:
   `-LiteralPath` reaches :323, matches `/[rR]/` (the "r" in "Literal"), sets
   `recursive` and continues. The NEXT token `C:\proj` does not start with `-`, so :327
   pushes it to `targets`. The target is extracted. A value is lost only if it itself
   starts with `-`.

So the real defect is narrower in mechanism and WIDER in scope: the Windows verbs never
reach any branch. Value-parameter parsing remains worth doing (it stops `-Recurse` from
setting recursive by `r`-substring coincidence and handles `-Path <p>` properly), but as a
correctness improvement, not as a rescue of a swallowed target.

Minimal fix: add the Windows verbs in a SEPARATE branch after `rmdir`, and parse
PowerShell-style `-Recurse` / `-Force` / `-LiteralPath <p>` / `-Path <p>` there. Do NOT
merge `rm` and `rmdir` into one verb set: the `rm` branch requires `recursive` (:329)
while the `rmdir` branch denies with no recursive requirement (:336-341), and merging
them would stop `rmdir <protected-worktree>` from denying on every platform. Keep it
additive - the POSIX path must not change. Also extend `DESTRUCTIVE_HINT` (:375), which is
`rm|rmdir`-only and so leaves the conservative fallback at :402 blind to the Windows
verbs. See 100_closeout.md section 2 for the diff-level version.

### B17. [P3] `skill-search` splits remote paths with `split("/")`
`plugins/codexclaw/components/skill-search/src/cli.ts:96-98`,
`plugins/codexclaw/components/skill-search/src/sources.ts:73`

`dir.split("/").pop()` and `path.split("/")[0]`. These operate on GitHub API paths and
catalog markdown, which are always forward-slash, so this is **correct as written** and
listed only to mark it as deliberately-not-a-defect for the fix cycles. Do not "fix"
these to `path.sep`; that would break them.

Same for `manifest-targets.ts:100` (`parts.join("/")`), which builds a manifest-relative
reference, and `scouting-bundle.ts:32`/`memory-search.ts:282`, which deliberately
normalize `sep` to `/` for stable output.

### B18. [P3] `cxc gui` dependency probe and `plan init` output path
`bin/codexclaw.mjs:396` prints "Run \`npm install\` in plugins/codexclaw/gui first" with a
POSIX-looking relative path; `plan-cli.ts:123-127` returns `unitDir` (absolute) as `rel`,
so the success message prints a full `C:\Users\...` path where the variable name promises
a relative one. Cosmetic, but the `rel` naming is actively misleading for whoever fixes
#30 in the same file.

---

## C. Verified non-issues (do not "fix" these)

- **Hook manifests** (`plugins/codexclaw/hooks/*.json`) use
  `node "${PLUGIN_ROOT}/components/.../cli.js"` with forward slashes inside quotes. Node on
  Windows accepts forward slashes, and the path is quoted, so spaces are safe. Correct.
- **`cxc-resolve.ts:37,47`** already handles `WIN_EXTS` (`.cmd/.exe/.bat/.ps1`) and uses
  `path.delimiter` for the PATH split (line 48). This is the model the other spawn sites
  should follow.
- **`worktree-guard.ts:44`** uses `delimiter` for `CODEXCLAW_WORKTREE_ROOTS`. Correct.
- **`service.ts:228-288`** has a real Task Scheduler implementation, uses
  `process.env.SystemRoot`, writes a CRLF `.cmd` (line 245), and quotes paths. Solid.
- **`steering.ts:66-88`** uses `mkdirSync(dir, { recursive: false })` for locking, which is
  atomic on Windows too, and the comment says so. Correct.
- **`receipt-cli.ts:79`** uses `shell: false` with an argv array by design ("the recorded
  command must be the argv that actually ran"). Note the consequence: on Windows,
  `cxc receipt test -- npm test` hits the same `.cmd` problem as B4, but the fix belongs in
  a documented wrapper, not by turning on `shell: true` here.
- **All internal CLI delegation** (`bin/codexclaw.mjs:127-171`, `plugins/codexclaw/bin/cxc.mjs:96`)
  spawns `process.execPath` with an argv array. Immune to shell quoting. Correct.
- **`chmod`/`mode: 0o600`** usage is a silent no-op on Windows rather than an error, and
  `index-db.ts:74,93` already wraps it in try/catch with a "non-POSIX filesystem" comment.
  Acceptable as-is; the security posture is weaker on Windows but that is a platform
  limitation, not a code defect.

---

## D. Ranked defect list (fix-cycle order)

| # | Sev | Location | Problem |
|---|-----|----------|---------|
| 1 | P0 | `cxc-ops/src/scouting-bundle.ts:75` | `process.env.HOME` undefined on win32 -> `split("")` shreds the bundle |
| 2 | P0 | `pabcd-state/src/orchestrate-cli.ts:204` | `--attest` JSON unquotable in PowerShell; no file alternative (#31) |
| 3 | P0 | `cxc-ops/src/scouting-bundle.ts:30-42` | `redactPaths` case-sensitive + 8.3 blind -> home dir leaks |
| 4 | P1 | `pabcd-state/src/plan-cli.ts:54,110` | date prefix doubled; `_` mangled to `-` (#30) |
| 5 | P1 | `pabcd-state/src/goalplan-cli.ts:69,181` + `steering.ts:45` | criteria unregistrable post-init; `final-gate` verb advertised but absent (#29) |
| 6 | P1 | `pabcd-state/src/attest.ts:174-215` | early-return chain drip-feeds required fields (#31) |
| 7 | P1 | `bin/codexclaw.mjs:259` | venv python at `bin/python3`; win32 bootstrap self-destructs |
| 8 | P1 | `bin/codexclaw.mjs:400` | `spawnSync("npm")` ENOENT (needs `npm.cmd`) |
| 9 | P1 | `bin/codexclaw.mjs:253`, `doctor.ts:409` | `python3` absent on Windows; no `py -3` rung |
| 10 | P2 | `skill-search/src/cli.ts:82` | launch failure vs auth failure indistinguishable (status=null) |
| 11 | P2 | `messenger-bridge/src/runner.ts:263-318` | no win32 process-tree kill; orphans + hung turns |
| 12 | P2 | 8 sites (`state.ts:305` et al.) | `renameSync` over existing -> intermittent EPERM |
| 13 | P2 | `pabcd-state/src/state.ts:200-209` | `linkSync` publish throws on non-NTFS |
| 14 | P2 | `scripts/hook-bench.mjs:64,85` | hard-coded `/tmp` |
| 15 | P2 | 29 sites (B9) | `split("\n")` on TOML/stdout/patch text |
| 16 | P3 | `cxc-ops/src/doctor.ts:73` | version regex missing backslashes |
| 17 | P3 | `pabcd-state/src/worktree-guard.ts:310` | guard misses `Remove-Item`/`-LiteralPath` forms |
| 18 | P3 | `pabcd-state/src/friction.ts:48` | UNC paths survive normalization |

Suggested cycle grouping (10 PABCD units): (1) 1+3, (2) 2+6, (3) 4, (4) 5, (5) 7+9,
(6) 8+10, (7) 11, (8) 12+13, (9) 15+14, (10) 16+17+18.
