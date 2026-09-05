# Release blocker: compiled payload parity

C4 bounded packaging repair, discovered during080's isolated deployment check.
Goal: Git marketplace installation and the release archive contain the same
compiler output. No new runtime behavior, dispatcher, dependencies or feature
activation. Native rollback succeeded; production is untouched. Retain that FAIL.

## Reproduced failure and cause

Exact375c02a build directory has918 payload files; Git installation has911.
Seven src/*.ts files are tracked, and build.mjs compiles them, but their generated
dist/*.js files are ignored and untracked. Release.yml archives the post-build
directory, while native Git installation copies the tracked snapshot. The existing
packaging test covers runtime-reachable imports only; it misses these dormant
library modules. git diff --exit-code also ignores untracked generated files.

## Exact change map

NEW, generated only by the existing remote Node24 build:
- plugins/codexclaw/components/cxc-ops/dist/activation-trace.js
- plugins/codexclaw/components/cxc-ops/dist/scouting-bundle.js
- plugins/codexclaw/components/cxc-ops/dist/win-paths.js
- plugins/codexclaw/components/messenger-bridge/dist/token-intake.js
- plugins/codexclaw/components/subagent-config/dist/capabilities.js
- plugins/codexclaw/components/subagent-config/dist/capability-lock.js
- plugins/codexclaw/components/subagent-config/dist/dispatch-contract.js

These are already compiled into release archives from existing tracked sources;
commit their actual output with git add -f, consistent with the current dist policy.
Do not change source bodies, add runtime imports or remove files from the expected
inventory to hide the mismatch. Global dist ignore remains unchanged.

MODIFY plugins/codexclaw/test/packaging.test.mjs: preserve all three existing tests;
add one contract comparing every existing compiler source's output path against
Git-tracked files, using build.mjs COMPONENTS/listTsFiles and one git ls-files -z
snapshot (avoid one extra Git subprocess per generated file on drvfs).
The independent boundary is filesystem compiler inputs versus Git index membership.
Run it on the unmodified index first: it must fail for exactly these seven outputs;
then stage actual generated outputs and require PASS. No prose assertions/skips.

MODIFY generated root README badges via inventory.mjs --write --tests N after
the successful full run. Expect one new test, but use the measured total, not2524
until observed. No version reuse after publication;0.2.17 is still unpublished.

## Delivery and proof

Publish a focused repair PR to dev before allowing promotion PR66. Revalidate
the resulting dev head and promotion checks; prior375c02a green CI cannot waive
this observed packaging failure. Main keeps the active managed checkout and all
research records. Gauss audits the plan/interdiff; Lagrange repeats the same
isolated operator lifecycle only after the corrected ref is published.

Evidence: remote RED/green packaging test, compiled bytes from unchanged sources,
full suite/count/gate, exact-head CI/packed/WSL, and native candidate file/trust
match plus explicit rollback. No release or production update until these pass.
