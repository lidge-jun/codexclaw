# wp5b — Local and SSH deployment of 0.2.24 (diff-level)

Depends on 040. Class C4 (production installs on other hosts).

## Targets and modes (observed 2026-09-08)

| Host | Install mode | Current | Node/Codex | Action |
|---|---|---|---|---|
| local (jun) | native plugin cache from marketplace clone ~/.codex/.tmp/marketplaces/codexclaw | 0.2.23 | 24.17 / 0.153.4 | git pull marketplace to main SHA; native reinstall; doctor |
| macmini-cf | Git-mode cache (0.2.22), ~/.codex/.tmp/marketplaces/codexclaw at c762542 | 0.2.22 | 22.22 / 0.146 | fetch main SHA; native reinstall; doctor; trust |
| suji | Git-mode cache | 0.2.22 | 22.23 / 0.147 | same |
| desktop-c795oh4 (Windows) | Git-mode cache; has 0.2.21+0.2.22 caches | 0.2.22 | 24.19 / 0.147 | same via PowerShell; backup with restricted ACL |
| lidge, intmb, cursor | Codex present, no codexclaw manifest | none | — | not an install target; report as such |
| oracle, ocx-ci, win, clisu-oracle* | unreachable or no install | unknown | — | report unknown |

Installer: reuse the reviewed 0.2.23 procedure recorded in
/Users/jun/Developer/new/700_projects/codexclaw-visual-release/.codexclaw/evidence/
visual-release-0.2.23/ (installed-verified.json, ssh probes). If that run only
installed locally (delivery-state says "No SSH targets inferred"), the 0.2.18/0.2.21
SSH procedure from devlog/_fin/260906_release_0_2_18/013 and
devlog/_plan/260907_session_binding_recovery/020 applies: host-local backup dir
`~/codexclaw-deploy-0.2.24-<session8>/backup`, pull the marketplace clone to the
exact main SHA, run the native plugin refresh, then `cxc doctor` and `cxc hooks
retrust` without bootstrap, compare required-file hashes against the release payload.

## Steps per host

1. Reach probe: `ssh -o ConnectTimeout=8 -o BatchMode=yes <host> 'node -v; codex
   --version; ls ~/.codex/plugins/cache/codexclaw/codexclaw'`.
2. Backup: copy current cache dir and private config preimage into the host-local
   backup dir (never off-host).
3. Update: `cd ~/.codex/.tmp/marketplaces/codexclaw && git fetch origin && git
   checkout <mainSHA>` (fast-forward only; refuse if the clone is dirty beyond the
   install marker), then trigger the native plugin reinstall (codex plugin refresh
   path used in 0.2.23), verify a new `0.2.24+codex.*` cache directory appears.
4. Verify: manifest version, required-file hash comparison with the payload, `cxc
   doctor` PASS, trusted hook count, and record JSON receipts under
   .codexclaw/evidence/narrative-release-0.2.24/ssh/<host>-applied.json.
5. Report: existing sessions keep old skill snapshots; no hot reload claim.

## Rollback trigger

If after step 3 the new cache directory is missing, `cxc doctor` fails, or the
required-file hash comparison fails, restore the backed-up cache directory and
config preimage from the host-local backup, re-run doctor, record
ssh/<host>-rolled-back.json, and report that host as NOT DEPLOYED (c-5 unmet for it).

## Acceptance (criterion c-5)

- local + three hosts show 0.2.24 manifest, doctor PASS, trust intact, backups
  present; unreachable/no-install hosts listed as such; receipts written.

