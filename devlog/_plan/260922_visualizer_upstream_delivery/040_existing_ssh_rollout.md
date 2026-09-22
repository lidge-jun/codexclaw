# wp4 — Existing SSH installations and hook approval

Depends on wp3 published archives and local proof. User explicitly added this scope
on2026-09-22: after both releases, update all SSH places where these products are
already installed, including hook approval. No new product/account provisioning.

## Inventory and ownership

Input: sanitized fleet-inventory.json under this session's .codexclaw evidence,
produced by read-only Sol inventory of explicit SSH aliases/current installed metadata.
Deduplicate actual host+account; wildcard aliases are not targets. Record OS, SSH
alias, user/home, plugin registry or clean dev checkout, exact installed skill roots,
current revision and unavailable states. Never infer installation from command name
alone. Do not inspect private keys, browser profile content or entire config secrets.

Read-only probes use BatchMode=yes and bounded ConnectTimeout; no interactive key
acceptance or credential migration. Unreachable is unknown, not absent or updated.
Recheck any target just before write, because the inventory can become stale.

## Per-host update transaction

1. Pin the release tag/full SHA and locally verified payload hash from wp3. Keep the
   previous installed version/hash and supported rollback path. Re-read install mode.
2. Git marketplace installs: use that host's supported `codex plugin marketplace
   upgrade codexclaw` and reinstall/update selector `codexclaw@codexclaw` as required
   by current CLI. Verify returned installedPath and manifest version, not only exit0.
3. Existing dev installs: use the documented remote-dev-install/dev-install workflow
   only after confirming clean matching-origin dev checkout and a fast-forward update.
   Preserve links and local work; no reset, force-push, branch deletion or unrelated
   checkout switch. Dirty/diverged/unsupported targets stay unresolved with evidence.
4. Aside visualizer: update only the discovered installed account-skill roots. Keep
   Aside adapters/no-Chrome files. Use verified released skill archive; stage safely,
   preserve a rollback backup and any unrelated files. Symlinked developer installs
   keep their link and use the underlying verified repo update rather than replacing
   it. A missing skill remains missing. No aside-codemode deployment is in scope.
5. After codexclaw update, invoke its installed dispatcher `hooks retrust --key
   codexclaw@codexclaw --codex-home <verified home>` (or current supported equivalent).
   This hash approval is explicitly user-authorized. Run installed `doctor` and
   inspect trust counts separately from unrelated diagnostics. Approval does not
   prove an already-running session executed hooks; new sessions load new rules.
6. Run installed source-only intake, missing-PDF-tool fail-closed probe and provenance
   hash checks without real user docs/accounts. Verify the v1 prompt compatibility
   source hashes and the static-no-render policy are the released bytes. Record Node/
   platform limitations honestly. No services are restarted unless update requires a
   documented, already-authorized existing-service refresh; do not kill active tasks.

Windows uses current PowerShell/Node/executable paths and argument-safe scripts;
POSIX uses the host shell. Derive paths from the host, never assume macOS paths on
Windows. Transfer script/data through scoped stdin or verified temporary files,
not shell interpolation of untrusted values. No broad process matching/termination.

## Output and completion

Write sanitized per-host before/after version/source/hash/install receipt, smoke and
hook approval results to .codexclaw evidence; summarize only operational identifiers.
Remote details stay out of published repositories. Each known installed target must
be updated and verified or have a concrete unresolved failure; unknown/unreachable
hosts never become PASS. Product-not-installed is an observed NOOP. DONE requires
all recorded criteria, not merely SSH reachability. If an external blocker persists,
follow host goal status rules rather than fabricate completion or provision a host.

## Locked transaction safeguards (plan review)

Before any approval, compare the actual selected revision and installed payload
against wp3's release evidence. Marketplace latest/dev tip is only a discovery
candidate, never the authority. Prefer the exact release tag/snapshot; allow a
source checkout with a different merge commit only when the shipped payload subtree
and approved file hashes are identical. A version string alone is insufficient.
Any unexplained file/hash difference stops before hooks retrust. Do not approve a
newer upstream change merely because upgrade returned success.

Main coordinates one writer per resolved host/account/real installation root.
Aliases, symlinks, and separate tool handles that resolve to that root share the
same transaction; no concurrent update/retrust or rollback on one root.

Before mutation, establish a supported rollback using the retained previous payload
and matching plugin trust entries. On failed update, approval, hash check or smoke,
preserve evidence and restore the previous verified payload/trust where supported;
verify restored hashes and installed command behavior. Do not restore a whole config
file over concurrent unrelated changes. If supported restoration is unavailable or
fails, leave the transaction unresolved and do not grant trust to mismatched bytes.
Never claim rollback succeeded from a backup's existence.
