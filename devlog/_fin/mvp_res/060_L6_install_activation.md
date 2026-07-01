# L6 (Decade 060) -- Install Activation

Status: DONE
Cluster: 1 - Phase: 1 - Shorthand: cxc
Source-of-record: 027_config_untouched_guard.md; 028_phase1_integration.md; 028.1_install_activation.md; 028.2_pass6_P_plan.md; STATUS.md

## Goal (one slice)
Ship controlled activation for Codex feature flags: enable only declared codexclaw flags through the
official `codex features` CLI, record a manifest, and safely revert only flags codexclaw changed.

## Why now / dependencies
L6 depends on the Phase 1 hooks and skills knowing which Codex features they need. It unblocks L7 S1/S4
because build/install verification must prove both feature activation and config safety.

## Scope (decision-complete)
- Files added/edited:
  - `plugins/codexclaw/components/config-guard/src/features.ts`
  - `plugins/codexclaw/components/config-guard/src/activate.ts`
  - `plugins/codexclaw/components/config-guard/src/deactivate.ts`
  - `plugins/codexclaw/components/config-guard/src/cli.ts`
  - `plugins/codexclaw/components/config-guard/test/features.test.ts`
  - `plugins/codexclaw/components/config-guard/test/activate.test.ts`
  - `bin/codexclaw.mjs`
- Declared flags:
  - `multi_agent`
  - `goals`
  - `hooks`
  - `default_mode_request_user_input`
- Soft flag:
  - `default_mode_request_user_input` may soft-fail without failing activation.
- CLI form:
  - `cxc enable`
  - `cxc status`
  - `cxc uninstall`
  - full alias `codexclaw` is available through `bin/codexclaw.mjs`.
- Activation behavior:
  - read state using `codex features list`.
  - back up `config.toml`.
  - enable only declared flags not already true.
  - write `.codexclaw-install.json` with prior/enabled/failed state and hash.
- Deactivation behavior:
  - read install manifest.
  - skip safely when manifest is missing.
  - skip safely when config drift hash does not match.
  - disable only flags enabled by codexclaw, preserving pre-existing true flags.
- Must-NOT-Have:
  - No hand-rolled TOML editing.
  - No provider/model config writes.
  - No mutation of real `~/.codex` in tests.
  - No substring parsing of feature names.

## IPABCD micro-cycle
- I (if interview-bearing): not interview-bearing.
- P: revised the earlier "config untouched" rule into controlled, user-aware feature activation via
  official Codex commands.
- A: audit forced the pivot to official CLI wrapping, drift guard, injected runner/codexHome, and
  real-path safety.
- B: implemented feature parsing, activation, deactivation, CLI wrapper, install manifest, backup,
  hash guard, and root `bin/codexclaw.mjs` delegation.
- C: config-guard reached 15/15 after fixing exact first-field parsing for sibling rows like
  `multi_agent_v2` and `plugin_hooks`; final Phase 1 root `npm test` reached 73/73.
- D: done = `cxc enable/status/uninstall` delegate to compiled config-guard and tests prove offline
  backup/revert/drift behavior.

## Acceptance (1-3 testable criteria)
- `cxc enable` enables only missing declared flags and records what codexclaw changed.
- `cxc uninstall` reverts only flags codexclaw enabled and refuses unsafe drift.
- Feature parsing matches exact first-column names, not substrings.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `node --test` for config-guard: 15/15 pass.
- Final Phase 1 regression: root `npm test` 73/73.
- CLI stdout surfaces enabled, disabled, status, missing-manifest, and drift-safe no-op cases.

## Commit unit (one atomic conventional commit)
One activation commit: add config-guard component, tests, root CLI delegation, and declared feature policy.

## Blocked-on (jun decision id, if any)
None for Phase 1. Provider/ocx activation remains Phase 2.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- `devlog/_plan/260629_codexclaw_mvp/027_config_untouched_guard.md`
- `devlog/_plan/260629_codexclaw_mvp/028_phase1_integration.md`
- `devlog/_plan/260629_codexclaw_mvp/028.1_install_activation.md`
- `devlog/_plan/260629_codexclaw_mvp/028.2_pass6_P_plan.md`
- `plugins/codexclaw/components/config-guard/src/features.ts`
- `plugins/codexclaw/components/config-guard/src/activate.ts`
- `plugins/codexclaw/components/config-guard/src/deactivate.ts`
- `bin/codexclaw.mjs`
- codex-rs CLI `features list/enable/disable` behavior.
