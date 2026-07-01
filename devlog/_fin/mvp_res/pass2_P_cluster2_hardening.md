# Pass 2 (P) — Cluster 2 (L12–L19) jawdev-grade hardening plan

Status: P · Goal 45ab94c7-ba6 · 2026-06-30 · cxc
Scope: harden `mvp_res/` Cluster-2 skill-port loop docs (120–193) to decision-complete. Docs-only.

## A-gate audit (DONE)
gpt-5.5 clone-fidelity reviewer 019f1516 → FAIL. Structurally close but: OMO source root dangling,
wildcard source maps, L18/L19 policy + dependency contradictions, brittle acceptance.

## Confirmed gaps (measured)
G1. **OMO source root dangling**: every ref to `/Users/jun/.codex/plugins/cache/sisyphuslabs/omo/
    4.14.0/skills/` (98 lines across 18 docs) is dead — that path does NOT exist. The REAL source is
    repo-local `devlog/.lazycodex/plugins/omo/skills/` (verified: all cited skills present —
    comment-checker, programming, git-master, refactor, ast-grep, remove-ai-slops, debugging,
    visual-qa, frontend, review-work, init-deep, ultimate-browsing, ultraresearch). → rewrite all.
G2. **L18/L19 policy contradiction**: 180/190/192 say `search` is on-demand
    (`allow_implicit_invocation:false`, only `dev` implicit); 181:14-15 and 182:15-16 say search is
    in the final implicit/visible set. → make 181/182 conform to dev-only policy.
G3. **L19 dependency contradiction**: 190 says L19 blocks on L12-L17 (L18 optional/cataloged-if-
    present); 193:37,58 requires L18 before L19. → unify to "L19 blocks on L12-L17; L18 cataloged
    if present" (190's wording wins, since L18 search is on-demand and not a dev router).
G4. **INDEX L18 row** lacks the locked on-demand decision → add `(search on-demand, implicit=false)`.
G5. **L18.3 target conflict**: scope lists 2 target files but body promises a deep-research-swarm
    reference doc → add the missing target file to scope or drop the promise.

## Plan (diff-level, surgical)
1. Global rewrite (G1): `devlog/.lazycodex/plugins/omo/skills/` →
   `devlog/.lazycodex/plugins/omo/skills/` across all mvp_res docs (sed, 98 occurrences). This also
   makes L12-L17 and L18 use ONE canonical source root (resolves the source-root conflict).
2. G2: edit 181 + 182 so any "search in implicit set" becomes "search on-demand, reached by explicit
   trigger or dev-hub routing; NOT in the implicit set".
3. G3: edit 193 to match 190 (L19 hard-deps = L12-L17; L18 cataloged-if-present, not a hard dep).
4. G4: INDEX L18 row + add a one-line locked note.
5. G5: add the deep-research-swarm reference target to 183 scope (e.g.
   `plugins/codexclaw/skills/search/references/deep-research.md`).
6. NOTE on wildcard maps: the audit flags `references/*` etc. as non-exact. Decision: per-file
   enumeration of every reference file is OUT of scope for a PLAN doc — the exact files are
   discoverable at implementation time by `ls` of the (now-correct) source dir. Instead, pin the
   RULE: "port ALL files under <source>/references/ preserving relative paths; enumerate at B." This
   keeps the plan decision-complete (deterministic) without freezing a file list that may drift.
   Add this rule once to 120 (hub) and reference it from the others.
7. One atomic docs commit.

## A-gate verdict + this plan
Plan closes G1-G5 + the wildcard concern (via rule #6). Brittle-acceptance items deferred to each
loop's own B-phase (they are implementation-test concerns, not plan blockers).

## Acceptance (Pass 2 D)
1. 0 refs to the dead omo cache path; all omo refs resolve under devlog/.lazycodex/plugins/omo/skills/.
2. No L18/L19 policy contradiction (search on-demand everywhere); 190 and 193 dependency text agree.
3. gpt-5.5 C-gate re-audit returns Cluster-2 docs decision-complete + consistent.

## QA channel
- `grep -rn '.codex/plugins/cache/sisyphuslabs/omo' devlog/_plan/mvp_res/` → 0
- `grep -rln 'devlog/.lazycodex/plugins/omo/skills' devlog/_plan/mvp_res/ | wc -l` → matches source root use
- spot-check a sample rewritten omo path exists on disk
- gpt-5.5 C-gate verdict

## Commit unit
`docs(plan): harden Cluster-2 (L12-L19) skill-port docs to decision-complete grade`
