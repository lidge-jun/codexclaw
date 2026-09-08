# Verifiers — observed at wp1 (2026-09-08)

Each command below was run; exit codes are real. "Reads target" states what the
command observes, per PLAN-VERIFIER-REAL-01.

| Command | Exit | Reads the change target? |
|---|---|---|
| `node --test plugins/codexclaw/test/skill-catalog.test.mjs` (worktree) | 0, 4 pass | Reads skills/README.md catalog block, on-disk SKILL.md folders, README badges. Does not read prose. |
| `/usr/local/bin/python3 /Users/jun/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/codexclaw/skills/search` | 0 "Skill is valid!" | Frontmatter of the named skill only |
| same for plugins/codexclaw/skills/dev-diagram-viewer | 0 | same |
| `node --test --test-concurrency=1 'plugins/codexclaw/components/pabcd-state/test/*.test.ts' 'plugins/codexclaw/components/subagent-config/test/*.test.ts' 'plugins/codexclaw/test/*.test.mjs'` in /tmp/pr84-merge-260908 (origin/dev 50b7309c + pr84 57e63fdc, CHANGELOG resolved) | 0; pass 1857, fail 0, 61.5 s | Reads PR #84's changed src/dist/test files including worktree-source-integration.test.ts and qa-validate-evidence.test.mjs. Log: evidence/wp4/merge-tests-wp1.log |
| `node devlog/_plan/260908_narrative_documents/evidence/check-links.mjs <files>` | written at wp1 A-fold; baseline run on search/diagram-viewer/kwrite/plan-output: exit 0, checked 15 relative links in 4 files; missing 0 | Reads each changed Markdown file and resolves every relative link target |
| Forward-use trials (wp2, wp3) | independent Opus-5 leaves; PASS criteria in 010/020 | Reads the new references by loading them as skills |
| GitHub exact-head CI / packed-install / WSL / release workflow | remote; run ids recorded at wp5 | Reads the pushed head |

Not run: full product build/typecheck (docs-only work-phases); GUI tests.


## wp1 C run

- check-links.mjs over the seven plan docs: exit 1 with 5 missing targets, all of them
  quoted future paths (`reader-documents.md`, `deep-research.md`) that wp2/wp3 create.
  Expected for plan text; the checker is meant for shipped skill files, where it must be 0.
- `cxc receipt test -- node --test plugins/codexclaw/test/skill-catalog.test.mjs`: 4 pass,
  receipt at .codexclaw/evidence/<session>/test-receipt.json.
