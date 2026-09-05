# wp1 — global native/manual stack awareness

Depends on: none. One complete PABCD; no additional implementation decades.

## Exact change map

### MODIFY `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts`

Add `renderStackedPrAffordance(): string` beside the existing static renderers. Complete intended content:

```ts
/** Global discovery only; the agent verifies membership and CI on demand. */
export function renderStackedPrAffordance(): string {
  return [
    "[codexclaw] For PR creation/review/merge or dependent branches (stacked PR/스택 PR),",
    "read $codexclaw:cxc-dev references/stacked-prs.md (DEV-STACK-06/07), even without",
    "a DevOps trigger. A parent base or Can Stack banner is not native stack registration;",
    "verify GitHub membership and CI separately. Per-PR CI is expected, not proof of a broken stack.",
    "This is guidance, not authorization to register, restack, cancel CI, or merge.",
  ].join(" ");
}
```

Before: both lifecycle handlers push `renderLoopAffordance()` but no stack guidance.
After: immediately after that call in **both** `runMapAffordanceSessionStart` and `runPostCompactAffordance`, push `renderStackedPrAffordance()`. Preserve event names, size gate, identity and all existing guidance. No conditional path, new imports, external tools or state mutation.

### MODIFY `plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts`

Import `runPostCompactAffordance`. Extend the existing critical-loop visibility case to check a bounded stack pointer in an empty repo's SessionStart and PostCompact envelopes. Require canonical reference/rule ids, native-registration distinction and no authorization claim; check the envelope has no permission decision. Extend malformed-input fallback coverage to retain the pointer. Extend the existing symlink CLI case to assert the emitted stack pointer and invoke `hook post-compact`, checking the actual shipped CLI output, not source wording. Existing top-level test count stays unchanged. Run these new assertions before source implementation for RED, then after build for GREEN.

### MODIFY `plugins/codexclaw/skills/dev/references/stacked-prs.md`

Insert `DEV-STACK-06 — Recognize and register deliberately` after the model:

- Act on PR/dependency semantics, parent-base discovery, English/Korean stack requests, not only a DevOps keyword; no generic CSS/runtime-stack trigger.
- Separate manual branch chain, confirmed native stack and unknown membership.
- Read PR base/head and repo identity, then GET the documented stacks endpoint with `pull_request=N`; inspect successful membership, ordered PR numbers and trunk. Successful `[]` means no membership reported; errors/unsupported APIs remain unknown.
- `gh pr create --base`, body maps, labels and Can Stack are not registration. For authorized GitHub stack publication prefer native registration; use available `gh stack submit`, website confirmation or documented REST POST with bottom-to-top numbers. Publishing/registering is a write; inspect/help first, never install automatically. Verify membership afterward and report fallback/unavailability honestly.

Insert `DEV-STACK-07 — Diagnose CI independently`:

- Record topology, native membership, head/check SHA and workflow event/ref/concurrency as separate facts.
- Native stack registration does not deduplicate CI; all-layer CI is expected. Manual chains depend on actual workflow filters and branch rules.
- Distinguish different PR runs from same-PR duplicate events, historical reruns, or cancellations; unknown cause stays unknown.
- Optimization is separate authorized workflow work, with required-check coverage and exact-head proof. No blanket top-only skips/cross-layer cancellation based on a stack name.

Qualify existing native-only CI/protection and merge paragraphs (DEV-STACK-03/04 and anti-patterns). Manual top-child merge targets its base branch, not automatically trunk; manually retarget/restack children before parent deletion and verify new base/head checks. Remove the unsolicited global `rebase.updateRefs` setting from the recipe; prefer invocation-scoped behavior. Update tooling to separate branch setup from registration and link freshly opened official sources. Keep other rules and vendor caveats intact.

A-audit amendment: native stack API merging requires the documented asynchronous API, not legacy synchronous merge endpoints. Accepted/queued is not merged: poll to a terminal result and verify actual landing; protection checks can fail after acceptance. Include an accepted-then-protection-failure forward scenario without any real merge.

### MODIFY routing pointers only

- `skills/dev/SKILL.md`: refine existing metadata sentence to include native membership and CI diagnosis; add an early global PR/dependency routing paragraph before the overlay table and extend that table's stack scope. Keep `allow_implicit_invocation` untouched.
- `skills/dev-devops/SKILL.md`: add stacked-PR CI to description, a canonical-reference row in the routing table, and replace §2.1 sizing-only pointer with `DEV-STACK-03/06/07`. No duplicated procedure or broad implicit enablement.

### MODIFY `structure/INDEX.md`

Update the existing SessionStart and PostCompact hook rows to mention global stack guidance. Add one short Skills Map paragraph locating DEV-STACK-06/07 and explaining that advice is always available but membership/CI inspection is on demand, not performed by the hook.

### GENERATED `plugins/codexclaw/components/cxc-ops/dist/map-affordance.js`

Regenerate with the repository build command. Confirm only the expected dist delta remains; do not hand-edit generated output or upgrade versions.

## Final verification and delivery

Use the commands already run in `000_plan.md`; check all cxc-ops affected tests if useful, without running the repository-wide suite. Independently review every changed file and run forward scenarios: manual chain + Can Stack, confirmed native + per-layer CI, API error, and unrelated stack vocabulary. This semantic review is not replaced by phrase-matching SKILL.md tests. Commit focused increments, push only `codex/stack-awareness`, open one PR to `dev`, verify head and checks. Archive this unit at D while preserving the ledger's historical plan pointer.
