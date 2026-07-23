# 020 — WP2: README release polish (fresh-install truth)

Depends on WP1 landed: the README can then truthfully promise a working
terminal surface on marketplace installs.

P-recheck (2026-07-24, post-WP1 at 2d0e807b): facts refreshed against tree —
tests badge 1,201 → 1,213; skills 27 (dir has 28 entries incl. README.md);
hooks 18 (manifest length verified); new truth to document: payload bin
`bin/cxc.mjs`, SessionStart banner announces resolved invocation when `cxc`
absent, `scan record` exists, version 0.1.1.

## File change map

### MODIFY `README.md` (mirror to `README.ko.md` / `README.zh.md`)

1. Install section: keep the 2-line install; REPLACE the "Everything runs
   from chat, no CLI needed" framing with the WP1 reality: chat surface works
   out of the box AND the terminal surface resolves via the payload
   dispatcher; add one line for the no-PATH case (the SessionStart banner
   names the exact `node .../bin/cxc.mjs` invocation) and one line for
   optional PATH-level `cxc` (repo checkout + `npm link`, or alias).
   Exact edits: the collapsible "Update / uninstall / optional CLI" section's
   claim "The `cxc` CLI ships with a repository checkout" becomes the
   two-tier story (payload dispatcher ships with EVERY install at
   `bin/cxc.mjs` under the plugin root; PATH-level `cxc` optional via
   checkout). Architecture tree gains `bin/cxc.mjs` line; the footer italic
   line ("lives at the repository root, outside the plugin payload") is now
   FALSE for the dispatcher — rewrite. CLI section: note both invocations +
   `scan record` verb.
2. Verify every remaining factual badge/claim against the tree at WP2 time:
   tests badge → 1,213; skills 27, hooks 18 (verified); GUI wording stays
   "repo checkout for now" (D1 unchanged).
3. Update section: document `codex plugin marketplace upgrade codexclaw` +
   hook re-approval one-liner (already present — keep) + one line: upgrading
   to 0.1.1 delivers the new `bin/` (existing installs must upgrade or
   re-add; per-entry symlink cache won't pick up new top-level dirs).
4. Keep tone/structure; no marketing claims about unshipped surfaces
   (docs-site parity check only where claims overlap).
5. Contributing pointer (from 030, landing here): PRs target `dev` once the
   branch exists — add after WP3 push, or phrase branch-agnostically now:
   added as a short "Contributing" line naming `dev` as the integration
   branch (WP3 creates it before push, same release train).

### MODIFY `docs-site` — 6 pages (A-round widened; "install page only" was wrong)

1. `reference/commands.md`: caution block (11-14) two-tier rewrite + v0.1.1;
   live dispatch set (7) gains `scan` + pre-existing `plan`/`hooks`.
2. `index.mdx`: JSON-LD softwareVersion 0.1.1 (24); checkout-only claims
   (95-96, 107, 131, 146, 164-165) → two-tier; tests 1,201→1,213 (174);
   surface map verb list gains `scan`.
3. `concepts/how-it-works.md` (68-69): two-tier rewrite.
4. `getting-started/installation.md` (29, 42): PATH half stays true; "use
   Track 3 for CLI access" → payload dispatcher IS CLI access, Track 3 =
   PATH-level convenience + map/gui.
5. `getting-started/quickstart.md` (9-11): marketplace installs DO get the
   CLI via the dispatcher (banner names the invocation).
6. `reference/plugin-manifest.md`: version 0.1.1 (14); fix pre-existing
   drift 12→18 hooks (19 + block) and 25→27 skills (~41).
Non-blocking: `first-run.md` one sentence on the SessionStart resolved-
invocation banner.

### A-round blockers (all accepted)

1. tests badge 1,201→1,213 (3 READMEs + index.mdx:174).
2. `cxc map` (and `gui`) must be labeled repo-checkout-only wherever shown
   unqualified (README 44, 146 + ko/zh) — dispatcher excludes them by design.
3. docs-site version carriers → 0.1.1 (index.mdx JSON-LD, plugin-manifest).
4. docs-site scope = the 6 pages above.

## Accept criteria

- Every command shown in README works on a payload-only install (spot-check
  in the WP1 sandbox) or is explicitly labeled repo-checkout-only (CR-F).
- ko/zh translations updated for changed sections (same content, native
  register, no translationese).
