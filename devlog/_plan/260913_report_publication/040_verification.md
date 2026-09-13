# Report publication verification

Status: DONE

## Fresh local proof

| Check | Observed result |
|---|---|
| `npm test` | 3,226 total; 3,223 pass; 0 fail; 3 platform-conditioned skips; exit 0 |
| `node --test plugins/codexclaw/test/report-*.test.mjs` | 76 pass; 0 fail; 0 skipped |
| `node --test plugins/codexclaw/test/report-browser.smoke.mjs` | 12 pass; 0 fail; 0 skipped, real installed Chromium |
| `npm run build` | 181 files compiled; layout validation passed |
| `npm run gate` | No status, count, inventory or false-enforcement drift |
| Inventory | Published test count updated from 3,150 to measured 3,226 |
| Real Korean specimen export | 6 A4 pages; 2 passes; TOC pages 3/4/5/6; expected fonts embedded |
| Final image comparison | All 6 pages pixel-identical to independent fresh-reader images |
| Final evidence receipt command | PASS/0 after explicit summary-whitespace review disposition |

The three full-suite skips are existing Windows-specific path/launcher cases,
not newly skipped report tests. The initial full-suite run failed one GUI test
because the isolated worktree could not resolve the existing React installation.
The task and original checkout lockfiles were byte-identical. Reusing the existing
React 18.3.1 dependency tree, without installation or source edits, made the two
router tests and then the full suite pass. The temporary dependency link is not
part of the commit. No test assertion was deleted or weakened.

The generated specimen remains automated REVIEW/2, not automatically certified:
its sole heuristic finding is 42% whitespace below page 3 summary text. The
independent reader reported no reading obstruction or clipping; the self-contained
summary boundary is retained as a documented editorial choice. Seven completed
checks are bound to the final PDF bytes by the final receipt gate. Evidence
locators are trusted-producer assertions, not cryptographic reviewer identities.

Final specimen SHA-256:
`bd717d261c4a70b8017b9a5d7b896bcdea91c293059c99cfb18caed6abbeab23`.

The sample is entirely illustrative. Its 12%/8% rates, 4 percentage-point
difference and 1,400 KRW cost delta reconcile with the example inputs; the final
notice and nonrandom-assignment limitations are present in extracted text.
Pretendard Regular and SemiBold are the only emitted font names and are embedded.
Source font files and all browser/account-specific artifacts remain outside Git.

## Publication boundary

User authorization covers the local commits and pushing the task branch
`agent/report-publication-20260913` to the CodexClaw origin. The branch is based
on `origin/main` at `9e279a45`. The original dirty checkout is unchanged.
No force push, main merge, tag, release, account setting change or new dependency
installation is included. Remote HEAD equality is checked live after the final
commit; this record deliberately does not pre-claim a successful push.

CI is not claimed: the feature-branch push alone does not activate the repository's
main/dev push workflows. The completion receipt reports local proof and the actual
remote branch SHA. The repository's PR-target rule still expects `dev`, although
the remote had only `main`; no branch/ruleset policy was changed as a side effect.
