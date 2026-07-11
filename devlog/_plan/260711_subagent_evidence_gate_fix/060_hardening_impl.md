---
created: 2026-07-12
tags: [codexclaw, subagent, evidence-gate, hardening, impl-record]
---

# Hardening Implementation Record

## Changes

### 1. Structured token replaces generic grep (subagent-evidence.ts)

`EVIDENCE_EXEMPT_TOKEN = "[CXC-EVIDENCE-EXEMPT]"` replaces 9 generic markers
(read-only, readonly, chat-only deliverable, etc.). grep switches from
`-qiE` (regex, case-insensitive) to `-qF` (fixed-string, no regex/locale).

Why: sol Beauvoir identified HIGH false positive risk — generic markers like
"read-only" appear naturally in system prompt content (skill descriptions,
safety instructions, memory). The structured token is ASCII-only high-entropy
and codexclaw-specific, eliminating accidental matches.

### 2. Whitelist replaces blacklist (spawn-attach-hook.ts)

`MAIN_ONLY_SKILL_FOLDERS` (8-item blacklist) replaced by
`LEAF_SAFE_SKILL_FOLDERS` (20-item whitelist). New skills are invisible to
subagents until explicitly reviewed and added.

Why: sol Beauvoir + Descartes identified MEDIUM risk — blacklist fails open
for new skills. Descartes specified explicit Set over prefix-based matching
("dev- prefix auto-exposes future dev-* skills").

### 3. Auto-injection (spawn-attach-hook.ts)

When agent_type is "worker" AND the message contains read-only intent markers
AND the token is not already present, the spawn hook prepends
`[CXC-EVIDENCE-EXEMPT]` to the message. This is plaintext convenience only —
V2 ciphertext surfaces require explicit dispatcher inclusion (sol Descartes
blocker).

`hasReadOnlyIntent()` checks the spawn message (not transcript) for intent
markers. The function is exported for testing.

### 4. Tests

- Token present in transcript → release
- Token deep in transcript (30KB offset) → release
- Generic "read-only" text WITHOUT token → still blocks (false positive eliminated)
- No token → still blocks

## Verification

- pabcd-state tests: 33 pass, 0 fail
- subagent-config tests: 137 pass, 0 fail
- build: 102 files compiled, layout validated
