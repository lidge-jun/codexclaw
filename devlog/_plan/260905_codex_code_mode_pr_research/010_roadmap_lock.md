# WP0 — docs-only roadmap lock

Status: DESIGN

## Loop spec

- Archetype: evidence-driven optimization constrained by behavior-preservation gates.
- Trigger: user approved unlimited-time researcher-style HOTL execution and unlimited total subagent dispatches after Interview.
- Outcome: audited, dependency-ordered implementation instructions and a reproducible remote baseline, not production feature completion.
- Non-goals: modifying initiative, replacing Codex runtime, releasing/pushing, bypassing hook trust, broadening model/credential scope.
- Write scope: this devlog unit and session-bound `.codexclaw/` bookkeeping only in WP0. Source experiments start in WP1.
- Stop condition: all decade plans independently audited, docs receipt passes, WP0 task/criterion recorded and D closed.
- Memory: `000`–`008` research plus this file, `020`/`021`, `030`/`031`, `040`, `050`, `060`, goalplan and ledgers.
- Escalation: new authority or an unavailable exact probe contract; lower-severity technical questions are tested, not returned to the user. New delegated lanes require an explicit scoped packet; main reclaims a failed packet after two distinct agents.
- Resources: user-set total time and dispatch budget unlimited. No host token budget. At most two remote model probes concurrently; each initial fixture gets a 180-second process deadline with a recorded timeout outcome, not an automatic retry. No local suites.

## Source and policy anchors

Baseline production tree is local commit `065fa1e887f1d64dcd9c822f34c5fb8626d80a55`; the two earlier commits contain only this task's research/interview documents. Branch adopted in place: `codex/agent-led-lazy-skills`.

Initiative `848e6c5` remains read-only. The hierarchy is agent-neutral method → Codex skill/runtime adaptation → narrowly justified hooks. Preserve explicit interview/plan-only/HITL restrictions; an actual bare cxc-loop execution request normally selects scoped HOTL. Mere mention in a question or quoted code is not execution authorization.

## Work-phase dependency map

| Goal phase | Decade doc | Independently verifiable output |
| --- | --- | --- |
| wp0 | `010_roadmap_lock.md` | Audited docs-only roadmap and source-grounded verifier receipt |
| wp1 | `020_remote_evaluation.md` | Host-local probe recorder/analyzer and trustworthy baseline/activation measurements |
| wp2 | `030_agent_owned_skills.md` | Concise entrypoint + conditional references + preserved ownership and new HOTL intent contract |
| wp3 | `040_minimal_hooks.md` | Measured compact guidance and narrowly reduced hooks/delivery path with negative regressions |
| wp3-delivery | `050_skill_delivery_experiment.md` | Actual paired self-load versus inlining decision, including safe retention if the candidate fails |
| wp4 | `060_exact_candidate_handoff.md` | Exact installed candidate proof, blind/live regression evidence, independent final audit and coherent docs |

Each row is a full P→A→B→C→D cycle. WP0 does not implement another row. Any additional candidate that needs its own independent implementation is appended with a diff-level plan and criteria before its B; no two candidate phases are silently packed into one B.

## Current structure and intended boundaries

```text
plugins/codexclaw/
  skills/{loop,pabcd,dev}/        intent, phase contracts, common routing
  hooks/*.json                   actual native hook registrations
  components/pabcd-state/        FSM, ledgers, continuation, prompt guidance
  components/subagent-config/    skill delivery, configured roles, spawn guards
  components/cxc-ops/            identity, diagnostics, activation schema
  scripts/                       build, gate, hook-bench and comparison
  test/                          package/behavior/benchmark contracts
docs/native-thin-harness.md       product ownership source of truth
structure/{00,10,20,60}_*.md     philosophy, skill routing, dispatch, tool map
```

Method ownership remains in skill/reference files. Runtime handlers consume or point to that guidance, not a second method registry. Keep security/identity/state mutation branches unchanged unless a focused, reachable negative case justifies a specific change. `additionalContext` is guidance, not a skill-read enforcement mechanism.

## WP0 file map

- MODIFY `000_plan.md`: mark the historical research scope, current HOTL handoff and roadmap index.
- NEW `008_baseline_observations.md`: baseline source/runtime results and limitations, including shell/protocol confounders.
- NEW `010_roadmap_lock.md`: this contract.
- NEW `020`/`021`, `030`/`031`, `040`, `050`, `060`: complete implementation plans; numbered sub-docs only where needed by the owner.
- NEW during B, after audit: `011_roadmap_acceptance.md`, containing accepted plan file list and SHA256 digests, audit dispositions, baseline artifacts and next-cycle inputs. This is the actual docs-only B deliverable, not a product patch.

## Evidence already obtained

Remote snapshot: `/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/baseline-source`, created from `git archive HEAD`, with its own `.git` directory. It is an experiment copy, not the bound main FSM checkout.

The following real remote command completed with exit 0 and TAP `145 passed, 0 failed, 0 skipped`:

```sh
node --test --test-concurrency=1 \
  plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts \
  plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts \
  plugins/codexclaw/test/hook-bench-compare.test.mjs
```

Artifact: remote `../baseline-tests-confirmed.log`. These tests read the named runtime modules; they do not validate future prose or the whole plugin. New verifiers in later docs are explicitly prospective until first run.

## WP0 verifier

Use an inline Node check with this unit as an absolute argument: parse the goalplan, check each nonempty phase doc and its local Markdown links, check PR source ledger integrity, then `git diff --check`. The first version of this document check ran earlier against the research files; extend its actual input set to the new roadmap before C. It proves document shape and link integrity only. Semantic/contract correctness requires the independent A audit.

At C, run that exact document check through `cxc receipt test --session 01a0702d-c493-7510-801f-7d8772a2689c -- <command>`. Receipt owner is the bound local checkout. No repository suite, build or remote model probe is smuggled into this local docs-only check.

## Risks carried forward

- Existing hook-bench discards matcher metadata and equates empty stdout with no-op; do not claim realistic activation or no work from it.
- `TraceBuilder` is opt-in explicit recording, not automatic proof of actual skill reads.
- Selected-skill body presence is not rule application; self-load should be judged by task artifacts as well as traces.
- Native CLI/source/app versions differ. Effective parent/child model, tier and tool surfaces must be observed.
- Installed trust is distinct from payload bytes. No broad trust bypass or copied blanket trust state.
- Do not turn known required invariants into tunable quality scores. User permits optimization, not weakened safety or false completion.
