# 030 — Phase 3: Discovery metadata, consistency check, publish

Unit: `260803_stacked_pull_requests` · Work-phase: WP4 · Depends on: WP2 + WP3 (nothing to
route to until the doctrine and stubs exist). Deliverable: an agent that is *asked about*
stacked PRs reaches the doctrine, the repo's own gates are green, and the work is
published to `origin/dev`.

## Scope

IN: `plugins/codexclaw/skills/dev/SKILL.md` (frontmatter `description` + `keywords`),
`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md` (frontmatter `keywords`),
`docs-site/src/content/docs/guides/skills.md` (only if it enumerates per-skill
capabilities that now omit stacking), the devlog unit's own `040_summary.md`, and git
publish actions.

OUT: new skills, manifest changes, README skill-count badge (unchanged — this unit adds no
skill directory, which is exactly why `dev` was chosen as owner in `000_research.md` §5).

## M1 — `dev/SKILL.md` frontmatter

`cxc-dev` is `allow_implicit_invocation: true`, so its description/keywords are a real
routing surface: a user saying "stacked PR" or "PR 쪼개서 올려줘" must land here.

```diff
-  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification", "browse", "browser", "QA", "agbrowse", "브라우저", "페이지 확인", "화면 QA", "플레이라이트"]
+  keywords: ["develop", "implement", "refactor", "feature", "code quality", "verification", "browse", "browser", "QA", "agbrowse", "브라우저", "페이지 확인", "화면 QA", "플레이라이트", "stacked PR", "stacked pull request", "stacked diff", "PR stack", "restack", "스택 PR", "PR 쪼개기"]
```

And extend the `description` trigger list with the same intent (keep the existing text;
append before the closing quote):

```diff
-... Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding, browse, browser, QA, 브라우저, 브라우즈, 페이지 열어, URL 확인, 화면 확인, 스크린샷, QA 확인, 플레이라이트."
+... Triggers: any code change, refactor, bug fix, feature, test, review, scaffolding, browse, browser, QA, stacked PR, stacked diff, PR stack, restack, 브라우저, 브라우즈, 페이지 열어, URL 확인, 화면 확인, 스크린샷, QA 확인, 플레이라이트, 스택 PR, PR 쪼개기."
```

`agents/openai.yaml` for `dev` carries only `display_name` / `short_description` /
`allow_implicit_invocation` — no trigger list — so it needs **no** change. Verify by
reading the file before deciding to edit it (do not add fields the schema does not use).

## M2 — `dev-code-reviewer/SKILL.md` frontmatter keywords

Review of a stack enters through the reviewer skill:

```diff
-  keywords: ["review", "PR", "pull request", "diff", "merge", "feedback", "approve", "code quality"]
+  keywords: ["review", "PR", "pull request", "diff", "merge", "feedback", "approve", "code quality", "stacked PR", "stack review", "스택 PR 리뷰"]
```

## M3 — docs-site consistency (conditional)

`docs-site/src/content/docs/guides/skills.md` carries a per-skill capability table
(`cxc-dev-code-reviewer | dev-code-reviewer | Review verdicts, findings, and risk
assessment.`) and a routing table. Inspect both:

- If the tables are one-line role summaries only, **no edit** — stacking is a rule inside
  an existing role, not a new role. Record the no-op decision in the summary doc.
- If a table enumerates rule families or references per skill, add the `DEV-STACK-*` /
  `references/stacked-prs.md` row so the published docs do not under-report the skill.

The README `skills-27` badge stays untouched: no skill directory is added.

## M4 — Verification (C-gate evidence for the whole unit)

Run and capture, with exit codes:

```sh
npm run gate
npm test
rg -n "DEV-STACK-0" plugins/codexclaw/skills          # one definition site + pointers
rg -n "stacked-prs.md" plugins/codexclaw/skills       # owner + every stub resolves
ls plugins/codexclaw/skills/dev/references/stacked-prs.md
```

Pointer-resolution proof is the activation evidence for this unit
(C-ACTIVATION-GROUNDING-01): each stub names a path that exists, and the definition
appears exactly once. A stub pointing at a missing file is the failure mode this check
exists to catch.

## M5 — Publish

Commits are focused, one per work-phase (docs unit; doctrine; wiring; metadata). Then —
push is **pre-approved by the user for this session** (`DEV-GIT-PUSH-01` satisfied by
explicit instruction, scope = this repo's `dev` branch):

```sh
git push origin dev
git log --oneline -5 origin/dev
git status --porcelain
```

The scope of the approval is `origin/dev` only: no tags, no other branches, no PR
creation, no merge (`DEV-STACK-04` / `DEV-GIT-PUSH-01` both keep those out).

## Accept criteria (WP4)

1. Frontmatter parses and keywords include both English and Korean stacking intents.
2. `npm run gate` and `npm test` exit 0, output captured fresh.
3. Pointer-resolution greps show one definition site and no dangling reference path.
4. `git log origin/dev` proves the remote advanced to the new HEAD; `git status` shows no
   in-scope leftovers (the user's untracked `260722_260722-repo-governance-config/` stays
   untouched and is expected to remain listed).
