---
name: cxc-dev-diagram-viewer
description: "MUST USE when producing or displaying diagrams, charts, visualizations, SVG, mermaid, or interactive widgets in any Codex surface. Detects the runtime environment (Codex Desktop app vs CLI) and routes diagram output to the correct rendering path — native inline for supported formats, browser-based rendering for everything else. On-demand: activates by description match or explicit mention. Triggers: diagram, chart, SVG, mermaid, visualization, visualize, flowchart, sequence diagram, ER diagram, architecture diagram, Chart.js, ECharts, D3, Leaflet, map, interactive, widget, 다이어그램, 차트, 시각화, 그려줘, 플로우차트."
metadata:
  last-verified: "2026-07-11"
  short-description: "Environment-aware diagram rendering: native pass-through or browser-based display."
  keywords: [diagram, chart, SVG, mermaid, visualization, browser, rendering, interactive, widget]
---

# Diagram delivery — detect the actual rendering contract

Use `dev` for class, scope, safety and verification. This router selects delivery;
it does not duplicate the host's visualization contract or assume a native renderer.

## Choose the smallest useful surface

- Plain prose or a small table is enough when a visual adds no clarity.
- When the current host explicitly supports native Mermaid, use a supported type.
  Do not infer renderer support from the app name or an environment variable alone.
- When the host exposes the `visualize` skill for inline charts, comparisons or
  interactive explainers, read its CURRENT SKILL.md fully and follow its file location,
  fragment, size, resource, output-reference and interaction requirements.
  Do not emit a historical directive from memory.
- If no inline contract is exposed, use a standalone HTML/SVG artifact with an available
  browser, or a static/text alternative appropriate to the host. Never claim a file
  opened successfully without observing it.

Reference routing: [environment detection](reference/environment-detection.md),
[current visualization contract](reference/visualize-contract.md),
[standalone templates](reference/html-templates.md).
Browser selection follows [portable browser routing](../dev/references/browser-routing.md):
suitable available Aside is preferred, agbrowse supports parallel and local UI work,
and available native browsers remain valid alternatives. None is required on every host.

## Standalone artifacts

Write to an authorized, durable task-owned directory when delivering a file. OS temp
space is only for disposable previews and must not be assumed conversation-readable.
Use an absolute artifact path. Do not hardcode a user home, account ID or /tmp path
into a distributed workflow.

The optional `scripts/diagram-to-html.sh` wraps trusted locally authored content on
hosts with Bash and its prerequisites. It is a standalone HTML helper, NOT an inline
fragment generator, sanitizer or Windows installation prerequisite. Supply an explicit
authorized output path. On other hosts, generate the needed HTML with existing tools.

The templates use CDN dependencies and therefore need network access; "standalone"
does not mean offline or self-contained dependencies. Pin executable assets according
to the task's trust policy. Do not copy arbitrary retrieved HTML/JS into executable
output. For restricted/offline environments prefer a static asset or vetted local
dependencies already available; do not install new ones without authorization.

Only use platform open commands or host file/browser panels when available.
Some in-app browsers need task-scoped HTTP serving instead of file URLs: check the
current binding. If serving, use loopback and a scoped directory, record the process,
and stop only the server this task owns.

## Layout and verification

**DIAGRAM-LAYOUT-01:** put text-bearing HTML nodes in normal responsive flow using
Grid/Flexbox. SVG/canvas may draw marks or connectors; derive connector positions from
rendered bounds rather than hand-positioning labels. Use intrinsic sizing/wrapping
and inspect long labels at narrow and wide sizes appropriate to the surface.

**DIAGRAM-RENDER-VERIFY-01:** run/render the artifact, inspect the actual output, and
correct blank content, clipped labels, overlap and runtime errors. For interactive
artifacts, exercise at least the primary state change; initial render alone is not
interaction verification. Save meaningful evidence and repeat after relevant changes.

**DIAGRAM-SYNTAX-01:** run an existing supported parser/checker when available.
Do not invent a Mermaid CLI parse command or install a runner just for ad-hoc proof.
Static validity does not replace rendering.

**DIAGRAM-A11Y-01:** provide accessible labels/text alternatives, keyboard controls,
non-color meaning, sufficient contrast, and reduced-motion support as applicable.

## Classification and compatibility

Classify by behavior and risk, not file count or format. A text-only fence may be C0;
a bounded local artifact may be C1. External executable dependencies, untrusted input,
permission changes or security effects can require higher care under `dev` §0.0.
A CDN script is not automatically low-risk because it lives in one HTML file.

A host contract copied at one date does not establish current compatibility.
`upstream/visualize-upstream.md` records inspection provenance; the current host skill
wins over that snapshot. The optional Unix `upstream/sync-check.sh` is a drift reminder,
not proof that output works, and its absence/failure does not justify a false PASS.
