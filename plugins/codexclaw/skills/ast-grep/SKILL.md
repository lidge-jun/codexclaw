---
name: cxc-ast-grep
description: "Use ast-grep (sg) for AST-aware code search and rewrite across 25 languages. Trigger for structural code matching or deterministic codemods: find every function/call/class/import shaped like X, rewrite console.log to logger.info, strip `as any`, migrate require() to import, find empty catch blocks or missing await, and scan/apply YAML rules. Prefer this over rg/grep when the target is syntax shape rather than text; use rg for string contents, comments, filenames, or regex-style byte searches."
metadata:
  short-description: "AST-aware structural search + deterministic codemods (ast-grep/sg) across 25 languages."
---

# ast-grep

`sg` (also installed as `ast-grep`) is an **AST-aware search and rewrite tool**
across 25 languages. It treats your pattern as code, parses it the same way it
parses your project, and matches structurally. Reach for it whenever the question
depends on **code shape** rather than text bytes.

This skill ships a Python wrapper at `scripts/ast_grep_helper.py` and an install
reference at `references/install.md`. The helper adds offline pattern validation,
the two-pass write trick, and binary auto-resolution. Use it as the default entry
point.

## rg first — do not use ast-grep for ordinary grep

Plain filename, literal text, regex, comment, and simple callsite searches use
`rg` / `rg --files` first. ast-grep is for syntax-tree questions only. The test:
"does the answer depend on the language's syntax tree, or just on the file's
bytes?" Tree → ast-grep. Bytes → `rg`.

For a whole-repo structure OVERVIEW (which files own which symbols, ranked), use
`cxc map` (repo-map skill) instead; ast-grep is for shape SEARCH within known scope.

## When to use this skill

- "Find every function that takes a `Request` parameter."
- "Rewrite every `console.log(x)` to `logger.info(x)`."
- "Strip every `as any` cast."
- "Replace `require(...)` with `import` across the repo."
- "Find empty catch blocks" / "find missing `await`."
- "Apply this codemod across these 200 files."
- "Run our YAML lint rules and surface violations."

## Three things to internalize

### 1. ast-grep is NOT regex
The wildcards are `$VAR` (one AST node) and `$$$` (zero or more nodes). Regex
syntax (`|`, `.*`, `\w`, `[a-z]`) fails silently — the helper's `validate`
subcommand catches the common misuses offline before you run a search.

### 2. Always preview before you write
`replace` is a dry-run by default and prints the would-change diff. Add `--apply`
only after you have inspected the preview. The helper runs a two-pass write (JSON
match pass, then a separate `--update-all` pass) because ast-grep ignores
`--update-all` when `--json` is set.

### 3. Language matters
Pass `--lang` so the correct parser is used; the same pattern parses differently
across languages. `langs` lists the 25 supported languages with extensions.

## Verification loop (MUST)

Never trust a pattern you have not seen match. The loop:

1. `validate PATTERN --lang LANG` — offline sanity check (catches regex syntax and
   other common misuses; it can NOT catch every silent miss — see step 3).
2. `search PATTERN --lang LANG` — read the match list: is the COUNT plausible, and do
   2-3 spot-checked sites look right?
3. **0 matches where you expected some = pattern bug first**, not "no occurrences".
   The two reproduced causes: a glued metavariable (`use$HOOK(...)` — a metavar must
   be a whole token) and a pattern that does not parse as ONE node (`catch ($E) {}`).
   Consult `references/patterns.md` (verified examples + pitfalls) and refine.
4. `replace PATTERN REWRITE` — inspect the dry-run diff for every file, or at minimum
   every distinct shape in it.
5. Only then `--apply`. Never `--apply` a pattern whose match list you have not read.

## Helper usage

```
ast_grep_helper.py search PATTERN [PATH...] [--lang LANG] [--globs GLOB ...] [-C N]
ast_grep_helper.py replace PATTERN REWRITE [PATH...] [--lang LANG] [--apply]
ast_grep_helper.py scan [PATH...] --rule RULE_FILE [--apply]   # rule file via --rule, NOT positional
ast_grep_helper.py validate PATTERN [--lang LANG]   # offline pattern check
ast_grep_helper.py langs                            # list languages
ast_grep_helper.py doctor                           # binary availability + version
ast_grep_helper.py install                          # lazy-provision sg
```

Verified per-language pattern examples (call rewrite, cast strip, CJS→ESM, empty
catch, bare except, relational YAML rules) and the reproduced pitfall table live in
`references/patterns.md` — read it before writing a non-trivial pattern.

## Binary resolution + lazy provisioning

The helper resolves `sg` in priority order: `CODEXCLAW_AST_GREP_SG_PATH`
override (`OMO_AST_GREP_SG_PATH` fallback) → codexclaw runtime
(`$CODEX_HOME/runtime/ast-grep` or `~/.codexclaw/runtime/ast-grep`) → a cached
binary under the skill `bin/` → `PATH` → Homebrew defaults. When `sg` is missing,
`doctor`/`install` exit with a clear install hint rather than crashing. See
`references/install.md`. Provisioning is lazy, evidence-bound, and idempotent.

## Notes

- On-demand skill (`allow_implicit_invocation: false`); reached by trigger or
  `dev`-hub routing.
- No MCP server, no daemon, no workspace side-effects — this honors the core
  no-server contract. LSP and codegraph are deferred to a separate, isolated
  post-MVP extension and are deliberately not shipped here.
