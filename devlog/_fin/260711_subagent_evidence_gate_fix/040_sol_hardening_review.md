---
created: 2026-07-12
tags: [codexclaw, subagent, evidence-gate, sol-review, hardening]
---

# Sol Conceptual Hardening Review (Beauvoir)

## Findings triage

| # | Issue | Severity | Action | Disposition |
|---|-------|----------|--------|-------------|
| 1 | False positive: "read-only" in system prompt releases genuine workers | HIGH | PATCH | ACCEPT — replace generic markers with structured token |
| 2 | Structured marker > free-text grep | HIGH | PATCH | ACCEPT — merged with #1/#7 |
| 3 | Blacklist MAIN_ONLY → whitelist LEAF_SAFE | MEDIUM | PATCH | ACCEPT — whitelist is fail-closed |
| 4 | grep at scale (6 concurrent) | LOW | ACCEPT | ACCEPT — not a bottleneck |
| 5 | Unicode/locale edge cases in grep | MEDIUM | PATCH | RESOLVED BY #1 — token is ASCII-only |
| 6 | Layer ordering correct | NONE | ACCEPT | ACCEPT |
| 7 | Missing: spawn-time exemption marker | HIGH | PATCH | ACCEPT — spawn hook auto-injects token |

## Design decision (merges #1 + #2 + #5 + #7)

Replace all generic grep markers with one high-entropy structured token:
`[CXC-EVIDENCE-EXEMPT]`. This token:
- Is ASCII-only (eliminates unicode/locale issues — #5)
- Cannot appear accidentally in system prompt content (eliminates false positives — #1)
- Is a structured marker, not free-text (satisfies #2)
- Can be auto-injected by the spawn hook at spawn time (satisfies #7)

Spawn hook injection: when agent_type:"worker" AND the message contains
read-only patterns, the spawn hook injects `[CXC-EVIDENCE-EXEMPT]` into the
message. SubagentStop greps for this exact token only.

## Whitelist decision (#3)

Switch from MAIN_ONLY_SKILL_FOLDERS (blacklist) to LEAF_SAFE_SKILL_PREFIXES
(whitelist). Fail-closed: a new skill folder is invisible to subagents until
explicitly reviewed and added to the whitelist.
