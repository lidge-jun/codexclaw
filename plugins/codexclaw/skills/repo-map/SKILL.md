---
name: cxc-repo-map
description: "Use RepoMap for codebase overview, structure maps, symbol overview, and architecture map exploration. Triggers: repo map, codebase overview, structure map, 와꾸, project structure, unfamiliar codebase exploration, symbol overview, architecture map."
metadata:
  short-description: "One-shot tree-sitter symbol map with PageRank for unfamiliar codebase exploration."
---

# repo-map

RepoMap generates a compact symbol overview for a repository or subtree. It uses
tree-sitter tag queries to find definitions and references, then ranks files and
symbols with PageRank over the reference graph. The implementation is vendored
from Pete Davis' RepoMapper and keeps the Aider lineage for the `.scm` tag
queries.

Reach for it before deep `rg` dives when you are entering unfamiliar C2+ code and
need the project shape: important files, definitions, cross-file reference
gravity, and the likely architectural center of a subtree.

## rg and ast-grep boundaries

Use `rg` for text, filenames, comments, literal strings, and byte-level regex
searches.

Use `cxc-ast-grep` for shape search and deterministic rewrites: function/call
patterns, imports, syntax-aware migrations, and codemods.

Use this skill for an overview map, not for exact search. The map is a guide for
where to inspect next, not proof that a symbol is absent.

## When to use this skill

- "Give me a repo map of this package."
- "I am in unfamiliar code; show me the structure first."
- "What files define the main symbols in this subtree?"
- "Build an architecture map before changing this module."
- "와꾸 먼저 보자."

## CLI usage

Preferred:

```bash
cxc map .
cxc map src/ --budget 2048
```

Direct script:

```bash
python3 plugins/codexclaw/skills/repo-map/scripts/repomap.py .
python3 plugins/codexclaw/skills/repo-map/scripts/repomap.py src/ --budget 2048
```

Useful flags:

Note: compiled-output dirs (`dist`, `build`, `target`, `out`, `coverage`) are
skipped during directory expansion. If a repo's real sources live there, pass
the path explicitly (e.g. `cxc map dist/`) to map it anyway.

```bash
--map-tokens N      # token budget; default 4096
--budget N          # alias for --map-tokens
--chat-files ...    # files currently in focus, ranked higher
--mentioned-idents  # symbols to boost
--verbose           # stderr summary: files, defs, refs
```

## Dependencies

Install once when the Python dependencies are not already present:

```bash
python3 -m pip install -r plugins/codexclaw/skills/repo-map/scripts/requirements.txt
```

The CLI degrades cleanly when dependencies are missing. `--help` works with only
system Python. A real map run without parser dependencies prints a single install
hint and exits with code 3.

The pinned parser stack matters: `tree-sitter-language-pack==0.9.0` and
`tree-sitter==0.25.1` are the verified working pair for this vendored parser API.

## Cache

RepoMap stores derived tag cache data under:

```text
.codexclaw/cache/repomap/tags.v1
```

Set `CODEXCLAW_REPOMAP_CACHE` to override the location. The cache is rebuildable
derived data. It is wiped only by `cxc reset --all`.

## Verification tiers

Locally fixture-verified: TypeScript/JavaScript, Python, and Rust.

Other languages inherit the vendored Aider-tested `.scm` tag queries on a
best-effort basis. Treat those maps as orientation, then inspect the files they
surface.

## Notes

- On-demand skill (`allow_implicit_invocation: false`); reached by trigger or
  explicit use.
- Discoverability: a SessionStart hook
  (`hooks/session-start-announcing-map-affordance.json`, cxc-ops) announces this
  tool's existence once per session when the repo clears a source-file size gate.
  That is a POINTER only — the map body is never session-injected (on-demand stays
  the rule). This is the runtime companion to the `dev` §1.5 DEV-MAP-FIRST-01
  routing, which is model-autonomous.
- Stateless one-shot CLI: no daemon, server, MCP process, background indexer, or
  workspace watcher.
- Lazygap 005 compliant: no dependency import or runtime setup is required for
  `--help`; heavy Python modules load only after argument parsing.
