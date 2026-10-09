# A audit round 2 — FAIL

2026-10-09; bounded interdiff against research/02_audit_round1.md. HEAD `6520b7b893fb1b6d1995e1f7b245f244e4c8c8c7`; shared working-tree plan. No build/tests, git writes, orchestration or spawning. Only this report written.

Aliases: U = `devlog/_plan/261009_prompt_reduction`; numeric names mean its uniquely matching Markdown files. P = `plugins/codexclaw`. Amendments supersede earlier clauses. Findings verified by source inspection; implementation untested.

## Previous blockers

1. **Resolved — gate staging.** U/020:48 records over-budget descriptions as well as routers in an exact-size baseline before enabling the gate; U/030:33 removes description exceptions after catalog trimming. This avoids PR B failing on work deliberately assigned to PR C. Whole-file L3 bytes are now explicit at U/001:53.

2. **Resolved — child guard recognizers.** U/010:76 preserves markers, distinct surface/role full blocks, grant suffix and coordinator scope duty, with reapplication, cross-surface, no-grant and one-use tests. This addresses P/components/subagent-config/src/spawn-attach-hook.ts:428-435,967-984. Shared body text must respect those constraints.

3. **Resolved — owner destination ordering.** U/010:77 retains the dispatch card until wp3; terminal owner text lands with wp2. U/020:51 moves card procedures and creates hosted-ci-evidence.md with referring text updated in that same PR. No wp2 dependency on the future hosted-CI owner is introduced. The remaining writer collision is finding 4.

4. **Partially resolved — scopes.** U/010:78 excludes the two permission files from lane B; U/020:52 narrows dev, adds phase-control and assigns lane-packet tests; U/030:33 serializes catalog before body edits. **Residual R1 (Medium):** U/020:51 still assigns main a write into delegation.md, while :52 grants the refs lane all nine B4 files, including delegation.md (:25). Main also owns generic “tests” while refs owns lane-packet.test.mjs. Trigger: parallel writers follow their amended scopes. Impact: overlapping changes despite the disjoint-scope contract. Fix: have refs perform the delegation addition while main changes the card, or explicitly finish/join refs before main edits delegation; exclude lane-packet from main's test scope. Same-PR atomicity does not establish write ordering.

5. **Partially resolved — observable budgets and activation.** U/010:79 now sums actual co-emitting hook additionalContext, separates recall data, fails aggregate excess and tests provider SessionStart output directly. Named ordinary, loop/search, phase/bound-B, recall and compact scenarios repair the previous per-emitter-only proof. **Residual R2 (Medium):** the same clause promises POSIX and Windows aggregate scenarios through real hook commands, but the macOS-hosted script has no named Windows execution path. P/components/pabcd-state/src/cli.ts:460 passes process.platform to handleUserPromptSubmit; hook-bench.mjs:100-111 launches the local process executable and offers no platform override. Fixture stdin alone cannot activate Windows rendering. Fix: name a Windows CI/host invocation of measure-l1 with retained results, or explicitly use the exported handler's platform argument for Windows fixtures and distinguish that proof from local subprocess delivery. Do not mark two identical macOS subprocess runs as POSIX/Windows coverage.

6. **Resolved within the declared review boundary — owners/ratchet.** U/020:49 requires exactly one definition for migrated core IDs and isolated negatives; :50 adds obligations without IDs. U/030:34 checks destinations/router rows. U/001:57,65 freezes eligibility/legacy locations and names baseline-edit bypasses as early warning, not enforcement. C must review baseline/eligible-set edits against the predecessor; structural checks do not prove semantic survival or revision-to-revision shrinkage.

7. **Not resolved — privacy self-match.** **Residual R3 (Medium):** U/040:32 writes the pattern to /tmp, but its printf command still commits the literal negative-lookahead pattern inside the scanned plan. U/040:9 retains it too. A fresh in-memory application of the stated regex matched `/Users/` on both :9 and :32. Trigger: plan travels in PR A's committed push range. Impact: scan returns 0 instead of required 1 even without a leak. Fix: remove the literal pattern from every committed scan input and supply it separately, or narrowly exclude the command-bearing documents as the precedent did. Audit reports quoting the matching expression also need consideration; relocating the pattern file alone does not exclude its source text from git log -p. Retain actual task-identifier scanning.

8. **Resolved — deployment proof.** U/040:33 distinguishes dev/main SHAs and requires HEAD/cache/payload/trust/denial-smoke evidence, skipping dirty/off-dev hosts. Installer exit alone cannot establish PASS despite masked doctor failures (P/scripts/remote-dev-install.sh:99; scripts/dev-install.sh:130). A moving-dev SHA mismatch must fail acceptance. No fresh host claim.

## Amendment-only checks

No independent new blocker beyond R1-R3. Live facts/file-byte units are corrected (U/001:42,50,53); U/040:34 preserves fixtures and requires npm ci. U/002:7's research/03_reflection_round2.md was absent: architect evidence remains pending. U/003 adds no scope change; external claims were not fetched or relied on. No amendment authorizes guard/FSM/identity/trust changes or ownerless safety-rule deletion.

Residuals: R1 scope handoff; R2 Windows activation proof; R3 deterministic privacy-scan self-match. These require plan fixes before their governed work; no scope expansion performed.

VERDICT: FAIL
