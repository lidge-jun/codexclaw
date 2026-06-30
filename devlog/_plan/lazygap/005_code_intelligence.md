# 005 — Code Intelligence (LSP / codegraph vs ast-grep)

Gap class: CONFIRMED NON-GOAL (mostly) · evidence: explorer Beauvoir

> This is the one layer where the "gap" is largely intentional. omo ships a stateful code
> intelligence harness; codexclaw deliberately chose a stateless one-shot tool.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 (제한적) |
| --- | --- | --- | --- |
| `omo/.mcp.json:9-32` + `lsp/.mcp.json:2-8` + `lsp/src/codex-hook.ts:67-109` (LSP MCP + lsp-daemon + post-edit diagnostic block) | `ast-grep/SKILL.md:15-18,54-80` (on-demand one-shot helper) | omo has live diagnostics; codexclaw runs ast-grep when asked | keep ast-grep; optionally have `cxc doctor` / the verification step suggest structural-search recipes |
| `codegraph/...session-start-worker.ts:43-126` + `hooks/session-start-checking-codegraph-bootstrap.json` (codegraph MCP + bootstrap/init/sync + PostToolUse guidance) | `ast-grep/SKILL.md` states "No MCP server, no daemon... LSP and codegraph are deliberately not shipped" | omo maintains a code graph; codexclaw does not | none — explicit non-goal |

## Verdict

The `ast-grep` skill already declares this a non-goal in its own body. That is consistent
with `structure/00_philosophy.md` §2 (no server, no daemon). The only in-philosophy
reinforcement is to make ast-grep recipes more discoverable (doctor hint, dev-routing
attachment), not to add a daemon or MCP search server.

Note: codexclaw does ship exactly one MCP (`plugins/codexclaw/.mcp.json:2-10`, the
codexclaw MCP for subagent config/GUI), so "no-server" means "no long-lived daemon /
code-intel server", not "zero MCP". Keep that distinction precise in docs.

## Enforcement tier

N/A — non-goal. Optional E4/E7 discoverability nudge for ast-grep only.
