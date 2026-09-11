# 071 — wp8 receipt (integration: the stack is published and green)

## Conclusion

Seven pull requests are open on `lidge-jun/codexclaw`, bottom-up from `dev`, each
based on the layer below, **every one green on its own CI**. Nothing was merged.

| # | PR | branch | issues | checks |
|---|---|---|---|---|
| L0 | [#154](https://github.com/lidge-jun/codexclaw/pull/154) | `codex/memory-recall-roadmap` | — (roadmap) | 14 pass |
| L1 | [#155](https://github.com/lidge-jun/codexclaw/pull/155) | `codex/fix-recall-cwd-normalization` | #138 | 13 pass |
| L2 | [#156](https://github.com/lidge-jun/codexclaw/pull/156) | `codex/fix-memory-search-semantics` | #142, #143 | 13 pass |
| L3 | [#157](https://github.com/lidge-jun/codexclaw/pull/157) | `codex/fix-recall-cli-arg-hygiene` | #139, #140 | 13 pass |
| L4 | [#158](https://github.com/lidge-jun/codexclaw/pull/158) | `codex/fix-chat-index-freshness` | #144 | 13 pass |
| L5 | [#159](https://github.com/lidge-jun/codexclaw/pull/159) | `codex/fix-recall-intent-regex` | #137 | 13 pass |
| L6 | [#160](https://github.com/lidge-jun/codexclaw/pull/160) | `codex/fix-memory-write-gate` | #135, #136, #141 | 13 pass |

Ten issues, seven layers, zero merges. Merging is the user's.

## `dev` was read, never written

The publication plan's decision rule case 1 applied: `origin/dev` existed and its
commits were already contained in the chain, because the chain had been rebased onto
it during wp7's P phase. No push, no fast-forward, no force touched `dev`.

That rebase is worth recording. Mid-stack, the peer session merged its entire Windows
sweep into `dev` — seven commits including a `config-guard` change to `bin/cxc.mjs`,
a file L6 edits. Rebasing at wp7's P, with a clean tree and before the largest layer
existed, cost one command. Discovering it after L6 was written would have meant
resolving that collision inside the biggest diff in the stack.

## The gate this stack had not noticed

The published stack failed its first CI round on four layers, and the audit of the
**published** result is what caught it. The ubuntu lane measures the suite and runs
`inventory.mjs --check --tests <measured>`; the README badge has to match. Every
layer here adds tests, so in a stack every layer must publish its own cumulative
total.

The expectation was read from the CI log rather than guessed:

```text
published tests=3065 but the measured suite reported 3077 — run inventory.mjs --write --tests 3077
```

That confirmed the arithmetic, and the per-layer new-test counts came from the diffs:
12, 4, 16, 11, 2, 22. The top layer's estimate was off by one — measured 3133, not
3132 — and the measured number governs.

The first cascade attempt replayed the badge commits up the chain and conflicted on
the same README line in every layer. It was aborted rather than forced through: the
chain was rebuilt by cherry-picking each layer's original commits onto its new parent
and appending that layer's own badge commit. The rebuilt top differs from the
pre-cascade top by exactly three README lines, which is the check that no work was
lost in the rebuild.

## The repository policy conflicts with the requested shape

`Enforce PR target branch` requires every PR to target `dev`. L1-L6 legitimately
target the layer below, so the workflow prefixed their titles with `[WRONG BRANCH]`
and asked for retargeting. **Retargeting would dissolve the stack**, so it was not
done, and each PR body says so. The workflow could not convert them to draft.

This is a real conflict between the repository's policy and a stacked delivery, and
it is the user's call: either the layers get merged bottom-up as they are, or the
policy grows an exception for a chain whose bottom targets `dev`.

## Evidence

- Ancestry verified pairwise from `origin/dev` upward after every rebase and after
  the cascade rebuild; each layer contains the one below.
- Each PR's diff carries only its own layer's commits; no `.codexclaw/`, no
  `node_modules`, no logs; every `dist/` change has a `src/` twin in the same PR.
- `Closes` mapping is unique: no issue is claimed by two layers.
- Privacy grep over the whole push range found no credentials, emails or transcript
  text. It did find Windows username paths and session ids in the devlog, which is
  the repository's existing convention — the same pattern is already on `dev` in the
  peer's unit and in older units.

## What did not improve

WSL never ran on any of these PRs: `wsl.yml` triggers on pushes to `main`,
`preview` and `dev`, so a stacked chain gets no WSL coverage until the bottom layer
lands. That is a gap in the evidence, not a passing check, and it is recorded here
rather than counted as green.

