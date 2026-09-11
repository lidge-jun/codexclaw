# 260911 Memory / recall sweep — roadmap

## Objective

Close the ten open codexclaw issues that the Windows issue sweep does not own —
#135, #136, #137, #138, #139, #140, #141, #142, #143, #144 — and deliver them as a
manual stacked branch chain based on `dev`, one PR per layer, merged bottom-up by
the user.

Host goal: `close-the-ten-open-codexclaw-issues-that-the-pee` (session
`01a0901a-b763-7e33-912d-f81565bcf7bd`). This unit is the Phase-0 docs-only pass
required by LOOP-DOCS-FIRST-01; its D locks the work-phase map below.

The open issue set at `6aae1c97` is fifteen. Peer session `01a08fba` owns the five
that reproduce as Windows execution defects (#109, #131, #132, #133, #134) under
`devlog/_plan/260911_windows_issue_sweep/`. This unit owns the other ten. The split
is by session, not by platform: several issues here also reproduce only on Windows.

## The base branch had to be restored first

`git ls-remote --heads origin` at the start of this unit returned exactly one ref:
`refs/heads/main` at `6aae1c97`. The `dev` branch was gone, deleted by GitHub's
`delete_branch_on_merge` when PR #145 (`dev` -> `main`) merged at 10:38Z.

That deletion contradicts the repository's own policy in two places:

- `.github/scripts/closed-pr-branch-cleanup.cjs:17` lists `dev` in
  `PROTECTED_BRANCHES` — but that module only governs branches of closed-unmerged
  PRs, so it never saw this one.
- `.github/workflows/enforce-pr-target.yml` requires `EXPECTED_BASE = "dev"` for
  every pull request except the `dev` -> `main` promotion. With `dev` absent, no
  compliant PR can be opened at all.

**Revision 2 correction.** While this unit was being written, peer session
`01a08fba` restored `dev` at `a267b398` — the last commit of the deleted branch,
not the promotion merge. `git ls-remote --heads origin` now returns `dev`,
`main`, `codex/win-sweep-roadmap` and `codex/fix-ocx-windows-detect`.

`a267b398` and `6aae1c97` carry the SAME tree (`904bbe09` for both), so the base
this unit was written against is byte-identical to the restored `dev`. The chain is
therefore rebased onto `origin/dev` and **this unit writes nothing to `dev`**: no
push, no fast-forward, no force. The earlier plan to restore `dev` at `6aae1c97`
is withdrawn — it is no longer needed, and fast-forwarding `dev` under a peer
session that is actively basing its own stack on it would be an unrequested
external change.

Repository setting `delete_branch_on_merge` remains a live trap for the next
promotion; it is recorded here, not fixed here, because changing repository
settings is outside this goal's authority.

## Constraints

- **No GitHub native stack.** The user asked for stacked PRs generically, which is
  not a DEV-STACK-OPT-IN-01 opt-in. Manual branch chain only: each PR's base is the
  branch below it.
- **Merging is the user's.** No merge, no auto-merge, no queue, at any layer.
- **Peer files are untouchable.** `provider-bridge/`, `session-binding.ts`,
  `config-guard/`, `source-identity.ts`, `session-source.ts` and the Windows
  landmine corpus belong to session `01a08fba`. If a layer here needs one of them,
  the layer stops and reports instead of editing.
- **Every layer stands alone.** Own thesis, own tests, own green CI at its own tip
  (DEV-STACK-03). No layer defers its tests upward.
- **Windows is the reproduction platform** for #135, #136, #138, #140 and #141.
  Shell work follows the `powershell-landmines` skill; every `orchestrate` attest
  uses `--attest-file`, never inline JSON.
- **Committed `dist` is per component.** `.gitignore:2` ignores `dist/`, and what is
  tracked is `plugins/codexclaw/components/*/dist/`. A layer that adds a NEW source
  file cannot stage its build output with a plain `git add`; it needs `git add -f`
  for that path.

## Out of scope

The five peer issues; any merge, release, deploy or plugin reinstall; repository
settings including `delete_branch_on_merge`; user credentials and codex config;
the `.codexclaw/` runtime state of other sessions; and PR #118, a cross-repo fork
PR that belongs to its author.

## Stack topology

Bottom to top. Each layer PR bases on the layer below; merge bottom-up.

| Layer | Branch | Base | Work-phase | Issues | Component |
|---|---|---|---|---|---|
| L0 | `codex/memory-recall-roadmap` | `dev` | wp1 | — (this unit) | docs |
| L1 | `codex/fix-recall-cwd-normalization` | L0 | wp2 | #138 | recall |
| L2 | `codex/fix-memory-search-semantics` | L1 | wp3 | #142, #143 | recall |
| L3 | `codex/fix-recall-cli-arg-hygiene` | L2 | wp4 | #139, #140 | recall |
| L4 | `codex/fix-chat-index-freshness` | L3 | wp5 | #144 | recall |
| L5 | `codex/fix-recall-intent-regex` | L4 | wp6 | #137 | recall |
| L6 | `codex/fix-memory-write-gate` | L5 | wp7 | #135, #136, #141 | pabcd-state |

wp8 adds no layer: it reads `origin/dev` without writing it, pushes the chain,
opens the seven PRs and turns every layer green.

Every decade doc was written against tree `904bbe09`, which is reachable as both
`6aae1c97` (main's tip) and `a267b398` (`origin/dev`). Where a layer doc says it
was written at `6aae1c97`, the tree is identical to the `a267b398` this chain is
actually based on; the SHAs differ, the content does not.

### Why a chain, and where it is genuinely required

The user asked for a stacked delivery, which is sufficient reason on its own. Two
couplings are real beyond that:

- **`memory-search.ts` is written by L2 and then L3.** L1 does NOT touch it: L1's
  change lands in `rollout.ts`, `index-search.ts` and `cwd-context.ts`, and
  `memory-search.ts` picks the corrected behaviour up through the helpers it
  already calls. Revision 1 listed L1 as a writer of that file; the audit rejected
  that and it is corrected here. `cli.ts` is written by L3 and then L4.
- **`hook.ts` is touched by L4 and L5 in different regions**: L4 rewrites the
  `noRefresh` banner path at `hook.ts:501-511`, L5 rewrites `RECALL_PATTERNS`
  at `hook.ts:78-116` (`detectRecallIntent` itself is `hook.ts:112-116`; the
  `기억해*` pattern L5 removes is `hook.ts:86`). One file, two writers, which is
  exactly the case where a manual chain is cheaper than two racing PRs.

L6 is genuinely independent: it lives in `pabcd-state` and shares no file with
L1-L5. It is chained anyway to honour the requested delivery shape, at the cost of
cascade work. If the user prefers, L6 can be cut loose and opened directly against
`dev` without touching the rest of the chain.

### Ordering rationale

L1 first because `normalizeCwd` is the shared primitive: #142's thread bookkeeping
and #144's staleness both read scoped results that L1 makes correct, and fixing it
later would force every layer above to re-verify its fixtures. L2 next because it
is the FIRST writer of `memory-search.ts` and L3 is the second, so that file is
opened and finished low in the stack before L3 and L4 move on to `cli.ts`. L3
before L4 because #144 adds new fields to the
same `--status` output path that #139 first makes safe to call. L5 after L4 because
both write `hook.ts`. L6 last because it is the only layer outside `recall` and
therefore the only one that can be reordered or detached without a cascade.

## Dependency-ordered work-phase map

- **wp1 — L0, docs-first roadmap (this unit).** `000_plan.md` plus one diff-level
  decade doc per implementation layer. Docs only; no production patch.
- **wp2 — L1 / #138.** `normalizeCwd` strips `\\?\` and UNC prefixes;
  `FOLD_CWD_CASE` includes `win32`; `index-search.ts` normalizes both sides of its
  SQL comparison so the index answers what the scan answers. Regression fixture must
  use a `repo_key` NULL session, because the `repo_key` OR branch hides the defect
  on a git clone. Doc: `010_wp2_recall_cwd_normalization.md`.
- **wp3 — L2 / #142 + #143.** A file-level AND that straddles a blank line keeps a
  hit; `matchedThreadIds` records only threads with a kept hit; the chat fallback
  forwards `synonyms` and `any`, pinned in `chat-fallback.test.ts`. Doc:
  `020_wp3_memory_search_semantics.md`.
- **wp4 — L3 / #139 + #140.** `--help` is answered before any work, so
  `chat index --help` stops running a full ingest; a dash-leading token is never
  accepted as a path value; a missing `--home` exits non-zero; the missing-root and
  missing-db conditions warn once each and are distinguishable. Doc:
  `030_wp4_recall_cli_arg_hygiene.md`.
- **wp5 — L4 / #144.** `--status` and the SessionStart banner compare the index
  against the source JSONL read-only, counting missing files AND files whose
  `(mtime, size)` moved; `last_ingest_at` advances only on a real change. Doc:
  `040_wp5_chat_index_freshness.md`.
- **wp6 — L5 / #137.** `previous`/`prior` require a noun; `기억해*` stays with the
  write gate; `리콜`, `이전 작업`, `메모리에서 찾` are added so the implementation
  matches what `skills/recall/SKILL.md:3` advertises. Doc:
  `050_wp6_recall_intent_regex.md`.
- **wp7 — L6 / #135 + #136 + #141.** The grant reveals the cwd it was written to;
  the Korean trigger matches `메모리` forms; `absolutize` expands `~\`,
  `%USERPROFILE%`, `$env:USERPROFILE` and `$HOME`; the destination parser classifies
  `Set-Content`/`Out-File`/`New-Item`/`Copy-Item`/`Tee-Object` and `python`/`node`
  one-line writes; `allow-write --help` is side-effect free and `--session=<id>` is
  accepted. Doc: `060_wp7_memory_write_gate.md`.
- **wp8 — integration.** Doc: `070_wp8_integration_stack_publish.md`.

## Acceptance criteria

The bound goalplan carries `c-1`..`c-12`.

| id | criterion | proving layer |
|---|---|---|
| c-1 | this unit holds `000_plan.md` plus one diff-level decade doc per layer before any production patch | wp1 |
| c-2 | a `repo_key` NULL regression proves index and scan agree for an extended-length cwd and for a case-differing cwd | wp2 |
| c-3 | tokens straddling a blank line still hit, and `matchedThreadIds` records only kept hits | wp3 |
| c-4 | the chat fallback forwards `synonyms` and `any`, pinned by `chat-fallback.test.ts` | wp3 |
| c-5 | `chat index --help` prints usage, exits 0, and leaves file/message counts unchanged | wp4 |
| c-6 | dash-leading path values rejected; missing `--home` exits non-zero; one warning per condition | wp4 |
| c-7 | status and banner report source-JSONL count and `(mtime, size)` drift read-only; `last_ingest_at` only on real change | wp5 |
| c-8 | the five utterances quoted in #137 are pinned with corrected verdicts | wp6 |
| c-9 | `allow-write` reveals its grant cwd; `메모리도 기록` and `메모리에 기록해줘` trigger | wp7 |
| c-10 | Windows home forms expand and PowerShell/python/node destinations classify as memory writes | wp7 |
| c-11 | `allow-write --help` exits 0 with no grant recorded; `--session=<id>` accepted | wp7 |
| c-12 | seven branches pushed, each PR based on the layer below, every layer green, nothing merged | wp8 |

## Verification contract

Every implementation layer produces, with pasted output:

1. `npm run build` — exit 0.
2. `npm test` — exit 0, with the layer's new test names visible in the output.
3. The red-green evidence for at least one new test: the assertion failing on the
   parent tip and passing at this layer's tip.
4. `cxc receipt test` — run by EACH implementation layer at its own C phase, because
   a goalplan-bound session requires `testReceiptPath` on every C->D edge. wp8 does
   not produce receipts for the layers below it and cannot stand in for them.
5. For the layers with a live Windows reproduction (#135, #136, #138, #140, #141),
   the observed command output before and after, quoted verbatim.

A layer whose build is green but whose new test never ran red is not proven.

## Risk register

| risk | layer | mitigation |
|---|---|---|
| `dev` is deleted again by the next promotion merge | all | the chain's PRs are the early-warning signal; record it, do not silently recreate `dev` a second time without telling the user |
| Peer session lands its stack first and moves shared files | L1-L6 | none of the peer's files overlap this unit's set; only a `dev` head move forces a cascade, handled by `git rebase --update-refs` from L0 upward |
| `FOLD_CWD_CASE` turning on for win32 changes existing search results | L1 | the change is a widening: previously-missed sessions start matching. Pin the previously-matching cases too, so the widening is proven not to drop anything |
| A new source file's `dist` output is silently unstaged | any | `git add -f` for that component's `dist` path, verified with `git show --stat` before pushing |
| Six parallel doc agents disagree about a shared helper | wp1 | the roadmap owns the shared decisions; the audit reads all seven documents as one artifact |
