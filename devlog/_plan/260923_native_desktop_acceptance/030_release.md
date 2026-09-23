# wp4: release 0.2.37 and issue updates

## Version files (pattern of 7ad32cf5)

| Path | Change |
|---|---|
| package.json:3, package-lock.json (root and workspace entries) | 0.2.36 → 0.2.37 |
| cli/package.json, plugins/codexclaw/components/*/package.json (9), plugins/codexclaw/gui/package.json | 0.2.36 → 0.2.37 |
| plugins/codexclaw/.codex-plugin/plugin.json | `0.2.37+codex.<UTC yyyymmddHHMMSS at release commit>` |
| plugins/codexclaw/inventory.json | manifestVersion, packageVersion, component versions |
| README.md, README.ko.md, README.zh.md | tests badge = measured total from the final `npm test` |
| CHANGELOG.md | 0.2.37 section: Added (native desktop owner, approvals reference, desktop surface), Changed (routing; `loop init` rejects `--surface`), Compatibility (`desktop` is a classification on v1 plans and makes the QA receipt mandatory on v2+ final gates; a 0.2.36 or older build drops the value on read and erases it on its next write, so every host that edits the plan needs 0.2.37), Verification |
| structure/INDEX.md | only if 020 did not already cover it |
| docs-site/src/content/docs/guides/skills.md:102 | cxc-qa description adds desktop GUI next to web, TUI, CLI and API |

Order: bump with a search for every "0.2.36" occurrence outside CHANGELOG history and devlog; run `npm install --package-lock-only` only if the lock does not follow by hand edits (verify with `npm ls` returning no invalid). Then `npm run build`, `npm test`, `npm run gate`, `node plugins/codexclaw/scripts/inventory.mjs --check --tests <total>`, `node plugins/codexclaw/scripts/check-versions.mjs 0.2.37`.

## Delivery

1. Push branch, open an ordinary PR to dev. Wait for every PR check; inspect jobs per DEV-CI-EVIDENCE-01.
2. Squash-merge to dev, as #233 and #236 were. Confirm dev exact-SHA CI, Packed install lifecycle and WSL jobs succeeded.
3. Open the dev → main promotion PR (title "Release codexclaw 0.2.37") and merge it with a merge commit, as #234 was; confirm main exact-SHA CI and the Packed install lifecycle workflow succeeded on that exact commit (release.yml:203, :237 require it).
4. release.yml workflow_dispatch with the full 40-character main SHA: dry-run first, then publish. The `prerelease` input is unused (release classify decides); 0.2.37 publishes as stable. Read both runs' jobs.
5. Download v0.2.37 assets, `shasum -a 256 -c SHA256SUMS`, extract, compare the payload with the checkout's plugins/codexclaw subtree for the shipped files.
6. Issues: close #208 citing its own 2026-09-22 comment (fresh codex exec session 01a0c973-81ca-7932-b13e-c7ffb36dbba3, 12 invocation records, hook-execution PASS) and the fresh local run saved at .codexclaw/evidence/01a0cadc-5dcb-7541-89bc-ab381777b661/doctor-20260923-local.txt (hook-execution PASS with 20 invocations in session 01a0cadc-5dcb-7541-89bc-ab381777b661, hook-trust PASS for 30 hook hashes). The ignored evidence file does not ship, so the closing comment quotes its two lines verbatim (`[PASS] hook-trust: 30 hook hash(es) trusted for codexclaw@codexclaw` and the `[PASS] hook-execution: session=01a0cadc-... 20 current invocation(s)` line with its caveat) and repeats the residual limits: records are same-user writable and replayable diagnostics, prove the entrypoint ran rather than handler success, and a host-side execution signal would still be stronger. Open a follow-up issue for D5 (native render observation, artifact identity inside receipts, an automated lipo/tool-usage oracle). Comment on #232 with what shipped, the v1/v2 activation limits and the follow-up link, then close it.
7. Record delivery evidence in 031_delivery.md.

Not in scope: installing 0.2.37 anywhere or retrusting hooks. The final report offers it.
