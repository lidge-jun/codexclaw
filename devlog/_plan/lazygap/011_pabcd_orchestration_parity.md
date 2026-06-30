# 011 — PABCD Orchestration Parity (Seed / Friction / Workspace-Context / Plan-Inject)

Gap class: HARNESS (orchestrator depth) · evidence: 2 parallel explorers (Arendt/Planck-class) reading `cli-jaw/src/orchestrator/*` against `pabcd-state/`

> The attest gate is DONE — codexclaw's `fsm.ts`/`attest.ts` are equal-or-stricter parity
> with cli-jaw's `attestation.ts` (same 4 forward edges P>A/A>B/B>C/C>D, same placeholder
> rejection, plus codexclaw flips `auditPassed/checkPassed` only on a passing attest, which
> cli-jaw doesn't). The remaining gaps are the **orchestrator context** cli-jaw carries that
> codexclaw documents but hasn't coded: Seed, Friction ledger, Workspace-context, and
> runtime Plan auto-inject.

## Parity table (code-grounded)

| cli-jaw 실측 | codexclaw 유무 | 격차 | no-server 도입 |
| --- | --- | --- | --- |
| `attestation.ts:37,107-152` 4-edge gate + did/placeholder/checkOutput/exitCode | ✅ equal-or-stricter (`attest.ts:35,76-112`, `fsm.ts:108-142`) | none | already shipped |
| `friction.ts:11-72` sha256(tool:error) ledger, count>=2 escalate / >=3 stop, oscillation `verdictHistory` | ❌ absent (repo grep 0) | no retry->escalate->stop verdict, no oscillation detect | ✅ **PostToolUse hook already exists** (`hook.ts:450`); replace the in-memory Map with `.codexclaw/friction.jsonl`, read verdict in Stop/PreToolUse |
| `seed.ts:1-107` OntologyEntity/Field/Relationship(owns/references/contains)/invariants + acceptanceCriteria/exitConditions + render + buildSeedFromEvidence | ⚠️ label only (`interview.ts:20` has the string `"ontology"`, no schema) | no structured seed type/builder/render/handoff | ✅ pure data transform; add `ontologySchema` to the interview tracker + port the render fn |
| `workspace-context.ts:25-136` resolveWorkspaceRoot + buildResolvedPathHints (token->abs + exists/symlink-outside) + authoritative root block (distrust cwd) | ❌ absent (grep 0); only prose in `pabcd/SKILL.md:98` | no path resolver / hint builder / symlink-escape check | ✅ pure `existsSync`/`realpathSync` + path; inject via UserPromptSubmit additionalContext |
| `pipeline.ts:171-185` `## Approved Plan (authoritative)` + consistency guard auto-inlined into dispatch (`orchestrate.ts:356,666`) | ⚠️ doctrine only (`20_pabcd_dispatch_doctrine.md:33`) | no inject code; hook directives don't carry plan body | △ partial — hooks can't author a subagent task body, so runtime force is impossible; ceiling is "store plan in `.codexclaw/`, directive says read+inline it" + the consistency-guard text in the B directive |
| `state-machine.ts:294-592` STATE_PROMPTS very detailed (interview 4-dim, tier dispatch, ready criteria) | ⚠️ compressed (`hook.ts:79-113`, 2-4 lines/phase) | questioning-strategy / ready-criteria detail thinned | ✅ pure strings; expand directives to needed depth |
| `distribute.ts:369-619` runSingleAgent (spawn/monitor/session-resume/phase-merge), worker-monitor/status/watch/replay | ❌ structurally absent (by design) | no server worker orchestration | ✕ non-goal — replaced by Codex `spawn_agent` subagents per doctrine; operator surface is out |

## The three cleanest imports (pure function + file IO, server-free)

1. **Friction signature ledger + oscillation** — the highest-leverage add. The PostToolUse
   hook is *already wired and firing* (`post-tool-use-capturing-interview-answers.json`).
   Swapping cli-jaw's in-memory `Map` for `.codexclaw/friction.jsonl` restores the full
   retry->escalate->stop verdict and the done/needs_fix oscillation guard. This is the one
   parity item that turns into a real **E1/E2 runtime gate** (deny the retry, or block Stop
   with an escalate directive), not just prose.
2. **Workspace-context resolver/block** — `existsSync`/`realpathSync` only. Resolves the
   project-root-authority + symlink-escape gap and injects an authoritative path block via
   UserPromptSubmit. Pure E4 directive, but a *grounded* one.
3. **Seed ontology schema + render** — `seed.ts` is pure transform; absorb it into the
   interview tracker as an `ontologySchema` field + a render function. Makes the interview's
   "ontology" dimension a real artifact instead of a label.

## Constrained item

**Shared Plan auto-inject** is genuinely partial. cli-jaw's *server* injects the approved
plan into each spawn task body (`orchestrate.ts:356`). codexclaw hooks cannot write a
subagent task body, so runtime enforcement is impossible. The honest ceiling: persist the
frozen plan to `.codexclaw/`, add a B-phase directive that says "read the Approved Plan and
inline it into every spawn", and add cli-jaw's 5-point consistency guard text
(`pipeline.ts:177-183`: don't change numbers/paths/resource-IDs). That is E4+E7, never E3.

## Enforcement-tier ledger

- Friction ledger -> **E1 (deny repeat) + E2 (Stop escalate block)** — the real win.
- Workspace-context block -> E4 (grounded directive).
- Seed schema -> E7 artifact + feeds the interview freeze (E1 via existing freeze gate).
- Plan auto-inject -> E4 directive + E7 guard text (runtime force impossible, stated plainly).
- Expanded phase directives -> E4.

## Proposed slice

One loop (decade 270, `L27`): friction ledger first (it's the only new runtime gate and the
hook already exists), then workspace-context block, then seed schema. Plan auto-inject and
directive-depth expansion ride along as E4/E7 text changes in the same loop since they touch
the same `hook.ts` directive surface.
