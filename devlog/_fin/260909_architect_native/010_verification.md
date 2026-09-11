# Native architect repair verification

Status: DONE

Implementation: afcbb2f, branch codex/architect-role, worktree /home/jun/code-worktrees/codexclaw/architect-role. This corrects the prior 5089fad completion claim: logical architect configuration existed, but its native type was still explorer. The new producer emits architect; registration publishes a distinct read-only native role. No explorer/reviewer alias fallback is implemented for architect producers.

## Evidence

Logs: /var/tmp/cxc-architect-native-01a0829e.
Native evidence: /home/jun/code/codexclaw/.codexclaw/evidence/01a0829e-d196-7b31-bed9-9551e9ea3c18.

- Red: wrapper assertions failed on explorer versus architect (red.log). After correction wrapper/hook tests114 pass; native type with absent/conflicting marker or review words selects architect fixture model/effort/prompt. Explicit caller overrides and full-fork field omission preserved.
- Integrated affected role suite: 259 tests, 259 pass, 0 fail (affected.log).
- Full suite at afcbb2f: 2729 tests, 2658 pass, 71 skipped, 0 fail (full.log); source-bound C test receipt captured by cxc receipt test.
- Component build and gate: exit0 (final-build.log, final-gate.log). Generated registrar/CLI/wrapper shipped in dist.
- Registration tests22 pass: both roles, strict parser, path resolver, explicit blank rejection, valid spaced paths, managed upgrade/backup, user-edit preservation, symlinks/directories, locks, concurrent first registration and compatibility entrypoints. Main replaced task path with tmpdir and used binding-only noarg resolver oracle before integrated run.
- Generated-dist command runner QA: five cases in qa-native/architect-native-command/capture.json: help, invalid scope option, register, repeat, conflict. Published native file has name architect, sandbox read-only and no model sentinel. Temporary destination removed.
- Host file hash comparison: five pre-existing role/config files unchanged; /home/jun/.codex/agents/architect.toml still absent. No actual installation/provider mutation/inference/restart/push.
- A reviewer 01a08437 PASS after accepting shared registrar reconciliation and default-path coverage amendments. Executor 01a08442 slice accepted after main diff inspection and portable-test/oracle corrections. Native evidence receipt architect-native-registration.md contains its actual focused result.

## Boundaries

Explicit `cxc subagents register architect` is now available in this source build; it is not auto-run by hooks or installation. A fresh session must expose architect before dispatch. Current host lacks architect, so native discovery, sandbox enforcement and actual model inference are NOT RUN. Registration file/TOML and payload fixtures are not native execution proof. Full-history inheritance and explicit caller overrides are deliberate existing behavior. UI did not change in this repair; prior UI smoke was not repeated or promoted to native proof.

No change to structure/00_philosophy.md. Registration reconciliation keeps executor entrypoint and safe update semantics from sibling9a546f0, without merging unrelated changes or editing its worktree. Local filesystem guards preserve cooperative updates; hostile noncooperating races are not a security isolation claim.

## Final review

Fresh C reviewer 01a08458-af0b-7c90-ac12-c8fc0ce87d6b returned PASS at afcbb2f, blockers none. Main accepted stale SpawnPayload snippet correction in structure/10_subagent_skill_routing.md and added explicit upgrade guidance to CHANGELOG Unreleased. Raw lock error wording remains a nonblocking usability issue; file protection is tested. Future sibling merge must preserve this shared registrar and reapply sibling executor availability/docs changes; no merge was performed. Reviewer proposed a runtime probe but was stopped before execution; no additional registration test is claimed. Final source-bound contract check precedes D; archive-only head gets a direct check after closure.

D closed native cycle with all criteria met. Final contract28 pass at8d55f33; unit archived after closure. No additional implementation or installation remains within this authorized scope.
