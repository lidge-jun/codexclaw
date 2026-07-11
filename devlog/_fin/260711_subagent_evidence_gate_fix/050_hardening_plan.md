---
created: 2026-07-12
tags: [codexclaw, subagent, evidence-gate, hardening, plan]
---

# Hardening Plan — Evidence-Gate Defense-in-Depth

## File change map

1. `subagent-evidence.ts` — replace READ_ONLY_GREP_PATTERN generic markers with
   single token `[CXC-EVIDENCE-EXEMPT]`. grep pattern becomes fixed-string
   `grep -qF` (no regex, no locale issues). Remove old marker constants.

2. `spawn-attach-hook.ts` — in skillAffordanceBlock or runSpawnAttachHook,
   auto-inject `[CXC-EVIDENCE-EXEMPT]` when: (a) agent_type is worker AND
   (b) message contains read-only intent patterns. Export the token constant.
   Switch MAIN_ONLY_SKILL_FOLDERS → LEAF_SAFE_SKILL_FOLDERS whitelist.

3. `structure/20_pabcd_dispatch_doctrine.md` — document the token convention
   under DISPATCH-AGENT-TYPE-01.

4. Tests — update subagent-evidence.test.ts for the new token-based detection.
   Add spawn-attach-hook test for auto-injection.

## Accept criteria

1. grep -qF for exact token only (no generic markers)
2. spawn hook auto-injects token for read-only workers
3. whitelist replaces blacklist
4. tests pass, build OK
