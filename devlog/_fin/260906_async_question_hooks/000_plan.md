# Common async question guidance

Status: DONE

## Loop spec and settled requirements

- Archetype: satisfy-spec. Trigger: user requested a common hook policy, synchronous Interview exception and PR publication after the earlier docs patch.
- Goal: useful questions are allowed during ordinary and goal work; prefer exposed async outside Interview, expect no reply, continue work and incorporate later answers.
- Constraints: preserve native availability and higher-priority host rules, synchronous Interview capture and blocking goal guard. No catalog changes, installation/retrust, merge or release. User authorized implementation choices, push and PR.
- Success: SessionStart and PostCompact emit the guidance without a phase/goal/size prerequisite, child recipients route questions to main, synchronous/async boundaries remain correct, focused checks and PR head are verified.
- Ontology: plugin guidance, native tool availability, Interview readiness and actual approval are different things. Async permission does not create a missing tool or turn silence into consent.
- Class: C2 focused hook-message slice; no permission decision logic changes. One work-phase `hook-guidance`, one PABCD cycle. Previous D: ba9fa32c delivered skill guidance only; this explicit follow-up adds common discovery and PR delivery.
- Verifier: existing map-affordance + goal-gate suites (baseline 47/47, exit 0), emitted dist checks, build and documentation gate, independent Grok review and exact PR head/CI inspection. No configured tsc project; repository build uses Node type stripping.
- Stop: scoped source/docs/tests committed, cycle closed, branch pushed and PR URL/head confirmed. Remaining CI is reported by actual state; repair attributable failures before completion.
- Artifacts: this unit and the bound goalplan. DONE requires fresh evidence; missing authority/capability is reported without inventing success. No numeric budget was requested.
- Escalation: unrelated runtime/provider/catalog changes are out of scope. Main reclaims a lane after two distinct agent failures; write delegation requires a P amendment. Grok-4.6 read-only review is authorized; use Aside for meaningful browser checks.

## Existing owners and reuse

`cxc-ops/src/map-affordance.ts:225-291` already emits common SessionStart and
PostCompact pointers via `cxc-ops/src/cli.ts:116-128`. Use that owner instead of
adding a hook, stateful timer or scheduler. `pabcd-state/src/goal-gate.ts:133-139`
denies only synchronous `request_user_input`; async already passes. Its wording
will clarify that distinction, without changing permission behavior.

One cohesive PR includes ba9fa32c and this hook extension; a stack would split the
same user-visible behavior unnecessarily. Base is `dev`, required by `.github/workflows/enforce-pr-target.yml:24`;
GitHub default `main` is reserved for the dev promotion exception. Never merge as part of this request.

## Acceptance paths

| Trigger | Observable proof |
|---|---|
| Empty/small ordinary workspace starts | SessionStart output contains one concise async pointer |
| Context compacts with no phase/goal lookup | PostCompact output contains the same policy |
| Child receives the common pointer | Wording routes candidate questions to main; no new child questioning capability |
| Active goal: synchronous call | Existing denial remains and explicitly says blocking/synchronous |
| Active/unreadable/inactive goal: async names | Existing guard returns empty passthrough; no new allow override |
| Actual Interview | Skill explicitly uses synchronous tool and forbids async substitution for ledger-backed rounds |
| Async missing or higher-priority host denial | No invented tool, flag change, blocked-call bypass or optional blocking fallback |

Guidance is E4 injected text plus E7 skill prose, not tool-use enforcement.
Known bypass: model ignores text or host does not run trusted hooks. Residual:
no guaranteed question invocation or delivery. Final new enforcement layer: none.

## D closure

Implementation cycle closed to IDLE after fresh 48-pass receipt and independent C PASS. The question policy is delivered by existing common hooks and does not change native tool exposure or permission decisions. Unit archived; authorized branch push and dev-target PR follow. Future changes to model catalogs or Interview runtime remain separate.
