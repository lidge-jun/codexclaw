# 260706_repo_map — `cxc map`: on-demand ranked repo structure map

Status: B in flight (W1 vendor+adapt, W2 CLI+tests dispatched in parallel) · class C3
Parent evidence: lazygap `005_code_intelligence.md` (LSP/codegraph LOCKED non-goal;
one-shot stays the answer), external research gathered 2026-07-06 (see Sources).

## Why (plain)

The pre-patch exploration phase is the real cost: `rg` answers "where is this string"
but the agent reconstructs the repo's shape by opening files, every session. Research
shows structured repo overviews are the most token-efficient exploration aid
(8.5-13k tokens vs ~108k for grep-walks in the 2025-10 retrieval study), while
session-start whole-repo indexing is the weakest-evidence pattern (stale-index
problem; Claude Code abandoned it). The sweet spot is an **on-demand, stateless
one-shot map**: Aider's tree-sitter tags + PageRank, generated fresh per request.

## Interview decisions (2026-07-06)

- **Delivery: exploration-time on-demand** — routed via `dev` §1.5 (DEV-MAP-FIRST-01,
  DEFAULT class, guidance wording only). No session-start injection, no daemon.
- **Content: symbols + imports + importance ranking** — full Aider lineage
  (def/ref tags, PageRank over the symbol-reference graph).
- **Languages: all vendored `.scm` queries (Rust included), 2-tier verification** —
  TS/JS + Python + Rust fixture-verified locally; remaining languages inherit
  Aider's battle-tested tags queries best-effort (FAMILY-FRESH-01 applies to
  patterns we author, not to vendored upstream-verified assets).
- **Engine: vendor RepoMapper** (github.com/pdavis68/RepoMapper, MIT, Pete Davis;
  queries derived from Aider, Apache-2.0) rather than a TS port. ast-grep was
  rejected as extraction engine (Mind C2: patterns can't reliably enumerate all
  defs/refs; tree-sitter tags queries are the honest engine).

## Audit findings folded in (reviewer FAIL round, 2026-07-06)

1. `agents/openai.yaml` required for every skill dir (manifest-policy.test.mjs:51).
2. skill-hub `references/catalog.md` row required (manifest-policy.test.mjs:144-158).
3. Cache `.codexclaw/cache/repomap/` is wiped only by `cxc reset --all` (reset.ts
   scopes); documented in SKILL.md rather than changing reset semantics.
4. Lazy imports mandatory: upstream `utils.py` sys.exits on missing tiktoken at
   import time; `repomap.py` must parse args before heavy imports so `--help`
   exits 0 dep-free (acceptance criterion).
5. `cxc map` is the first skill-owned Python subcommand in `bin/codexclaw.mjs`
   (all others delegate to compiled component dists) — rationale recorded in
   INDEX.md CLI table: vendored upstream script, no dist build to own.
6. Dependency pins are load-bearing: `tree-sitter-language-pack==0.9.0` +
   `tree-sitter==0.25.1` live-verified; language-pack 1.10.x breaks the parser
   API (`parse(bytes)` raises). Pinned in vendored `requirements.txt`.

## Philosophy compliance (lazygap 005)

`cxc map` is a stateless one-shot CLI: no daemon, no MCP server, no maintained
code graph. The diskcache tags cache under `.codexclaw/cache/repomap/` is a
rebuildable derived cache, explicitly allowed by `structure/00_philosophy.md`
§2 (ast-grep runtime precedent). The LOCKED non-goal (LSP daemon / codegraph
MCP) is untouched.

## Evidence base

| Claim | Source |
| --- | --- |
| Repo-map style AST/graph search most token-efficient retrieval | preprints.org/manuscript/202510.0924 (2025-10), checked 2026-07-06 |
| AST-structured querying largest ablation win | arXiv 2511.16005 (InfCode-C++), checked 2026-07-06 |
| Session-start indexing weakest pattern (stale, abandoned by Claude Code) | Pragmatic Engineer interview w/ Boris Cherny (2026), checked 2026-07-06 |
| Graph-as-tool beats graph-as-preload | RepoMaster arXiv 2505.21577; Codebase-Memory arXiv 2603.27277, checked 2026-07-06 |
| Aider repo map design (tags + PageRank, token budget) | aider.chat/docs/repomap.html, checked 2026-07-06 |

## Live verification (pre-B spike)

Pinned-deps venv run over `components/subagent-config/src`: ranked map with
store.ts/spawn-wrapper.ts symbols, 84 defs / 49 refs, 2.4s wall (cold cache).
`tree-sitter-language-pack==1.10.1` reproduces the `'bytes' object is not an
instance of 'str'` parser failure; 0.9.0 is correct.

## Addendum 2026-07-07 — dependency bootstrap ladder (deployment hardening)

Owner directive: `cxc map` must work for a fresh install without a manual pip
step. Shipped a bootstrap ladder in `bin/codexclaw.mjs` (`selectRepoMapCommand`,
pure + test-importable via a main-module guard):

1. `--help`/`-h` bypasses the ladder entirely (dep-free help contract kept).
2. `CODEXCLAW_PYTHON` env override, verbatim.
3. `uv run --quiet --with-requirements <pinned reqs> python -B` — deps resolve
   into uv's rebuildable cache; first run pays the resolve, warm after.
4. Existing venv at `$CODEXCLAW_HOME|~/.codexclaw/venvs/repomap` (philosophy §2
   user-level rebuildable derived cache; recall-FTS precedent). Auto-created
   only under `CODEXCLAW_MAP_BOOTSTRAP=1` (opt-in network).
5. Bare `python3` — repomap.py's own exit-3 install hint remains the floor.

Audit (independent reviewer, PASS-WITH-NOTES) findings folded in: help bypass
preserved (packaging test), venv documented as rebuildable cache not state,
`repo-map-smoke.test.mjs` `depsAvailable()` now mirrors the ladder (uv counts),
ladder asserted source-level offline in `repo-map-packaging.test.mjs` (no
network in CI). Verified live: `cxc map --help` exit 0 dep-free; uv-rung map of
`components/cxc-ops/src` ranked listing exit 0; full `npm test` 796 pass.

Cross-harness: this repo is the reference implementation of the pabcd SoT
contract (`pabcd_initiative/skills/dev-pabcd/references/repo-map-capability.md`);
the ladder is recorded there as a contract-compatible packaging note. Subtree
scoping (`cxc map <subdir>` ranks within the subtree only) is part of the
contract and useful for large feature-partitioned monorepos.
