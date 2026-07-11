# 030 — Phase 3: reviewer search baseline (attachment)

Write scope (disjoint):
`plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts`,
`plugins/codexclaw/components/subagent-config/test/*.ts`,
`plugins/codexclaw/skills/search/SKILL.md`. Nothing else.

Mechanism recap (001 RC3): `inferRole` (spawn-attach-hook.ts) already upgrades
audit/review-worded spawns to `reviewer`; the gap is only that the reviewer
baseline carries no `search`. One-line fix + tests + doctrine echo.

## 1. src/spawn-wrapper.ts — MODIFY

Replace:

```ts
export const ROLE_BASE_SKILLS: Record<RoleName, string[]> = {
  explorer: ["dev"],
  reviewer: ["dev", "dev-code-reviewer"],
  executor: ["dev"],
};
```

with:

```ts
export const ROLE_BASE_SKILLS: Record<RoleName, string[]> = {
  explorer: ["dev"],
  reviewer: ["dev", "dev-code-reviewer", "search"],
  executor: ["dev"],
};
```

and extend the preceding doc comment's reviewer sentence to:
"the reviewer additionally anchors on the `dev-code-reviewer` review skill
(read-only adversarial review) and `search` (A-gate reviewers must verify
references/versions/external claims through the search ladder —
SEARCH-ATTACH-01)."

## 2. skills/search/SKILL.md §SEARCH-ATTACH-01 — MODIFY

After the first paragraph's sentence ending "...do not duplicate it as prose in
the spawn message." append:

```text
PABCD A-gate audit/reviewer dispatches are in scope too: a plan auditor must
verify references and external/current claims, so the audit dispatch packet
attaches `$cxc-search` alongside `$cxc-dev-code-reviewer` (AUDIT-LOOP-01), and
the reviewer role baseline carries it by default (spawn-wrapper
`ROLE_BASE_SKILLS.reviewer`).
```

## 3. Tests — MODIFY/ADD

### test/spawn-wrapper.test.ts

- UPDATE the `resolveAttachedSkillFolders("reviewer", ["security", "code-review"])`
  expectation (~line 163-164) from
  `["dev", "dev-code-reviewer", "dev-security"]` to
  `["dev", "dev-code-reviewer", "search", "dev-security"]` (base-first order,
  surface dedup unchanged).
- Scan the file for other reviewer-baseline assertions (mention block content,
  items payloads) and update them the same way.

### test/spawn-attach-hook.test.ts

- ADD regression test (c4): a PreToolUse `spawn_agent` payload with
  `agent_type: "explorer"` and message
  `"Audit the plan at devlog/_plan/x/000_plan.md adversarially; challenge assumptions and verify references."`
  (no literal "search" substring) must produce an `updatedInput.message`
  containing BOTH `dev-code-reviewer/SKILL.md` and `search/SKILL.md` mentions.
  Follow the file's existing harness (CODEXCLAW_SKILLS_DIR fixture, JSON stdin
  envelope).
- ADD dedup case: same message but already containing `$cxc-search` -> the
  mention block must NOT duplicate the search skill (excludeFolders path).

## Verification (phase-local)

```sh
cd plugins/codexclaw/components/subagent-config && npm test
rg -n "A-gate audit" plugins/codexclaw/skills/search/SKILL.md
```

All tests green; SEARCH-ATTACH-01 extension grep-verifiable. dist/ is NOT
rebuilt in this phase: the MAIN session runs root `npm run build` + root
`npm test` (dist-freshness) at C (audit round 1 B1) — workers never touch dist/.
