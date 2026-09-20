# 040 — wp5: reinstall from dev on every SSH host that has codexclaw

## Survey (2026-09-20, read-only)

| Host | codexclaw plugin cache | Checkout | Login-shell node |
|---|---|---|---|
| macmini | 0.2.29 | `/Users/junny/Developer/codexclaw` on `dev` at `b135cc5` (stale) | v22.22.0 (nvm) |
| macbookpro-2 | 0.2.28 | none found | v24.17.0 |
| suji | 0.2.24 | none found | v22.23.1 |
| mini (Windows, git-bash) | 0.2.27 | none found | v24.16.0 |
| sujihome | absent | — | — |
| lidge-ai, clisu-oracle, desktop-c795oh4 | absent | — | — |
| codex | unreachable (ssh timeout to 100.110.77.109) | — | — |

Four hosts are in scope. Absent is not a target: installing codexclaw somewhere it was
never installed is a new deployment, not a reinstall. An unreachable host is reported as
unreachable, never as done.

## Procedure per host

Use `plugins/codexclaw/scripts/remote-dev-install.sh <host> [--shell zsh|bash] [--check]`,
which performs the steps below and refuses rather than repairing: it stops on a missing
checkout, a branch that is not `dev`, or any uncommitted change, and it compares the
version the host reports afterwards with the version its checkout declares. `--check` runs
only the read-only half. It cannot see doctor failures, because `dev-install.sh` does not
propagate them.

1. Ensure a checkout. Where one exists, `git fetch origin && git switch dev && git pull
   --ff-only`; never reset, never force. Where none exists, clone to
   `~/Developer/codexclaw` and check out `dev`. Preserve any dirty tree: if the pull is not
   fast-forwardable, stop on that host and report it.
2. Run the installer through a login shell so nvm-managed node resolves:
   `zsh -lc 'cd <checkout> && scripts/dev-install.sh'` (bash on `mini`).
3. Verify on the host itself, not from here: the installed manifest version under
   `~/.codex/plugins/cache/codexclaw/codexclaw/` must be the dev version, and
   `node <pluginRoot>/bin/cxc.mjs --version` (or `doctor`) must answer from that path.
4. Record per host: previous version, new version, installer exit status, doctor result.

## What this phase may not claim

That a host is updated because the command was sent. Each host reports its own installed
version after the run, and a host that fails keeps its previous install and is listed as
failed with the error text.
