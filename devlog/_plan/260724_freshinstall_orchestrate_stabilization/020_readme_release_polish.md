# 020 — WP2: README release polish (fresh-install truth)

Depends on WP1 landed: the README can then truthfully promise a working
terminal surface on marketplace installs.

## File change map

### MODIFY `README.md` (mirror to `README.ko.md` / `README.zh.md`)

1. Install section: keep the 2-line install; REPLACE the "Everything runs
   from chat, no CLI needed" framing with the WP1 reality: chat surface works
   out of the box AND the terminal surface resolves via the payload
   dispatcher; add one line for the no-PATH case (the SessionStart banner
   names the exact `node .../bin/cxc.mjs` invocation) and one line for
   optional PATH-level `cxc` (repo checkout + `npm link`, or alias).
2. Verify every remaining factual badge/claim against the tree at WP2 time:
   tests-passing count (re-run `npm test` and update the number), skills
   count (`ls plugins/codexclaw/skills | wc`), hooks count (18 — plugin.json
   hook array length), GUI wording stays "repo checkout for now" unless D1
   changed.
3. Update section: document `codex plugin marketplace upgrade codexclaw` +
   hook re-approval one-liner (from 260723 unit 010).
4. Keep tone/structure; no marketing claims about unshipped surfaces
   (docs-site parity check only where claims overlap).

### MODIFY `docs-site` pages only where they contradict the WP1 reality

(260723 WP3 already synced the site; this pass is a delta check, likely the
install/CLI page only.)

## Accept criteria

- Every command shown in README works on a payload-only install (spot-check
  in the WP1 sandbox) or is explicitly labeled repo-checkout-only (CR-F).
- ko/zh translations updated for changed sections (same content, native
  register, no translationese).
