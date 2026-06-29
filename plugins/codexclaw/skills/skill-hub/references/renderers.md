# Renderer Native-Gap Note

cli-jaw shipped structured renderers (`diagram-html`, `mermaid`, `chart-json`,
`search-results`, `dataframe`, `compose-block`) that rendered inside the jaw Web
UI. **codex-rs has no equivalent renderer pipeline**, so those fenced blocks do
not auto-render in a Codex session.

## What this means

- Do not promise inline rendering of `diagram-html`, `mermaid`, or `chart-json`
  in codexclaw — there is no native consumer for them.
- For visual explanation, prefer artifacts the environment can actually open:
  a real image file, an HTML file the user can open in a browser, or plain
  inline SVG where the host supports it.
- If a future codexclaw GUI adds a renderer, add it here and update the affected
  skills; until then, treat structured-renderer fences as a native gap.

## Migration stance

This is a deliberate non-port: the renderer skills are not vendored into
codexclaw because the runtime cannot consume them. Document the gap rather than
shipping dead capability.
