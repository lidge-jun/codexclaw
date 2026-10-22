# 010 — Phase 1: finish, publish, align (noslopdesign-publish)

Repo root N = /Users/jun/Developer/new/700_projects/noslopdesign. CodexClaw root X = /Users/jun/.goat/desktop/worktrees/codexclaw/goat-ac0814e4.
Amended after audit r1 (FAIL, 11 findings); dispositions in 000_plan.md "Audit".

## MODIFY / NEW / DELETE map

### N/scripts/lib/rules.mjs (MODIFY)
- SKILL_MAP: `{ from: '.../dev-frontend', to: 'skills/noslop-frontend', owned: ['references/core/iterative-design.md'] }`, uiux `owned: []`. Export `ownedFor(entry) = new Set([...OWNED, ...entry.owned])`.
- REWRITES append (after the existing entries):
  - `[/^### \`shadcn-components\.tar\.gz\`[\s\S]*?(?=^## )/m, '']`
  - `['; the document grammar (hairlines, type hierarchy, one accent, data charts) is \`dev-visualizer\` REPORT-DESIGN-01.', '; use a document grammar of hairlines, type hierarchy, one accent and data charts instead.']`
  - `['(per search skill)', '(with a current web search)']`
  - `['DEFAULT — ponytail discipline applied to UX', 'DEFAULT — minimum-choice discipline applied to UX']`, `['existence the ponytail way, in order', 'existence, in order']`
- LEFTOVERS: replace the dev-name pattern with `/\bdev-[a-z]+(?:-[a-z]+)*\b/` (any CodexClaw dev-* skill; today only dev-visualizer would hit); add `/\bponytail\b/`, `/per search skill/`.

### N/scripts/sync-from-codexclaw.mjs (MODIFY)
- Two passes: pass 1 computes every target buffer, collects `changed` and `problems` (owned set from `ownedFor(entry)`); if `problems.length` → print and exit 1 before any write (no dirty tree). Pass 2 writes/removes only when not `--check`.
- upstream.json written only when `changed.length || !prev.commit` (unchanged).

### N/skills/noslop-frontend/references/core/iterative-design.md (MODIFY, repo-owned)
- Rewritten in original words. Sections: `# Iterative Design — LLM Limitations & Multi-Round Process`, `## The Convergence Problem`, `## The Multi-Round Process` (`### Round 1: Diverge`, `### Round 2: Kill` incl. the precedence note pointing at `../../../noslop-uiux/SKILL.md` UX-CONCEPT-GEN-01, `### Round 3: Mutate`, `### Round 4+: Repeat`), `## Working With the User`, `## Upgrade Techniques Library` (Typography, Layout, Surfaces, Motion; links `liquid-glass.md`, `prototype-variants.md`). Topic-index row (synced) stays truthful: "Diverge→Kill→Mutate process, upgrade techniques".

### N/tests/check.mjs (MODIFY)
- Owned set from `ownedFor`.
- Orphans: for each skill, each `references/**/*.md` basename must appear in some other text file of EITHER skill (including SKILL.md) → else `fail(at, 'orphan reference: nothing names <basename>')`.
- Versions: `package.json.version`, `.claude-plugin/marketplace.json plugins[0].version`, `.codex-plugin/plugin.json version` must be equal → else fail naming all three.

### N/install.sh (MODIFY)
- Replace `points_here` with taste-skill's `resolve_link` and `owned_by_repo` (verbatim logic, MIT, credited in a comment).

### N/.github/workflows/check.yml (REPLACE)
```yaml
name: Check skills

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Frontmatter, links, orphans, versions and leftover references
        run: |
          npm install --no-save --no-package-lock yaml@2.6.1
          node tests/check.mjs
      - name: Shell scripts parse
        run: |
          shopt -s nullglob
          for f in install.sh skills/*/scripts/*.sh; do bash -n "$f"; done
          bash install.sh --list
      - name: Synced files match the pinned upstream commit
        run: |
          commit="$(node -p "require('./upstream.json').commit")"
          git init -q "$RUNNER_TEMP/codexclaw"
          git -C "$RUNNER_TEMP/codexclaw" fetch -q --depth 1 https://github.com/lidge-jun/codexclaw.git "$commit"
          git -C "$RUNNER_TEMP/codexclaw" checkout -q FETCH_HEAD
          node scripts/sync-from-codexclaw.mjs --source "$RUNNER_TEMP/codexclaw" --check
```

### N/.github/workflows/sync.yml (REPLACE)
Every `run:` uses `shell: bash` (GitHub runs it as `bash --noprofile --norc -eo pipefail {0}`), so a failing `node … | tee` fails the step. `failure()` covers Fetch, Sync, Check and PR steps; `success()` closes the issue. PR lookup is open-only.
```yaml
name: Sync from CodexClaw

on:
  schedule:
    - cron: '0 0 * * 1'
  workflow_dispatch:

concurrency:
  group: sync
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      actions: write
    env:
      GH_TOKEN: ${{ github.token }}
      BLOCKED_TITLE: Sync from CodexClaw is blocked
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Fetch CodexClaw
        run: git clone --depth 1 https://github.com/lidge-jun/codexclaw.git "$RUNNER_TEMP/codexclaw"
      - name: Sync
        run: node scripts/sync-from-codexclaw.mjs --source "$RUNNER_TEMP/codexclaw" 2>&1 | tee "$RUNNER_TEMP/sync.log"
      - name: Check
        run: |
          npm install --no-save --no-package-lock yaml@2.6.1
          node tests/check.mjs 2>&1 | tee -a "$RUNNER_TEMP/sync.log"
      - name: Open pull request
        run: |
          if [ -z "$(git status --porcelain)" ]; then echo "already in sync"; exit 0; fi
          commit="$(node -p "require('./upstream.json').commit.slice(0, 12)")"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -B sync/codexclaw
          git add -A
          git commit -m "sync: codexclaw $commit"
          git push -f origin sync/codexclaw
          body="Skill references synced from lidge-jun/codexclaw@$commit by scripts/sync-from-codexclaw.mjs. Check skills runs on this branch through workflow_dispatch."
          open="$(gh pr list --head sync/codexclaw --state open --json number -q '.[0].number')"
          if [ -n "$open" ]; then
            gh pr edit "$open" --title "sync: codexclaw $commit" --body "$body"
          else
            gh pr create --base main --head sync/codexclaw --title "sync: codexclaw $commit" --body "$body"
          fi
          gh workflow run check.yml --ref sync/codexclaw
      - name: Close blocked issue
        if: success()
        run: |
          for n in $(gh issue list --state open --search "in:title \"$BLOCKED_TITLE\"" --json number,title -q ".[] | select(.title == env.BLOCKED_TITLE) | .number"); do
            gh issue close "$n" --comment "Sync succeeded in run $GITHUB_RUN_ID."
          done
      - name: Report blocked sync
        if: failure()
        run: |
          log="$(tail -n 60 "$RUNNER_TEMP/sync.log" 2>/dev/null || echo 'no log')"
          body="$(printf 'Run: %s/%s/actions/runs/%s\n\n%s\n%s\n%s\n' "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" '~~~' "$log" '~~~')"
          n="$(gh issue list --state open --search "in:title \"$BLOCKED_TITLE\"" --json number,title -q ".[] | select(.title == env.BLOCKED_TITLE) | .number" | head -n 1)"
          if [ -n "$n" ]; then gh issue comment "$n" --body "$body"; else gh issue create --title "$BLOCKED_TITLE" --body "$body"; fi
```
Activation scenarios: (a) upstream adds a new internal reference → Sync exits 1 → Report blocked sync creates/comments the issue; (b) upstream breaks a link or adds an orphan → Check exits 1 → same; (c) next healthy run → Close blocked issue; (d) skill content changed, no open PR (first run or after merge) → create; (e) open PR exists → edit; (f) commit-only upstream change → tree clean → "already in sync".

### N/skills/noslop-frontend/SKILL.md (MODIFY)
- Tools section: add "`$imagegen` in the references means the agent's own image tool: Codex `$imagegen`, or any image generation tool or MCP in Claude Code and other agents."

### N/README.md, N/README.ko.md (MODIFY)
- Replace the single-skill advice: "Install both; noslop-uiux reads its work sizes and rule classes from noslop-frontend, and each links into the other."
- After the prompts, a table "How to call it": npx skills / install.sh in Codex → `$noslop-frontend …`; in Claude Code → `/noslop-frontend …`; Claude Code plugin → `/noslopdesign:noslop-frontend …`; Codex plugin → pick `noslop-frontend` from the `$` skill menu. All paths: plain requests ("SaaS 홈페이지 멋있게 만들어줘") also trigger it from the description.
- New "Maintaining" / "관리" section: sync commands, the Actions PR repo setting, rule-table-only edits to synced files, version bump in three files.

### N/NOTICE.md (MODIFY)
- impeccable row: "Detector rule patterns adapted (no verbatim text)". b1rdmania row removed; sentence: "iterative-design.md is written for this repo and is not synced." taste-skill row adds install.sh resolve_link.

### N/CHANGELOG.md (MODIFY) — owned iterative-design rewrite; sync PR/issue flow; per-install call syntax.

### X (CodexClaw) branch handling
- Before anything here: the noslopdesign write sync reads `$TMP/codexclaw-main`, a fresh `git clone --depth 1` of origin/main, never X.
- `git fetch origin dev && git checkout -B goat/noslopdesign-repo-strategy origin/dev` (untracked devlog unit carries over; origin/dev..HEAD then holds only this unit's commit).

### X/README.md, X/README.ko.md, X/README.zh.md (MODIFY)
- Ecosystem table row: `| [noslopdesign](https://github.com/lidge-jun/noslopdesign) | Standalone \`dev-frontend\` + \`dev-uiux-design\` as \`noslop-frontend\` / \`noslop-uiux\`, synced weekly from here |` (ko/zh translated).
- After the Dev Skill Family table: "**Frontend skills downstream.** `dev-frontend` and `dev-uiux-design` references are mirrored to [noslopdesign](https://github.com/lidge-jun/noslopdesign) by a rule table. Keep cross-skill references in the forms `cxc-dev-*`, `../../dev-*/` and `\`dev\` §x`, keep `Source:` lines at line start, and do not rename the two folders; a new form fails that repo's weekly sync and opens an issue there."

### X/NOTICE.md (MODIFY)
- "## Downstream" section: noslopdesign redistributes the dev-frontend and dev-uiux-design references under MIT with this notice's third-party credits.

### GitHub (NEW)
- `gh repo create lidge-jun/noslopdesign --public --source N --remote origin --push --description "<desc>"`; `gh repo edit --add-topic agent-skills,claude-code,codex,frontend,design,anti-slop,korean`.
- `gh api -X PUT repos/lidge-jun/noslopdesign/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`, then read back `gh api repos/lidge-jun/noslopdesign/actions/permissions/workflow` expecting `can_approve_pull_request_reviews: true`.
- CodexClaw: commit on the rebased branch, `git push -u origin goat/noslopdesign-repo-strategy`, `gh pr create --draft --base dev`, then GOAT `link_pull_request` with the PR URL and verify with `list_thread_pull_requests`.

## TESTS

- tests/check.mjs is the test. Probes in a scratch copy (`cp -R N $TMP`): add an unreferenced `references/core/zz-probe.md` → exit 1 "orphan reference"; set package.json version 9.9.9 → exit 1 naming the three versions; append "see dev-visualizer" to a synced file → exit 1 leftover.
- Sync probe: scratch codexclaw copy with "see \`cxc-dev-testing\`" appended to a reference → sync exits 1 and the scratch noslopdesign tree stays clean (`git status --porcelain` empty after commit).
- install.sh: `HOME=$(mktemp -d) ./install.sh --all-agents` → 4 "linked"; rerun → 4 "linked" (relink); `--uninstall --all-agents` → 4 "removed"; relative-link probe: a `ln -s ../relative` link resolving into skills/ is recognized as owned.

## Verification (C)

- `cd N && npm run check` → exit 0.
- `node scripts/sync-from-codexclaw.mjs --source X --check` → exit 0.
- `shopt -s nullglob; for f in install.sh skills/*/scripts/*.sh; do bash -n "$f"; done` → exit 0.
- `gh run list -R lidge-jun/noslopdesign -w "Check skills" -L 1 --json conclusion,headSha` → success at main head.
- `gh workflow run sync.yml -R lidge-jun/noslopdesign` → run success with "already in sync", or an open `sync/codexclaw` PR whose dispatched Check skills run succeeds.
- `rg -n noslopdesign X/README.md X/README.ko.md X/README.zh.md X/NOTICE.md` → hits in all four; draft PR URL linked via link_pull_request.
