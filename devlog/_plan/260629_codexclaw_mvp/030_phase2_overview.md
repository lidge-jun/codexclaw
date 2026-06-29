# 030 — Phase 2 Overview: opencodex + GUI

Status: PLANNING  ·  Phase 2 of 3

## Layering note
Phases 2 and 3 are INCREMENTALLY shippable releases layered on Phase 1 (not standalone-from-scratch): P2 reuses Phase-1 subagent roles; P3 needs the installed plugin. Each adds value independently of the OTHER, on the Phase-1 base.

## Definition
Bring in opencodex (optional) and codexclaw's own GUI. Multi-model subagents become
configurable: pull the current subagent model list + the main model (n+1 models), and let the
user assign which model each role uses — via the GUI.

## Success criteria (testable)
- S6: With ocx installed, SessionStart `ocx ensure` runs; with ocx absent, graceful skip (no error).
- S7: GUI lists available models = ocx-provided catalog + the default/main model (n+1).
- S8: Assigning a model to a role (explorer/reviewer/executor) persists and the spawned subagent
  honors it.
- S9: GUI shows a link bar to `http://localhost:10100` only when ocx is detected.
- S10: Per-role prompt override editable in GUI and applied on spawn.

## Step map (030–039)
- 031 provider bridge (ocx ensure / graceful skip)   [was 020]
- 032 subagent config store (.codexclaw/subagents.json)
- 033 model catalog source (ocx catalog + main model = n+1)
- 034 GUI scaffold (Vite + React, mirror opencodex stack)
- 035 GUI subagent page (role → model + prompt) + 10100 link bar
- 036 phase 2 integration + verification

## Open decisions (ask jun)
- Q-P2-1: codexclaw GUI is its own app (confirmed earlier) — reuse opencodex GUI components or
  build fresh against the subagent-config component?
- Q-P2-2: When ocx absent, is multi-model simply disabled (default only), or do we surface any
  non-ocx model source?
