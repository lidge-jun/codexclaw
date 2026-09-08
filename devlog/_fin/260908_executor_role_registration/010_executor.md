# Implementation contract

Depends on existing RoleName executor; no persisted enum or setting migration.

## File changes
- NEW subagent-config/src/role-registration.ts and test/role-registration.test.ts: explicit registration API, pinned shipped template path derived from import.meta.url (works src/dist), remove model sentinel from installed role, preserve all instruction text, exclusive publication and idempotence, conflict and symlink errors. CLI `cxc subagents register executor`; no arbitrary role/path/prompt arguments. Home injection only at API for tests or standard CODEX_HOME environment. Output installed path and restart guidance. No config.toml editing.
- MODIFY subagent-config/src/cli.ts and test/cli.test.ts: parse register executor strictly, invoke registration and report error nonzero. CLI does not auto-register during list/get/set/spawn.
- MODIFY subagent-config/src/spawn-wrapper.ts, test/spawn-wrapper.test.ts: executor payload agent_type becomes executor; pure builder remains filesystem-free. Setup prerequisite explicit in docs. Existing worker direct calls remain accepted by hook.
- MODIFY subagent-config/src/spawn-attach-hook.ts, test/spawn-attach-hook.test.ts: executor and worker select executor before keyword inference; explicit reviewer selects reviewer. Preserve existing explorer keyword compatibility, fork restrictions, recursion guard, model/effort override rules. No new message role marker.
- MODIFY pabcd-state/src/subagent-evidence.ts, src/review-observer.ts, test/subagent-evidence.test.ts and test/review-deadlock.test.ts, hooks/subagent-stop-verifying-evidence.json: gate executor and worker identically; both excluded from review observer; matcher ^(executor|worker)$. No permission or evidence relaxation.
- MODIFY agents/executor.toml comments, agents/README.md, README.md, README.ko.md, active skill call examples: canonical executor with explicit registration prerequisite; worker only legacy native compatibility. Historical devlogs untouched.
- GENERATED corresponding dist JS via npm run build; CHANGELOG Unreleased and inventory if required.

## Chain and acceptance
Creation: registration CLI -> shipped template -> user role TOML named executor. Host reads that role next session; builder emits executor -> spawn hook chooses existing executor settings -> subagent exit matcher/runtime evidence verifies executor. Persistence: roles.executor unchanged. Deserialization: native role loader and existing store unchanged; worker input alias remains. Consumers: spawn wrapper, inferRole, exit matcher, evidence gate and review observer. UI unchanged because already executor.

1. Fresh temp home: register creates parseable executor TOML, instruction body equals shipped template, no model/effort/sandbox/approval override; repeat unchanged; CLI rejects unknown names/extra args.
2. Existing different file or symlink/directory: nonzero, original bytes unchanged; user config and worker file untouched.
3. executor message mentioning review still selects executor configured model+effort; same behavior for worker on v1/v2 fresh spawn. Full-history fork retains current no-override policy.
4. Executor exit without evidence blocks exactly like worker; reviewer/explorer unaffected; review observer excludes executor even with verdict-looking output.
5. Shipped payload includes new module and CLI works without repo node_modules. A fresh native session must expose executor in its spawn schema and record executor as the spawned role. Capture native SubagentStop evidence (or native runtime logs) to prove exit identity. Config/read agents:null is explicitly NOT discovery proof. If unavailable, report custom-role exit identity unverified; only worker is live-proven.
6. Local apply backs up plugin/runtime files and global role config; uses registration command; change global guidance worker -> executor only in implementation role selection. Preserve legacy worker file and project model settings.
7. PR targets upstream dev from isolated branch; no merge. Full relevant checks + negative cases, retain logs and final review.

## Audit fold-back
1. Matcher identity changes require hook re-approval. Update plugins/codexclaw/inventory.json via the existing generator. Run cxc doctor after local application; explicitly report any Modified/untrusted hook and require the normal user-facing reapproval. Never hand-edit trust state or claim active hooks from unit tests. Package tests prove matcher selection; native logs prove delivery only when available.
2. Fresh-session native verification replaces config/read as discovery evidence. Capture tool schema/actual agent_role and executor exit behavior, including missing receipt failure. If runtime cannot refresh, local code delivery remains distinct from activation.
3. Executor setup is a deliberate new prerequisite, not an optional hidden fallback: the user explicitly chose one canonical name. Canonical builders emit executor; docs/active delegation instructions require register + new session, then check the actual exposed role before calling. On older/unregistered hosts report the setup requirement; do not invent executor support or silently relabel as worker. Legacy callers that explicitly emit worker continue to work. This rebuts an unconditional automatic worker fallback because it perpetuates the requested inconsistency. Registration is not performed inside a spawn hook.
Inline prompts remain intentionally for per-project promptOverride and old worker callers; native base instructions and inline overrides are not a claim that the native developer instruction is erased. Preserve existing precedence; document this limitation. state.ts missing-agentType legacy fallback remains worker to avoid recategorizing old tombstones; actual executor entries already preserve their string.

Full-suite follow-up: update cxc-ops/test/hook-trust.test.ts live matcher golden fixture. Compute new digest independently using Python sorted JSON + hashlib; existing worker matcher identity is changed deliberately and requires reapproval. GUI router baseline required npm ci; no GUI product edits.
