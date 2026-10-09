# wp3 C round 1: dispositions of research/11_review_wp3.md

| Finding | Disposition |
|---|---|
| 1 LOST L033 installed-CLI recovery | Restored in `loop/references/runtime-lifecycle.md` "Entry and resume": run session/orchestrate/loop through `node "<pluginRoot>/bin/cxc.mjs"` when PATH resolves an older development `cxc`; leave the development checkout untouched. |
| 2 LOST L012 skill-relative link base | Restored in `dev/SKILL.md` "Reading contract": resolve a skill's relative links from that skill's directory, not the working directory. |
| 3 LOST L029 native vs external discovery | Restored in `dev/SKILL.md` conditional routes "Capability gap": installed skills come from the host's skill list and these routers; `cxc skill search/show` is the external catalog, only for gaps. |
| 4 scanner: inline-code headings, decorated classes | Headings keep inline code for slugs and definitions; definitions accept `ID (**CLASS**)`, `ID: CLASS` and `(CLASS, ID`. New fixtures. The stronger scanner found two more legacy duplicates (DEVOPS-BASELINE-DEFECT-01, SOT-SYNC-01), frozen in the baseline for wp4. Migrated-ID audit rerun: 57 core definitions, each exactly one now (`migrated-id-audit.json`). Unique-ID disappearance is not a gate check; it is covered by that audit, as the review asked. |
| 5 folded/literal YAML | `yamlScalar` reads plain, quoted and `>`/`|` block scalars for both description fields; fixtures for folded, literal and short_description. |
| 6 reference-style links | Link definitions `[r]: target` are resolved; fixture. `{#id}` anchors stay supported (used by dev-visualizer's print-provenance.md). |
| 7 host-bound comparisons | New lane-packet test checks each measured bound on the host-envelope row of its call in `lane-dispatch.md` (seven bounds, row-anchored). |
| 8 alias migration | Reverted: alias map and resolver probe model are back to the 2026-09-24 values; refreshing aliases is left as a separate decision. The resolver test now checks the cell inside the "SessionStart dispatch card" section. |

