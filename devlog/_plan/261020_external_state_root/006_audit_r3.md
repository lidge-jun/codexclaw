# 006 — audit round 3 dispositions

Round 3 (research/04): FAIL on sync/writer exclusion, committed lock files and no-origin repos; #1/#4/#7 accepted, #6 accepted as residual. Overrides 004/005 where they differ.

1. Sync never replaces a file a writer may be appending to. New D11 procedure, all git calls with the routing vars removed and argv arrays:
   1. take `<base>/.cxc-sync.lock` (wx; stale-lock message names the file);
   2. snapshot: `git add -A`, commit if anything is staged (reads files only);
   3. `git fetch`; if no upstream → push skipped, done; if the remote is not ahead → push, done;
   4. merge in a throwaway linked worktree under the OS temp dir (`git worktree add --detach <tmp> HEAD`, `git merge --no-edit <upstream>`, `.gitattributes` `*.jsonl merge=union`); a conflict aborts the merge, removes the temp worktree and stops with exit 1, live files untouched;
   5. apply the merge to the live directory path by path (`git diff --name-status -z <snapshot> <merge>`): `*.jsonl` → append the merged lines that the live file lacks (append-only, safe next to concurrent appenders); any other added/modified/deleted path → atomic tmp+rename (or unlink) only if the live bytes still equal the snapshot blob (or the path is still absent); otherwise record a conflict. Any conflict stops before step 6, so the branch never claims a merge the live tree does not contain;
   6. `git reset --soft <merge>` (moves the branch only, the working tree is not touched), `git add -A`, commit if dirty (appends that arrived during the sync), `git push` (never `--force`);
   7. remove the temp worktree and the lock.
   Residual: a non-jsonl durable file rewritten by a writer between step 2 and step 5 is reported as a conflict and the sync is retried later; no data is overwritten.
2. Lock and scratch files are never committed: the base `.gitignore` written by sync lists `.cxc-sync.lock`, `.migrate.lock`, `*.tmp`, `.goalplan.lock/`, `.probe-*`; sync also refuses to stage if any of them is tracked.
3. No-origin git repos: explicit support-scope exception. Without an origin there is no owner and no stable cross-machine identity, so auto resolves to `local`: nothing becomes visible to git, but the state stays in the checkout and is not synced. `cxc state path` prints exactly that and how to opt in (`state.mode` / `CODEXCLAW_STATE_MODE=external`, which then keys the project by the hash of the shared git dir).
4. 005 #6 wording corrected: `cxc loop validate` does not cross-check the goalplan ledger; the residual is that such a gap is not reported automatically.
5. 005 #8 claim withdrawn: migrate's lock is not honored by hook writers, so a write between the IDLE check and the copy is possible. Residual, bounded by requiring every session in the checkout to be IDLE and by jsonl union on the destination; documented in the migrate output.
6. Tests add: sync with a concurrent appender (a child process appending to a ledger while sync merges a remote change) loses no line; sync conflict on a non-jsonl file leaves live bytes and the branch unchanged; lock files are ignored.

