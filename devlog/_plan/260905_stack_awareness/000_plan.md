# Stack awareness — one cohesive work-phase

## Loop spec

- Class: C3, spec-satisfaction repair; one PABCD cycle (`wp1`).
- Trigger: user asks for global and DevOps stack awareness and a CodexClaw PR.
- Goal: distinguish a branch chain from a registered GitHub stack without requiring DevOps invocation; diagnose CI separately.
- Non-goals: no OpenCodex writes, CI cancellation or optimization, merge, release, install, global Git/config changes, new stack manager or prompt regex.
- Verifier: focused hook tests, manifest policy tests, dependency-free build/layout validation, content gate, independent semantic/forward review, remote PR head/checks.
- Stop: requested scoped PR exists, fresh checks and review support the claims, goalplan evidence captured.
- Memory: this unit plus the session-bound goalplan and ledger in the same checkout.
- Outcomes: DONE, NOOP, NEEDS_HUMAN, UNSAFE, BLOCKED, BUDGET_EXHAUSTED with real evidence, not unfinished work disguised as a blocker.
- Escalation: main reclaims a packet after two distinct reviewer failures; a new worker/write scope requires a P amendment. Ask before crossing external authority.
- Resources: local repo edits and Node checks; authenticated `gh` reads of OpenCodex; GitHub docs reads; CodexClaw branch push and PR creation authorized. No added dependencies or paid services; no explicit token budget; 120-minute wall-clock bound.

## Residence and shape

```text
plugins/codexclaw/
  components/cxc-ops/{src,dist}/map-affordance.{ts,js}
  components/cxc-ops/test/map-affordance.test.ts
  skills/dev/{SKILL.md,references/stacked-prs.md}
  skills/dev-devops/SKILL.md
structure/INDEX.md
devlog/_plan/260905_stack_awareness/{000_plan,001_evidence,010_implementation}.md
```

Reuse `map-affordance.ts` and its SessionStart/PostCompact callers; keep the canonical stack owner and on-demand DevOps visibility policy. One thesis, one branch `codex/stack-awareness`, one PR targeting `dev`; no artificial stack for this compact fix. Initial HEAD and freshly fetched `origin/dev` both `01c2bc2a`.

No-code options: doing nothing leaves native-only promises attached to manual chains; deletion alone cannot restore discovery; configuration changes would expand scope and make DevOps globally implicit; reuse wins. Add only one bounded static guidance renderer to the existing global envelope, with no network, state fields, subprocesses or lexical prompt classifier.

## Acceptance

1. Global guidance exists at SessionStart in an empty/non-Git repo without prompt/DevOps keywords, and after PostCompact. Emission is advisory, never a claim that the repo has a stack or that a skill was loaded.
2. `dev` routes PR creation/review/merge, dependent branches and a parent-base discovery to the canonical owner. Generic runtime/CSS stacks do not authorize GitHub operations.
3. Canonical rules distinguish manual chain / native membership / unknown API access; base links, titles, a body stack map and the Can Stack banner cannot certify native registration.
4. Read-only `gh` inspection captures repo identity, base/head, native membership, exact-head CI and event/concurrency context. Native registration uses documented UI/CLI/API only when authorized and verifies after writing.
5. Per-PR CI is expected; native registration alone is not deduplication. No top-only CI, cross-layer cancellation, blanket skip or branch-protection bypass is introduced.
6. Native merge/rebase/protection promises are qualified; a manual child merge is not a trunk landing. Preserve children until retarget/restack and reverify exact heads after changes.
7. Focused tests, generated dist, gates and independent review pass. Publish the scoped PR, report the real remote head and CI state, and do not mutate OpenCodex.

## Verifier preflight (2026-09-05)

- `node --test plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts plugins/codexclaw/test/manifest-policy.test.mjs`: exit 0, 17/17. Direct arguments cover the changed runtime via imports, emitted CLI envelope and implicit policy; does not validate semantic prose.
- `node plugins/codexclaw/scripts/build.mjs`: exit 0, 156 files, layout validated. `COMPONENTS` includes `cxc-ops`; `compileComponent` reads its `src/**/*.ts`. This strips types, NOT a TypeScript typecheck; no component tsconfig exists.
- `node plugins/codexclaw/scripts/gate.mjs`: exit 0. Reads all SKILL.md and `structure/*.md` for false-enforcement claims and inventory. It does not certify stack guidance meaning; independent review owns that.
- Red/green will extend existing hook tests to require the new output on both lifecycle surfaces; current tests are preserved, not skipped or weakened.
- No repository-wide local test suite. Cross-platform full coverage stays on PR CI; current CI has a published test-count gate, so extending existing cases keeps the count unchanged.
- Skill-creator `quick_validate.py` preflight could not start: local Python lacks `yaml` (`ModuleNotFoundError`). No dependency installed; repository manifest-policy tests cover skill frontmatter/implicit policy, and independent review covers meaning. This missing optional validator is not represented as a pass.

## Advisory boundary

Tier E1/E7; executing surface is existing SessionStart/PostCompact `additionalContext` plus agent-followed skills. Known bypass: hooks disabled, prompt/context ignored, or model fails to read owner. Residual: advisory cannot enforce stack registration or CI policy. Wording is explicitly discovery/advice, not enforcement. Final enforcement layer: none added.

No field/enum chain is introduced. New renderer creates a constant string; existing envelope serializes it into `additionalContext`, host reads it as guidance. No persisted state or new consumer schema.
