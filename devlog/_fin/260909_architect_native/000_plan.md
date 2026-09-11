# Native architect repair

Status: DONE

Loop: satisfy-spec HOTL, one bounded PABCD cycle (native). Class C3 with C4 care for native role registration and file preservation. Previous D at 5089fad delivered a logical architect mapped to explorer. Jun corrected that outcome: architect must be its own native role. The changed decision is N1: architect -> architect, not explorer or reviewer. Installed skill workflow applies; new native role cannot be invoked in this session without forbidden registration/restart, so no bootstrap architect call is claimed.

## Scope and map

Source: /home/jun/code-worktrees/codexclaw/architect-role, branch codex/architect-role. Native workflow state stays /home/jun/code/codexclaw. No AGENTS.md/POLICY.md found in target tree; user instructions own scope. Main plans/judges, independent reviewer A/C. Model overrides omitted in ordinary workflow agents; family independence unverified. No user time/token cap specified. No install, global config write, paid inference test, push/PR/merge, new skill, philosophy edit or other-worktree mutation.

Current chain: CLI -> store, wrapper -> store/prompt -> native spawn input -> hook inferRole. Add CLI -> role-registration -> canonical architect.toml -> explicit native config-layer file. No dependency from wrapper/hook to registration (never auto-register during dispatch). Component-local registration module is justified by filesystem preservation/atomic update concerns; rejected copying arbitrary templates on every spawn and aliasing reviewer, both violate intent/ownership.

## Exact changes

N1 MODIFY components/subagent-config/src/spawn-wrapper.ts: ROLE_AGENT_TYPE value union adds architect; architect entry changes explorer -> architect; SpawnPayload agent_type type extends if separately declared. Every producer that emits native type must preserve architect. routeDispatch only creates role/message, callers must use architect type. Keep existing roles unchanged. No model invention: existing resolveSpawnConfig and hook explicit agent_type architect choose architect settings even with absent/ambiguous markers or reviewer words. No fallback on missing registration; host unknown-role error remains visible, docs require fresh-session schema check before invoking.

N2 NEW components/subagent-config/src/role-registration.ts: adapt exactly the 74-line existing registerExecutor implementation from sibling executor-role-registration at 9a546f0 to registerArchitect, architect.toml filenames/messages and locks. Existing managed-content hashes, complete-file link publication, conflict/symlink refusal, exact backups and fail-closed lock behavior retained. Import only node builtin modules, no store/wrapper dependency. Export registerArchitect(codexHome?) using explicit root or existing CODEX_HOME/default resolution. Do not execute against real home in this task.
N3 MODIFY components/subagent-config/src/cli.ts: add strict `register architect` parse and command runner; no --global/extra args accepted for registration. Runner optional native-home argument enables direct command testing in isolated root without repurposing HOME/CODEX_HOME. Catch registration errors, nonzero result, print new-session/live-schema instruction. Never call registration from list/get/set or hooks.
N4 MODIFY agents/architect.toml: add sandbox_mode = "read-only". Preserve default sentinel in canonical source; registration removes sentinel, preserving inherited model/effort and role-specific CXC settings. Native role is separate from reviewer prompt.

Tests: NEW role-registration.test.ts adapts existing executor registration tests at 9a546f0 with explicit temporary roots. Assert name architect, sandbox_mode read-only, no pinned model/effort, complete prompt, initial/idempotent registration, intact managed upgrade+backup, edited/conflicting file preserved, symlink/directory rejected, identical legacy adoption, lock refusal and runner error. Do not repurpose CODEX_HOME in subprocess tests; use runSubagents(...,cwd,nativeHome) and concurrent registerArchitect calls in child Node code with explicit root if warranted.
MODIFY spawn-wrapper.test.ts architect expects architect, add native input with marker removed and reviewer keywords still resolves configured architect; test missing role not rewritten and full-fork/explicit-field semantics in spawn-attach-hook.test.ts. Existing suites cover remaining roles and negatives; add meaningful behavioral assertions, no prose phrase tests.
Build generated dist through npm run build, force-add only new generated module; existing tracked dist updates normal.

Docs MODIFY agents/README.md, pabcd/references/delegation.md, structure/20_pabcd_dispatch_doctrine.md, structure/INDEX.md current architect mapping and registration prerequisites; README.md/ko/zh and docs-site guides/subagents.md/reference/commands.md explain explicit registration, inherited default, fresh-session verification and no alias fallback. Preserve prior historical devlog. docs/native-thin-harness.md retains no auto-registration statement, add pointer if needed. structure/00_philosophy.md unchanged.

## Verification and ownership

Baseline: node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/subagent-config/test/*.test.ts' reads direct role targets; baseline result recorded below when finished. npm run build enumerates component source; npm run gate observes inventory/false enforcement, not semantics (both verified in previous repair at unchanged baseline). Final affected suite plus full npm test (TMPDIR=/var/tmp/cxc-architect-native-01a0829e avoids foreign /tmp/.git), build, gate, dist freshness and manifest/inventory tests. GUI unchanged; no repeated browser run.

Delegate N2/N3 and registration tests to executor in disjoint files; main owns wrapper/hook tests, prompt and docs. Inspect executor diff and evidence. Independent A before B and fresh C review while main runs tests. Native proof limit: fixture publication/parser/payload only; no host discovery, model inference or read-only enforcement smoke asserted. Write final evidence and close source-bound C receipt before D.

Boundary: registration filesystem checks are real code guards against accidental overwrite, not hostile local process isolation (noncooperating race remains). Native sandbox enforced by host when role loads, unverified here. Missing role refusal is host-owned, no new local availability detector. Procedure guidance E7; no new phase/consultation hook. No silent model fallback.

## A synthesis, amendment 1

Reviewer 01a08437 returned FAIL. Accept both root causes.
N2 reconciliation: use a shared registerRole(role: "architect" | "executor", codexHome?) containing the sibling's filesystem logic once, with registerExecutor and registerArchitect compatibility entrypoints. CLI register accepts exactly either supported role, rejecting unknown roles/extra flags. Port sibling registration tests intact in meaning and extend architect cases; shared module and parser supersede BOTH additive versions when reconciling sibling branch, preserving register executor. Do not cherry-pick unrelated sibling changes or mutate its worktree. This branch owns the integrated registration delta; no merge/publish is performed.

N2 resolver: export resolveNativeRoleHome(env = process.env, userHome = homedir()) for production registration default. Test explicit env root, empty/unset env -> supplied user home/.codex and actual no-argument resolution read-only; call real registration using the resolver's task-temp result. Runner/registration default must visibly use this resolver, reviewed and asserted. No tests change HOME/CODEX_HOME in parent or child, per standing instruction. This takes the reviewer's direct-resolver alternative rather than an env mutation. Keep real-home files untouched.

N4 comment: canonical SOURCE, not auto-registered; sandbox_mode read-only only for architect. Executor source/policy unchanged. Architect stays outside existing worker-only evidence gate (read-only intent).
N1 exact native producer spawn-wrapper.ts:379 and SpawnPayload:340; add direct ROLE_AGENT_TYPE.architect expectation as well as changing existing producer assertion.
Docs paths: docs-site/src/content/docs/guides/subagents.md and docs-site/src/content/docs/reference/commands.md. Baseline build/gate exit0; role suite236 pass. No architecture call can be claimed before role installation; independent reviewer audit is real, registration/bootstrap still outside authority.

B: A re-audit PASS; default resolver oracle uses separate injected values plus no-argument default binding, not duplicate expression. Main native mapping red test failed twice on explorer!=architect; after code fix wrapper/hook114 pass. Executor owns registrar/CLI/tests; main prompt sandbox now available for their tests.

C conclusion: independent reviewer01a08458 PASS; full2729 tests (2658 pass/71skipped), affected259 pass, generated command runner5 scenarios and QA evidence PASS. No design change. Accepted doc snippet/Unreleased upgrade-note corrections; raw lock error usability and future sibling merge reconciliation recorded in010. No native installation claimed.
