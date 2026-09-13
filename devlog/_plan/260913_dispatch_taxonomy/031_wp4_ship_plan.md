# wp4 — P revalidation and ship plan

## Revalidation of 030

030 was written before the work existed. Two of its assumptions have moved.

The installed plugin cache was `0.2.24` when 030 was written. During this session
it changed to `0.2.25+codex.20260911171412` and back again, which broke every
hardcoded `cxc` path mid-run. Every CLI call since resolves the path with a glob.
The reinstall step must therefore verify by **content**, not by version string: the
new cache must contain `skills/pabcd/references/dispatch-surfaces.md`.

`origin/dev` and `origin/main` are both at `af445635`, so the promotion PR will
carry exactly this branch and nothing else. 030 warned about unrelated peer work
riding along; that risk is currently absent, and it is re-checked immediately
before promoting rather than assumed.

## The change being shipped

Eleven commits on `codex/dispatch-taxonomy-hardening`, based on `origin/dev`.
Six are plan documents, five are the change:

| Commit | What |
|---|---|
| `f42a1e4d` | the taxonomy reference and nine routing edits, plus DEV-STACK-08 |
| `1a781847` | the SessionStart clause compressed into its 600-character bound |
| `ac5f0e93` | the V1/V2 schema split, the capability fix, the leaf-guard text |

## Sequence

1. Add the `CHANGELOG.md` Unreleased entry. This is wp4's own source delta.
2. `npm run build`, `npm run gate`, `npm test` one final time at the shipping tree.
3. Push the branch.
4. Open the PR against `dev`. `enforce-pr-target` requires `dev` as the base for
   everything except the promotion.
5. Wait for hosted CI **at the head being merged**. A green run from an earlier
   push is not proof for a later head.
6. Merge into `dev`.
7. Open `dev` -> `main`, wait for its CI at that head, merge.
8. Verify `dev` still exists afterwards. `delete_branch_on_merge` deleted it once
   before, recorded in `devlog/_plan/260911_memory_recall_sweep/000_plan.md`.
9. Reinstall the local plugin from the merged `dev` and verify by content.

Steps 3 through 7 are external writes the user authorized for this task: push,
merge into dev, merge into main, and reinstall locally. Nothing beyond that list
is in scope — no release, no tag, no npm publish.

## What counts as done

- `c-4`: gate and suite pass at the shipping tree, with the pre-existing
  `gui/router.test.ts` react failure named rather than hidden.
- `c-5`: both merges landed, each with a CI conclusion recorded at the exact
  merged head.
- `c-6`: the new cache directory exists and contains `dispatch-surfaces.md`.

## Honest limits to state at D

This session loaded its plugin directives from the old cache. Reinstalling does
not retroactively change what this session is running under, and the new
SessionStart clause will first appear in a later session. Say that rather than
implying the running session picked up the new rules.
