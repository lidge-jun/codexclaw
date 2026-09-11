# 045 — wp8 / L6 / #109 split-cwd source separation

Branch `codex/fix-split-cwd-source`, base **L5** (`codex/windows-landmine-sweep`, `3cdb6c86`).
Criterion **c-8**. Work class **C4**: this layer touches the evidence chain.

Revision 2. Revision 1 was audited and returned FAIL on three blockers, all folded here:
its `resolveSessionSource` snippet silently dropped a re-point detection clause, its
negative-control test asserted the wrong refusal, and its reproduction omitted the
`session bind` that `session source` requires.

## 1. The problem, stated correctly

#109's own diagnosis is inverted. It says `--cwd` applies to the FSM but git reads the
process cwd. The code is the opposite: `--cwd` reaches git through
`captureSessionSourceIdentity(args.cwd)`, which calls `resolveSessionSource` and then
`captureSourceIdentity(sourceCwd)`. With no binding `resolveSessionSource` returns `cwd`
unchanged, so `--cwd` **is** the git cwd. That is exactly why git fails: the FSM directory
is not a repository. Propagating `--cwd` harder changes nothing.

The real gap is that the one mechanism designed to separate them refuses this shape.

## 2. Why `cxc session source` cannot express it today

`session-source.ts:102-105`, inside `bindSessionSource` (`:98`):

```ts
  const nativeCwd = canonical(cwd);
  const sourceRoot = canonical(target);
  const native = gitIdentity(cwd), source = gitIdentity(sourceRoot);
  if (source.root !== sourceRoot || source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
    throw new Error("Source must be a linked worktree root in the native session's repository.");
  }
```

Two independent blocks:

1. `gitIdentity(cwd)` **throws** when the native cwd is not a repository, so the call dies
   before any comparison runs.
2. Even surviving that, `source.commonDir !== native.commonDir` demands a linked worktree of
   the **same** repository. A non-git parent holding an unrelated git child can never
   satisfy it.

The same asymmetry is in `resolveSessionSource` (`:80-95`), which re-derives
`gitIdentity(cwd)` at `:88` on every resolve.

## 3. Options

### Option A — a per-command `--source-cwd` flag: rejected

It makes source identity a per-invocation argument. The B baseline and the C check would
be free to pass different values while `compareSource` reported `same`. That is a forgery
surface aimed at CHECK-BINDING-01, and it is **worse than the bug**: today the cycle
cannot close, which is safe; with Option A it can close on the wrong tree.

### Option B — widen `bindSessionSource` to accept a non-git native cwd: chosen

Keep one immutable, session-owned, on-disk binding. Relax only the premise that the
native cwd must itself be a repository. Everything downstream is already written for it:
`resolveSessionSource` returns the bound root, `captureSessionSourceIdentity` captures
against it with `excludeCodexclawArtifacts: true` and stamps `sourceRoot`, and the receipt
then carries a real commit sha.

It composes with L4 by construction. L4 refuses on an **unavailable source identity**
(`source-gate.ts`), so once the identity resolves, that gate switches itself off.

## 4. Change map

| file | NEW/MODIFY/DELETE | change |
|---|---|---|
| `pabcd-state/src/session-source.ts` | MODIFY | §5 — the probe, the widened bind guard, the conditional resolve clause |
| `pabcd-state/dist/session-source.js` | MODIFY | `npm run build`, already tracked |
| `pabcd-state/test/worktree-source-integration.test.ts` | MODIFY | the existing binding matrix lives here (`:209`), **not** in a `session-source.test.ts`, which does not exist |
| `pabcd-state/test/split-cwd-cycle.test.ts` | NEW | the c-8 positive path |

## 5. Design

### 5.1 A non-throwing native probe that does NOT swallow every git failure

Revision 1 wrapped `gitIdentity` in a bare `catch` returning `null`. The audit was right
that this is too broad: it would treat a **corrupt or unreadable** repository as "not a
repository" and then allow binding an unrelated repo, quietly relaxing the linked-worktree
guard for a case that has nothing to do with #109.

Discriminate instead. `git rev-parse --git-dir` succeeds inside any repository, including
one whose fuller identity resolution failed, so it separates "no repo here" from "repo is
broken":

```ts
/**
 * Native-side git identity, or null ONLY when the native cwd is genuinely not inside a
 * repository.
 *
 * #109: an FSM directory need not be a repository. When it is one, the existing
 * linked-worktree rule applies unchanged. When it is not, there is no `commonDir` to
 * compare against and the only meaningful requirement is that the target is a
 * repository root. `gitIdentity` keeps throwing for the SOURCE, where a repository is
 * mandatory.
 *
 * The discriminator matters: a bare catch would also swallow a corrupt or unreadable
 * repository and then let an UNRELATED repo be bound as this session's source, relaxing
 * the linked-worktree guard for a reason that has nothing to do with #109.
 * `rev-parse --git-dir` succeeds inside any repository, so a failure there is the
 * canonical "not a repository" signal; anything else is rethrown.
 */
function nativeGitIdentity(cwd: string): { root: string; commonDir: string; gitDir: string } | null {
  try {
    return gitIdentity(cwd);
  } catch (err) {
    try {
      execFileSync("git", ["rev-parse", "--git-dir"], { cwd, env: gitEnvForProbe(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return null; // not inside a repository at all
    }
    throw err; // inside a repository, but its identity could not be resolved
  }
}
```

Reuse whatever env sanitisation `gitIdentity` already applies (it strips `GIT_DIR`,
`GIT_WORK_TREE`, `GIT_COMMON_DIR`, `GIT_INDEX_FILE` at `:27-29`); extract it rather than
re-inlining, so the probe cannot be redirected by a stray `GIT_DIR`.

### 5.2 The widened bind guard

before (`session-source.ts:102-105`) — quoted in §2.

after:

```ts
  const native = nativeGitIdentity(cwd), source = gitIdentity(sourceRoot);
  if (source.root !== sourceRoot) {
    throw new Error("Source must be the root of a Git repository or worktree.");
  }
  if (native) {
    // Unchanged contract for a git native cwd: same repository, different worktree.
    if (source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
      throw new Error("Source must be a linked worktree root in the native session's repository.");
    }
  } else {
    // #109: non-git native cwd. There is no repository to be a worktree OF, so the root
    // check above is the whole requirement -- EXCEPT that the source must not contain the
    // FSM directory. captureSourceIdentity excludes only `.codexclaw/`
    // (source-identity.ts excludeCodexclawArtifacts), so binding an ANCESTOR of the FSM
    // directory would sweep the session's own siblings into the certified tree and
    // silently widen what the receipt attests to.
    if (nativeCwd === sourceRoot || nativeCwd.startsWith(sourceRoot + sep)) {
      throw new Error("Source root must not contain the session's own working directory; bind the repository itself, not an ancestor of it.");
    }
  }
```

Import `sep` from `node:path`. Both sides of the containment test are `canonical()`
output (`:23-25`, `realpathSync.native`), so Windows extended-length and 8.3 aliases are
already normalised — a raw string prefix comparison would be unsound on this platform.

### 5.3 `resolveSessionSource` — make ONE clause conditional, not three

Revision 1's snippet dropped `source.commonDir !== binding.commonDir` along with the native
clause. That is the blocker the audit caught: on a non-git native it would stop detecting
a **re-pointed source**. All three source-side clauses stay; only the native one is
conditional.

before (`session-source.ts:88-93`):

```ts
  const native = gitIdentity(cwd);
  const source = gitIdentity(binding.sourceRoot);
  if (source.root !== binding.sourceRoot || source.commonDir !== binding.commonDir
      || source.gitDir !== binding.gitDir || native.commonDir !== binding.commonDir) {
    throw new Error("Bound source worktree moved or its repository identity changed.");
  }
```

after:

```ts
  const native = nativeGitIdentity(cwd);
  const source = gitIdentity(binding.sourceRoot);
  // The three SOURCE clauses are what detect a moved or re-pointed source worktree and
  // stay unconditional. Only the NATIVE clause is conditional, because a non-git native
  // cwd has no commonDir to compare (#109).
  if (source.root !== binding.sourceRoot || source.commonDir !== binding.commonDir
      || source.gitDir !== binding.gitDir
      || (native !== null && native.commonDir !== binding.commonDir)) {
    throw new Error("Bound source worktree moved or its repository identity changed.");
  }
```

## 6. What is deliberately NOT changed

- `check-gate.ts` and `receipt-cli.ts`: untouched. `unavailable` still refuses.
- `compareSource`: untouched. `unavailable` vs `unavailable` is still never `same`.
- The binding stays **immutable** and session-owned, and still cannot be created after B
  (the `["IDLE","I","P","A"]` phase guard at `:106-118`).
- `GIT_*` sanitisation: untouched, and the new probe inherits it.
- `excludeCodexclawArtifacts: true` on the bound path: untouched.

An independent reviewer confirmed there is no CHECK-BINDING-01 bypass here: this layer
makes a real git identity **reachable**, and never makes an absent one acceptable.

## 7. Tests

### 7.1 MODIFY `test/worktree-source-integration.test.ts` — acceptance matrix

The existing binding matrix is in this file (around `:209`). Extend it:

| native cwd | target | expected |
|---|---|---|
| not a repo | git root, sibling of the FSM dir | accepted |
| not a repo | git root nested **under** the FSM dir | accepted |
| not a repo | a **subdirectory** of a repo, not its root | rejected, "root of a Git repository" |
| not a repo | an **ancestor** directory containing the FSM dir | rejected, "must not contain" |
| repo | linked worktree, same repo | accepted (unchanged) |
| repo | unrelated repo root | rejected (unchanged) |
| **repo present but identity unresolvable** | any | **throws, not treated as non-git** (§5.1) |
| any | relative path | rejected (unchanged) |
| any | a second, different target after binding | rejected, immutable (unchanged) |

The seventh row is the §5.1 discriminator. Without it, a later "simplify the catch"
refactor silently re-opens the linked-worktree guard.

### 7.2 NEW `test/split-cwd-cycle.test.ts` — the c-8 positive path

Fixture: a temp directory that is **not** a repository, containing a `src/` child that is
`git init` with one commit.

**`session bind` comes first.** `session-cli.ts:96` refuses `session source` when the
session has no state, so revision 1's ordering would have failed for a reason unrelated to
#109 and looked like a c-8 failure. Either drive `session bind` first or seed the state
file directly; the test must not depend on a native Codex thread existing.

1. Seed session state, then `cxc session source <fsm>/src --json` succeeds.
2. `loop init --session <id>` succeeds. **This is the L4/L6 composition assertion**: under
   L4 the same call in this directory is refused, and it passes here only because the
   binding made the source identity resolvable.
3. `orchestrate P → A → B → C` with real attests.
4. `cxc receipt test --session <id> -- <trivially passing command>` writes a receipt, exit 0.
5. **Assert the receipt's `sourceIdentity.kind` is not `unavailable` and its `commitSha`
   equals `git -C <fsm>/src rev-parse HEAD`.** This is the criterion. A receipt that
   merely exists does not satisfy c-8.
6. `orchestrate D` with `testReceiptPath` closes to IDLE.

### 7.3 The negative control — assert the RIGHT refusal

Revision 1 mutated the tree between B and the check and expected `receipt test` to say
`changed the source while running`. The audit showed that is a different assertion:
that message fires when the command mutates the tree **during** its own run
(`receipt-cli.ts:154`), and a mutation made *before* `receipt test` starts leaves its
before/after snapshots equal, so it passes.

Two separate controls, each aimed at its real gate:

- **During-run mutation** → `receipt test` refuses with `changed the source while running`.
  Use a check command that writes a tracked file.
- **Between-check-and-D mutation** → `C→D` refuses via `check-gate.ts:77`, the
  "source changed after the check ran" path. Write the receipt first, then mutate a
  tracked file, then attempt `orchestrate D`.

Together they prove staleness detection survived the separation. Revision 1 proved neither.

## 8. Reproduction (parent fails, L6 head passes)

```powershell
$fsm = Join-Path $env:TEMP ("cxc-split-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $fsm | Out-Null
New-Item -ItemType Directory -Path (Join-Path $fsm "src") | Out-Null
cd (Join-Path $fsm "src")
git init -q; "x" | Set-Content -Encoding utf8 a.txt; git add a.txt
git -c user.name=t -c user.email=t@t commit -q -m init
cd $fsm
# session state must exist BEFORE `session source`: session-cli.ts:96 refuses otherwise,
# and that failure has nothing to do with #109. In a standalone terminal the id is `cli`.
cxc session bind --session cli
cxc session source (Join-Path $fsm "src") --json
```

On the L5 head that last command fails with `Source must be a linked worktree root in the`
`native session's repository.` — or, before L4, `gitIdentity(cwd)` throws first. On the L6
head it succeeds, and the full bound cycle closes with a receipt carrying the `src` HEAD sha.

## 9. Regression risk

Highest in this stack. The guard being widened decides which tree a receipt certifies.

- **Widening too far.** `source.root !== sourceRoot` is retained and now runs
  unconditionally, so a subdirectory can never be bound. §7.1 row 3 pins it.
- **Binding an ancestor.** The FSM directory would then be inside the certified tree, and
  its siblings would enter the identity, since `excludeCodexclawArtifacts` only excludes
  `.codexclaw/`. Explicit rejection plus §7.1 row 4.
- **Swallowing a broken repository.** §5.1's discriminator plus §7.1 row 7.
- **Losing re-point detection.** All three source clauses stay in §5.3; this was revision
  1's blocker.
- **Losing staleness detection.** §7.3's two controls, each on its real gate.
- **Weakening the `unavailable` refusal.** Nothing in the gate files is touched; §6 lists
  what stays.

## 10. Criterion

**c-8**: a goalplan-bound session whose FSM directory is not a git repository but whose
source tree is, completes P through D and the written receipt carries a real commit sha
rather than an unavailable identity. Proved by §7.2 steps 5 and 6, with step 2 proving
L4/L6 composition and §7.3 proving staleness detection survived.
