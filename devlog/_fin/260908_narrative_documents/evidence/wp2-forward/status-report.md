# 0.2.24 is not released yet: PR #84 is the last blocker, and it is a CHANGELOG-only conflict

**Reader contract:** a CodexClaw maintainer returning from vacation, who knows the repo and the release process but was not in this session; after reading, they decide whether to take over the PR #84 integration and the 0.2.24 release, or leave it to the running agent.

The last shipped release is v0.2.23 (2026-09-08 01:40 UTC, A8). 0.2.24 has not been cut. The work that stands between here and the release is a single pull request, #84, which GitHub reports as CONFLICTING against `dev` (A6) — but a trial merge shows the conflict is confined to `CHANGELOG.md`, and the full test suite passes on the merged tree (1857 pass, 0 fail, A7). The agreed plan is to integrate #84 by pushing to the contributor branch, cut 0.2.24, and deploy to three hosts (A11). Two known traps could break that: the release workflow's dispatch path defaults to a prerelease (A12), and the CHANGELOG carries a stale empty `Unreleased` heading (A13). Nothing in the evidence indicates the release was started.

## Contents

- [PR #84 is mergeable in substance; the conflict is bookkeeping](#pr-84-is-mergeable-in-substance-the-conflict-is-bookkeeping)
- [The release path has two traps that must be handled before tagging](#the-release-path-has-two-traps-that-must-be-handled-before-tagging)
- [Three deploy targets are reachable and behind; several hosts are out of scope or unreachable](#three-deploy-targets-are-reachable-and-behind-several-hosts-are-out-of-scope-or-unreachable)
- [What this does not cover](#what-this-does-not-cover)
- [Next steps](#next-steps)
- [Appendix: evidence](#appendix-evidence)

## PR #84 is mergeable in substance; the conflict is bookkeeping

GitHub marks PR #84 CONFLICTING against `dev`, which normally means real work. Here a trial merge narrowed the conflict to `CHANGELOG.md` alone (A6) — a file whose conflicts are resolved by choosing entry order, not by reconciling code. On the merged tree, the PABCD-state, subagent-config and plugin test suites ran clean: 1857 passing, 0 failing, in 61.5 seconds (A7). Supporting checks on the current tree agree: the skill-catalog test passes 4/4 (A3) and `quick_validate.py` reports the search skill valid (A4).

The integration route is already decided: push directly to the contributor branch, which is possible because `maintainerCanModify` is true on the PR (A11). That keeps the contributor's authorship and avoids a force-push dance on `dev`.

## The release path has two traps that must be handled before tagging

The first trap is in `release.yml`: its `workflow_dispatch` path defaults `prerelease` to true, so dispatching the workflow produces a prerelease rather than a normal release. The recorded mitigation is to push the tag instead of dispatching (A12).

The second is in the changelog: line 57 holds a stale, empty `Unreleased` heading (A13). Since the only merge conflict is in that same file (A6), the changelog needs one deliberate edit that both resolves the conflict and fills or removes that heading before the release is cut.

## Three deploy targets are reachable and behind; several hosts are out of scope or unreachable

The deploy set for 0.2.24 is macmini-cf, suji, and desktop-c795oh4 (A11). All three were probed this session. macmini-cf runs Node v22.22.0 (A1) and suji runs codex 0.147.0 (A2); desktop-c795oh4's plugin cache holds only 0.2.21 and 0.2.22 builds (A9), so it is at least two versions behind and will need the install after release. A local model endpoint on 127.0.0.1:10100 answered with 28 models including `anthropic/claude-opus-5` (A5).

Two groups of hosts are not part of this delivery. lidge, intmb and cursor have codex installed but no codexclaw manifests (A10), so there is nothing to upgrade there. oracle, ocx-ci and win timed out over SSH on the morning of 2026-09-08 (A14) and could not be assessed.

## What this does not cover

The evidence is a single session's raw notes; everything outside it is unknown rather than negative.

- No evidence that the release was cut, tagged, or published. Treat 0.2.24 as not started.
- No CI run result for PR #84 itself is recorded — only local test runs on a merged tree (A7).
- The three timed-out hosts (A14) have no recorded state; whether they are down or transiently unreachable is unknown.
- Version currency of macmini-cf and suji installs is unknown; only the runtime and codex versions were probed (A1, A2), not the installed codexclaw version.
- **Assumption (not in the dump):** that PR #84's content is the intended payload of 0.2.24. The notes tie the two together in one decision (A11) but never state the release scope.
- **Assumption (not in the dump):** that "`quick_validate.py` on search skill" and the skill-catalog test (A3, A4) relate to the #84 payload; the notes do not say what #84 changes.

## Next steps

1. Resolve `CHANGELOG.md` on the #84 merge and clear the stale `Unreleased` heading at line 57 in the same edit (A6, A13).
2. Push the resolved branch to the contributor's branch using maintainer write access (A11), and let PR CI run.
3. Cut 0.2.24 by pushing the tag; do not use `workflow_dispatch` on `release.yml` (A12).
4. Install and verify on macmini-cf, suji, and desktop-c795oh4 — desktop-c795oh4 is the furthest behind (A9).
5. Re-probe oracle, ocx-ci and win before treating them as excluded (A14).

## Appendix: evidence

All items are verbatim observations from [raw-evidence-dump.md](raw-evidence-dump.md), the sole input for this report. No external sources were consulted.

| Anchor | Kind | Observation |
|---|---|---|
| A1 | probe | `ssh macmini-cf 'node -v'` → v22.22.0 (exit 0) |
| A2 | probe | `ssh suji 'codex --version'` → 0.147.0 |
| A3 | test run | `node --test plugins/codexclaw/test/skill-catalog.test.mjs` → 4 pass, 0 fail |
| A4 | test run | `quick_validate.py` on search skill → "Skill is valid!", exit 0 |
| A5 | probe | `curl http://127.0.0.1:10100/v1/models` → 28 models, includes `anthropic/claude-opus-5` |
| A6 | observation | PR #84 CONFLICTING against `dev`; trial merge shows only `CHANGELOG.md` conflicts |
| A7 | test run | `node --test` pabcd-state + subagent-config + plugin tests on merged tree → 1857 pass, 0 fail, 61.5s |
| A8 | probe | `gh release list` → v0.2.23 Latest, 2026-09-08T01:40:36Z |
| A9 | probe | `ssh desktop-c795oh4 ls cache` → 0.2.21+codex.20260906214421, 0.2.22+codex.20260906224615 |
| A10 | note | lidge, intmb, cursor have codex but no codexclaw manifests |
| A11 | decision | Integrate PR #84 via push to contributor branch (`maintainerCanModify` true), then release 0.2.24, deploy to macmini-cf / suji / desktop-c795oh4 |
| A12 | risk | `release.yml` dispatch defaults `prerelease=true`; use tag push instead |
| A13 | risk | Stale empty `Unreleased` heading in CHANGELOG line 57 |
| A14 | note | oracle, ocx-ci, win SSH timeouts in last probe (2026-09-08 morning) |

### Fresh-reader check (READER-DOC-05)

No independent fresh reader was available within this delegated scope, so the check was not performed as specified. The draft was instead re-read against the three fresh-reader questions by the author. Recorded outcome and its limits are in [self-check.md](self-check.md).
