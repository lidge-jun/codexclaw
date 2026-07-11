# 010 — Runtime flip + config-guard declaration

## Scope

IN: `~/.codex/config.toml`, `plugins/codexclaw/components/config-guard/src/features.ts`,
`config-guard/test/features.test.ts`, `config-guard/test/activate.test.ts`.
OUT: any other config key; backup config files.

## Diffs

### MODIFY ~/.codex/config.toml

Before (current, around lines 317-324):

```toml
[agents]
max_threads = 1000

# multi_agent_v2 remains off due to upstream HTTP 400 with encrypted tool schema
# (openai/codex#26753). Keep stable multi_agent (v1) instead.
[features.multi_agent_v2]
enabled = false
max_concurrent_threads_per_session = 1000
```

After:

```toml
# dev2 full switch (260709): multi_agent_v2 ON. agents.max_threads removed because
# validate_multi_agent_v2_config rejects it when v2 is enabled; concurrency now
# lives in features.multi_agent_v2.max_concurrent_threads_per_session.
# Known risk accepted: upstream encrypted-schema HTTP 400 (openai/codex#26753).
[features.multi_agent_v2]
enabled = true
max_concurrent_threads_per_session = 1000
```

Note: the `[agents]` table disappears entirely (max_threads was its only key).
Activation scenario (C-ACTIVATION-GROUNDING-01): boot a fresh `codex exec` after the
edit; success proves the validation branch is not tripped; `codex features list`
shows `multi_agent_v2 ... true`.

### MODIFY config-guard/src/features.ts

```ts
export const DECLARED_FEATURES = [
  "multi_agent",
  "multi_agent_v2",
  "goals",
  "hooks",
  "default_mode_request_user_input",
] as const;

export const SOFT_FEATURES: ReadonlySet<string> = new Set([
  "default_mode_request_user_input",
  "multi_agent_v2",
]);
```

`multi_agent_v2` is SOFT because it is stage under-development: a future codex build
may refuse/remove it and activation must degrade (V1 fallback is automatic via the
version-resolution ladder) instead of hard-failing install. `multi_agent` stays
declared: it is the V1 fallback when a model/catalog pins V1.

### MODIFY config-guard/src/activate.ts (AUDIT FOLD-BACK, blocker 3)

`codex features enable multi_agent_v2` rewrites the flag as a SCALAR
(`multi_agent_v2 = true`), replacing an existing `[features.multi_agent_v2]` TABLE
and silently dropping `max_concurrent_threads_per_session` (codex-rs
config/edit.rs:884, :573). Two-layer defense:

1. On THIS machine the clobber path never fires: WP1 edits the table to
   `enabled = true` manually BEFORE any activation, so `featuresToEnable` never
   lists `multi_agent_v2` as pending.
2. General case: `activate()` gains table preservation — before running enable for
   `multi_agent_v2`, read `configPath`; if a `[features.multi_agent_v2]` table with
   extra keys exists, snapshot those keys; after a successful enable, if the config
   now carries the scalar form, rewrite it back to a table with `enabled = true`
   plus the preserved keys (activate.ts already read/writes configPath for
   backup/hash). NEW test in activate.test.ts models the clobber with a fake
   runner that performs the scalar rewrite on a temp config and asserts the
   preserved `max_concurrent_threads_per_session` survives.

Activation scenario: the new test IS the trigger (fake runner emulates edit.rs
clobber); on the live machine, `rg max_concurrent ~/.codex/config.toml` after WP1
proves the key survived.

### MODIFY config-guard tests

- features.test.ts: fixture flips `multi_agent_v2 ... true`; "exactly the 4 flags,
  no multi_agent_v2" becomes "exactly the 5 flags, incl. multi_agent_v2"; the
  sibling-clobber regression re-targets `plugin_hooks` only (multi_agent_v2 is now
  declared, so it IS recorded); readDeclaredState sizes 4 -> 5.
- activate.test.ts: the `["multi_agent_v2", "under-development", false]` sibling row
  now counts as a pending declared flag; assert it gets `features enable` and that a
  failed enable is soft (no throw, `enableFailed: true`).

## Rollback

Restore `enabled = false` + `[agents] max_threads = 1000`; revert features.ts. One
commit per phase keeps this a single `git revert`.
