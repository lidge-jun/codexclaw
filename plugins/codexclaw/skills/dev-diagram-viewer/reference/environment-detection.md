# Detect capabilities, not product names

The current host's instructions and callable tool/skill catalog are authoritative.
Environment variables such as CODEX_INTERNAL_ORIGINATOR_OVERRIDE, TERM and bundle
IDs are hints only; they do not prove that Mermaid, inline HTML or a browser is available.

| Observation | Consequence |
|---|---|
| Current host explicitly documents native Mermaid | Use its supported syntax; do not assume every Mermaid release/type is available |
| visualize skill is listed | Read it and follow the actual inline output contract |
| A browser tool or documented local CLI is available | Read its API and verify access/ownership before driving it |
| Only terminal/text delivery exists | Offer text/static output or an authorized standalone file |
| A local web server answers | Proves only that server exists, not which app the user is viewing |

Do not probe an unrelated service port to infer the current conversation's renderer.
Never infer a signed-in session from tool installation or an OS label.

Standalone opening is platform-specific and optional:
macOS `open`, Linux `xdg-open`, Windows `Start-Process`, or a host file/browser panel
when exposed. A headless host may have none. Report the file and verification limits
instead of claiming it was displayed. Do not execute an OS command from an untrusted
artifact path without argument-safe handling.

For interactive work, use `../../dev/references/browser-routing.md`.
No Aside, agbrowse, Bash, or native browser plugin is required on every platform.
