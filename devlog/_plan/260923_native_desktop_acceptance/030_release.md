# wp4: release 0.2.37 and issue updates

## Version files (pattern of 7ad32cf5)

| Path | Change |
|---|---|
| package.json:3, package-lock.json (root and workspace entries) | 0.2.36 → 0.2.37 |
| cli/package.json, plugins/codexclaw/components/*/package.json (9), plugins/codexclaw/gui/package.json | 0.2.36 → 0.2.37 |
| plugins/codexclaw/.codex-plugin/plugin.json | `0.2.37+codex.<UTC yyyymmddHHMMSS at release commit>` |
| plugins/codexclaw/inventory.json | manifestVersion, packageVersion, component versions |
| README.md, README.ko.md, README.zh.md | tests badge = measured total from the final `npm test` |
| CHANGELOG.md | 0.2.37 section: Added (native desktop owner, approvals reference, desktop surface), Changed (routing), Compatibility (plans using `desktop` need 0.2.37+ readers), Verification |
| structure/INDEX.md | only if 020 did not already cover it |
| docs-site/src/content/docs/guides/skills.md:102 | cxc-qa description adds desktop GUI next to web, TUI, CLI and API |

Order: bump with a search for every "0.2.36" occurrence outside CHANGELOG history and devlog; run `npm install --package-lock-only` only if the lock does not follow by hand edits (verify with `npm ls` returning no invalid). Then `npm run build`, `npm test`, `npm run gate`, `node plugins/codexclaw/scripts/inventory.mjs --check --tests <total>`, `node plugins/codexclaw/scripts/check-versions.mjs 0.2.37`.

## Delivery

1. Push branch, open an ordinary PR to dev. Wait for every PR check; inspect jobs per DEV-CI-EVIDENCE-01.
2. Merge to dev (merge commit as the repository does). Confirm dev exact-SHA CI, packed install and WSL jobs succeeded.
3. Open the dev → main promotion PR (title "Release codexclaw 0.2.37"); merge after checks; confirm main exact-SHA CI.
4. release.yml workflow_dispatch with the full 40-character main SHA: dry-run first, then publish. Read both runs' jobs.
5. Download v0.2.37 assets, `shasum -a 256 -c SHA256SUMS`, extract, compare the payload with the checkout's plugins/codexclaw subtree for the shipped files.
6. Issues: close #208 with the invocation evidence (installed 0.2.36 doctor `hook-execution PASS` in session 01a0cadc-5dcb-7541-89bc-ab381777b661, trust 30/30 on six hosts on 2026-09-23). Open a follow-up issue for D5 (native render observation, artifact identity inside receipts, automated lipo/tool-usage oracle). Comment on #232 with what shipped and the follow-up link, then close it.
7. Record delivery evidence in 031_delivery.md.

Not in scope: installing 0.2.37 anywhere or retrusting hooks. The final report offers it.
