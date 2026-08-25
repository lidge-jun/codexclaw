# 000 — baseline and scope: the attest from/to cascade, and the lessons opencodex paid for

Two things share one unit because they share one failure shape: **a gate that
rejects work the documentation told the agent to do.**

The attest half is the shipped CLI refusing an attestation whose shape the skill
never described. The devops half is opencodex's v2.32.1 freeze train discovering,
repeatedly, that a gate nobody can satisfy honestly gets satisfied dishonestly —
a red suite argued into an exception, a flaky test re-run until green, a
readiness report describing a tree that had already moved.

The flaky-test policy sits between them. It is currently the clearest instance
in this repo of a rule that contradicts itself in the same file.

## Baseline

Repo: `/Users/jun/Developer/new/700_projects/codexclaw` at `74245989`
(`devlog: the win32 recipe was executed, not assumed`), version 0.2.12.

Pre-existing dirty state, NOT created by this unit and to be preserved:

```
 M scripts/dev-symlink.sh
?? devlog/_plan/260722_260722-repo-governance-config/
?? devlog/_plan/260814_260814-fix-main-ci-windows-worktree/
?? mktemp:
```

Test baseline before any edit, full declared command:

```
npm test
-> tests 1961  pass 1961  fail 0  duration_ms 36311.187  exit 0
```

The pabcd-state slice alone, run twice by the error-hunt lane:
865 pass / 0 fail both times, exit 0, 6.24s then 9.54s. Same 865 test names.
**No flaky test was observed in this repo's own suite.** That matters for scope:
the flaky work here is policy text, not a test repair.

## The defect, stated exactly

`coerceAttest` returns null unless `from` and `to` are strings
(`components/pabcd-state/src/attest.ts:91-96`). The CLI turns that null into:

```
attest JSON missing valid from/to
```

at `orchestrate-cli.ts:227` (inline) plus `orchestrate-grammar.ts:88` for the
chat surface. The `--attest-file` path at `:257` emits a DIFFERENT string,
`attest file <path> is missing valid from/to` — same defect, separate wording,
and therefore separate test coverage (see 002 blocker 2).

The contract agents actually read — the "Required attest keys" table at
`skills/pabcd/SKILL.md:91-98` — lists `did`, `auditOutput`, `auditVerdict`,
`auditResidual`, `checkOutput`, `exitCode`. It never names `from` or `to`.
An agent that copies the table writes `{"did":"..."}` and is refused before any
other check runs.

This is not theoretical and it is not rare:

```
cxc chat search "missing valid from/to" --days 0
-> 50 hits (3/9457 files scanned)
```

across opencodex, ima2-gen, cli-jaw and codexclaw sessions, the oldest sampled
at 2026-08-13. Every one of those is a wasted turn inside somebody's loop.

### It is a cascade, not a single error

The from/to refusal is only the first gate. Fixing it alone walks the agent into
the next two, because `planUnit`, `workPhaseId` and `testReceiptPath` are ALSO
absent from every skill doc (`rg` over pabcd/loop/interview returns zero hits for
all three) while the runtime requires them:

| # | Refusal | Source |
|---|---------|--------|
| 1 | `attest JSON missing valid from/to` | `orchestrate-cli.ts:227` (parse time, before session/plan/binding) |
| 2 | `P -> A requires "planUnit"` | `plan-gate.ts:38-43` |
| 3 | `A goalplan is bound ... pass "workPhaseId"` | `attest.ts:148` |
| 4 | `C -> D on a goalplan-bound session requires "testReceiptPath"` | `check-gate.ts:37` |

A bound HOTL session on P>A therefore needs FIVE keys the skill names ONE of.
Documenting only `from`/`to` would trade one round trip for two.

### Why 260822 did not already fix this

`devlog/_plan/260822_attest_win_parity/` fixed a different failure with a
similar surface: on Windows, PowerShell mangles inline `--attest '{...}'` so the
CLI sees invalid JSON. That unit made the recipes platform-aware and pushed
`--attest-file`. It never touched the key list, because the key list was not the
bug it was chasing. The from/to omission survived that sweep intact.

## Scope

IN:

- `skills/pabcd/SKILL.md` attest table and the copy-paste examples under it
- `skills/interview/SKILL.md:64,144` (two override examples missing from/to)
- `skills/loop/SKILL.md` attest references
- `structure/20_pabcd_dispatch_doctrine.md:72` (names the keys as invalid JSON)
- `components/pabcd-state/src/orchestrate-cli.ts` + `orchestrate-grammar.ts`
  null-coerce error text, and `hook.ts` injected examples
- `components/pabcd-state/test/` regression coverage
- `skills/dev-devops/SKILL.md` + `references/ci-cd-deploy.md`,
  `references/sre-foundations.md` (new DEVOPS-* rules)
- `skills/dev-testing/SKILL.md` §5.4 + `references/ci-pipeline.md` §5,
  `skills/dev-debugging/SKILL.md` Scenario D + anti-pattern row,
  `skills/dev/references/skill-ownership.md` (missing flaky row)
- this devlog unit

OUT:

- `~/.codex/plugins/cache/codexclaw/**` — the installed payload. The repo is the
  source of truth; a rebuild may be RUN, no cache file is authored.
- the opencodex repo. It is read-only evidence this cycle: no branch, no PR, no
  commit there.
- `git push`, PRs, npm publish, version bumps. Local commits only (LOOP-GIT-01).
- repairing the interview-readiness dead end found by the error-hunt lane (001
  §F.1). It is a design decision about what `isInterviewReady` should accept,
  not a text fix, and it gets its own unit.
- the docs-site quickstart and guide attest examples. They are a live
  copy-paste surface and they are incomplete, but docs-site is its own build
  with its own review; recorded as a follow-up (002 nit 4).

**Amended after audit (002 blocker 3):** `cxc freeze --help` was originally
listed OUT here while 010 §7 listed it IN. It is now **IN**. It is a workspace
mutation behind a read-only-looking flag that exits 0, so nothing signals it,
and the guard belongs in the same file family wp1 already opens.

## Accept criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | The attest table names every key the runtime requires per edge, with a copy-paste object | diff + `rg` for `workPhaseId` in `skills/pabcd` returning hits |
| 2 | The null-coerce refusal prints a correct example for the requested edge | actual CLI output of a failing invocation |
| 3 | A regression test pins that message | test name + green run |
| 4 | dev-devops carries the freeze-train lessons as named rules with devlog citations | `rg` for the new rule ids |
| 5 | Flaky guidance is elimination-first with one canonical owner and no surviving contradiction | `rg -i -e flaky -e quarantine` across the four skills |
| 6 | `npm test` green at the final tree | `cxc receipt test` path, exit 0 |

## Terminal outcome expected

DONE. `NOOP` is unavailable: the divergence is measured above, not hypothesized.
