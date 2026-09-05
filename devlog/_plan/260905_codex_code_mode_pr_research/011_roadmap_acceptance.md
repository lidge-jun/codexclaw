# WP0 roadmap acceptance

Status: DONE for docs-only build; implementation phases remain pending.

The main agent accepted both independent A-gate verdicts after the review sequence
ff49029e → 97f9f020 → f7baba8e. Lorentz and Hilbert each returned VERDICT: PASS,
with no remaining blockers. These are plan-level verdicts, not runtime claims.
The fold-back history is in [009](009_audit_synthesis.md).

## Locked inputs for following P cycles

| Plan | SHA256 |
| --- | --- |
| 010_roadmap_lock.md | 5c44346e8105f8538006c82e19bb82577d5b197c6caf19550c8e9bc8895978d5 |
| 020_remote_evaluation.md | ebc0b85ea287b0bd8e9f88fa786c32d439d329c066c62f449e7033e54a773799 |
| 021_evaluation_contract.md | 1fc93fecede54593bd64b755c6c34cef8743c0b57f5d148417b35fa710865c57 |
| 030_agent_owned_skills.md | ec152707172415a45461c5641a264edae84493c5f0fbaad85911a499deb96646 |
| 031_skill_content.md | e52cbaf67ffcaa43987193f1ac10df55400b9719579106a75ab42ae186206eeb |
| 040_minimal_hooks.md | bfecc56aedbaf96bec3c11bf6b4a684d7ef5224e60d8f5228c846c33129b921a |
| 050_skill_delivery_experiment.md | 8616c77a97323b180c41b5df750785e39c3c9f28aa78230d081790c9ba31542f |
| 060_exact_candidate_handoff.md | 37b5ebcef6948a52d7bdeedad11ef18e82e86bdd185fad74d2fa1bb359a56b37 |

The initial skeleton was refined before this lock into six dependency-ordered
cycles: wp0 → wp1 → wp2 → wp3 → wp3-delivery → wp4. Each future P revalidates its
locked plan against the current source and records amendments before B.

## Research and verifier evidence

- Baseline runtime/setup and user-approved OCX tier-echo exclusion: [008](008_baseline_observations.md).
- Existing remote tests: 145/0 for continuation, spawn and benchmark comparison;
  an additional 38/0 for manifest, catalog, provenance, gate and attestation contracts.
  Both confirming wrappers returned exit 0; logs remain under the dedicated
  macmini experiment root. No product code changed between baseline runs.
- Proposed complete recorder/analyzer/test JavaScript files were parsed with
  node --check; three parsed. This was document syntax validation, not execution.
- Document graph verifier passed eight phase documents, 30 local links, six
  work phases, seven criteria and 33 PR provenance records before this B artifact.
  C reruns it including this acceptance record.

## Decisions preserved

Payload and launchers are validated before any candidate doctor execution and
again after it. Runtime identity drift is failure, not a cheaper sample. The
worker comparison uses recognized skill mentions and independent behavioral
oracles. Interview obligations have an actual owner before repeated hook text
is removed. Final tracked docs precede terminal source-bound receipts.

No production code, runtime manifest, skill, hook or test was changed in WP0.
Next: execute the audited WP1 measurement plan on the same bound checkout with
remote tests and isolated installed-payload probes. Do not stop after roadmap lock.
