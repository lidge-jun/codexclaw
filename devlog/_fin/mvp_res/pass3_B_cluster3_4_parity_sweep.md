# Pass 3/4 (B) - Cluster 3 + Cluster 4 parity sweep

Status: B - Goal 45ab94c7-ba6 - 2026-06-30 - cxc
Scope: docs-only parity correction after L20-L28 shipped.

## Trigger
The canonical index marked L20-L28 DONE, tests/build were green, and recent
history showed implementation plus docs-close commits for L20-L28. A parity scan
still found stale sub-loop Status lines:

- L9.3/L9.4 stayed ANALYZED even though L9 is DONE and T4/T7 are resolved.
- L12.1-L17.3 stayed PLANNED even though L12-L17 shipped.
- L26.1/L26.2 stayed PLANNED (impl pending) even though L26 shipped and `cxc gui`
  starts the dashboard.
- L20.3 still described an unshipped dry-run-style reset contract, while the
  shipped reset is scope-limited to `.codexclaw/` and prints removed paths.
- The old decade-themed `260629_codexclaw_mvp/` source docs still carry TODO and
  superseded `ocx ensure` wording; those files are historical inputs, not current
  status authority.

## B changes
1. Marked residual shipped sub-loop docs DONE:
   - L9.3, L9.4
   - L12.1, L12.2
   - L13.1, L13.2
   - L14.1, L14.2
   - L15.1, L15.2
   - L16.1, L16.2
   - L17.1, L17.2, L17.3
   - L26.1, L26.2
2. Clarified `000_INDEX.md`: old `260629_codexclaw_mvp/` docs are historical
   source/reference inputs only; current Status/decisions/evidence live in
   `mvp_res/`.
3. Aligned L20.3 reset text with shipped behavior: scoped cleanup, post-run
   removed-path summary, no MVP dry-run flag.

## Evidence collected before edit
- `npm test` -> 223/223 pass.
- `npm run build` -> build OK, 27 files compiled.
- `node bin/codexclaw.mjs doctor` -> overall PASS.
- `node bin/codexclaw.mjs gui` -> Vite ready, Local URL printed, clean manual stop.
- `git log --oneline --grep` showed shipped feature + docs-close commits for
  L20-L28 and L12-L19.

## Acceptance
1. No L1-L28 loop/sub-loop doc remains ANALYZED or PLANNED because of stale
   implementation-pending text.
2. Phase 3 deferrals (L29-L30) and deferred L31 remain non-DONE.
3. `mvp_res` explicitly owns current status so old source TODO lines do not
   override canonical evidence.

## QA channel
- `rg -n "^Status: (PLANNED|ANALYZED)" devlog/_plan/mvp_res/0*.md devlog/_plan/mvp_res/1*.md devlog/_plan/mvp_res/2*.md`
- `npm test`
- `npm run build`

## Commit unit
`docs(plan): align mvp_res shipped-status parity through L28`
