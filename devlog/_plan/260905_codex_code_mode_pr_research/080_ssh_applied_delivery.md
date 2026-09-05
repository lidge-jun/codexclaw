# SSH applied-state delivery

C4 satisfy-spec operator work authorized by the2026-09-06 user request. Depends
on070's exact-head PR/promotion/release gates. No host writes before the published
artifact SHA, frozen Git SHA and expected plugin version agree.

## Concrete operator sequence

Use an ignored one-shot helper under the session evidence/operator directory, not
a production plugin/runtime module. Inputs: absolute normal CODEX_HOME, previously
verified installed payload root, native Codex executable, full release SHA,
expected manifest version, and expected per-file content manifest extracted from
the verified release archive. Execute only on the three established installations.

Before changing native registration, copy the complete old payload to an exclusive
host-local backup root/plugins/codexclaw. Copy the repository's existing unchanged
.agents/plugins/marketplace.json alongside it (same name and relative source).
Verify every copied file hash and reject symlinks/non-files. This provides a normal
local-marketplace rollback source even if the old cache is pruned. Back up current
normal config privately on the same host; never print or copy credentials off-host.

Main verifies each CLI and path with read-only commands. Then use native CLI:
marketplace remove codexclaw; marketplace add lidge-jun/codexclaw --ref FULL_SHA;
plugin add codexclaw@codexclaw --json. Resolve installedPath from this result,
require it inside that CODEX_HOME, and compare every relative file hash and version
to the published artifact. Do not edit the cache or config by hand.

Run the installed payload's hooks retrust --key codexclaw@codexclaw --codex-home
HOME, with no bootstrap override. Run doctor --json in a fresh process with native
Codex and Node on PATH. Assert manifest/hooks/hook-trust/install-root PASS and the
expected version, not merely exit0. Record before/after, per-command exit and
installed identity; no model substitution, external notification or app shutdown.

If install or verification fails after the registration change, stop promotion to
the next host. Restore through marketplace remove/add LOCAL_BACKUP_ROOT/plugin add,
normal re-trust and exact old-file-hash verification. Do not rely on a previous Git
SHA reproducing a possibly locally updated old cache. Preserve all failure logs.
If rollback also fails, report both failures and require direction; never retry
blindly or clear the user's config, sessions, credentials or unrelated plugins.

## Host bindings

macmini: home /Users/junny; Node24.20.0 available for operator/check execution;
native Codex0.146.0 remains unchanged. suji: home /Users/neuralarcadepro, existing
native Codex0.147.0 and Node. Windows: C:\Users\user, native codex.exe from the
existing npm package, C:\Program Files\nodejs\node.exe. Preflight confirms exact
native paths before mutation; .cmd/POSIX wrapper behavior is not guessed.
The old installed version at inventory is0.2.16+codex.260830094500 on all three.

Installed files and a fresh CLI's validated hook trust establish available applied
state, not hot reload of existing Codex conversations. Do not terminate those
processes; disclose fresh-session pickup when needed. Unreachable win/oracle/ocx-ci
remain unknown and cannot be included in an all-host success claim.

## Evidence and boundaries

Source confirmation of remove/add semantics is recorded by Lagrange from native
Codex reference d2d5b702 at marketplace_add, marketplace_remove and store. Existing
Packed install lifecycle CI exercises immutable-ref downgrade/upgrade on0.147.0;
it does not certify0.146.0, Windows, this helper or current production trust.
Operator preparation/rollback must be verified before promotion; actual host
receipts, not source inspection, establish deployment success.

## Helper audit fold-back

Gauss identified five issues before any execution. Folded: canonical/disjoint
paths and backup/template/release identity validation before removal; uncertain
timeout/signal outcomes stop with recorded PID and recovery-required status rather
than racing rollback; case-normalized pinned CODEX_BIN/PATH plus actual bare lookup;
regular immutable config-byte copy with mode0600 or restricted Windows ACL; raw
diagnostics stay host-local with sanitized outer summaries. Ordinary terminal
failure still inspects native registration before local-source rollback.
Further re-review and isolated execution remain required, not assumed passed.

Second review found an uncertainty-loss edge if command-log writing failed after
a timeout. Fixed by classifying outcome/PID/signal before logging and treating any
receipt-write failure as recovery-required without automatic mutation. Outer
failure-log errors cannot suppress the sanitized recovery summary. Final Gauss
interdiff verdict PASS on helper SHA256
b05b8a7d499592ce8fad2e85403fab922a034627a439afb2c810d15656b01951.
Lagrange owns only the isolated macmini native lifecycle proof; production remains
main-owned. Empty isolated-home initial trust setup is explicit CI-style bootstrap;
the helper and all production re-trust calls have no bootstrap override.

## First isolated execution: failure recovered

Codex0.146.0, isolated HOME, old048ae759 install and trust initialization succeed.
Helper backup succeeds; candidate375c02a file match fails before candidate trust
because seven generated files are absent from Git. Automatic rollback restores
all880 old files exactly and passes all four required doctor checks without a
bootstrap override. No candidate applied receipt exists; separate verify/explicit
rollback steps were NOT RUN after the failure.081 owns the packaging correction.
Old-file digest:19289d50a1b4b50b8b20fd09363eac3ee1dd5e00f536d4f6d9846c271dff1594.
The restored registration points to the local backup; original config byte
identity is not claimed. Full logs remain in the isolated root and the private
operator/lifecycle-check-* evidence files. No production write occurred.

One diagnostic-only helper correction captures the original failure stage before
rollback changes the current command stage. Current helper SHA256:
83a925d2533abecef9883c301dba7b020f460e33b6ca1a450c6dc4926d8d5775.
Gauss's narrow review found no behavior/recovery-policy change in that interdiff.
