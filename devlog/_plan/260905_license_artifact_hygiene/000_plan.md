# License and artifact hygiene

User scope: continue removal of unused artifacts; change CodexClaw to AGPL. No
runtime refactor, release, install, Git history rewrite or third-party relicensing.
This is compact repository/documentation maintenance, not a new autonomous loop.

## Decisions and change map

- DELETE 35 unused files: `devlog/_fin/logo-{candidates,fusion,i2i-half,references}/`,
  `dev/references/v2-ultra-ab-diff.html`, and `architecture-analysis-report.md`.
  Inventory: 31.98 MiB. Searches of paths and filenames found no active runtime,
  packaging or docs-site dependency. Retain selected logos, applied assets and
  referenced QA/design evidence. Update selected-logo provenance links to Git history.
- MODIFY `.gitignore` with exact retired paths, not broad image or devlog exclusions.
- MODIFY root `LICENSE` to the verbatim GNU AGPL v3 text. NEW root `NOTICE.md`
  declares `AGPL-3.0-only`, retains the 2026 lidge-jun copyright, and preserves
  RepoMapper MIT and Aider Apache-2.0 notices. Do not rewrite vendored notices or
  dependency license metadata.
- NEW `plugins/codexclaw/{LICENSE,NOTICE.md}`: same documents in the actual
  marketplace payload, which does not include root files.
- MODIFY root `package.json`, only its root entry in `package-lock.json`, and
  `plugins/codexclaw/.codex-plugin/plugin.json`: `MIT` -> `AGPL-3.0-only`.
- MODIFY three README badges/license sections and docs-site manifest reference
  and SoftwareApplication license URL. Preserve third-party attribution.
- Extend the existing packaging artifact checks to cover tracked, identical root /
  payload legal files and matching first-party SPDX metadata; no new test-count row.

## Primary evidence (2026-09-05)

OMO `code-yeongyu/oh-my-openagent` currently uses **SUL-1.0**, not AGPL, confirmed
by its default `dev` package.json and LICENSE.md via authenticated read-only API.
The user was told; follow the explicit AGPL request, without claiming an OMO match.
Source: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/LICENSE.md

AGPL text obtained directly from https://www.gnu.org/licenses/agpl-3.0.txt
(34,523 bytes), with verbatim-copy permission. Use version 3 only rather than
silently granting rights under unknown future licenses. This project declaration
does not replace separately licensed third-party material or retroactively revoke
licenses on earlier distributed versions.

## Verification / limits

- Source-to-payload license byte equality and exact SHA against the fetched GNU text.
- Focused packaging + vendored RepoMapper tests; check unchanged third-party files
  and dependency lock entries. No repository-wide local suite or new dependencies.
- `node plugins/codexclaw/scripts/gate.mjs`, staged diff, removal inventory and
  precise ignore checks. Code/deployment assets must be unchanged.
- Independent final review checks scope, metadata, payload inclusion and retained
  notices, not a legal opinion on every historical contribution.
- Commit cleanup and license changes separately, then push to the same requested
  `dev` target only if it is still a fast-forward. Do not promote main or release.
