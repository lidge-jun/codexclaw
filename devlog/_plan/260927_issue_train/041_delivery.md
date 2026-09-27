# Delivery record: issue train 2026-09-27

Four ordinary PRs landed the train in `dev`: wp2's hook runtime fixes (#269), wp3's agent-created thread permissions and dispatch guidance (#270), wp4's goalplan pending decisions (#271), and this record. Every implementation PR was merged with a merge commit after all hosted checks passed on its exact head, so later branches built on earlier ones stayed clean. Nothing was promoted to `main`, released or tagged.

## Pull requests

| PR | Scope | Head at merge | Merge commit | Hosted checks |
|---|---|---|---|---|
| #269 | #250, #251, #252, #253, #254, #255 (partial) | 29e34de8 | b558d84e | 13/13 success (ubuntu, macOS, Windows ×4 shards, packed install, artifacts, labeler, target) |
| #270 | agent-thread permission hook and advisory, dispatch guidance, #265 guidance | 40624cdb | c550d78e | 13/13 success |
| #271 | #262 (partial: open/decided decisions) | e59c9d8e | c4f17670 | 14/14 success |

Two CI rounds failed on Windows before their fixes: #269's policy-off CLI test built a path from `URL.pathname` (fixed with `fileURLToPath`, 29e34de8), and #270's home-directory test set only `HOME`, which Windows `os.homedir()` ignores (fixed by also setting `USERPROFILE`, 40624cdb). Hosted CI for #269 waited about an hour behind another repository's queued runs on the same account; no other repository's runs were cancelled.

## Issue dispositions

- Closed as fixed with a comment naming #269: #250, #251, #252, #253, #254.
- Partly addressed, left open with a comment: #255 (`.gitignore` shipped; lazy state creation deferred), #262 (`options[]`, recommendation validation and `withdrawn` not shipped), #265 (guidance shipped; CLI deferred).
- Deferred with a one-line reason and a link to 001: #209, #213, #247, #256, #257, #258, #259, #260, #263, #264, #266, #267, #268.
- Closed as not planned: #261.

## Review record

Each implementation phase had an architect consultation with reflection, a plan audit by the same gpt-6-sol reviewer, parallel gpt-6-sol builders in managed worktrees, and an independent gpt-6-sol implementation review. The implementation reviews found and forced fixes for: negated and indirect refusals still arming the loop (#250), malformed or overflowing TOML and project-controlled config paths authorizing the permission hook, hook-observation writes under a project-contained `CODEX_HOME`, ambiguous decision ids, and the IDLE decision release firing on structurally broken plans. #255's first design (lazy session-state creation) failed three plan audits and was replaced with the `.gitignore` partial fix.

## Residual risks

- The #250 detector is advisory and heuristic; unusual refusal phrasing can still produce a hint, never a phase change.
- The permission hook treats explicit top-level `config.toml` keys as evidence of user intent. It does not see runtime overrides or Codex schema-type errors, and live suppression of the Desktop approval modal is source-verified but not yet observed in the app. The two new hooks need trust approval after upgrade.
- `cxc loop ask` cannot prove a question reached the user.

## Operational notes

- During this train the installed plugin cache was replaced at 23:45 KST on 2026-09-27 with 0.2.36 from the marketplace source `/Users/jun/Developer/new/700_projects/codexclaw` (checked out at an older commit). The loop used a pinned 0.2.39 CLI extracted from dev for its own FSM commands. The installed plugin was not changed.
- A docs commit on the wp3 branch briefly swept 279 pre-existing untracked files from this checkout into the pushed branch (including a headless Chrome profile used for PDF rendering, which held no cookies or saved logins). The branch was rewritten and force-pushed before merge, so they never reached `dev`; the original commit object may stay reachable on GitHub by SHA for a while. The files remain untracked in the checkout.

