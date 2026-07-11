---
created: 2026-07-11
tags: [codexclaw, subagent, evidence-gate, sol-discussion, design]
---

# Sol Discussion — Design Alternatives for Evidence-Gate Fix

Dispatched: gpt-5.6-sol (Bacon), agent_type: explorer.

## Alternatives Analyzed

| Alt | Mechanism | Reliability | Simplicity | Robustness | Verdict |
|-----|-----------|-------------|------------|------------|---------|
| A | last_assistant_message marker | Low-medium | Small gate + prompt changes | Weak (child compliance) | Escape hatch only |
| B | agent_type:"explorer" for read-only | High | Zero gate changes | Strong (schema-level) | **RECOMMENDED** |
| C | Transcript-based detection | Medium | High complexity | Weak (text matching) | Avoid |
| D | agent_id naming convention | Medium-high | Small | Medium (fragile naming) | Inferior to B |

## Recommendation (ACCEPTED)

**Alternative B** — establish the invariant: chat-only audit/research dispatches
use `agent_type:"explorer"`; tasks expected to write `.codexclaw/evidence/` use
`agent_type:"worker"`. The existing gate (`GATED_AGENT_TYPES = Set(["worker"])`)
and the hook matcher (`"^worker$"`) already implement the correct filtering.
The fix is a convention/documentation change backed by explicit tests.

## Main-session triage

Sol's analysis is accurate. The key insight: the gate code already works correctly
for explorer agents — both the hook JSON matcher (`"^worker$"`) and the code-level
`GATED_AGENT_TYPES` exclude explorer. The bug is purely a dispatch convention gap:
the orchestrator was using `agent_type:"worker"` for read-only dispatches because
no rule explicitly said not to.

The fix surface:
1. Doctrine: codify `DISPATCH-AGENT-TYPE-01` rule in dispatch doctrine
2. Skill text: update cxc-pabcd delegation section
3. Code: add clarifying comment + dedicated test documenting the invariant
4. Devlog: document the analysis, incident evidence, and fix
