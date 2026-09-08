# Raw notes from an agent session (as-produced; this is the INPUT for the trial)

- probe 1: ssh macmini-cf 'node -v' -> v22.22.0 (exit 0)
- probe 2: ssh suji 'codex --version' -> 0.147.0
- ran: node --test plugins/codexclaw/test/skill-catalog.test.mjs -> 4 pass 0 fail
- ran: quick_validate.py on search skill -> "Skill is valid!" exit 0
- probe 3: curl http://127.0.0.1:10100/v1/models -> 28 models, includes anthropic/claude-opus-5
- observed: PR #84 CONFLICTING against dev; trial merge shows only CHANGELOG.md conflicts
- ran: node --test pabcd-state + subagent-config + plugin tests on merged tree -> pass 1857 fail 0 in 61.5s
- probe 4: gh release list -> v0.2.23 Latest 2026-09-08T01:40:36Z
- probe 5: ssh desktop-c795oh4 ls cache -> 0.2.21+codex.20260906214421, 0.2.22+codex.20260906224615
- note: lidge/intmb/cursor have codex but no codexclaw manifests
- note: oracle/ocx-ci/win ssh timeouts in last probe (2026-09-08 morning)
- decision taken: integrate PR #84 via push to contributor branch (maintainerCanModify true), then release 0.2.24, deploy to macmini-cf/suji/desktop-c795oh4
- risk: release.yml dispatch defaults prerelease=true; use tag push instead
- risk: stale empty Unreleased heading in CHANGELOG line 57
