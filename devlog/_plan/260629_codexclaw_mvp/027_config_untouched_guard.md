# 027 — Config-Untouched Guard

Status: TODO  ·  Phase 1

## Goal
Guarantee codexclaw (phase 1, ocx-free) never mutates `~/.codex/config.toml`.

## Why
opencodex is the component that injects providers into config.toml. In phase 1 codexclaw
runs without ocx, so config must stay byte-identical.

## Guard
- Test: snapshot `config.toml` hash → install codexclaw + run a session → assert hash unchanged.
- codexclaw writes only to: its plugin dir (`~/.codex/plugins/...`) and the working tree
  `.codexclaw/` state dir.

## Boundary note
- Phase 2 (ocx) MAY touch config via `ocx ensure` — but that is opencodex's action, user-opted,
  not codexclaw silently editing config.

## Verify
- Hash-equality test passes across install + session.
