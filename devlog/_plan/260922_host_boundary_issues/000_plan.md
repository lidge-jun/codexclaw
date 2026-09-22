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

wp1 build: inherited executors 01a0c90a-29ed-78f0-af8d-48ef540da3f8 and 01a0c90a-2ab0-7683-b38e-10897d0cb837 implemented disjoint observation/ownership modules. Main integrated registration, compiled fixtures and scratch home isolation. Independent reviewer 01a0c910-8101-74f2-af93-1f28bc026621 PASS after 25 focused tests. Main compiled integration suite: 67/67. Full first pass measured 3506 tests and exposed three packaging/count failures: new registration changes shared reference count 16->17; new ignored dist files needed explicit Git tracking. These were corrected; manifest suite 20/20 and packaging 4/4 now pass. Fresh full C receipt follows; first-pass failures are not hidden.

wp1 D: d3305b48 full C receipt exit 0, 3506 tests / 3503 pass / 3 existing skips / 0 failures. CLI QA matrix and teardown receipt passed; independent review PASS. Continue 020 in wp2. No installed-host activation claim yet. Tests proved invocation diagnostics and hook-visible ownership decisions; native bypass and TOCTOU remain.

wp2: architect 01a0c916-9b3f-7710-9d59-13df74206475 D1-D6 accepted and reflected ALIGNED; independent A reviewer 01a0c918 PASS. Builders completed pending contract and explicit memory observation limits with red/green evidence. Independent C reviewer 01a0c91d PASS, focused 56/56, independent calendar oracle 14784 inputs and 60 malformed creation cases. Main focused 66/66 and full suite 3522 tests / 3519 pass / 3 existing skips / 0 failures. Actual pending/invalid-mode and compiled memory CLI QA passed in isolated temp home. #209/#191 remain native residuals. Continue 030 delivery; no quota setting or native DB was changed.

wp3 delivery: PR #233 merged to dev as 7ad32cf5 after full PR CI; dev exact-SHA CI(7), Packed install(5) and WSL(2) jobs all succeeded. Promotion PR #234 merged to main as e42ca5d8 with dev deletion protection verified before and dev still present after. Main exact-SHA CI/Packed/WSL all succeeded, release dry-run 35737454464 passed the gate, and publish run 35737858033 released v0.2.36 pinned to e42ca5d8 with payload, SHA256SUMS, candidate manifest and build provenance.

Downloaded release payload checksum verified; extracted 1096 files matched the updated stable checkout byte for byte, and the installed 0.2.36 cache matched the released payload with zero mismatches. The stable checkout fast-forwarded to 7ad32cf5 with all 2500 untracked user files preserved unchanged.

Live activation: a fresh read-only codex exec ran the installed payload's hooks and produced 12 real invocation observations (session 01a0c973-81ca-7932-b13e-c7ffb36dbba3), which installed doctor reported as hook-execution PASS while keeping hook-trust separate. The new automation-ownership hook has no trust entry, so doctor reports hook-trust FAIL and that guard is inactive until the user approves it in Codex. Trust was not forged or bypassed. Rollback payload with digests is retained at /Users/jun/.codexclaw/backups/20260922-ecf0-codexclaw and its restore path was proven in an isolated Codex home.

