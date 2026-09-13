# wp4 — Ship

## Sequence

1. `npm run gate` and `npm test` on the branch. Both must pass before the push;
   a documentation unit that breaks the gate is not shippable.
2. Push `codex/dispatch-taxonomy-hardening`.
3. Open the PR against `dev` — `enforce-pr-target` requires `dev` as the base for
   everything except the promotion PR.
4. Wait for hosted CI at the exact head. A green aggregate from an earlier push
   is not proof for the head being merged.
5. Merge into `dev`.
6. Open the promotion PR `dev` → `main`, wait for its CI, merge.
7. Reinstall the local plugin from the merged `dev` state and verify the
   installed version changed.

## Plugin reinstall

The installed cache is
`~/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619` while the
repository is already at `0.2.25`. The reinstall must therefore be verified by the
cache directory changing, not by the command exiting zero.

Steps: build the marketplace payload from the merged tree, install through the
plugin CLI with a cachebuster, then confirm `codex plugin list` reports the new
build and that the new cache directory holds
`skills/pabcd/references/dispatch-surfaces.md`. The last check is the one that
matters — it proves the new taxonomy actually reached the installed payload
rather than only the repository.

This session's own plugin directives still come from the old cache; a reinstall
does not retroactively change what this session loaded. Say so rather than
implying the running session picked up the new rules.

## Risk

Merging to `main` is a promotion of whatever is on `dev`, which may include peer
work that landed independently. Check `dev`'s commit range before promoting and
name anything unrelated that rides along, instead of describing the promotion as
if it carried only this unit.

`delete_branch_on_merge` has previously deleted `dev` on promotion (recorded in
`devlog/_plan/260911_memory_recall_sweep/000_plan.md`). Verify `dev` still exists
after the promotion merge and restore it from the merged commit if it is gone.

## Evidence to capture

- gate and test output with exit codes, and the receipt path from `cxc receipt test`
- the PR numbers, the merged head shas, and the CI conclusion at those heads
- `codex plugin list` before and after, plus the file listing inside the new cache
