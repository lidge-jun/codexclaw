# Environment Detection — Detailed Guide

## Decision Tree

```
1. Check CODEX_INTERNAL_ORIGINATOR_OVERRIDE env var
   |
   +-- "Codex Desktop" --> CODEX_DESKTOP environment
   |
   +-- absent / other value
       |
       2. Check system prompt for <app-context> block
       |
       +-- present --> CODEX_DESKTOP environment
       |
       +-- absent
           |
           3. Check __CFBundleIdentifier env var
           |
           +-- "com.openai.codex" --> CODEX_DESKTOP environment
           |
           +-- absent / other --> CLI environment
```

## Shell One-Liner

Detect the environment in a single command:

```bash
if [ "$CODEX_INTERNAL_ORIGINATOR_OVERRIDE" = "Codex Desktop" ]; then
  echo "CODEX_DESKTOP"
elif [ "$__CFBundleIdentifier" = "com.openai.codex" ]; then
  echo "CODEX_DESKTOP"
else
  echo "CLI"
fi
```

## Environment Profiles

### Codex Desktop App

Confirmed signals observed in production (2026-07-11):

| Variable | Value |
|---|---|
| `CODEX_INTERNAL_ORIGINATOR_OVERRIDE` | `Codex Desktop` |
| `__CFBundleIdentifier` | `com.openai.codex` |
| `TERM` | `dumb` |
| `NO_COLOR` | `1` |
| `COLORTERM` | (empty) |
| `PATH` | includes `Applications/ChatGPT.app/Contents/Resources` |
| `CODEX_THREAD_ID` | UUID present |
| `CODEX_PERMISSION_PROFILE` | `:danger-full-access` or similar |

System prompt features:
- `<app-context>` block with `# Codex desktop context`
- Mermaid diagram support mentioned
- `::code-comment`, `::git-*` directives documented
- `![alt](url)` image rendering confirmed
- Browser plugin (`browser:control-in-app-browser`) available in skills list

### CLI Environment (Codex CLI, jaw, terminal)

| Variable | Value |
|---|---|
| `CODEX_INTERNAL_ORIGINATOR_OVERRIDE` | absent or non-`Codex Desktop` |
| `__CFBundleIdentifier` | absent |
| `TERM` | `xterm-256color`, `screen-256color`, etc. |
| `NO_COLOR` | usually absent |
| `COLORTERM` | `truecolor` or similar |

System prompt features:
- No `<app-context>` block
- No `::code-comment` or `::git-*` directives
- No Browser plugin reference

## Rendering Capability Matrix

| Capability | Desktop App | CLI + jaw Web UI | CLI + terminal |
|---|---|---|---|
| Markdown text | yes | yes | yes |
| Markdown images `![](path)` | yes (absolute paths) | depends | no |
| Mermaid code blocks | yes (rendered) | yes (rendered) | code only |
| Inline SVG | no (shows raw) | yes (rendered) | no |
| HTML widgets | no | yes (iframe) | no |
| Chart.js/ECharts | no | yes (iframe) | no |
| Leaflet maps | no | yes (iframe) | no |
| Interactive controls | no | yes (iframe) | no |
| `open` command | opens default browser | opens default browser | opens default browser |
| In-app browser | yes (Browser plugin) | no | no |

## jaw Web UI Detection

To detect whether jaw Web UI is the active rendering surface:

```bash
# Check if jaw server is running on default port
curl -sf http://localhost:3457/api/health 2>/dev/null && echo "JAW_ACTIVE" || echo "JAW_INACTIVE"
```

When jaw Web UI is active, all diagram types are natively rendered through its
frontend — no browser fallback needed. The agent should use the cli-jaw `diagram`
skill directly in that case.

## Platform-Specific Browser Open Commands

| Platform | Command | Notes |
|---|---|---|
| macOS | `open <file.html>` | Opens in default browser |
| Linux | `xdg-open <file.html>` | Requires `xdg-utils` |
| WSL | `wslview <file.html>` or `explorer.exe <file.html>` | Opens in Windows browser |

For Codex Desktop, use `open` as the primary path. The in-app browser is an
optional enhancement for HTTP-served previews and screenshot capture.
