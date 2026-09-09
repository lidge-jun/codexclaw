# 050 — Publish: stacked PR chain and CI verification

Status: PLANNED
Branches: L1..L4 as in 000_plan; remote `origin` = lidge-jun/codexclaw
Class: C3 (external state: push + PR creation, both user-authorized 2026-09-09; merge NOT authorized)

## Preconditions

- L1..L4 tips each pass gate + catalog tests (receipts from wp2-wp5 C phases).
- Chain proof: `git merge-base --is-ancestor l1 l2 && ... l3 l4` exit 0.
- Fresh `git fetch origin dev`; if `dev` moved, rebase L1 onto it with
  `git rebase --update-refs` so L2-L4 cascade (DEV-STACK-02), re-run tests, re-prove
  chain.
- Hooks: check `git config core.hooksPath` and `.husky` in codexclaw; push with hooks
  as configured. `--no-verify` is not assumed for this repository; if a hook blocks,
  report the text and ask.
- `enforce-pr-target.yml` (`pull_request_target`, exempts only `dev -> main`) will
  prefix `[WRONG BRANCH] `, draft and comment on L2-L4 because their bases are chain
  branches. Expected; recorded in the receipt. If the user's async answer selected the
  L1 exemption, that change is a P-phase amendment to 010 before wp2 B; if it selected
  all-against-dev, the chain becomes four PRs on `dev` with body-only dependency notes
  and this doc is amended.

## Steps

1. `git push -u origin codex/agent-swarm-hygiene-l1` then l2, l3, l4 (in order).
2. Create PRs bottom-up with explicit `--base`:
   - L1: `gh pr create --base dev --head codex/agent-swarm-hygiene-l1 --title "<010 thesis>" --body-file <tmp>`
   - L2: `--base codex/agent-swarm-hygiene-l1`; L3: `--base ...-l2`; L4: `--base ...-l3`.
   Bodies from a template file written to `mktemp`, containing the DEV-STACK-03 stack
   table (filled after all four numbers are known — create L1 first, then edit bodies
   with `gh pr edit --body-file` once numbers exist), "Depends on #<n>. Review this
   PR's diff only.", a one-paragraph problem/result summary per the PR-description
   rules, and the validation line (gate + catalog exit 0 at `<sha>`).
3. Verify: `gh pr view <n> --json baseRefName,headRefOid,isCrossRepository` for each;
   for DEV-STACK-06 record that the PRs were created with `gh pr create --base` only and
   no native registration command was run; read `gh api repos/lidge-jun/codexclaw/pulls/<n>`
   and note whether a `stack` field is present (absent or empty = manual chain).
4. CI: `gh pr checks <n> --watch` per PR; record run IDs and conclusions on the final
   head SHA. `ci.yml` runs on bare `pull_request:` (no base filter), so every layer gets
   its own run (DEV-STACK-07). `enforce-pr-target` will report on L2-L4 as above.
5. Record PR numbers, head SHAs, run IDs in `evidence/060_publish_receipt.md` and meet
   criterion c-5 with that path.

## Outcomes

DONE: four open PRs, chain proven, CI (or documented local equivalent) green on final
heads. NEEDS_HUMAN: merge. BLOCKED: push refused by hook/ruleset — report the exact
refusal text; do not `--no-verify` without the user's stated preference for this repo.

## Accept criteria

| # | Criterion | Evidence |
|---|---|---|
| A1 | `gh pr list` shows 4 open PRs with the planned bases; L2-L4 may carry the enforcer's title prefix and draft state | command output |
| A2 | Each body has the stack table and Depends-on line (survives the enforcer's title edit) | `gh pr view --json body` grep |
| A3 | Chain ancestry proven on pushed SHAs | command exit codes |
| A4 | CI conclusion recorded per final head, or trigger limitation quoted | receipt |
