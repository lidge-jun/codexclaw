# Async user questions

Status: DONE

## Loop spec

- Archetype/trigger: satisfy-spec; user requested investigation and reusable async-question guidance, then invoked cxc-loop.
- Goal: models that receive the async question tool can discover it, send a useful question, continue independent work and incorporate a later answer correctly.
- Class/scope: C2 documentation only, one work-phase (`async-guidance`), one PABCD cycle. Main writes; Grok-4.6 leaves investigate/audit. No runtime, hook, config, provider, installed-cache, memory, push or release changes.
- Verifier: `node plugins/codexclaw/scripts/gate.mjs` checks skill/reference/SOT prose and inventory (baseline exit 0; `walkSkillMds` and `checkForbiddenClaims`, lines 147-170). `git diff --check` checks edited whitespace. Review all new relative links and simulate actual question scenarios independently with Grok. These are documentation checks, not a live user-reply test or proof of improved model success rates.
- Stop: source-backed findings, reachable coherent instructions, fresh checks, independent review, local commit and completed FSM/goalplan criteria.
- Artifact: this unit, its research and phase documents; `.codexclaw/goalplans/investigate-the-newly-exposed-request-user-input/` and session ledger.
- Outcomes: DONE for verified documentation; NEEDS_HUMAN for an indispensable missing decision; BLOCKED only under the host goal contract. No success inferred from tool availability alone.
- Escalation: report any required runtime/config change separately. Main reclaims a lane after two distinct failed agents; a write delegation requires a P amendment. No numeric budget was requested; no invented token/cost/time bound. Tools limited to authorized read-only investigation and local documentation/FSM/commit operations.

## Repository and ownership

Existing `plugins/codexclaw/skills/dev/` owns common development decisions; `interview/` owns persisted Interview state and remains unchanged; `loop/` owns scoped continuation. `structure/60_native_capabilities.md` is the native-tool inventory. Reuse those owners, not a new skill, transport, hook or service. No-code alternatives: doing nothing retains missing guidance; configuration cannot teach pending/reply behavior; reuse and extend current owners is sufficient.

```text
plugins/codexclaw/skills/
  dev/SKILL.md + references/{async-questions,skill-ownership}.md
  loop/SKILL.md
structure/60_native_capabilities.md
devlog/_plan/260906_async_questions/{000_plan,001_research,010_guidance}.md
```

## Acceptance

1. Availability is described from the current tool schema and dated local source, with model/host uncertainty preserved. A non-Astra schema observation is separate from an executed call or end-to-end reply proof.
2. The common dev entrypoint names the async tool and routes to a concrete recipe. It does not force unnecessary questions or select by model name.
3. Scenarios cover async present, absent, schema mismatch, pending optional preference, pending required input/approval, late answer and goal/Interview restrictions. The reader must choose an allowed channel, not invent arguments, answers, flags or approvals.
4. The synchronous Interview capture limitation remains explicit. No claim that a sent async question satisfies the Interview ledger or that the existing exact-name hook guards every async variant.
5. Gate, whitespace/link checks and independent scenario review pass; no unrelated code suite is needed. `quick_validate.py` baseline cannot run under system Python (missing PyYAML); use an existing compatible runtime if available, otherwise report this limit and use the repository gate plus frontmatter review.

## Continuity

First cycle, no previous D. Next direction: finish this documentation slice; any future runtime integration needs its own concrete scope and proof.

## User steering (2026-09-06)

Interview stays on its original synchronous flow. During work, leave useful async questions for the user to see, do not expect a reply, and continue asking distinct useful questions as they arise. Answers, if any, steer ongoing work. This supersedes the initial optional-wait recipe; no waiting timer, reminder loop or completion blocker for optional questions. Required authorization remains separate.

## D closure

Single PABCD cycle closed through attested D to IDLE on 2026-09-06. All three goalplan criteria met; docs gate receipt exit 0, new links and whitespace checked, independent Grok scenario verdict PASS. No Interview/runtime/config edits. Unit archived to devlog/_fin/260906_async_questions; implementation recipe remains under dev/references/async-questions.md. Local commit follows this closure. Future catalog opt-in is separate from this completed guidance slice.
