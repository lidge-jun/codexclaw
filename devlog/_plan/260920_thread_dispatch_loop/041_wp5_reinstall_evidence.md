# 041 — Release and reinstall evidence

## Release

| Step | Result |
|---|---|
| dev tip | `39409c8d` — CI, Packed install lifecycle and WSL all success |
| Promotion | PR #226, every check green, merged to `main` at `5e4743d5536eb20caa023e25fe4fd2f4f30016ed` |
| `dev` after merge | still present and protected (checked immediately after the merge) |
| main runs | CI, Packed install lifecycle and WSL all success on that exact SHA |
| Dispatch | `release.yml` run `35465846765` completed success with the full 40-character SHA |
| Published | `codexclaw v0.2.33`, Latest |

Two facts worth keeping. The dispatch guard rejects a short SHA: that was measured on the
**0.2.32** dispatch earlier the same day, run `35456348666`, which failed with
"main moved after the release audit (expected 30774a1e, got 30774a1e425a…)". This release
used the full SHA from the start, so it only demonstrates the passing side.

And CI caught a defect two reviewer rounds had missed: both new CLIs decided whether they
were invoked by splitting `argv` on `/`, which is never true on Windows, so the CLI body
never ran and the process exited 0 in silence. Fixed in `39409c8d` with a test that fails
when the CLI prints nothing.

## Reinstall from dev

Each host pulled `dev` to `39409c8d` and ran `scripts/dev-install.sh` through a login
shell, then reported its own installed version.

| Host | Before | After | Installer exit | Doctor |
|---|---|---|---|---|
| macmini | 0.2.29 | 0.2.33+codex.20260920025749 | 0 | PASS |
| macbookpro-2 | 0.2.28 | 0.2.33+codex.20260920025749 | 0 | PASS |
| suji | 0.2.24 | 0.2.33+codex.20260920025749 | 0 | FAIL — 5 hook-trust records need approval |
| mini (Windows, git-bash) | 0.2.27 | 0.2.33+codex.20260920025749 | 0 | WARN — python not runnable for ast-grep |

The exit column is the remote command chain's status, which ran under `set -e`. It is not
a doctor verdict: `scripts/dev-install.sh:130` masks doctor failure with `|| true`, so the
doctor column is read separately from the doctor output itself.

`macbookpro-2`, `suji` and `mini` had no checkout, so one was cloned to
`~/Developer/codexclaw`; `macmini` already had one on `dev` and was fast-forwarded.

Neither non-PASS shows a failed install: both hosts installed the expected version and the
installer exited 0. `suji` reports four hooks with no trust record and one whose recorded
hash changed; the host excludes untrusted hooks from execution until the user approves
them, and no session can grant that for them. `mini` reports python not runnable for the
ast-grep helper. Neither was compared against a pre-release run on the same host, so
"unrelated to this release" is the reading of the doctor text, not a measured before/after.

Out of scope and reported as such: `sujihome`, `lidge-ai`, `clisu-oracle` and
`desktop-c795oh4` have no codexclaw install, so there was nothing to reinstall, and
`codex` did not answer ssh.
