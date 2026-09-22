# Observe hook execution and protect task-owned automations

Maintainers need to distinguish recorded hook trust from actual invocation, and keep one task from accidentally changing another task's heartbeat. This unit adds bounded invocation evidence and an ownership check on the plugin-visible automation tool path. It also makes pending task creation and unobservable memory gates explicit. Native host defects remain open where this plugin cannot fix them.

Reader: a maintainer deciding whether to merge and deploy these changes; familiarity with Codexclaw is assumed.

## Loop contract

Satisfy-spec HOTL, triggered by the user's request to implement the four remaining issues, use inherited subagents, publish PRs, merge and deploy. C4 ownership/delivery, C3 observation/contracts. Scope is this checkout and existing GitHub/plugin installation credentials. No user token, cost or wall-clock bound was specified; native limits apply and parallel work remains bounded. No native DB writes, host binary patches, quota bypass, new services or role preference changes. DONE requires reviewed fixes, exact-head CI, merge, release and installed payload verification. Missing native API remains a documented residual, never a fake completion claim. Evidence lives in this unit and .codexclaw/evidence. Escalate only concrete missing authority/access or a safety conflict.

## Existing owners and ordered work

```
plugins/codexclaw/
  components/cxc-ops/        observation store + doctor
  components/pabcd-state/   automation call guard
  components/recall/        read-only memory status
  components/*/src/*cli*    existing hook ingress
  scripts/check-lane-packet.mjs
  hooks/                    registered commands
structure/INDEX.md          source-of-truth map
```

- wp0: docs-only roadmap, architecture reflection and independent audit.
- wp1: invocation observations and heartbeat ownership safeguard; 010 defines disjoint workers.
- wp2: pending identity and truthful memory diagnostics; 020 consumes verified boundaries.
- wp3: integration/version, ordinary PR to dev, promotion to main, release and local installation; 030 defines evidence.

One branch, ordered commits and ordinary PRs; no native stacks. Main owns all Git/FSM/delivery operations. Children share this checkout and only edit named disjoint paths. Parent-model inheritance uses V1 fork_context with no model/effort overrides. Runtime turn_context verified gpt-6-astra/high for initial children. Review independence is task/lens independence, not model-family independence.

## Architecture consultation

Architect 01a0c8ff-84e0-7443-8d4a-3686821b05b1 proposed D1-D8. D1 and D3-D8 accepted. D2 amended: instrument existing CLI ingress with a shared scripts/hook-observation.mjs leaf helper instead of adding a child-process wrapper to every hook; avoid latency, signal and universal trust-declaration churn. Evidence means invocation only, not authenticated host provenance or successful enforcement. Reflection on this plan revision is required before A.

## Evidence and continuity

Baseline ec9f3f6: npm ci --ignore-scripts exit 0; npm run build exit 0; node plugins/codexclaw/scripts/gate.mjs exit 0. Gate traverses declared skills/reference/structure docs for existing drift checks; semantic plan correctness is independent review. Full baseline suite completed: 3480 tests, 3477 pass, 3 skipped, 0 failures (146.5 seconds). New verifier files are planned and will first execute in B/C; no pass claimed now.

D continuity records follow after each verified cycle. #209 and #191 stay open until native mapping/routing fixes exist; #213 stays open for host-atomic enforcement. #208 closure requires actual installed invocation observation, not a manually replayed hook fixture.

wp0 D conclusion: roadmap locked after architect ALIGNED and independent reviewer 01a0c905-fd7e-7063-a671-a33208f12b11 PASS (staged plan digest b348efc6f209ce383842b2e975833449875be46ccb19ab110635e2488b3cc823). Reviewer independently ran docs gate and 40 focused baseline tests; no blockers. Next cycle executes 010; accepted design decisions remain unchanged. Native residuals did not improve in this docs-only cycle. A failing package import or ownership-negative test would invalidate readiness and requires repair before delivery.
