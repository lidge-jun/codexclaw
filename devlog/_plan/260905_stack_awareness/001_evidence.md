# Evidence and root cause

Observed 2026-09-05; OpenCodex calls were read-only.

## Live versus pasted state

- The pasted #3595 page says Can Stack and has base `codex/orphan-image-carriers`, head `codex/cursor-tool-image-prep`. It is evidence of a branch chain and a registration offer, not confirmed native membership at that snapshot.
- `gh pr view 3595 -R lidge-jun/opencodex --json number,url,baseRefName,headRefName,headRefOid,state,isDraft,statusCheckRollup` confirms the same branch edge, head `01e3cfbeb08e55c9e0afd8ea15edbaafcc3fa79a`.
- `gh api 'repos/lidge-jun/opencodex/stacks?pull_request=3595'` returns stack **3656**, trunk `dev`, created `2026-09-05T11:45:27Z`, ordered members **3589, 3591, 3593, 3595, 3596**. This live state differs from the paste. This task did not create or modify it; do not attribute the outside mutation to this patch.
- `gh api 'repos/lidge-jun/opencodex/contents/.github/workflows/ci.yml?ref=dev' --jq .content | base64 -D`: `pull_request: {}`, push only `[main, preview, dev]`, concurrency `cross-platform-ci-${{ github.ref }}`, cancel-in-progress true. Different PR refs have different groups. Registration is not a top-only CI policy.
- Exact-head Actions query returned two Cross-platform CI `pull_request` runs at 06:30Z (`33949973809`, `33949973937`), both cancelled. The second run's aggregate `ci` check failed after macOS jobs were cancelled; Linux tests succeeded. These are not evidence that the stack topology caused cancellation; the cancellation actor/cause is not established here.
- Additional live probes: `/stacks?pull_request=3655` and `/stacks?pull_request=3570` each returned successful `[]`. #3655 targets `codex/provider-quota-parity`, head `codex/provider-ci-isolation-followup`, same repository. These remain concrete examples where base chaining alone is not native registration.
- A subsequent read of `/pulls/3595` included native `stack` metadata (number 3656, position 4, size 5) and a changed head `8d05059f82537f148c2d0ab4d5d5a1ad1f97a499`. The older CI above is a time-stamped snapshot, not proof for that new head. Outside activity is ongoing; no cause is inferred.
- `gh extension list` shows only `gh-copilot` on this host. No `gh stack` extension was installed for this investigation.

## Opened primary sources

- [About stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs): native CI applies to every layer; native stack merging/rebase behavior differs from plain branch chains.
- [Creating stacked PRs](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests): a matching base/head chain gets a recommendation banner; confirmation registers it. `gh stack submit` publishes and registers.
- [Stack REST API](https://docs.github.com/en/rest/pulls/stacks): read with GET `/repos/{owner}/{repo}/stacks?pull_request=N`; create with POST and bottom-to-top `pull_requests` array. Read errors are not an empty successful response.
- [Stack API/webhooks](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks): native membership is API-visible; workflow payload metadata can support separately designed policies.

## Repository cause and reuse

`skills/dev/references/stacked-prs.md` defines a portable branch chain but then unconditionally promises GitHub-native trunk protections/CI and top-PR whole-stack merges. Its tooling paragraph presents `gh pr create --base` as sufficient without a registration verification step. `dev` already has stacked keywords, so merely adding another keyword is not the fix.

`components/cxc-ops/src/map-affordance.ts` already emits compact global advice at SessionStart and PostCompact, but has no stack pointer. `dev-devops` is implicit-off by design and its only CI stack pointer names layer sizing. Reuse the existing global envelope; do not introduce a regex or network query on each prompt.

Pre-write searches: `stacked`, `DEV-STACK`, `implicit`, `renderBackgroundTerminal`, `runPostCompact`, `SessionStart`, `map-affordance`. Read the canonical owner, dev/devops routing, map-affordance and direct CLI consumer/tests, build/gate scripts and `structure/INDEX.md`. The sole new renderer belongs alongside existing affordance renderers, not in a new module.
