# wp1 implementation and check evidence

Roadmap checkpoint c3313333; implemented candidate cf4115d2. Grok Russell's final
plan correction reread returned PASS, confirming all four findings were folded
and the map remained buildable with no hooks/config changes. The main agent had
entered wp1 B with the earlier near-pass and explicit accepted corrections; no
later PASS was invented as earlier evidence.

Changed nine files: dev/loop/pabcd entrypoints, native-execution and examples
references, peer/ownership pointers, native SOT and native-execution.test.mjs.
Shared policy is 77 lines and conditional examples 89 lines at cf4115d2. These
are source sizes, not measured token-cost reductions. Existing modules remain.

On macmini Node24.20.0, isolated /Users/junny/codexclaw-native-eval-01a0702d
at cf4115d2 fetched from a task-owned Git bundle:

`node --test plugins/codexclaw/test/native-execution.test.mjs plugins/codexclaw/test/packaging.test.mjs plugins/codexclaw/test/skill-catalog.test.mjs`

29 tests, 29 pass, 0 fail/cancel/skip; 592.953542ms. Gate and inventory checks
also exited zero. Baseline before the change was 8/8 package/catalog tests.
The new 21 tests exercise extracted trusted reference JS with controlled tool
responses; they do not implement or certify native V8/hooks/cancellation.
Negative controls include read rejection, failed/malformed/pending command result,
preview/upstream truncation, cache miss/invalid state, failed storage, hostile
strings as data and zero dependent writes after invalid/incomplete prerequisites.
In-memory mutants losing partial outcomes, bypassing prerequisites and converting
a cache miss to success are rejected by independent output/call-count oracles.

Local evidence copy: .codexclaw/evidence/01a0702d-c493-7510-801f-7d8772a2689c/
native-code-mode/codexclaw-native-eval-targeted.log. Product tests/builds were not
run on the local interactive machine. Full suite completed on exact cf4115d2:
2572 tests, 2571 pass, 0 fail/cancel, 1 existing optional repo-map skip,
73531.215917ms. Build exited zero and compiled component diff is empty.
Measured count synchronization is reserved for wp2 before PR submission.

Independent fresh implementation reviewer Harvey (Grok-4.6 high),
01a074c1-f3f4-7822-ac93-b8fdf12329f0, reads the nine-file diff; verdict pending.
No speedup, universal routing adoption or security enforcement claim follows.
