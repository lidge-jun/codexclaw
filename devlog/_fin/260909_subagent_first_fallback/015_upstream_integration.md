# Upstream integration for PR #116

Merged upstream dev `3f9d22e59beda246f23649e7b9a221e8ea632254` into the publication branch. The repository fetch refspec only tracks main; fetching dev initially updated FETCH_HEAD without updating origin/dev. An explicit dev-to-origin/dev fetch corrected that stale comparison.

Resolved the hook-count conflict to 25 (upstream memory-write hook plus the new fallback notice) and retained the inventory test's count-independent drift fixture. Regenerated inventory and README counts. Fallback source, compiled runtime and GUI files are byte-identical to the previously verified publication head `2e728edc`; the native 24-case evidence remains applicable to those artifacts, with the same isolated-hook limitations.

After integration: full suite 2,821 total, 2,750 passed, zero failures, 71 skipped; build compiled 166 files successfully. Published test counts were regenerated from that observed total, and the inventory suite, count checker, repository gate and diff check passed. Logs: `/var/tmp/cxc-fallback-native-701c17d/pr-full-test.log`, `pr-build.log`, `pr-inventory-test.log`.

Publication uses `thisisjun786/codexclaw:codex/subagent-first-fallback` targeting `lidge-jun/codexclaw:dev`. Original local commits remain on `codex/subagent-first-fallback`; publication history uses the GitHub noreply email after GH007 rejected the first push. No history was force-pushed.
