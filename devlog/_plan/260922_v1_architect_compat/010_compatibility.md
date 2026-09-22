# wp1: schema-sensitive architect guidance and release

## File map and exact changes

MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`: replace the unconditional paragraph beginning `Architect dispatch requires` with three live-schema cases: exposed native architect -> use it; no agent_type -> leading CXC-ROLE architect in supported message/text item plus baseline skills and explicit read-only/no-child/no-FSM scope; agent_type supported but architect absent -> unmet native setup, authorized registration/fresh session, no alias substitution. The no-agent_type route is supported, not an exception needing approval. Keep actual permission gaps and user-required native isolation reportable. Preserve independent review, configured settings, overrides, fork and handle rules.

MODIFY `plugins/codexclaw/skills/pabcd/references/phase-audit.md`: extend the opening role selection clause with a no-agent_type message/items reviewer route, pointing to delegation.md. Preserve all audit verdict and independence requirements.

MODIFY `README.md`, `docs-site/src/content/docs/guides/subagents.md`, `plugins/codexclaw/agents/README.md`: replace unconditional native architect prerequisite with matching typed/native and untyped/logical cases. Label V2 sample payloads as requiring exposed fields; add a supported V1 architect message example and explain read-only scope is instruction, not sandbox enforcement.

MODIFY `plugins/codexclaw/agents/architect.toml`: clarify the two leading comments: registration is for native typed dispatch; V1 uses the logical role through its supported payload. No TOML values or developer instructions change.

MODIFY `structure/INDEX.md`, `structure/10_subagent_skill_routing.md`: synchronize the logical/native distinction and describe SpawnPayload/helper examples as V2-shaped; no new API or transport selector. Native ROLE_AGENT_TYPE map remains unchanged.

NEW this unit's three numbered documents and final evidence record. MODIFY `plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts`: extend the existing architect routing test input matrix with actual V1 message and text-items inputs without agent_type. Verify configured values, overrides and idempotency while retaining the legacy typed and V2 fixtures. This strengthens existing behavioral coverage without adding a prose test or changing the test count. No production source/manifest/version changes planned. If runtime evidence exposes a real defect, amend P decisions and re-audit before expanding.

## Acceptance and activation

1. No agent_type in live V1: attach architect skills and read-only scope through message/items; actual proposal and same-agent reflection complete without native-role registration or exception approval. Independent reviewer remains a separate agent.
2. Native architect exposed: use native type; existing native routing tests remain green.
3. Typed schema with architect missing: report setup gap; do not silently alias explorer/reviewer or claim isolation.
4. Caller overrides, full-history fork restrictions and explicit worker precedence remain covered by existing hook tests. No guard code changes.
5. Documents consistently state the three cases and distinguish logical role from enforced permission. Independent semantic audit is the oracle; gate output does not certify these sentences.
6. Before PR: git diff --check, focused 124-test command, gate.mjs and independent final diff audit. PR CI supplies full suite/platform/packed-install checks; integration owner supplies exact-SHA release checks. No new tests so inventory count unchanged by this patch.
7. Verify merged commit belongs to release ancestry and download published payload; inspect corrected delegation owner. Preserve artifact checksum and release run URL.

Field-chain: N/A, no new runtime fields/types. Enforcement: E7 instructions only; executing surface is the main agent; bypass is an agent ignoring instructions; residual risk is absent native sandbox on V1; wording explicitly calls this logical scope, not enforced protection. Runtime guards are unchanged.
