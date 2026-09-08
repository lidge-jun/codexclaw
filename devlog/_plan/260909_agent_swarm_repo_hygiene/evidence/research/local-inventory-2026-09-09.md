# Local worktree/branch inventory — 2026-09-09 (Opus-5 subagent C, read-only)

Snapshot; not reproduced by a script. Numbers came from git worktree list --porcelain,
git status --porcelain -uno, git branch -vv, git merge-base --is-ancestor against
origin/dev|origin/main, gh pr list --state all (joined by headRefName), gh api repos.

| Item | opencodex | codexclaw | cli-jaw | ima2-gen |
|---|---|---|---|---|
| worktrees | 80 | 8 | 42 | 3 |
| under ~/.codex/worktrees | 21 | 1 | 27 | 2 |
| under /private/tmp or /var | 57 | 4 | 9 | 0 |
| dirty (-uno non-empty) | 5 | 0 | 20 | 0 |
| detached HEAD | 8 | 1 | 14 | 1 |
| locked | 0 | 0 | 6 | 0 |
| registered path missing | 0 | 0 | 4 (locked, reason recorded) | 0 |
| local branches | 314 | 27 | 173 | 16 |
| origin branches | 68 | 25 | 21 | 5 |
| no upstream | 153 | 5 | 78 | 7 |
| upstream gone | 94 | 1 | 66 | 7 |
| ancestor of dev/main | 66 | 22 | 97 | 10 |
| not ancestor | 248 | 5 | 76 | 6 |
| not ancestor but PR MERGED | 43 | 4 | 5 | 0 |
| not ancestor, no PR | 203 | 1 | 65 | 5 |
| open PR / open issue | 72 / 69 | 1 / 0 | 0 / 1 | 1 / 1 |
| fetch.prune | true | unset | unset | true |

Disk: ~/.codex/worktrees 30G; /private/tmp/{ocx,cj,cxc}-* 15G.
No crontab; 27 LaunchAgents, none for git cleanup; no worktree remove/prune scripts in repos.
Repo settings that day: opencodex auto-delete on / auto-merge on / rebase off; codexclaw
auto-delete off / auto-merge off; cli-jaw classic protection only; ima2-gen ruleset with
restrict-deletions only.
