# Provenance repair evidence

090 plan and three-file source interdiff independently reviewed by Gauss: PASS,
no concrete blockers. Original tests/assertions and schema1 remain intact.

Remote macmini Node24.20.0 proof:

- RED against the unchanged recorder:24 tests,0pass,24fail,0skip/cancelled.
  The cases expose admitted drift or inability to retain the original failed report.
- GREEN recorder/analyzer/family selection:240pass,0fail,0skip/cancelled;
  31,632.965ms. All three stage boundaries and the copied-recorder case execute.
- Full suite:2548total,2547pass,0fail,0cancelled,1 existing optional repo-map skip;
  91,909.637ms, exit0. Existing build succeeds; README generator uses measured2548.

Evidence: R/release-provenance-{red,green,build,suite}.log, where R is the session
remote root already recorded in049_1. Fixture source is R/release-provenance-source.
No model call, production installation, trust write or real recorder mutation
occurred in these tests. Test mutations stay within synthetic temporary roots.

New reports bind approval/install, actual prompt, Codex entrypoint and recorder
hashes to the before snapshot, and compare source HEAD/status/tracked-file bytes
at each boundary. Missing/deleted later inputs preserve failed-run provenance.
Historical records and transient write-and-restore remain outside stronger claims.

The PR66 P1 review thread stays unresolved until the verified fix is published and
its exact-head checks pass; neither the earlier platform green nor prior isolated
installation proof excuses the identified recording defect.
