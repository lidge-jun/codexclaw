# SessionStart state bootstrap — plan and root-cause record

## Loop spec

- **Archetype:** spec-satisfaction repair (C3: hook/runtime contract plus persisted session identity).
- **Trigger:** a fresh Codex `SessionStart` emits the real `session_id`, then an agent runs `cxc orchestrate P --session <that-id>` before any state-writing UserPromptSubmit/Stop/goalplan hook.
- **Goal:** the SessionStart-bound ID is immediately usable by every agent-gated PABCD command in the same workspace.
- **Non-goals:** weaken G2/G3 unknown-session protection; allow arbitrary UUID creation at the CLI; make `cli` a Codex-session fallback; change Stop continuation policy; touch opencodex #78/#82; clean unrelated dirty worktree files; release or deploy.
- **Verifier:** a manifest-to-compiled-entrypoint test invokes the real SessionStart bootstrap hook in an empty temp workspace, observes `.codexclaw/sessions/<id>.json`, then invokes the compiled `orchestrate P --session <id>` path and observes a legal `IDLE -> P` transition. Unit tests additionally measure resume safety, malformed-input silence, a two-process creation race, fail-open IO, synthetic child defense, and source/dist parity. A copied-tree full build/test run protects ignored live artifacts in the real dirty tree.
- **Stop condition:** fresh, resume/corrupt, malformed, race, IO-failure, synthetic-child, immediate-orchestrate, and unknown-unbound cases all have activation evidence; focused tests and copied-tree gates add no failures beyond the five exact pre-existing baseline failures; an independent C reviewer finds no blocking session-identity regression.
- **Memory artifact:** this unit plus `.codexclaw/goalplans/outcome-in-users-jun-developer-new-700-projects/`.
- **Expected terminal outcomes:** `DONE` after verified bootstrap; `NOOP` only if current runtime already satisfies the exact process-boundary probe; `BLOCKED` for unavailable runtime evidence; `UNSAFE` if the only fix weakens G2/G3 or overwrites resumed state; `NEEDS_HUMAN` only for a genuinely ambiguous external issue target; `BUDGET_EXHAUSTED` at four hours.
- **Escalation:** return to P if the real SessionStart payload lacks `session_id`/`cwd`, if Codex does not execute the registered hook, or if resume safety cannot be achieved without changing the session-state format.
- **HOTL resources:** local filesystem and authenticated read-only GitHub triage; writes limited to the PABCD SessionStart hook, its tests/generated dist, this devlog, and the PABCD skill source of truth; no dependency, secret, release, force-push, destructive Git, or unrelated issue mutation; `gpt-5.6-sol` medium subagents; four-hour wall-clock bound.

## Repository signals and ownership

```text
plugins/codexclaw/
├── .codex-plugin/plugin.json                 # active hook manifest list
├── hooks/
│   ├── session-start-announcing-map-affordance.json
│   ├── user-prompt-submit-checking-pabcd-trigger.json
│   └── stop-checking-pabcd-continuation.json
├── components/
│   ├── cxc-ops/src/map-affordance.ts         # SessionStart identity/context output
│   └── pabcd-state/
│       ├── src/{cli,hook,parse,state}.ts      # state owner and hook dispatcher
│       ├── test/{parse,state}.test.ts
│       └── dist/*.js                         # committed install artifact
├── test/hook-e2e.test.mjs                    # manifest-to-dist process boundary
└── skills/pabcd/SKILL.md                     # session identity/state SoT
```

Conventions found:

- `pabcd-state/src/state.ts` is the sole schema and atomic-write owner.
- Each active hook concern has its own JSON file and manifest row.
- Hook parsing is defensive and fail-open; side-effect-only handlers return empty stdout.
- `dist/*.js` is committed and must equal the repository's deterministic `compileSource` transform.
- Tests use temp workspaces and real compiled hook entrypoints; production state must never be used as a fixture.
- Source-of-truth sync target: `plugins/codexclaw/skills/pabcd/SKILL.md` control-surface/state sections.

## Reproduction and causal chain

Observed on 2026-07-10 against the current compiled entries:

```text
binding=session's id is `019f4a8a-b1a1-7113-b72a-460a39a8f096`
state_after_session_start=missing
orchestrate_exit=1
orchestrate P: unknown session '019f4a8a-b1a1-7113-b72a-460a39a8f096'
```

Causal chain:

1. `components/cxc-ops/src/map-affordance.ts:155-187` parses `session_id` and returns the binding envelope but performs no state write.
2. `.codex-plugin/plugin.json:22-26` registers provider detection and the cxc-ops affordance at SessionStart, but no `pabcd-state` bootstrap.
3. `components/pabcd-state/src/state.ts:87-132` returns an in-memory default when the file is absent.
4. `components/pabcd-state/src/orchestrate-cli.ts:233-243` correctly rejects an absent non-reserved explicit ID under G2.
5. `components/pabcd-state/src/hook.ts:759-777` can bootstrap later at an active-goal Stop, but the proactive HOTL/HITL entry command runs before that Stop. The reserved `cli` escape creates a different FSM and violates SESSION-IDENTITY-01 for a Codex session.

## Competing hypotheses and falsifiers

- **H1 — missing SessionStart bootstrap (accepted):** if true, SessionStart emits the binding, the exact state file remains absent, and immediate orchestrate fails G2. The temp process-boundary probe produced all three observations.
- **H2 — SessionStart executable skipped through a symlinked plugin cache (rejected):** if true, the binding envelope would be absent. The reproduced transcript and current probe both contain it; the direct-exec symlink regression test also passes.
- **H3 — state was written under a different cwd (rejected):** if true, the exact session filename would exist under another workspace root. The probe used one explicit temp `cwd`, and a workspace search found no file for the reproduced session ID.
- **H4 — Stop bootstrap itself is broken (rejected as root cause):** if true, a real active-goal Stop probe would not create state. Direct and compiled probes create it; it simply occurs after the failing immediate command.

The causal mechanism is therefore an ordering gap: identity is announced at SessionStart, while persistence is deferred to optional later hooks, but the CLI's safety gate requires persistence before accepting that identity.

## Scope boundary and baseline hazards

IN:

- resume-safe SessionStart creation of the exact default IDLE state;
- defensive root-payload parsing and root/subagent separation;
- dedicated hook registration;
- unit and real-dist process-boundary regression coverage;
- generated dist and PABCD SoT parity.

OUT:

- the unrelated dirty `state.ts` change that forces `orchestrationActive=false` for persisted IDLE states and its pre-existing `hook-continuation` failure;
- orchestrate help/current-phase UX, goal-complete gating, metrics, render observations, GUI/frontend, messenger, skill text unrelated to session bootstrap;
- diagnostic teeing in `pre-tool-use-attaching-skills.json`;
- opencodex issues #78/#82.

Baseline note: the focused broader run has exactly five unrelated dirty-worktree failures. C must compare these exact names before/after and must not rewrite or silently absorb them:

1. `L11: inactive goal allows I-trigger (interview directive injected)` — the user's dirty IDLE reconstruction invariant conflicts with the loose-trigger test at `hook-continuation.test.ts:85`.
2. `WP7/G19: every manifest hook command resolves to an existing dist entrypoint`.
3. `260710: spawn hook e2e - native collaboration name drives the V2 path`.
4. `260710: spawn hook e2e - snapshot override composes mention repair with v1/v2 policy`.
5. `260710: spawn hook e2e - cache-shaped fixture uses script-relative skills`.

Failures 2–5 come from the unrelated diagnostic command in `pre-tool-use-attaching-skills.json`, which does not match `hook-e2e.test.mjs`'s `hook <event>` parser. The baseline artifact is `/tmp/codexclaw-session-bootstrap-baseline.tap`.

## GitHub target correction

Read-only REST, GraphQL, search, events, and direct issue lookup agree that `lidge-jun/codexclaw` has zero lifetime issues (zero open, zero closed). The opencodex issues shown in the reproduction are separate product defects. Creating a throwaway Codexclaw issue solely to comment and close it would invent external state and is outside the user's hook-repair intent. The durable goalplan objective is amended so this zero-issue evidence satisfies the external criterion; the immutable host-goal text is superseded by the steering record in `005_audit_synthesis.md` rather than fulfilled by fabricated issue activity.

## Acceptance criteria

1. **Fresh root SessionStart:** trigger the registered compiled hook with non-empty `session_id` and `cwd`; observe one parseable default IDLE file at the exact sanitized path and empty stdout from the bootstrap hook.
2. **Immediate P entry:** after criterion 1 and before UserPromptSubmit/Stop/goalplan, trigger compiled `orchestrate P --session <id>` with valid attestation; observe exit 0, `IDLE -> P`, and the same file updated.
3. **Resume/corrupt safety:** preseed valid phase/slug/counters or corrupt bytes, trigger SessionStart again, and observe byte-for-byte unchanged state; a subsequent legal mutation may normalize corrupt bytes through existing FSM IO.
4. **Malformed/missing identity:** trigger malformed JSON, missing `session_id`, empty/whitespace-only ID, and empty/whitespace-only cwd; observe exit 0 and no `.codexclaw/sessions/missing.json` side effect.
5. **Creation race:** launch two compiled SessionStart hook processes for one fresh ID; observe both exit 0, exactly one complete parseable default file, and no leftover temp files.
6. **IO fail-open:** make `<cwd>/.codexclaw` a regular file so session-directory creation raises `ENOTDIR`; observe hook exit 0, empty stdout, and no state side effect.
7. **Synthetic child defense:** inject `agent_id`/`agent_type` in a SessionStart payload; observe no root write. This is a defensive boundary test, not a claim that production SessionStart currently carries child fields.
8. **G2/G3 retained:** trigger an unbound unknown explicit ID without SessionStart; observe the existing rejection, and verify no implicit or `cli` fallback was added.
9. **Generated/runtime parity:** changed `src/*.ts` and committed `dist/*.js` match `compileSource`; the new manifest command resolves without altering the diagnostic command.
10. **Regression gates:** targeted real-tree tests pass; copied-tree build/freshness/packaging/gate/full tests preserve exactly the five named baseline failures with no new failure delta.
11. **Independent review:** fresh reviewer confirms no overwrite-on-resume, partial publication, arbitrary-ID minting, child-session write, output-envelope conflict, or unrelated dirty-file loss.

The executable file-by-file plan is `010_session_start_bootstrap.md`.
