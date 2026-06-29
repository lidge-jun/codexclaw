# L22 (Decade 220) -- Code Intelligence (lsp / codegraph / ast-grep)

Status: DONE
Cluster: 3 · Phase: expansion · Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/130_code_intelligence.md (J5), 090.1 J-13/J-16

## Goal (one slice)
Decide how much code intelligence codexclaw adopts. The core stays no-server /
lightweight / config-untouched. ast-grep is adopted via lazy provisioning;
lsp/codegraph are explicitly deferred to a separate post-MVP extension. The
`130-defer` fork is resolved to ast-grep only for MVP.

## Why now / dependencies
- Upstream: depends on the install/activation flow (L6) for any lazy
  provisioning hook, and on `cxc doctor` (L20) to probe binary presence.
- Downstream: a richer code-intel path would feed L13 (dev-architecture /
  dev-debugging) structural-search guidance, but MVP keeps those on `rg`.

## Scope (decision-complete for the unblocked part)
Unblocked / decided:
- Native `rg` first: filename/extension search, literal/regex grep, import and
  callsite text candidates, and post-change test/typecheck are handled by the
  codex-native shell path. No MCP needed for these.
- ast-grep ADOPTED (J-13): port `skills/ast-grep` + `scripts/ast_grep_helper.py`
  + install references. The external `sg`/`ast-grep` binary is ensured via lazy
  provisioning following the lazycodex/omo bootstrap convention (session-start-
  style `ensure`/`provision`), NOT PATH-only and NOT bundled-vendored.
- lsp/codegraph ISOLATED (J-16): never in the base manifest. They live in a
  separate "code-intel extension" install so MCP servers, detached daemons,
  language servers, external binaries, and workspace side-effects stay out of the
  core no-server contract.

Resolved part -- `130-defer` decision:
- The remaining question is closed: MVP code-intel is ast-grep only.
  lsp/codegraph remain documented-but-unshipped post-MVP extension candidates.

### Option A -- ast-grep only (selected)
- MVP code-intel = ast-grep skill + lazy `sg` provisioning. No lsp, no codegraph.
- Pros: low port risk (skill + Python helper, no MCP/daemon), clear value over
  `rg` (AST-shape search, deterministic codemods, YAML rule scan/apply), keeps
  the core no-server/config-untouched promise intact.
- Cons: no type-accurate diagnostics, no precise goto-def/find-refs, no safe
  workspace-edit rename, no pre-indexed structure graph for large repos.

### Option B -- full lsp/codegraph extension fork (deferred post-MVP)
- Add an isolated extension bundling `lsp-daemon` (socket daemon + stdio MCP
  proxy), the post-edit diagnostics hook, `skills/lsp` + `skills/lsp-setup`,
  language-server install docs, and a codegraph MCP with session-start init/sync.
- Pros: type-accurate diagnostics, real definition/reference, rename safety
  (workspace edit), and indexed structure queries for large repos.
- Cons: on-demand detached daemon, socket/proxy lifecycle, per-language server
  binaries, `lsp.rename` mutates files, codegraph needs an external binary +
  provisioning + workspace side-effects (`.gitignore`, prepare). High first-run
  failure surface; a bad install hurts first impressions. Pushed to P3/P4 in J5.

### Recommendation
Adopt Option A for MVP. Ship ast-grep with lazy provisioning now; document
lsp/codegraph as a deferred, separately-installed extension (P3 lsp, P4
codegraph) validated on a TypeScript + Python repo roundtrip before promotion.
This honors J-13 (ast-grep adopt) and J-16 (lsp/codegraph isolated) and closes the jun fork for MVP.

Must-NOT-Have:
- No lsp/codegraph in the base `plugins/codexclaw/.mcp.json`.
- No auto-start daemon or language-server install in the core install path.
- No ast-grep binary auto-download outside the lazy provisioning convention.

## IPABCD micro-cycle
- I: not interview-bearing; the decision fork is resolved.
- P: port ast-grep skill + helper + install refs; add lazy `sg` provisioning;
  write the no-server code-intel principle doc. Keep lsp/codegraph explicitly deferred.
- A: audit angle = "does anything code-intel violate the core no-server contract?"
  reviewer confirms only ast-grep lands and provisioning is lazy/opt-in-safe.
- B: implement ast-grep skill + provisioning; document the isolated extension and
  the resolved post-MVP defer rationale.
- C: run `ast_grep_helper.py` against a sample repo (preview + two-pass replace);
  `cxc doctor` reports `sg` presence/provisioning state.
- D: done-for-MVP = ast-grep works with lazy provisioning; lsp/codegraph
  remain documented-but-unshipped post-MVP candidates.

## Acceptance (1-3 testable criteria)
1. ast-grep skill runs a structural search + a previewed two-pass rewrite via
   `ast_grep_helper.py` on a sample repo.
2. `sg` binary is resolved/provisioned lazily; missing-binary path exits with an
   install hint rather than a hard crash.
3. Base `.mcp.json` contains no lsp/codegraph server (core no-server contract).

## QA channel (node:test path / CLI stdout / tmux / data dump)
- CLI stdout of `ast_grep_helper.py` preview JSON + apply.
- `cxc doctor` code-intel section showing `sg` state.
- node:test asserting base `.mcp.json` excludes lsp/codegraph.

## Commit unit (one atomic conventional commit)
`feat(code-intel): adopt ast-grep with lazy provisioning; isolate lsp/codegraph`

## Blocked-on (jun decision id, if any)
None. 130-defer resolved to Option A: adopt ast-grep only for MVP; lsp/codegraph are deferred to a separate post-MVP extension.

## Resolved (jun 2026-06-30)
- Decision: 130-defer is resolved to Option A; MVP adopts ast-grep only, and lsp/codegraph stay deferred post-MVP.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/130_code_intelligence.md (J5 full analysis)
- codex-rs/protocol/src/prompts/base_instructions/default.md:262 (rg-first)
- codex-rs/linux-sandbox/src/bwrap.rs:815 (rg --files fallback)
- devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:230
- devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/ensure-daemon.js:17
- devlog/.lazycodex/plugins/omo/components/codegraph/src/serve.ts:85
- plugins/codexclaw/.mcp.json:1 (base manifest, codexclaw MCP only)
