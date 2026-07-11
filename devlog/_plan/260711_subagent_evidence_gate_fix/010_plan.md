---
created: 2026-07-11
tags: [codexclaw, subagent, evidence-gate, plan]
---

# Plan — SubagentStop Evidence-Gate Fix (DISPATCH-AGENT-TYPE-01)

## Loop spec

- Archetype: spec-satisfaction repair
- Trigger: 4+ evidence-confusion incidents in session 019f4a07 (devlog 051, 071)
- Goal: read-only dispatches never receive conflicting evidence-persistence directives
- Non-goals: changing codex-rs SubagentStop schema, rewriting the evidence gate itself
- Verifier: `npm test` + `npm run build` in pabcd-state component
- Stop condition: all tests pass, doctrine codified, devlog closed
- Terminal: DONE

## Root cause

- `subagent-stop-verifying-evidence.json` hook matcher: `"^worker$"` — fires only for worker
- `subagent-evidence.ts` gate: `GATED_AGENT_TYPES = Set(["worker"])` — gates only worker
- Both already exclude `explorer`. The gate is correct; the dispatch convention is not.
- Orchestrator was using `agent_type:"worker"` for ALL dispatches including read-only
  audit/research because no rule explicitly distinguished the two.

## Fix approach (Alternative B, sol-confirmed)

### File change map

1. `structure/20_pabcd_dispatch_doctrine.md` — add DISPATCH-AGENT-TYPE-01 rule:
   - `agent_type:"explorer"` for chat-only/read-only deliverables
   - `agent_type:"worker"` for tasks that write files and need evidence verification
   - Place after DISPATCH-ECONOMY-01 in section 3

2. `plugins/codexclaw/skills/pabcd/SKILL.md` — update Delegation Model section:
   - Add cross-reference to DISPATCH-AGENT-TYPE-01
   - Clarify in DISPATCH-TASK-01 that agent_type selection is mandatory

3. `plugins/codexclaw/components/pabcd-state/src/subagent-evidence.ts` — add
   clarifying comment on GATED_AGENT_TYPES documenting the invariant:
   "Only worker agents are gated; explorer agents bypass the evidence gate.
   Dispatch convention DISPATCH-AGENT-TYPE-01: use explorer for read-only/chat-only
   deliverables."

4. `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts` — add
   test case: "DISPATCH-AGENT-TYPE-01: explorer dispatches bypass evidence gate
   regardless of last_assistant_message content" (covers the invariant explicitly)

5. `plugins/codexclaw/skills/loop/SKILL.md` — add note in dispatch-related section
   referencing DISPATCH-AGENT-TYPE-01

### OUT of scope

- dist/ rebuild (done in C phase)
- codex-rs upstream changes
- docs-site / pabcd_initiative
- Other hooks
- Changing GATED_AGENT_TYPES itself (it's correct as-is)

### Accept criteria

1. DISPATCH-AGENT-TYPE-01 codified in dispatch doctrine with clear rule
2. pabcd SKILL.md references the new rule
3. Clarifying comment in subagent-evidence.ts
4. New test case passes
5. All existing tests pass
6. Build succeeds
