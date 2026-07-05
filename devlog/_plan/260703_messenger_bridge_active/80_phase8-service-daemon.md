# messenger_bridge — cxc service daemon

Status: PENDING (scaffolded 2026-07-03; P for this phase fills diff-level detail)
Parent: 00_plan.md slice map

## Scope / exit criteria

launchd install/uninstall/status; log files; auto-restart; user docs

## D record (2026-07-03) — SHIPPED

- Built `service.ts`: pure `buildPlist()` (launchd XML, RunAtLoad + KeepAlive,
  ProgramArguments = node + bin/codexclaw.mjs serve --port --cwd, StandardOut/
  ErrPath → ~/.codexclaw/serve.{out,err}.log) + `servicePaths()`, and
  install/uninstall/status that shell out to launchctl. Non-darwin returns an
  explicit "unsupported" rather than pretending. `cxc service <install|
  uninstall|status>` wired through the messenger-bridge CLI + bin delegator.
- Tests: service (4) — plist content, XML-escaping of special-char paths, path
  derivation, safe no-op uninstall/status when not installed. Full bridge suite
  63/63; gate OK.
- Live: `cxc service status` → "not installed" (correct). NOT installed on the
  user's machine — install is a system-state change the user triggers with
  `cxc service install`. uninstall/status are safe no-ops when absent.
- macOS-only for now (launchd); Linux systemd --user is a possible follow-up.
