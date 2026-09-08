# 060 — Publish receipt (2026-09-09, wp6)

Status: DONE

Manual PR chain on lidge-jun/codexclaw, base `dev` @ 6e97e73d (unchanged from start to publish). No GitHub native stack: `gh api repos/lidge-jun/codexclaw/pulls/95` has no `stack` field; PRs were created with `gh pr create --base` only.

| # | PR | Base | Head branch | Head SHA | Checks | CI run | Packed install | WSL | Enforce target |
|---|----|------|-------------|----------|--------|--------|----------------|-----|----------------|
| 1 | #94 | dev | codex/agent-swarm-hygiene-l1 | 46a9bc9d | 11 pass | 34257783590 | 34257783537 | 34257783562 | 34257820264 |
| 2 | #95 | l1 | codex/agent-swarm-hygiene-l2 | 3e7302ec | 11 pass | 34257787659 | 34257787703 | 34257787629 | 34257824607 |
| 3 | #96 | l2 | codex/agent-swarm-hygiene-l3 | 6ca0c3d8 | 11 pass | 34257793492 | 34257793661 | 34257793628 | 34257830060 |
| 4 | #97 | l3 | codex/agent-swarm-hygiene-l4 | f2b29e86 | 11 pass | 34257795555 | 34257795623 | 34257795584 | 34257838159 |

Chain proof (run before push, same SHAs): `git merge-base --is-ancestor` exit 0 for
origin/dev→l1, l1→l2, l2→l3, l3→l4.

Pre-declared interaction (000_plan, 050): `enforce-pr-target.yml` prefixed #95, #96, #97
titles with `[WRONG BRANCH] ` and commented; its draft conversion was refused by the
default token (`autoDraftedByBot:false`), so all four PRs remain ready for review. The
check itself passed on every layer. The user's async question on how to handle this
(exemption in L1 / leave / all-against-dev) was not answered during the loop; no
exemption was added.

Each PR body carries the DEV-STACK-03 stack table and a Depends-on line (#95-#97).

Merge is NOT authorized in this session (NEEDS_HUMAN). Landing order: #94 → #95 → #96 →
#97, retargeting each child to `dev` after its parent lands (manual chain, DEV-STACK-04).

