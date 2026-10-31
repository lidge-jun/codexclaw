# 000 — noslopdesign-publish: Plan

CodexClaw's `dev-frontend` and `dev-uiux-design` skills only work inside CodexClaw, so nobody outside
can install them. This unit publishes them as `lidge-jun/noslopdesign`: two standalone skills,
`noslop-frontend` (build/fix, the front door) and `noslop-uiux` (direction before code), installable
the way taste-skill is, and kept aligned with CodexClaw by a mechanical weekly sync. CodexClaw gains
a pointer to the downstream; it does not depend on it.

## Loop-spec

- Loop archetype: satisfy-spec (verifier-defined).
- Trigger: user request 2026-10-23 "별도 리포로 align 되고 따라갈 수 있게 GitHub 업로드, taste skill 배포 방식 참조, 이름은 noslopdesign, front/uiux가 이름에 들어가게", then "$cxc-loop, 상속 무제한 파견, npm 필요하면 $aside-jun".
- Goal: public repo lidge-jun/noslopdesign with both skills, four install paths, green CI, working sync; CodexClaw pointer as a draft PR.
- Non-goals: merging into CodexClaw; npm publish (DD-11); before/after gallery screenshots (follow-up); CodexClaw-side CI warning step (DD-9 optional, deferred); changing CodexClaw skill content.
- Verifier: in /Users/jun/Developer/new/700_projects/noslopdesign: `npm run check` exit 0, `node scripts/sync-from-codexclaw.mjs --source <codexclaw> --check` exit 0, `bash -n install.sh skills/*/scripts/*.sh` exit 0, `install.sh --all-agents` into a temp HOME links 2 skills per agent; GitHub: `gh run list -w "Check skills"` success on main head; `gh workflow run sync.yml` completes with "already in sync". CodexClaw: `rg noslopdesign README*.md NOTICE.md`.
- Stop condition: all four goalplan criteria met with evidence, draft PR open on CodexClaw.
- Memory artifact: this unit + codexclaw devlog D record; noslopdesign upstream.json.
- Expected terminal outcomes: DONE (all met); BLOCKED if GitHub refuses repo creation or Actions settings; NEEDS_HUMAN for merging the CodexClaw PR.
- Escalation: anything beyond creating/pushing the new public repo and a CodexClaw draft PR (merge, release, npm publish, messages) goes to the user.
- Resource bounds: no token/time budget set by the user; lanes inherit codex/anthropic/claude-opus-5-5, options [] (user: 상속 무제한 파견).

## Architect consultation

- Handle: GOAT task `noslopdesign-architect-r1` (completed), proposal DD-1..DD-11, ARCHITECT: PROPOSAL-READY.
- DD-1 accept: README notes the plugin namespace (`noslopdesign:noslop-frontend`).
- DD-2 accept: check.mjs fails on synced reference .md files that no file in the skill mentions by filename (orphans).
- DD-3 accept as is.
- DD-4 accept: install.sh copies taste-skill's `resolve_link`; check.mjs enforces equal versions across package.json and both manifests; name==folder check kept.
- DD-5 accept: CI runs bash -n on skill scripts and `sync --check` against the pinned upstream commit.
- DD-6 accept with a variant: no PAT available, so the sync job force-pushes one branch `sync/codexclaw`, creates/updates one PR, then `gh workflow run check.yml --ref sync/codexclaw` (workflow_dispatch is the GITHUB_TOKEN event that does start runs). On sync failure it opens/updates one issue titled "Sync from CodexClaw is blocked" with the leftover lines. concurrency group `sync`. Repo setting "Allow GitHub Actions to create and approve pull requests" set via API after creation. A single reused branch replaces per-commit branches, so no branch cleanup is needed.
- DD-7 accept: `references/core/iterative-design.md` becomes repo-owned and rewritten in original words (same headings and role); impeccable row reworded to "patterns adapted"; CodexClaw README + NOTICE list noslopdesign as downstream.
- DD-8 accept: a rewrite drops the shadcn tarball section from scripts/README.md; first commit + setup notes in README "Maintaining" section; this plan fills the scaffold.
- DD-9 accept the guidance part (recorded in CodexClaw README downstream note); defer the optional CI step.
- DD-10 accept as constraints. DD-11 accept: no npm publish, so $aside-jun is not used.
- Reflection: GOAT task `noslopdesign-architect-r2`, ARCHITECT: ALIGNED, 2 material + 6 minor gaps, dispositions:
  - G1/G2 (material, sync PR on commit-only change): already fixed in the draft — sync writes upstream.json only when skill content changed or no pin exists (`if (changed.length || !prev.commit)`); the workflow dirty check is therefore skill-content only. Verifier amended: manual sync run passes with "already in sync" OR an opened `sync/codexclaw` PR whose dispatched Check run succeeds.
  - G3 accept: sync.yml closes the blocked issue after a successful sync.
  - G4 accept: orphan check counts mentions from both skills.
  - G5 accept: version check names `.claude-plugin/marketplace.json` and `.codex-plugin/plugin.json`.
  - G6 accept: CI uses `shopt -s nullglob` before bash -n.
  - G7 accept: register the CodexClaw draft PR with link_pull_request.
  - G8 accept: read back the workflow-permissions setting, expect can_approve_pull_request_reviews:true.

## Audit

- Round r1 (GOAT task `noslopdesign-audit-r1`): VERDICT FAIL, 4 High / 4 Medium / 3 Low. All accepted; 010 rewritten with exact snippets.
  - H1 fold G3-G8 into 010: done. H2 tee without pipefail: `shell: bash` defaults. H3 merged-PR lookup: `gh pr list --state open`. H4 leftover regex: `\bdev-[a-z]+(?:-[a-z]+)*\b` + dev-visualizer sentence rewrite.
  - M5 Check failures also open the issue (`failure()` covers all steps). M6 rebase branch onto origin/dev. M7 README drops single-skill advice. M8 per-install call syntax table.
  - L9 rewrites for "per search skill"/"ponytail"; `$imagegen` handled by one SKILL.md note instead of per-file rewrites (keeps sync rules few; the references already state ima2 is canonical and $imagegen a fallback). L10 rewrite keeps an Upgrade Techniques section. L11 exact regex/YAML in 010; sync computes before writing.
- Round r2 (GOAT task `noslopdesign-audit-r2`): VERDICT GO-WITH-FIXES (blockers=1). Every r1 finding closed.
  - M1 accept: the write sync always reads a clean clone of origin/main (`git clone --depth 1 https://github.com/lidge-jun/codexclaw.git $TMP/codexclaw-main`); C checks `git -C X branch -r --contains <upstream.json commit>` lists origin/main.
  - L2 accept: same `$imagegen` note in noslop-uiux/SKILL.md. L3 accept: CodexClaw note names the supported forms exactly (the six mapped names, `\`dev\` §0.2`, `§0.4`). L4 accept: clean path closes an open sync PR. L5 accept: orphan check keys on skill-relative paths for duplicated basenames; Codex plugin call written as `$noslopdesign:noslop-frontend`.
  - Main judgment: near-pass — the one Medium blocker is folded as a concrete amendment, Lows folded in B.

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 010_phase1.md | Fold DD fixes, publish repo, CI green, CodexClaw pointer draft PR | — |

## Accept criteria

1. Public GitHub repo lidge-jun/noslopdesign with both skills, README en/ko, LICENSE/NOTICE, four install paths.
2. check.mjs and sync --check pass locally; "Check skills" CI green on main head.
3. Sync is mechanical (rules.mjs), pinned in upstream.json, runnable by the weekly workflow (manual dispatch proves it).
4. CodexClaw README/NOTICE point at noslopdesign, as a draft PR, unmerged.

## D record (2026-10-23)

Conclusion: noslopdesign is published. github.com/lidge-jun/noslopdesign is public at main 02760c2 with release v0.1.0; `npx skills add https://github.com/lidge-jun/noslopdesign --list` reads noslop-frontend and noslop-uiux from GitHub. CodexClaw PR #312 (base dev, head e88fd5fe) adds the downstream pointer and is ready for review, unmerged.

Evidence: test receipt `.codexclaw/evidence/01a16583-820c-71a3-a69c-2f9dab0b852e/test-receipt.json` (npm run check, sync --check against a fresh clone of codexclaw main @ 1cbfcbb2, shell parse, pin on origin/main, skill-catalog.test.mjs 4/4, pointers 4/4); probes for orphan, version, leftover and unmapped internal reference each exit 1, a blocked sync leaves the tree clean; install.sh link/relink/uninstall in a temp HOME.

NOT RUN: GitHub Actions (Check skills, Sync from CodexClaw, CodexClaw PR checks). Every run in both repos stayed queued on GitHub's side with nothing in progress; the user directed shipping without CI. The workflow YAML is reviewed but unproven on a runner. Real installs through the Claude Code and Codex plugin marketplaces were not exercised.

What did not improve / open: before/after gallery for the README (the main lever for attention) is not built; upstream drift such as Vite 7 vs 8 in init-artifact.sh and the "adapted for codexclaw" Source lines stays until fixed in CodexClaw; scheduled workflows on public repos pause after 60 days without activity.

Next: watch the first CI and sync runs when GitHub's queue drains; review and merge #312.
