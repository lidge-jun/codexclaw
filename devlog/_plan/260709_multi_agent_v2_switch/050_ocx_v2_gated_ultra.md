# 050 — opencodex v2-gated ultra + toggle surface (wp5)

## Decision (user-confirmed, 260709)

| model class | v2 on | v2 off |
|---|---|---|
| max-native (anthropic/*, gpt-5.6 family) | max + ultra | max only (ultra stripped, incl. native ultra on 5.6-sol/terra) |
| mock-max (gpt-5.5 / 5.4 / 5.4-mini / 5.3-codex-spark, routed models) | ultra only | neither (ladder ends at xhigh/high) |

Mock max is NEVER visible in the picker regardless of v2 (current shipped ocx
behavior already never invents a visible max: `applyReasoningLevels` appends max
only when the provider advertises it; `ensureUltraReasoningLevel` deliberately
appends ultra alone — wire clamps ultra->max->highest native). This phase adds
the v2 gate; it does not add any max emission.

## Repo: /Users/jun/Developer/new/700_projects/opencodex

### NEW src/codex/features.ts

- `isMultiAgentV2Enabled(codexHome?: string): boolean` — resolve home via the
  existing helper in `src/codex/paths.ts` (respect `CODEX_HOME`), read
  `config.toml` as text, detect BOTH forms:
  `[features.multi_agent_v2]` table with `enabled = true`, and
  `[features]`-section boolean `multi_agent_v2 = true`. Missing file/key ->
  false (upstream default_enabled=false). Pure read; NEVER writes.
- `hasAgentsMaxThreads(codexHome?)` — regex for a `[agents]` table with
  `max_threads =` (used by the toggle warning; v2 on + agents.max_threads is a
  codex-rs boot validation error).

### MODIFY src/codex/catalog.ts

Compute `const v2 = isMultiAgentV2Enabled()` once per catalog build and thread
it to the three ultra points:

1. `applyReasoningLevels` (routed): when `!v2`, filter `"ultra"` out of the
   effort list (including provider-supplied overrides) and skip the append.
2. `ensureUltraReasoningLevel` (older natives): no-op when `!v2`.
3. `ensureGpt56ReasoningLevels` (5.6 fallback): keep the `max` append; skip
   `ultra` when `!v2`.
4. NEW `stripUltraWhenV2Off(entry, v2)` applied at the shared emission point
   (`finishUpstreamNativeEntry` + the routed/derived exit of `deriveEntry`):
   removes any `ultra` level that arrived from upstream snapshots (5.6-sol) and
   repairs `default_reasoning_level` if it pointed at ultra.

No other ladder change; native max stays exactly as upstream advertises.
Catalog build stays read-only w.r.t. config.

### NEW src/cli/v2.ts + MODIFY src/cli/index.ts dispatch

`ocx v2 status|on|off`:

- status: print enabled state + resulting picker policy line.
- on/off: shell out to `codex features enable|disable multi_agent_v2`
  (format-preserving TOML edit stays upstream-owned); on: warn when
  `hasAgentsMaxThreads()` (name the boot error + the fix); then
  `invalidateCodexModelsCache()` (existing export, catalog.ts:1338) and print
  "new sessions only; restart the Codex app / wait for cache refresh".
- NEVER auto-flips from any other code path.

### MODIFY src/server/management-api.ts

- `GET /api/v2` -> `{ enabled, agentsMaxThreadsConflict }`.
- `PUT /api/v2` body `{ enabled: boolean }` -> same routine as the CLI
  (features CLI + cache invalidation), responds with warnings array. Follows
  the existing `/api/disabled-models` pattern (which already documents the
  models-cache invalidation contract at management-api.ts:365-367).

### Tests (tests/)

- features parser: table form, boolean form, absent file -> false; CODEX_HOME
  override respected (temp dir fixtures).
- catalog gate: with temp CODEX_HOME v2 OFF -> routed model + gpt-5.5 have no
  ultra; gpt-5.6-sol ladder has max but no ultra; luna unchanged. v2 ON ->
  current behavior preserved (ultra present; sol keeps native ultra).
  Activation scenario per C-ACTIVATION-GROUNDING-01: the OFF fixture is the
  trigger; assertion on the emitted `supported_reasoning_levels` is the
  observed effect.
- endpoint: PUT /api/v2 flips + returns warning when agents.max_threads fixture
  present (runner-level, mock exec for `codex features`).

## Risks

- Codex desktop picker caches models beyond models_cache.json: toggle output
  must set expectation (restart note) — UI lag is not a gate failure.
- `codex features disable` on an under-development flag: verify exit code in B;
  if unsupported, fall back to `codex features enable`-symmetric config edit via
  the CLI's documented surface and record the deviation.
