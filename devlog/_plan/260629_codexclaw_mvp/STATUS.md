# codexclaw MVP — Status

Numbering follows cli-jaw devlog convention: `0X0_` per phase; PABCD steps as suffixes
(`plan/audit/build/check/verification/done`); fine increments (`001`,`011`...) allowed.

| Phase | File | Title | Status |
|-------|------|-------|--------|
| 000 | 000_research.md | Research & context anchor | REFERENCE |
| 005 | 005_overview.md | Overview | REFERENCE |
| 010 | 010_repo_skeleton.md | Repo & plugin skeleton | DONE (2026-06-29) |
| 020 | 020_provider_bridge.md | Provider bridge (ocx) | TODO |
| 030 | 030_pabcd_state.md | PABCD state machine | TODO |
| 040 | 040_subagent_config.md | Subagent config | TODO |
| 050 | 050_gui.md | GUI | TODO |
| 060 | 060_dev_skills_migration.md | dev-* skills migration | TODO |
| 070 | 070_packaging.md | Packaging & marketplace | TODO |

## Notes
- 2026-06-29: Scaffold complete + plan renumbered to cli-jaw `0X0` convention.
- 000_research.md is the durable anchor — read it first after any context loss.
- Plugin validates except the bundled validator's stale `hooks` false-positive
  (omo, a shipping marketplace plugin, hits the same one — Codex ingestion accepts `hooks`).
- Reference: `devlog/.lazycodex` (gitignored, not part of source).
