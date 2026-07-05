# Verified ast-grep patterns

Every pattern and pitfall below was EXECUTED against fixture files with the shipped
helper (`scripts/ast_grep_helper.py`) — not transcribed from docs. Re-verify after a
major ast-grep upgrade (see Sources footer).

## TypeScript / JavaScript (`--lang ts`)

| Intent | Command | Verified result |
| --- | --- | --- |
| Find call sites | `search 'console.log($$$ARGS)'` | matches `console.log("boot", total)`; does NOT match `console.warn` (exact callee) |
| Rewrite calls | `replace 'console.log($$$ARGS)' 'logger.info($$$ARGS)'` | preview `-> logger.info("boot", total)`; args carried over via `$$$ARGS` |
| Strip casts | `search '$X as any'` | matches `cfg as any` |
| Empty catch | `search 'try { $$$BODY } catch ($E) {}'` | matches — see Pitfall 1 for why bare `catch ($E) {}` fails |
| CJS → ESM | `replace 'const $V = require($M)' 'import $V from $M'` | `const legacy = require("./legacy")` → `import legacy from "./legacy"` |

## Python (`--lang python`)

| Intent | Command | Verified result |
| --- | --- | --- |
| print → logging | `replace 'print($$$ARGS)' 'logging.info($$$ARGS)'` | rewrote both call sites, nested call args preserved |
| Bare except | inline pattern FAILS (Pitfall 1) — use a YAML rule on `kind: except_clause` | `except: $$$BODY` errors with "Multiple AST nodes" |

## YAML relational rule (scan)

Find `fetch()` calls whose result is not awaited:

```yaml
id: unawaited-fetch
language: TypeScript
severity: warning
message: fetch() result is not awaited
rule:
  pattern: fetch($$$ARGS)
  not:
    inside:
      kind: await_expression
```

```
ast_grep_helper.py scan <PATH> --rule unawaited-fetch.yml --report-style short
```

Verified: flags `const res = fetch(...)`, correctly skips `await fetch("/health")`.
NOTE: the rule file goes in `--rule`; a bare positional YAML path is treated as a scan
target and sg demands a project config ("No ast-grep project configuration is found").

## Pitfalls (all reproduced live)

1. **A pattern must parse as ONE node.** `catch ($E) {}` and `except: $$$BODY` both
   fail with `Multiple AST nodes are detected`. Fix: wrap in enough context to form a
   single statement (`try { $$$BODY } catch ($E) {}`) or switch to a YAML `kind:` rule.
2. **Regex syntax fails.** `console\.(log|warn)` — the helper's `validate` flags the
   `|` alternation with a hint. Run one call per alternative; there is no regex in
   patterns.
3. **Glued metavariables miss SILENTLY.** `use$HOOK($$$A)` passes `validate` (it is
   syntactically plausible) but returns **0 matches** on a file containing
   `useState(0)`. A metavariable must be the WHOLE token: match `$HOOK($$$A)` and
   filter names afterwards, or use a YAML rule with a `regex` constraint on the
   metavariable. Treat "0 matches where you expected some" as a pattern bug first.
4. **`--lang` decides the parser.** The same pattern text parses differently (or not
   at all) across languages; fixtures in another language are simply not scanned.

## Sources / verification

| What | Evidence |
| --- | --- |
| All rows above | Executed 2026-07-02 against scratch fixtures (`sample.ts`, `sample.py`, `unawaited.yml`), ast-grep 0.44.0 (Homebrew), helper v0.1.0 |
| LLMs mis-write ast-grep patterns (why this file exists) | https://ast-grep.github.io/blog/more-llm-support.html (checked 2026-07-02) |
| Pattern syntax reference | https://ast-grep.github.io/guide/pattern-syntax.html (checked 2026-07-02) |
