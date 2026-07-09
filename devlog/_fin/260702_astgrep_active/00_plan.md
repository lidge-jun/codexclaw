# astgrep_active — Make agents actually reach for ast-grep

Status: SHIPPED (D closed 2026-07-02; 318/318 tests, gate OK, live dist E2E verified;
advisory envelope confirmed against omo lsp codex-hook.ts:36-42 parity) · class C3
Parent evidence: lazygap `005_code_intelligence.md` (LSP/codegraph = confirmed non-goal;
"ast-grep one-shot stays the answer"), external evidence gathered 2026-07-02 (see Sources).

## Why (Part 1 — plain)

Research shows structural (AST) search measurably helps agents, but LLMs write
ast-grep patterns badly (limited training data), and agents default to hand-editing
the same shape across many files instead of running one deterministic codemod.
Two reinforcements, both inside the no-server philosophy:

1. **Skill**: upgrade `cxc-ast-grep` with a mandatory verification loop and a
   per-language, *actually tested* pattern example reference, so a model that loads
   the skill writes valid patterns on the first or second try.
2. **Hook**: a fail-open PostToolUse advisory that notices "same-shaped edit repeated
   across ≥3 distinct files" and suggests switching to an ast-grep rewrite —
   the same E-tier advisory pattern as the existing shell friction gate (080.1).

Non-goals (LOCKED upstream): no LSP daemon, no codegraph MCP, no new subagent roles.

## Evidence base

| Claim | Source |
| --- | --- |
| AST-structured querying largest ablation win for issue resolution | arXiv 2511.16005 (InfCode-C++), checked 2026-07-02 |
| LLMs mis-write ast-grep patterns / confuse with other tools | ast-grep.github.io/blog/more-llm-support.html, checked 2026-07-02 |
| grep-first, escalate-to-structural strategy | yage.ai "Why Coding Agents Still Use grep" (2026-03-27), checked 2026-07-02 |

## Part 2 — diff-level plan

### NEW `plugins/codexclaw/skills/ast-grep/references/patterns.md`

Per-language verified examples (TypeScript/JS, Python, plus one YAML relational rule).
Each row: intent → pattern → helper command → expected match on a fixture snippet.
Every example MUST be executed against a scratch fixture during B (evidence recorded
in the doc's Sources/verification footer, FAMILY-FRESH-01). Content sections:

- Common intents: call rewrite (`console.log($$$A)` → `logger.info($$$A)`), import
  migration, strip `as any`, empty catch, missing await (relational rule `has`/`inside`).
- Pitfall table: regex syntax fails silently · `$VAR` = one node vs `$$$` = zero+ ·
  `--lang` required for correct parser · metavariable must be WHOLE token (`$FN(` ok,
  `use$HOOK(` invalid) · pattern must be a parsable expression for the target language.

### MODIFY `plugins/codexclaw/skills/ast-grep/SKILL.md`

- Add section **"Verification loop (MUST)"**: `validate` → `search` (review the JSON
  match list — count + spot-check 2-3 sites) → refine pattern → `replace` preview →
  `--apply`. Never `--apply` a pattern whose match list you have not read.
- Add routing line to `references/patterns.md` (tiered loading — read on demand).
- Keep total ≤500 lines (currently 81; additions ~25 lines).

### NEW `plugins/codexclaw/components/pabcd-state/src/edit-shape.ts`

Fail-open PostToolUse capture for `apply_patch` (same coverage limit as comment-lint:
shell-based writes are invisible; stated in the module header).

- `normalizeEditLine(line)`: squeeze whitespace, quoted strings → `"S"`, numeric
  literals → `N`, identifier tokens → `I`. Aggressive on purpose — collisions are
  acceptable for an *advisory* (the advice "use ast-grep" is the same either way).
- `fileEditShapes(patchText)`: split the apply_patch envelope on
  `*** Update File:` / `*** Add File:` sections → per file, signature =
  sha256(joined normalized `-`/`+` body lines). Whole-hunk match, not per-line —
  cuts false positives.
- Ledger `.codexclaw/edit-shapes.jsonl`, rows
  `{ts, key, file, files: string[], advised: boolean}` — friction.ts idioms
  (append-only, best-effort write, FAIL-OPEN readers).
- `handleEditShapeCapture(payload)`: records shapes; when a key reaches **≥3 distinct
  files** and was not yet advised → mark advised (dedupe: fires ONCE per signature)
  and emit a PostToolUse additionalContext envelope:
  "same-shaped edit in N files — consider `$cxc-ast-grep` replace for the rest;
  preview first". Otherwise `""`.
- Threshold 3 mirrors the friction stop threshold (verdictForCount).

**A-phase audit item (open risk):** confirm codex-rs PostToolUse supports an
additionalContext-style envelope (check lazygap `010_runtime_capability_verification.md`
/ codex-rs source). Fallback if unsupported: side-effect ledger + surface the advisory
on the NEXT `pre-tool-use-friction`-style PreToolUse "ask" instead.

### NEW `plugins/codexclaw/hooks/post-tool-use-detecting-edit-shapes.json`

Matcher `^apply_patch$`, command
`node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook post-tool-use-edit-shape`,
timeout 10, statusMessage "(codexclaw) Watching for repeated edit shapes".

### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

Add `post-tool-use-edit-shape` branch inside the existing fail-open try (after
`post-tool-use-friction`), dispatching to `handleEditShapeCapture(parsePostToolUse(raw))`.

### NEW `plugins/codexclaw/components/pabcd-state/test/edit-shape.test.ts`

node:test (`node --test`, matches component convention): normalization table cases ·
per-file signature extraction from a realistic apply_patch envelope · threshold + 
distinct-file counting (same file twice ≠ 2 files) · advise-once dedupe ·
fail-open on garbage payloads/unreadable ledger.

### Build + verify

- `node scripts/build.mjs` → refresh `components/pabcd-state/dist/*` (committed dist).
- C phase: `node --test` (pabcd-state), `scripts/gate.mjs` if it is the repo gate,
  tsc --noEmit equivalent per repo config, and live fixture runs for every
  patterns.md example.

## Out of scope

- Write/Edit tool matchers for shape capture (comment-lint parity: only apply_patch
  carries a parseable envelope; revisit if Codex normalizes edit tools).
- Any MCP/daemon for ast-grep; LSP anything (lazygap 005 non-goal).
- Auto-running codemods — the hook only advises.
