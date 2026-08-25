# 260722 repo governance config — plan (P)

## Objective

Land repository-level governance/config artifacts on `main` (then sync to `dev`) so both
CodeRabbit (installed 2026-07-22) and Codex-style agents review PRs with the project's real
rules: dev-branch-first flow, `claudedesktop` in-development status, security-boundary
review requirements.

## Deliverables

1. `.coderabbit.yaml` (new, repo root)
   - `language: ko-KR` review tone.
   - Path instructions: `src/**` (Bun-native TS, no Node-only APIs), `tests/**`,
     `gui/**`, `.github/**` + `scripts/release.ts` (security boundary), `docs-site/**`.
   - `reviews.auto_review` enabled for PRs targeting `dev` and `main`.
   - Tone: P0/P1-focused, no nitpick flood; Korean summaries.
2. `AGENTS.md` (new, repo root)
   - Repo orientation: what opencodex is, layout map (src/tests/gui/docs-site/structure).
   - Branch policy: PRs target `dev`; `main` is release-promoted; `preview` is the
     prerelease lane; `claudedesktop` is an in-development feature branch — do not
     treat its absence from main as a bug, do not merge it without maintainer action.
   - Commands: `bun run typecheck`, `bun run test`, `bun run privacy:scan`, `bun run lint:gui`.
   - `## Review guidelines`: P0/P1 focus, security-boundary list (auth, credential
     handling, GitHub Actions, release automation, dependency install) requiring
     explicit security review per MAINTAINERS.md; devlog/structure conventions.
3. `CONTRIBUTING.md` (edit, minimal)
   - Add a short "Branches" section: `dev` = integration target for all normal PRs,
     `main` = releases only, `preview` = prerelease train, `claudedesktop` = WIP.
   - Keep the pointer-style doc; do not duplicate the hosted guide.

## Landing strategy

- Work on a `codex/repo-governance-config` branch off `main`; commit; push; merge to
  `main` (fast, config-only, no runtime code). Then bring the same files to `dev`
  (merge main into dev or cherry-pick) so feature branches inherit `.coderabbit.yaml`.
- User instruction "main에 설정해놔" = explicit approval to land on main and push.

## Out of scope

- No runtime/src changes, no workflow changes, no release.
- No rewrite of docs-site contributing guide.

## Verification (C)

- YAML parses (`bun -e` YAML load or python yaml).
- `git diff --stat` limited to the three files.
- Files render on GitHub after push (spot check).

## Risks

- `.coderabbit.yaml` schema drift → validate keys against current CodeRabbit docs
  during build; keep config minimal to stay schema-safe.
- CONTRIBUTING.md divergence from hosted docs-site guide → keep the section short and
  pointer-first.
