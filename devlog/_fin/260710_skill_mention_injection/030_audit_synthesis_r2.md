# 030 — Audit Round 2 Synthesis (Galileo, VERDICT: FAIL, blockers 3+1)

All ACCEPTED.

## B1 (High, ACCEPT) — malformed-link symptom untouched
RCA: r2 scanner protected ALL complete markdown links, but the ORIGINAL failure
was itself a complete link with a bad target (`[$codexclaw:cxc-loop](/plain/path)`
— no skill:// scheme). codex-rs consumes linked mentions whole with exact-path
selection and no name fallback (injection.rs:301,368), so a noncanonical target
injects nothing.
Fold-back: link-repair rule — a complete markdown link whose LABEL is a known
cxc mention (`$cxc-<f>` / `$codexclaw:cxc-<f>`, folder exists under skillsDir)
and whose TARGET is noncanonical (not `skill://<skillsDir>/<f>/SKILL.md` or
points to a nonexistent file) is atomically replaced by the canonical link.
Links with correct canonical targets stay protected; unknown-label links stay
protected unconditionally.

## B2 (High, ACCEPT) — doc map still incomplete
Fold-back: add structure/20_pabcd_dispatch_doctrine.md:169,
structure/40_enforcement_methods.md:51, docs-site reference/hooks.md:55; and
DELETE the A-directive clause "the spawn-attach hook fills in missing baselines"
(hook.ts:172) — normalization repairs mentions, it never invents them.

## B3 (High, ACCEPT) — e2e bypasses production resolution branch
Fold-back: two e2e cases — (a) snapshot dir + CXC_SKILLS_DIR override (env
branch); (b) cache-shaped fixture `<tmp>/plugin/components/subagent-config/dist/`
+ sibling `<tmp>/plugin/skills/<f>/SKILL.md`, env UNSET (script-relative branch).

## B4 (Medium, ACCEPT) — deprecated intent extra
Fold-back: INTENT_EXTRA_SKILL_FOLDERS.research = ["search"] only
(ultraresearch is a deprecated redirect); update its assertion.
