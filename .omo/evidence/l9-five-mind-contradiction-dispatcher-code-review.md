# L9 Five-Mind Contradiction Dispatcher - Code Review

codeQualityStatus: BLOCK
recommendation: REQUEST_CHANGES
Reviewer mode: read-only adversarial review. No production or test fixes were made.

## Skill-Perspective Check

- `remove-ai-slops`: unavailable in the configured skill locations (`/Users/jun/.cli-jaw-3458/skills`, `/Users/jun/.codex/skills`); applied the prompt's remove-ai-slops criteria manually.
- `programming`: unavailable in the configured skill locations; applied the prompt's programming criteria manually.
- Violations found: yes. The tests mirror the implementation's `mind` field instead of the frozen L9.2 `correlationId` contract, and they do not cover side-effect key stripping or unsupported non-reference evidence strings.

## Evidence

- Frozen specs inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/091_L9.1_five_mind_role_definitions.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md`
  - `/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/093_L9.3_loop_coordinator_t4.md`
- Implementation inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/dist/minds.js`
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/interview.ts`
- Tests inspected:
  - `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts`
- Diff inspected: `git diff --find-renames --find-copies HEAD~1..HEAD -- plugins/codexclaw/components/pabcd-state/src/minds.ts plugins/codexclaw/components/pabcd-state/test/minds.test.ts plugins/codexclaw/components/pabcd-state/dist/minds.js`
- Runtime probe: `normalizeMindOutput()` strips extra keys such as `action`, `question`, `planEdit`, `stateWrite`, and `optionChoice`; accepted output keys were only `mind`, `dimension`, `contradiction`, `severity`, and `evidence`.
- `npm test` from repo root: 120 tests, 120 pass, 0 fail.

## Findings

### CRITICAL

None.

### HIGH

1. Accepted contradictions do not carry the frozen exact correlation key.

`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:48`
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:49`
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:50`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:73`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:74`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:93`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:107`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:108`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:50`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:53`

The frozen L9.2 hardening pin makes the correlation field name exact: `correlationId: string`, formatted as `<roundId>-<mindId>`, present on dispatch input and every accepted contradiction. The implementation instead exposes only `mind: Mind`; `normalizeMindOutput(mind, raw)` has no `roundId` or `correlationId` input and pushes accepted items with `mind` but no `correlationId`. This preserves which Mind produced the item, but it loses the pinned round+Mind key and does not satisfy the source-of-truth contract.

The current test reinforces the mismatch by asserting `out[0].mind === m` rather than the frozen `correlationId` field. That is an implementation-mirroring test, not a spec test.

### MEDIUM

1. Evidence validation accepts any non-empty string, despite the spec requiring source-shaped evidence and rejecting unsupported guesses.

`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/090_L9_five_mind_contradiction_dispatcher.md:51`
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:17`
`/Users/jun/Developer/new/700_projects/codexclaw/devlog/_plan/mvp_res/092_L9.2_contradiction_only_dispatch_protocol.md:18`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:102`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:106`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/src/minds.ts:112`

The validator rejects missing or whitespace-only evidence, but accepts arbitrary non-empty strings such as `trust me`, `unsupported guess`, or `probably in the plan`. L9.2 says evidence must be a file:line, section reference, or exact short source quote, and unsupported guesses are rejected. Some semantic verification is inherently hard without source context, but the current boundary is weaker than the frozen protocol and can admit evidence-bearing-looking contradictions that are unsupported.

### LOW

1. Test coverage misses adversarial acceptance criteria around smuggling and exact protocol fields.

`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:29`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:38`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:50`
`/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/components/pabcd-state/test/minds.test.ts:57`

The new tests cover missing dimension, invalid severity, empty contradiction, whitespace evidence, top-level malformed output, cap length, and one lowest-dimension route. They do not assert that extra side-effect keys are stripped, do not assert that only the contract fields plus correlation field survive, do not assert the exact `correlationId` name/format, do not cover arbitrary non-reference evidence, and do not cover malformed tracker shapes beyond `null`.

## Positive Checks

- `normalizeMindOutput()` has no spread or passthrough. Extra side-effect keys are stripped from accepted items.
- Missing/invalid dimension, invalid severity, empty contradiction, whitespace evidence, non-array raw output, and invalid Mind id all reject to `[]` or skip the item.
- Every accepted item is at least associated with a `mind` value, though not with the frozen `correlationId` key.
- `MIND_DISPATCH_DIRECTIVE` names main loop ownership, hook as directive injection only, top-level-only dispatch/no nested orchestration, and `.codexclaw/` state and plan artifacts.
- `selectMinds()` honors the cap for normal numeric counts, routes by lowest primary dimension, and does not crash on a malformed/null tracker.
- No L9-specific model catalog dependency, MCP server, configurable `mind-*` roles, or per-Mind model settings were introduced in the reviewed diff.
- `npm test` passes 120/120.

## Blockers

- Add the frozen `correlationId: string` contract to accepted Mind contradictions, with `<roundId>-<mindId>` format and tests against the exact field name/format. The current `mind` field alone is not the frozen contract.

## Verdict

REQUEST_CHANGES
