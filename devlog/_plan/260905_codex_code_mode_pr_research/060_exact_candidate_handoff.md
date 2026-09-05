# WP4 — exact-candidate verification and installed handoff

Status: DESIGN
Depends on: WP3 selected implementation, WP1 evidence tools, WP2 skill contract.

## Outcome and scope

Verify the selected implementation as a built, installed plugin in a fresh macmini session, then close the source-of-truth/evidence loop. This is not permission to push, release, merge, edit initiative, upgrade unrelated host software, or bypass hook trust.

This phase is spec-satisfaction verification, not further tuning against the held-out tasks. New failures return to the responsible code slice or an appended repair phase; do not mutate the final gate to accommodate them.

## Exact file map

| Action | Path | Delta |
| --- | --- | --- |
| MODIFY | `docs/native-thin-harness.md` | Record selected skill/guide ownership and actual runtime adapter boundaries, preserving existing safety/permission principles |
| MODIFY | `structure/00_philosophy.md` | Describe bare cxc-loop as scoped HOTL by user policy; keep explicit interview and other runtime-owned controls |
| MODIFY | `structure/10_subagent_skill_routing.md` | Replace stale blanket V1/V2 delivery assertions with the selected measured strategy and explicit unsupported/unknown combinations |
| MODIFY | `structure/60_native_capabilities.md` | Add verified code-mode execution/discovery/state semantics with exact observed version and limitations; keep source-only ideas separate |
| MODIFY | `docs-site/src/content/docs/guides/skills.md`, `guides/pabcd.md` | Align entry examples and progressive loading with canonical owners; do not duplicate long method bodies |
| MODIFY | `.codex-plugin/plugin.json` beneath `plugins/codexclaw/` | Cachebuster only via existing supported helper in the candidate install copy; do not bump public product version solely for cache invalidation |
| NEW | `devlog/_plan/260905_codex_code_mode_pr_research/061_final_evidence.md` | Immutable evidence index: source/candidate/install identity, test/probe manifests, holdout verdict, known limitations and teardown |
| NEW | `devlog/_plan/260905_codex_code_mode_pr_research/062_final_review.md` | Reviewer verdict and issue disposition against the exact source/payload pair |

Runtime dist modifications are generated from the final source using `plugins/codexclaw/scripts/build.mjs` on macmini. Integrate only those generated changes, verify source/dist equality, and force-add only intentional tracked payload files where repository policy requires it. Do not manually edit generated JavaScript.

## Before/after contract changes

- Before: skill routing SoT mixes historic V1 auto-load claims with later unconditional body inlining. After: name the shipped selected strategy, its version/surface coverage, and its failure behavior. Do not claim automatic skill application from body presence.
- Before: native capability doc mainly catalogs historical direct tools. After: current live `exec`/`wait`, deferred inventory, serializable session storage, fresh-isolate limitation, cancellation and actual tier evidence are attached to the observed runtime version.
- Before: no measured end-to-end reduction claim exists. After: report only paired, eligible measurements; explicitly mark unobserved combinations and metric proxies.
- Before: original initiative user-approval text could be conflated with downstream default. After: distinguish original neutral contract from the newly requested bare-loop HOTL adapter policy.

These are semantic document edits, not phrase-presence test targets. Reviewer checks the exact resulting statements against source and captured behavior.

## Installation and evidence procedure

1. Freeze selected source SHA and dirty-diff status before building. Produce candidate manifest version, build output, archive SHA256 and a file-level payload digest manifest. Existing packing workflow supplies the implementation pattern.
2. Use a candidate-specific marketplace/source and Codex configuration in the dedicated macmini experiment root. Do not overwrite global marketplaces or add unsupported manifest fields. Resolve the installed path from `codex plugin add ... --json`, never broad filesystem discovery.
3. Verify real paths stay in the intended candidate roots and relevant doctor checks pass. Missing/zero hook trust entries are not PASS. Any native trust approval requirement is an explicit boundary, not a reason to add `--dangerously-bypass-hook-trust` or forge trust state.
4. Start a fresh `codex exec` session with exact Astra/high/Fast arguments, approval/sandbox bypass, controlled cwd/env, and raw artifact capture. Requested settings alone do not establish effective model or tier.
5. Run baseline/candidate common tasks in alternating order and then independent held-out tasks. Initial fixture timeout is 180 seconds; a longer task gets a recorded explicit bound appropriate to its scope. Unlimited project time does not mean unlimited hung child processes.
6. Collect stdout JSONL, stderr, final output, exit/signal, rollout/context provenance, request/tier provenance, actual artifacts, hook context/activation evidence and payload identity. Never include auth/token values in shareable evidence.
7. Preserve all negative outcomes. A retry requires diagnosed new evidence. Do not merge retries into the success sample or treat a lower-cost failure as an improvement.

## Verification matrix

| Family | Required observation |
| --- | --- |
| HOTL intent | Bare scoped cxc-loop creates real host goal and persisted FSM, completes all scoped plan phases, and emits evidence |
| Explicit restrictions | Interview-only and plan-only requests do not become autonomous implementation; a question explaining loop does not create a goal |
| Ordinary work | Non-loop task uses only relevant skills and does not acquire HOTL or additional mutation scope |
| Skill application | Blind task outcome demonstrates the selected rule; actual load evidence supplements but does not replace behavior |
| Spawn | Caller model/effort/other fields preserved, same tested execution surface, missing/opaque/full-history paths not silently misclassified |
| Invariants | Worktree deletion denial, parent identity, recursion grants, goal completion rejection, source/receipt binding and bounded Stop release remain valid |
| Recovery | Compact/restart or interrupted tool scenario has observable recovery; skipped recovery cannot support a recovery claim |
| Installed artifact | Fresh session loads the exact selected installed payload; source tests alone insufficient |
| Cost | Hook invocation, context bytes, actual/proxy token distinction, wall-clock and host time reported separately; no failure population dropped |

## Verifier commands and ownership

Already exercised baseline: the three focused test files listed in `010_roadmap_lock.md` returned 145/0 on macmini. Later newly written scripts/tests must be run before being cited as working commands. Verification expands to affected pabcd-state and subagent-config tests, package/manifest contracts, and WP1 evidence-analyzer tests.

Existing full build/check owners are `node plugins/codexclaw/scripts/build.mjs`, `node plugins/codexclaw/scripts/gate.mjs`, and `node --test --test-concurrency=1 <explicit affected files>`, executed on the remote snapshot. Read output and exit code. Full repository-wide suites, if needed for risk, run only on macmini and retain logs. No local UI build or repository test suite is required for this headless change.

After source and installed verification, an independent reviewer receives the exact source range, payload digest and raw outcome pointers without the proposed verdict. The main addresses blockers; the same reviewer verifies fixes, while the final held-out gate remains uncontaminated.

## B and C artifacts

During B, update the listed SoT documents from actual selected behavior and write `061_final_evidence.md`. During C, run exact-candidate remote verification, capture the local source-bound receipt that invokes the authorized remote verifier, and write `062_final_review.md` from the actual returned verdict. Do not claim remote evidence belongs to the main source unless the artifact identity matches.

## D closure

Complete the WP4 task and criteria through `cxc loop` commands with artifact pointers, close C→D using its real receipt, and validate the full goalplan. Archive the devlog unit to `_fin/` only once all in-scope work is done, updating links without erasing research provenance. Commit local results, verify no unintended changes or remote jobs remain, then mark the host goal complete. No push or public release.
