# User-directed direct deployment

The latest user instruction is: "기다리지말고 그냥 배포해". It supersedes the
previous requirement to wait for GitHub CI/promotion/publication before installing
on the established SSH targets. Deploy the exact locally committed, remotely
verified Git snapshot; label it as a direct candidate deployment, not a completed
GitHub release. Do not forge CI, bypass branch protection, or claim open PRs merged.

Retain the reviewed installer, exact file-hash comparison, private rollback copy,
native registration and normal no-bootstrap trust checks. Only the expected-file
producer gains an explicit direct-snapshot mode; it does not pretend a Git snapshot
was independently verified against a nonexistent published archive.

The additional PR68 review finding is accepted: status.showUntrackedFiles=no can
hide new source files from the earlier status check. Force --untracked-files=all
and cover all three snapshot phases with that local-config override and a new
untracked file. Targeted remote cases pass3/3; full verification proceeds while
deployment files are prepared. No new model experiments.

Suji/Windows pre-existing trust failures remain recorded. After exact new-file
verification, the existing normal retrust command may reconcile missing/drifted
entries only while its matching-pin safety guard succeeds. No bootstrap override,
manual config rewrite, app termination, unrelated plugin change or network repair.

Known targets: macmini-cf, suji, desktop-c795oh4. win/oracle/ocx-ci remain unreachable
after a fresh attempt; their installation state and deployment remain unknown.
