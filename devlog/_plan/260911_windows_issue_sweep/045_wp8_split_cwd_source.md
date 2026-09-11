# 045 — wp8 / L5 / #109 split-cwd source separation

Branch `codex/fix-split-cwd-source`, base L4 (`codex/fix-nongit-early-refusal`).
Criterion **c-8**. Work class **C4**: this layer touches the evidence chain.

## 1. The problem, stated correctly

#109's own diagnosis is inverted, and building to it would produce the wrong fix.

The issue says `--cwd` applies to the FSM but git reads the process cwd. The code is the
opposite. `--cwd` reaches git through `captureSessionSourceIdentity(args.cwd)`, which
calls `resolveSessionSource` and then `captureSourceIdentity(sourceCwd)`:

```ts
// session-source-identity.ts
export function captureSessionSourceIdentity(cwd: string, sessionId: string, options: CaptureOptions = {}): SourceIdentity {
  const sourceCwd = resolveSessionSource(cwd, sessionId);
  const identity = captureSourceIdentity(sourceCwd, sourceCwd === cwd ? options : { excludeCodexclawArtifacts: true, ...options });
  return sourceCwd === cwd ? identity : { ...identity, sourceRoot: sourceCwd };
}
```

With no source binding `resolveSessionSource` returns `cwd` unchanged, so `sourceCwd === cwd`
and `--cwd` **is** the git cwd. That is precisely why git fails: the FSM directory is
not a repository. Propagating `--cwd` harder changes nothing.

The real gap is that the one mechanism designed to separate them refuses this shape.

## 2. Why `cxc session source` cannot express it today

```ts
// session-source.ts, bindSessionSource
const native = gitIdentity(cwd), source = gitIdentity(sourceRoot);
if (source.root !== sourceRoot || source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
  throw new Error("Source must be a linked worktree root in the native session's repository.");
}
```

Two independent blocks:

1. `gitIdentity(cwd)` **throws** when the native cwd is not a repository. #109's FSM
   directory is not one, so the call dies before any comparison runs.
2. Even surviving that, `source.commonDir !== native.commonDir` demands the target be a
   linked worktree of the **same** repository. A non-git parent holding an unrelated
   git child has no shared `commonDir` and can never satisfy it.

The same asymmetry exists in `verifyBinding` (`session-source.ts:91`), which re-derives
`native.commonDir` on every resolve.

## 3. Options considered

### Option A — a per-command `--source-cwd` flag

Add `--source-cwd <path>` to `receipt test` and `orchestrate`, used for git while
`--cwd` stays the FSM.

**Rejected.** It makes source identity a per-invocation argument. The B→C baseline and
the C→D check would be free to pass different values, and `compareSource` would then
be comparing two different trees while reporting `same`. That is a forgery surface
aimed straight at CHECK-BINDING-01, and it is worse than the bug: today the cycle
cannot close, which is safe; with Option A it can close on the wrong tree. It also
duplicates a binding that is already supposed to be immutable and session-owned.

### Option B — widen `bindSessionSource` to accept a non-git native cwd (**recommended**)

Keep exactly one immutable, session-owned, on-disk binding. Relax only the premise
that the native cwd must itself be a repository. When it is not, accept a target that
is a git **root** in its own right.

Everything downstream is already written for this: `resolveSessionSource` returns the
bound root, `captureSessionSourceIdentity` captures against it with
`excludeCodexclawArtifacts: true` and stamps `sourceRoot`, and the receipt then carries
a real commit sha. No gate is loosened; a previously unreachable input becomes
reachable.

It also composes with L4 by construction: L4 refuses on an **unavailable source
identity**, and after this binding the identity resolves, so L4 stops firing without
knowing anything about split cwds.

## 4. Change map

| file | NEW/MODIFY/DELETE | change |
|---|---|---|
| `plugins/codexclaw/components/pabcd-state/src/session-source.ts` | MODIFY | `gitIdentity` gains a non-throwing probe; `bindSessionSource` and `verifyBinding` accept a non-git native cwd |
| `plugins/codexclaw/components/pabcd-state/src/session-cli.ts` | MODIFY | `session source` error text names the new accepted shape |
| `plugins/codexclaw/components/pabcd-state/dist/*.js` | MODIFY | `npm run build` |
| `plugins/codexclaw/components/pabcd-state/test/session-source.test.ts` | MODIFY | binding acceptance/rejection matrix for a non-git native |
| `plugins/codexclaw/components/pabcd-state/test/split-cwd-cycle.test.ts` | NEW | the c-8 positive path, end to end |

## 5. Design detail

### 5.1 A non-throwing native probe

`gitIdentity` stays as-is for the source side, where a repository is mandatory. Add a
probe for the native side:

```ts
/**
 * Native-side git identity, or null when the native cwd is not a repository.
 *
 * #109: an FSM directory need not be a repository. When it is one, the existing
 * linked-worktree rule applies unchanged. When it is not, there is no `commonDir`
 * to compare against and the only meaningful requirement is that the target is a
 * repository root. `gitIdentity` keeps throwing for the SOURCE, where a repository
 * is mandatory.
 */
function nativeGitIdentity(cwd: string): { root: string; commonDir: string; gitDir: string } | null {
  try { return gitIdentity(cwd); } catch { return null; }
}
```

The `catch` is safe because `gitIdentity` already pipes stderr (`session-source.ts:30`),
so a non-repository probe is silent.

### 5.2 The widened guard

before (`session-source.ts:100-104`):

```ts
  const native = gitIdentity(cwd), source = gitIdentity(sourceRoot);
  if (source.root !== sourceRoot || source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
    throw new Error("Source must be a linked worktree root in the native session's repository.");
  }
```

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
    // #109: non-git native cwd. There is no repository to be a worktree OF, so the
    // root check above is the whole requirement. Reject a source that would contain
    // the FSM's own .codexclaw tree: the identity capture excludes those artifacts,
    // but a source root ABOVE the FSM directory would also sweep in unrelated
    // siblings and silently widen what the receipt certifies.
    const fsmArtifacts = canonical(cwd);
    if (fsmArtifacts === sourceRoot || fsmArtifacts.startsWith(sourceRoot + sep)) {
      throw new Error("Source root must not contain the session's own working directory; bind the repository itself, not an ancestor of it.");
    }
  }
```

Import `sep` from `node:path`.

`commonDir` and `gitDir` are still recorded in the binding from the **source** side, so
`verifyBinding` keeps detecting a moved or re-pointed source worktree.

### 5.3 `verifyBinding` symmetry

`session-source.ts:91` compares `native.commonDir !== binding.commonDir`. With a non-git
native that comparison is meaningless and must be skipped, using the same probe:

```ts
  const native = nativeGitIdentity(cwd);
  if (source.root !== binding.sourceRoot
      || source.gitDir !== binding.gitDir
      || (native !== null && native.commonDir !== binding.commonDir)) {
    throw new Error("Bound source worktree moved or its repository identity changed.");
  }
```

Read the exact surrounding lines before patching; `:91` is the tail of a multi-line
condition.

### 5.4 Exact anchors, resolved at L4 head `96e9486a`

**Correction to §5.3's naming.** There is no `verifyBinding` function. The re-derivation on
every resolve lives in `resolveSessionSource` itself, and the comparison to relax is at
`session-source.ts:91`, the tail of a four-clause condition:

```ts
// session-source.ts:80-95
export function resolveSessionSource(cwd: string, sessionId: string): string {
  const binding = readBinding(cwd, sessionId);
  const pinned = readState(cwd, sessionId).boundSourceRoot;
  if (!binding) {
    if (pinned) throw new Error("Source binding is missing for the pinned worktree; restore the same binding before continuing.");
    return cwd;
  }
  if (pinned && binding.sourceRoot !== pinned) throw new Error("Source binding differs from the session's pinned worktree.");
  const native = gitIdentity(cwd);
  const source = gitIdentity(binding.sourceRoot);
  if (source.root !== binding.sourceRoot || source.commonDir !== binding.commonDir
      || source.gitDir !== binding.gitDir || native.commonDir !== binding.commonDir) {
    throw new Error("Bound source worktree moved or its repository identity changed.");
  }
  return binding.sourceRoot;
}
```

Note `:88`: `gitIdentity(cwd)` **throws** for a non-git native cwd, so resolve fails before
the comparison is even reached. Both `:88` and the `native.commonDir` clause at `:91` must
become conditional, and the other three clauses must stay — they are what detect a moved
or re-pointed source.

**`bindSessionSource`** is `:98`, and the guard to widen is `:102-105`:

```ts
  const nativeCwd = canonical(cwd);
  const sourceRoot = canonical(target);
  const native = gitIdentity(cwd), source = gitIdentity(sourceRoot);
  if (source.root !== sourceRoot || source.commonDir !== native.commonDir || source.gitDir === native.gitDir) {
    throw new Error("Source must be a linked worktree root in the native session's repository.");
  }
```

`canonical()` already exists at `:22-24` using `realpathSync.native`, so the ancestor
comparison in §5.2 gets Windows extended-length and 8.3 handling for free. `gitIdentity`
is `:26` and already pipes stderr and strips `GIT_DIR`/`GIT_WORK_TREE`/`GIT_COMMON_DIR`/
`GIT_INDEX_FILE`, so the non-throwing probe can wrap it without losing either property.

The immutability path (`:106-110`) and the phase guard are downstream of the widened
check and need no change.

## 6. What is deliberately NOT changed

- `check-gate.ts` and `receipt-cli.ts`: untouched. `unavailable` still refuses.
- `compareSource`: untouched. `unavailable` vs `unavailable` is still never `same`.
- The binding remains **immutable** and session-owned, and still cannot be created
  after B (`["IDLE","I","P","A"]` phase guard).
- `GIT_ROUTING_VARS` sanitisation in `gitEnv()`: untouched, so a stray `GIT_DIR` cannot
  redirect the capture.
- `excludeCodexclawArtifacts: true` on the bound path: untouched, so FSM bookkeeping
  never registers as a source change.

This layer makes a real git identity **reachable**. It does not make an absent one
acceptable.

## 7. Tests

### 7.1 MODIFY `test/session-source.test.ts` — acceptance matrix

| native cwd | target | expected |
|---|---|---|
| not a repo | git root, sibling of the FSM dir | accepted |
| not a repo | git root nested **under** the FSM dir | accepted |
| not a repo | a **subdirectory** of a repo, not its root | rejected, "root of a Git repository" |
| not a repo | an **ancestor** directory containing the FSM dir | rejected, "must not contain" |
| repo | linked worktree, same repo | accepted (unchanged) |
| repo | unrelated repo root | rejected (unchanged) |
| any | relative path | rejected (unchanged) |
| any | second, different target after binding | rejected, immutable (unchanged) |

### 7.2 NEW `test/split-cwd-cycle.test.ts` — the c-8 positive path

This is the test whose absence let #109 sit open. Fixture: a temp directory that is
**not** a repository, containing a `src/` child that is `git init` with one commit.

1. `loop init --session <id>` in the FSM dir. Under L4 this refuses, so the test binds
   first: `cxc session source <fsm>/src --json`, then `loop init` succeeds. **This
   ordering is the L4/L5 composition assertion** — it proves the two layers compose
   rather than contradict.
2. `orchestrate P → A → B → C` with real attests.
3. `cxc receipt test --session <id> -- <trivially passing command>` writes a receipt,
   exit 0.
4. **Assert the receipt's `sourceIdentity.kind` is not `unavailable` and its
   `commitSha` equals `git -C <fsm>/src rev-parse HEAD`.** This is the criterion. A
   receipt that merely exists does not satisfy c-8.
5. `orchestrate D` with `testReceiptPath` closes to IDLE.
6. Negative control: mutate a tracked file in `src/` between the B baseline and the
   check, and confirm `receipt test` still refuses with `changed the source while running`.
   Separation must not cost staleness detection.

## 8. Reproduction (parent fails, L5 head passes)

```powershell
$fsm = Join-Path $env:TEMP ("cxc-split-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $fsm | Out-Null
New-Item -ItemType Directory -Path (Join-Path $fsm "src") | Out-Null
cd (Join-Path $fsm "src")
git init -q; "x" | Set-Content -Encoding utf8 a.txt; git add a.txt
git -c user.name=t -c user.email=t@t commit -q -m init
cd $fsm
cxc session source (Join-Path $fsm "src") --json
```

On the L4 head that last command fails with `Source must be a linked worktree root in`
`the native session's repository.` (and on the pre-L4 parent, `gitIdentity(cwd)` throws
first). On the L5 head it succeeds, `cxc session current --json` reports `sourceCwd`
and `sourceIdentity`, and the full bound cycle closes with a receipt carrying the
`src` HEAD sha.

## 9. Regression risk

Highest in this stack. The guard being widened is the one that decides which tree a
receipt certifies.

- **Widening too far.** The `source.root !== sourceRoot` check is retained and now runs
  unconditionally, so a subdirectory can never be bound. §7.1 row 3 pins it.
- **Binding an ancestor.** The FSM directory would then be inside the certified tree,
  and its `.codexclaw` churn plus unrelated siblings would enter the identity. The
  explicit ancestor rejection plus §7.1 row 4 pin it.
- **Losing staleness detection.** §7.2 case 6 is the negative control.
- **Weakening the `unavailable` refusal.** Nothing in the gate files is touched; §6
  enumerates what stays.
- **`verifyBinding` drift.** Skipping the `commonDir` comparison for a non-git native
  must not skip the `gitDir`/`root` comparisons, which are what detect a re-pointed
  source. §5.3 keeps both.

A POSIX-only reviewer should note the ancestor test uses `canonical()` on both sides,
so `realpathSync.native` handles the Windows extended-length and 8.3 aliases that L2
addressed; a prefix comparison on raw strings would be unsound on this platform.

## 10. Criterion

**c-8**: a goalplan-bound session whose FSM directory is not a git repository but
whose source tree is, completes P through D and the written receipt carries a real
commit sha rather than an unavailable identity. Proved by §7.2 cases 4 and 5, with §7.2
case 1 additionally proving L4/L5 composition and case 6 proving staleness detection
survived.
