# 060 — Issue #243: first-cell subagent dispatch card

Issue #243 reports that a V1 host spends three Code Mode cells rediscovering the `spawn_agent` helper and a routed model ID before dispatch. This phase adds a compact SessionStart card so a proven V1 host can call its known helper immediately and an unproven host can resolve and call the unique helper in one cell. It also makes `subagents_get` return derived spawn arguments and an evidence-qualified model-presence result. The binding choices are in `061_dispatch_card_consultation.md` (E1–E6); source evidence is in `.codexclaw/evidence/01a0d143-ac30-70c0-b494-27e596c0c7a7/{exp243,arch243}.md` and issue #243. This document plans implementation; it does not implement it.

## Loop spec and boundary

| Field | This phase |
|---|---|
| Archetype | Satisfy-spec, one dependency-ordered implementation phase after the docs-only roadmap. |
| Trigger | Open issue #243, 2026-09-24, and consultation E1–E6. |
| Goal | A fresh V1 session has an exact first-cell spawn call and dated family aliases; an unresolved host has one cell that resolves and calls; MCP roles expose usable args and honest model presence. |
| Non-goals | No new hook, provider API, settings-store schema, persistent alias cache, V2 exact helper claim, deployment, issue closure, or branch operation. This delegated writer only creates this file. |
| Verifier | Focused Node tests for hook/catalog/MCP behavior; `node --check` on the unresolved JS cell; source/contract review and real V1 Code Mode smoke by main. Activation matrix below says what each check can observe. |
| Stop condition | Builder has landed only the mapped files, focused tests and build pass, host V1 smoke returns a child handle, and main has reviewed the diff. This docs-writer slice stops when this file and its verification receipts are returned. |
| Memory artifact | This `060_dispatch_card.md`; consultation `061_dispatch_card_consultation.md`; evidence paths above. |
| Terminal outcomes | PASS: all acceptance evidence exists. PARTIAL: source tests pass but host smoke unavailable or V2 remains unresolved. BLOCKED: a required API or timing assumption fails; main replans. These are report outcomes, not FSM states. |
| Escalation | Main decides any new host signal, fallback-protocol rewrite, widened write scope, or inability to keep the card inside its budget. A child cannot reclaim or re-dispatch work; managed `main-direct` is the only reclaim signal under DISPATCH-RETIRE-01. |

Class C3: SessionStart content, a cross-surface MCP response, and agent-facing docs change together. The existing `devlog/_plan/260924_issue_sweep_0238/` convention is reused. Main owns P/A/B/C/D and any source-of-truth sync; this leaf makes no phase transition. Dependency order: (1) dated alias/card renderer, (2) hook integration, (3) MCP decoration, (4) docs and focused proof.

## Reverified anchors and decisions

- `plugins/codexclaw/components/subagent-config/src/fallback-dispatch-cli.ts:8-15,28-38`: the fallback protocol is 2,379 characters today; `sessionFallbackNotice` returns nothing without a fallback; the CLI suppresses `agent_id` children and fails open on SessionStart errors. `plugins/codexclaw/hooks/session-start-announcing-subagent-fallback.json:3-8` calls that CLI with a 10-second timeout. Preserve the protocol verbatim and the hook envelope.
- `plugins/codexclaw/components/subagent-config/src/capabilities.ts:80-100`: `CODEXCLAW_SPAWN_V1=1` is the only SessionStart-available positive V1 signal. `detectSpawnSurface` returns V2 when no tool list exists; **that default is not V2 evidence**. `capabilities.ts:60-77` records the V1 Code Mode spelling, not an exact V2 spelling.
- `plugins/codexclaw/components/subagent-config/src/catalog.ts:58-105`: `nativeCatalogPath` and `readNativeCatalog` select the configured local Codex catalog and omit disabled/hidden entries. `live-catalog.ts:27-35,82-119` runs `ocx models live --json` for up to 12 seconds, caches last success for 30 seconds, and labels failure-backed cache `stale`. Never call it from the 10-second SessionStart hook. Use it with `forceRefresh:true` only at the MCP boundary.
- `plugins/codexclaw/components/subagent-config/src/mcp.ts:70-95`: `subagents_get` serializes `getSettings` in `content[0].text`; `catalog_list` alone currently calls `readCatalog`. `settings-api.ts:4-6` and `store.ts:116-121,175-203` show why adding response-only fields to shared `getSettings` would widen GUI/messenger contracts. `store.ts:36-55,67-69,268-287` supplies mode/model/effort and writes only those settings.
- `plugins/codexclaw/skills/pabcd/references/delegation.md:117-180` owns family detection and V1/V2 argument differences. `plugins/codexclaw/skills/dev/references/native-execution.md:18-25` owns general live-schema discovery. The card is a fast path for this known helper; live schema remains authoritative on mismatch.
- `plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts:11-22,76-81`, `test/catalog.test.ts:90-109`, `test/live-catalog.test.ts:34-75`, and `test/mcp.test.ts:70-89,137-151` are the existing test seams. The compiled MCP server is required by some tests; do not accept a zero-test or skipped-server result as proof.

## File change map and builder write scope

Only these paths are in the builder's source write scope; all are under `plugins/codexclaw/`:

| Status | Path | Exact change |
|---|---|---|
| NEW | `components/subagent-config/src/dispatch-card.ts` | Dated alias map, local-catalog check, full-ID passthrough, V1 and unresolved card renderer. No OCX call. |
| MODIFY | `components/subagent-config/src/fallback-dispatch-cli.ts` | Import renderer; keep exported `sessionFallbackNotice` and CLI/child/fail-open logic; always emit one SessionStart envelope, fallback text first; cap card at 1,200 and total context at 4,096 characters. |
| MODIFY | `components/subagent-config/src/mcp.ts` | Add response-only `spawnArgs`/`staleModel` decoration for `subagents_get`, force a catalog refresh for authoritative OCX evidence, retain `content[0].text` envelope and all existing fields. |
| MODIFY | `components/subagent-config/test/fallback-dispatch-cli.test.ts` | V1/unresolved/no-fallback/child/repeat/budget/fail-open cases. |
| NEW | `components/subagent-config/test/dispatch-card.test.ts` | Alias resolution, catalog missing/hidden, full-ID passthrough, card snapshots and ≤1,200 characters. |
| MODIFY | `components/subagent-config/test/mcp.test.ts` | Four-role `spawnArgs`, stale true/false/null, cache-age and failed-OCX cases, unchanged envelope. |
| MODIFY | `skills/pabcd/references/delegation.md` | Add Code Mode note under V1 table and unresolved-card note; preserve DELEGATE-MODEL-LIST-01. |
| MODIFY | `skills/dev/references/native-execution.md` | Add narrow dispatch-card pointer after general discovery advice. |

`capabilities.ts`, `catalog.ts`, `live-catalog.ts`, `store.ts`, `settings-api.ts`, the hook JSON, provider bridge, GUI, and generated `dist/` are read-only inputs for this phase. `fallback-dispatch-cli.ts` already serves the hook, so no second hook or JSON edit is needed. If the package build requires a source manifest update, main must expand scope explicitly in P before B.

## NEW `dispatch-card.ts`: complete intended content

Place this file in `components/subagent-config/src/`. These aliases are suggestions for family names only; a user-supplied model ID is passed unchanged. “Verified” means listed in the local Codex catalog at render time, **not** successful spawn or live OCX availability. The map date is the provenance of defaults, not a freshness claim.

```ts
import { readNativeCatalog } from "./catalog.ts";

export const ALIAS_MAP_DATE = "2026-09-24";
export const MODEL_ALIASES = {
  deepseek: "command-code/deepseek-deepseek-v4.1-flash",
  swe2: "devin/swe-2",
  kimi: "kimi/kimi-for-coding-highspeed",
  sol: "gpt-6-sol",
  luna: "gpt-6-luna",
} as const;
export type ModelAlias = keyof typeof MODEL_ALIASES;
export interface ResolvedAlias { id: string; verified: boolean; mapDate: string }

export function resolveDispatchAlias(nameOrId: string, env: NodeJS.ProcessEnv = process.env): ResolvedAlias {
  if (!Object.prototype.hasOwnProperty.call(MODEL_ALIASES, nameOrId)) {
    return { id: nameOrId, verified: false, mapDate: ALIAS_MAP_DATE };
  }
  const id = MODEL_ALIASES[nameOrId as ModelAlias];
  const entries = readNativeCatalog(env);
  return { id, verified: entries?.some(entry => entry.id === id) ?? false, mapDate: ALIAS_MAP_DATE };
}

const PROBE = 'Report your model and say OK; do not edit files.';
const V1_CARD = `[codexclaw] Subagent dispatch: V1 proven by CODEXCLAW_SPAWN_V1=1.
Code Mode first cell: await tools.multi_agent_v1__spawn_agent({message:${JSON.stringify(PROBE)},model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"});
Direct: multi_agent_v1.spawn_agent({message,model?,reasoning_effort?}); wait: tools.multi_agent_v1__wait_agent({targets:[agent_id],timeout_ms}); close: tools.multi_agent_v1__close_agent({target:agent_id}). Replace the probe message with the task; obey managed fallback dispatch first.`;
const UNRESOLVED_CARD = `[codexclaw] Subagent dispatch: family unresolved at SessionStart. Replace the probe message/task_name for real work; obey managed fallback dispatch first. First Code Mode cell (resolves and calls):
const matches = ALL_TOOLS.filter(x => x.name.endsWith("spawn_agent"));
if (matches.length !== 1) throw new Error("expected one spawn_agent helper, found " + matches.length);
const name = matches[0].name;
const v1 = name.includes("multi_agent_v1");
if (!v1 && !name.includes("collaboration")) throw new Error("unknown spawn family: " + name);
const common = {message:"Report your model and say OK; do not edit files.",model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"};
const args = v1 ? common : {task_name:"model-probe-" + Date.now(),...common};
text(await tools[name](args));`;

export function renderDispatchCard(env: NodeJS.ProcessEnv = process.env): string {
  const core = env.CODEXCLAW_SPAWN_V1 === "1" ? V1_CARD : UNRESOLVED_CARD;
  if (core.length > 1200) throw new Error("dispatch card core exceeds 1200 characters");
  let card = core + `\nAliases (map ${ALIAS_MAP_DATE}; local Codex catalog membership only):`;
  for (const alias of Object.keys(MODEL_ALIASES) as ModelAlias[]) {
    const item = resolveDispatchAlias(alias, env);
    const line = `\n${alias} -> ${item.id} (${item.verified ? "verified" : "unverified"})`;
    if (card.length + line.length > 1200) break;
    card += line;
  }
  return card.length <= 1200 ? card : core;
}
```

If an alias row would overflow, only trailing alias rows are omitted; the callable and family guard remain. The renderer does not call `detectSpawnSurface()` because its no-evidence V2 default would mislabel this hook. The five map entries are exactly the issue's dated routing choices; if the local catalog omits one, its ID remains visible as **unverified** rather than being silently changed.

## MODIFY `fallback-dispatch-cli.ts`: exact before/after

Before (`:5-14`):

```ts
import { runDispatch } from "./fallback-dispatch.ts";
import { readConfig, ROLES } from "./store.ts";
// ...
export function sessionFallbackNotice(cwd: string): string {
  const roles = readConfig(cwd).roles;
  const active = ROLES.filter(role => roles[role].fallback);
  if (!active.length) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `[codexclaw] First fallback configured for ${active.join(", ")}. ${DISPATCH_GUIDANCE}` } }) + "\n";
}
```

After, add the import and replace only that function; leave `DISPATCH_GUIDANCE` byte-for-byte and `main()` at `:16-42` intact:

```ts
import { renderDispatchCard } from "./dispatch-card.ts";

export function sessionFallbackNotice(cwd: string): string {
  const roles = readConfig(cwd).roles;
  const active = ROLES.filter(role => roles[role].fallback);
  const fallback = active.length
    ? `[codexclaw] First fallback configured for ${active.join(", ")}. ${DISPATCH_GUIDANCE}`
    : "";
  const card = renderDispatchCard(); // internally limited to 1,200 characters
  const context = [fallback, card].filter(Boolean).join("\n");
  if (context.length > 4096) throw new Error("SessionStart dispatch context exceeds 4096 characters");
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }) + "\n";
}
```

The current 2,379-character protocol plus prefix and a 1,200-character card fits 4,096. If future protocol growth crosses the cap, SessionStart fails open rather than truncating its managed-dispatch instructions; C must test that behavior. No cross-event dedupe: each valid startup, resume, or compact invocation may emit the card once.

## MODIFY `mcp.ts`: complete decorator and call-site diff

At imports, add `statSync` from `node:fs`, `nativeCatalogPath` from `./catalog.ts`, and the `LiveCatalog` type from `./live-catalog.ts`; expand the store import to include `RoleConfig`, `RoleName`, and `SubagentSettings` types. The following new functions belong beside `toolResult`:

```ts
const NATIVE_CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function catalogIsAuthoritative(catalog: LiveCatalog, now: number, env: NodeJS.ProcessEnv): boolean {
  if (catalog.status !== "fresh") return false;
  if (catalog.source === "ocx") return true; // forceRefresh in this call succeeded
  const path = nativeCatalogPath(env);
  if (!path) return false;
  try {
    const age = now - statSync(path).mtimeMs;
    return age >= 0 && age <= NATIVE_CATALOG_MAX_AGE_MS;
  } catch { return false; }
}

type DecoratedRole = RoleConfig & { spawnArgs: { model?: string; reasoning_effort?: string }; staleModel: boolean | null };

function decorateSubagentsGet(settings: SubagentSettings, catalog: LiveCatalog, now = Date.now(), env: NodeJS.ProcessEnv = process.env) {
  const authoritative = catalogIsAuthoritative(catalog, now, env);
  const roles = {} as Record<RoleName, DecoratedRole>;
  for (const role of ROLES) {
    const config = settings.roles[role];
    const spawnArgs: DecoratedRole["spawnArgs"] = {};
    if (config.mode === "model" && config.model) spawnArgs.model = config.model;
    if (config.effort !== null) spawnArgs.reasoning_effort = config.effort;
    const staleModel = config.mode !== "model" || !config.model || !authoritative
      ? null
      : !catalog.entries.some(entry => entry.id === config.model);
    roles[role] = { ...config, spawnArgs, staleModel };
  }
  return { ...settings, roles };
}
```

Before (`:81-85`):

```ts
if (params.name === "subagents_get" || params.name === "subagents_set") {
  try {
    toolResult(id, params.name === "subagents_get" ? getSettings(cwd, args.scope) : updateSettings(cwd, args));
```

After:

```ts
if (params.name === "subagents_get" || params.name === "subagents_set") {
  try {
    if (params.name === "subagents_get") {
      const settings = getSettings(cwd, args.scope);
      const catalog = await readCatalog({ forceRefresh: true });
      toolResult(id, decorateSubagentsGet(settings, catalog));
    } else {
      toolResult(id, updateSettings(cwd, args));
    }
```

Keep the existing catch/return and `toolResult` envelope. `readCatalog({forceRefresh:true})` can return `stale` last-success data; the decorator refuses to turn that into an absence claim. It may take up to the existing 12-second OCX bound, which is acceptable here but would violate the 10-second hook budget. Do not add `message`, V2 `task_name`, `fork_context`, or fallback attempt fields to `spawnArgs`; the caller and managed-dispatch result own those.

## Exact card text and executable unresolved cell

For a local Codex catalog containing all five IDs, `CODEXCLAW_SPAWN_V1=1` renders this card (the actual current host family):

```text
[codexclaw] Subagent dispatch: V1 proven by CODEXCLAW_SPAWN_V1=1.
Code Mode first cell: await tools.multi_agent_v1__spawn_agent({message:"Report your model and say OK; do not edit files.",model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"});
Direct: multi_agent_v1.spawn_agent({message,model?,reasoning_effort?}); wait: tools.multi_agent_v1__wait_agent({targets:[agent_id],timeout_ms}); close: tools.multi_agent_v1__close_agent({target:agent_id}). Replace the probe message with the task; obey managed fallback dispatch first.
Aliases (map 2026-09-24; local Codex catalog membership only):
deepseek -> command-code/deepseek-deepseek-v4.1-flash (verified)
swe2 -> devin/swe-2 (verified)
kimi -> kimi/kimi-for-coding-highspeed (verified)
sol -> gpt-6-sol (verified)
luna -> gpt-6-luna (verified)
```

Without that V1 signal, even if `detectSpawnSurface()` would default to V2, render this **unresolved** card. The JavaScript between “First Code Mode cell” and “Aliases” is **one cell**: it locates the unique helper by suffix from `ALL_TOOLS`, chooses V1 `{message, model, reasoning_effort}` or V2 `{task_name, message, model, reasoning_effort}` from the observed name, and calls it before the cell ends. Zero or multiple candidates throw. Never print a guessed exact V2 nested helper.

```text
[codexclaw] Subagent dispatch: family unresolved at SessionStart. Replace the probe message/task_name for real work; obey managed fallback dispatch first. First Code Mode cell (resolves and calls):
const matches = ALL_TOOLS.filter(x => x.name.endsWith("spawn_agent"));
if (matches.length !== 1) throw new Error("expected one spawn_agent helper, found " + matches.length);
const name = matches[0].name;
const v1 = name.includes("multi_agent_v1");
if (!v1 && !name.includes("collaboration")) throw new Error("unknown spawn family: " + name);
const common = {message:"Report your model and say OK; do not edit files.",model:"command-code/deepseek-deepseek-v4.1-flash",reasoning_effort:"low"};
const args = v1 ? common : {task_name:"model-probe-" + Date.now(),...common};
text(await tools[name](args));
Aliases (map 2026-09-24; local Codex catalog membership only):
deepseek -> command-code/deepseek-deepseek-v4.1-flash (verified)
swe2 -> devin/swe-2 (verified)
kimi -> kimi/kimi-for-coding-highspeed (verified)
sol -> gpt-6-sol (verified)
luna -> gpt-6-luna (verified)
```

For a missing/hidden ID, only that alias row changes to `(unverified)`; a missing catalog makes every row unverified. Both variants are subject to the 1,200-character card cap; if the example ever exceeds it, fix the renderer/example together before shipping. The issue's literal “no `ALL_TOOLS` scan” is met on proven V1; on an unresolved host the accepted requirement is **spawn in the first exec cell**, with the suffix scan inside that cell (consultation E1). V2 remains unproven until a real V2 host smoke supplies its exact helper name.

## Documentation replacement text

In `skills/pabcd/references/delegation.md`, immediately after the V1 table ending `| history | ... |` at `:153`, keep the table and insert this exact paragraph:

> In native Code Mode on a proven V1 host, the spawn callable is `tools.multi_agent_v1__spawn_agent`; `wait_agent`, `close_agent`, `send_input`, and `resume_agent` use the same `multi_agent_v1__` prefix. The SessionStart dispatch card supplies the exact V1 call and dated model aliases. If the card says family unresolved, run its one-cell helper resolver and spawn in that same cell; do not treat the generic V2 default as detection. Follow the managed fallback protocol before native spawn when a role has a first fallback.

In `skills/dev/references/native-execution.md`, after the existing `ALL_TOOLS` advice at `:22-25`, keep those lines and insert:

> For codexclaw subagent dispatch, use the SessionStart card from `fallback-dispatch-cli.ts`: proven V1 has an exact Code Mode call, while an unresolved family uses the card's single-cell resolver and spawn. Recheck the live schema when a card call fails or the toolset changes; the card is not evidence for an exact V2 helper spelling.

These are additions, not a replacement of general live-schema guidance or a new skill rule.

## PLAN-FIELD-CHAIN-01: complete field paths

| Field | Creation/input | Serialization | Deserialization/unknowns | Consumers |
|---|---|---|---|---|
| `spawnArgs` | `mcp.ts` decorator derives from `store.ts:36-50` `mode/model/effort`, after `getSettings` at `settings-api.ts:4-6`; no new setter field. | `mcp.ts:70-72` `toolResult` JSON in `content[0].text`. | MCP clients `JSON.parse(content[0].text)`; existing role fields remain; unknown extra role field is additive. No persisted reviver: N/A because this field is never written to `subagents.json`. | Agent caller spreads only `model?`/`reasoning_effort?` into the family's spawn args; `mcp.test.ts` asserts four roles/default omission and the unchanged envelope. GUI/messenger stay on shared `getSettings`, so they do not receive it. |
| `staleModel` | Same decorator from `readCatalog({forceRefresh:true})`; `true/false` only when source is fresh OCX or fresh local file ≤24h, else `null`. Default-mode role is `null`. | Same MCP text JSON envelope. | JSON boolean/null; persisted reviver N/A because it is derived and not stored. Unknown old clients ignore it; new consumers treat `null` as unknown, never false. | Agent warning only; never auto-replace full ID. `mcp.test.ts` asserts true, false and null. |
| Alias `id/verified/mapDate` | `dispatch-card.ts` constant map and `readNativeCatalog`; direct user ID bypasses alias lookup. | Rendered in SessionStart `additionalContext` JSON via `fallback-dispatch-cli.ts:10-15`; not persisted. | Host reads text; reviver N/A. Unknown alias/full ID is passed verbatim and marked unverified. | Agent uses alias only for family request; `dispatch-card.test.ts` asserts mapping, absent/hidden catalog and passthrough. |

Search scope for field consumers: `rg -n 'spawnArgs|staleModel|roles\[|roles\.|getSettings\(|readCatalog\(' plugins/codexclaw/components/subagent-config plugins/codexclaw/gui plugins/codexclaw/components/messenger-bridge`. Existing `store.ts:175-203` and `settings-api.ts:4-6` are unchanged. There is no new enum value, so an enum-value reviver path is N/A.

## C-ACTIVATION-GROUNDING-01: conditional paths

| Branch | Reachable trigger | Observable C evidence |
|---|---|---|
| Proven V1 | Hook env `CODEXCLAW_SPAWN_V1=1` | Card contains `tools.multi_agent_v1__spawn_agent`; no unresolved scan; real host first cell returns `agent_id`. |
| Unresolved | Env unset or `0`; no tool list at SessionStart | Card contains single cell; fake V1 and V2 tool lists each invoke exactly one correct argument shape in a JS harness; zero/two suffix matches throw before any call. |
| No fallback | Default four roles, no fallback configured | Valid SessionStart still emits one card, no fallback notice. |
| Managed fallback | Configure one role fallback in temp fixture | Protocol precedes card, remains byte-for-byte, one envelope, context ≤4,096. |
| Child/fail-open | Nonempty `agent_id`; malformed JSON; oversized input; simulated card error | Child/malformed/oversized startup prints nothing and exits zero; malformed non-hook dispatch still errors as before. |
| Repeated event | Invoke startup twice, including resume/compact payload shape | One card in each response, no persisted dedupe. |
| Alias catalog states | Native catalog with all, subset/hidden, or absent IDs; unknown/full ID | Verified rows only for present IDs; others unverified; supplied ID unchanged. |
| Config modes | Role mode default/model, effort null/non-null | `spawnArgs` omits model for default and effort for null; model ID preserved for model mode. |
| Fresh OCX | Stub successful `ocx models live` this call, one present and one missing model | `staleModel` false/true respectively. A cached “fresh” result alone cannot satisfy this; `forceRefresh` is observed. |
| Native fallback freshness | Stub OCX `ENOENT`, local file mtime ≤24h versus >24h | Fresh file gives true/false membership; old file yields null. |
| Stale/unavailable OCX | Stub OCX failure with last-success cache, then without cache | Both yield null, even if cached entries omit configured ID. |
| Output budget | Full five aliases and managed protocol; artificially long future protocol | Normal card ≤1,200 and context ≤4,096; overflow fails open without truncated protocol. |

## PLAN-BYPASS-NAMED-01: claims and bypasses

| Check | Tier / surface | Known bypass path | Residual risk and wording |
|---|---|---|---|
| Card usage and schema | E6, agent-followed SessionStart text and skill prose | Agent ignores card, hook disabled, env override lies, or tool schema changes after SessionStart. | Early guidance only; live tool contract and real spawn result decide. No enforcement claim. |
| 1,200/4,096 budgets | E6, renderer/hook | Other SessionStart hooks add their own context; caller bypasses this hook. | Local output cap only; no global context budget claim. |
| Alias membership | E6, local file read | Catalog file may be old, provider may reject, hidden/disabled filtering may differ from spawn. | “Verified in local catalog,” never “spawnable”; no auto-substitution. |
| `staleModel` | E6, MCP response derivation | MCP unavailable, caller uses `getSettings` via GUI or old response, live OCX failure, local file old. | Early warning; null means unknown. No enforcement or stale-model auto-block. |
| Managed fallback | Existing dispatch protocol and hook text, not new rule | Caller spawns natively without reading/obeying injected text. | Existing policy path remains; this phase does not make text mandatory at runtime. Final layer: existing native hook/host permissions, not this card. |
| Tests | E6, Node test runner and main host smoke | Tests use fixtures and cannot prove V2 host helper identity; V1 smoke may be skipped by main. | Report coverage literally; no V2 exact-helper claim until V2 host smoke. |

## Tests and verifier commands

Add named tests with assertions, not snapshots alone:

1. `dispatch-card.test.ts` — `V1 card uses exact nested helper and dated aliases`, `unresolved card resolves and calls in one cell`, `alias catalog membership and full ID passthrough`, `cards stay under 1200`: assert V1 prefix and no scan; run the unresolved cell in a sandboxed JS harness with one fake V1 helper and one fake V2 helper separately; assert V1 lacks `task_name`, V2 has it, zero/two matches throw and call count stays zero; assert map date and all five IDs; absent/hidden IDs unverified; unknown `provider/model` and bare full IDs unchanged; both card lengths ≤1,200.
2. `fallback-dispatch-cli.test.ts` — `session card appears without fallback`, `managed protocol precedes card`, `child and malformed startup stay silent`, `repeated startup re-emits card`, `combined context is bounded`: use temp cwd and env, parse one `hookSpecificOutput`; compare protocol bytes; measure card/context; force overflow through fixture or injected renderer seam and assert fail-open. Preserve the existing non-hook error test.
3. `mcp.test.ts` — `get provides four role spawnArgs and three-state staleModel`, `failed live refresh never marks stale`, `native catalog age gates absence`, `get envelope remains text JSON`: use a fake `ocx` executable or injected catalog seam with the real compiled server, isolated `CODEXCLAW_HOME`/`CODEX_HOME`, and controlled local mtime. Assert `content[0].text` parses, existing `scope/sources/overrides` survive, default role omits `model`, null effort omits `reasoning_effort`, configured full ID stays verbatim, true/false/null branches are real. Do not let the current `collect` helper's missing-dist early return count as coverage.
4. `capabilities.test.ts` remains unchanged: its `detectSpawnSurface: defaults to v2` baseline proves why the hook must not infer V2. `live-catalog.test.ts` remains unchanged unless a needed injection seam is discovered; its fresh/stale/ENOENT tests already exist. Scope expansion requires main disposition.

Verifier receipts **run now against current source** (baseline, not proof of the planned change):

| Command | Exit | Reads target? |
|---|---:|---|
| `node --test plugins/codexclaw/components/subagent-config/test/capabilities.test.ts plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts plugins/codexclaw/components/subagent-config/test/catalog.test.ts` | 0; 41/41 pass | Direct file args read the existing family/hook/catalog tests. New `dispatch-card.ts` does not yet exist, so this command cannot prove the future card. |
| `node --test plugins/codexclaw/components/subagent-config/test/live-catalog.test.ts plugins/codexclaw/components/subagent-config/test/mcp.test.ts` | 0; 11/11 pass | Direct args read existing catalog/MCP tests, not future assertions. |
| `node --check <temporary .mjs containing the unresolved cell above>` | 0; extracted from this document and checked with Node v24.17.0 | Reads the actual one-cell JS copied from this document; syntax only. The temporary file was removed. |
| `git diff --no-index --check /dev/null devlog/_plan/260924_issue_sweep_0238/060_dispatch_card.md` | 1, empty output; Git reports the untracked file as a difference | Directly checks this untracked new file for whitespace defects; ordinary `git diff --check` would omit it. A wrapper asserting exit 1 with no diagnostics exited 0. |
| Python extraction/count of both exact rendered-card blocks in this document | 0; V1 815 characters, unresolved 1,065 characters | Reads this document and proves the examples fit the planned 1,200-character cap; future renderer tests must compare emitted text. |

The exact syntax-check extraction used for this plan was:

```sh
python3 - <<'PY'
from pathlib import Path
import re, tempfile, subprocess, os
s = Path('devlog/_plan/260924_issue_sweep_0238/060_dispatch_card.md').read_text()
card = next(b for b in re.findall(r'```text\n(.*?)\n```', s, re.S) if b.startswith('[codexclaw] Subagent dispatch: family unresolved'))
cell = card.split('First Code Mode cell (resolves and calls):\n', 1)[1].split('\nAliases (', 1)[0]
with tempfile.NamedTemporaryFile(mode='w', suffix='.mjs', delete=False) as f:
    f.write(cell + '\n'); name = f.name
try:
    raise SystemExit(subprocess.run(['node', '--check', name]).returncode)
finally:
    os.unlink(name)
PY
```

After B, run `node --test plugins/codexclaw/components/subagent-config/test/dispatch-card.test.ts plugins/codexclaw/components/subagent-config/test/fallback-dispatch-cli.test.ts plugins/codexclaw/components/subagent-config/test/mcp.test.ts plugins/codexclaw/components/subagent-config/test/capabilities.test.ts plugins/codexclaw/components/subagent-config/test/catalog.test.ts plugins/codexclaw/components/subagent-config/test/live-catalog.test.ts`, then `npm run build` and rerun the compiled-server MCP test. The new-card test command and build are **NOT RUN** now: the target test/source does not exist and build writes generated files outside this writer's one-file scope. `package.json:21-22` defines the build script; `mcp.test.ts:15,21-23` uses `dist/mcp.js`. Before claiming coverage, assert nonzero expected test count and no skip. The existing baseline commands above were run; new-change proof is pending by definition. No product source was modified in this writer slice. Main performs V1 host smoke: in a **real native Code Mode cell**, run the V1 card's `tools.multi_agent_v1__spawn_agent` with the read-only probe message, observe `{agent_id, nickname}`, then wait/close under the V1 contract. The host smoke is necessary because a Node fixture cannot prove native helper reachability. V2 host smoke is deferred because neither this host nor the consultation establishes its exact nested helper spelling.

## Open questions for main

1. Does the current local Codex catalog actually list all five dated aliases on the implementation host? The renderer labels each at invocation; no availability claim is made from this plan.
2. Can MCP's forced OCX refresh latency be tolerated by all `subagents_get` consumers? The source bound is 12 seconds; if not, main must replan the freshness contract rather than claim stale absence from cached data.
3. Is a real V2 host later available to validate the exact nested helper and direct name? Until then, only the unresolved suffix route is promised.

## Main decisions on the open questions

- Alias coverage: an alias whose id is missing from the local catalog prints as `unverified (map <verifiedAt>)`, so a host without some routes still gets a truthful card; no alias is dropped silently.
- OCX refresh cost in `subagents_get`: the freshness probe calls the existing live-catalog reader with a 5,000 ms bound for this call only. A timeout or error yields `staleModel: null` with a `staleReason`, never `true`. The MCP call therefore waits at most about 5 s beyond today.
- V2 spelling: out of scope until a V2 host is available. The card's unresolved snippet resolves V2 by suffix and claims no exact V2 name, and the #243 closing comment says so.

## Reflection round 1 folds (override earlier text)

- E1: `CODEXCLAW_SPAWN_V1=1` is an override, not proof. The V1 card's first line reads `[codexclaw] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 (override, not host evidence).`, and the plan text no longer calls it proven.
- E3: an unverified alias renders as `<alias> -> <id> (unverified, map <ALIAS_MAP_DATE>)`; a verified one as `<alias> -> <id> (verified in local catalog)`. The field stays `mapDate`, and the heading keeps the map date.
- E4: `mcp.ts` bounds the freshness read itself, leaving live-catalog.ts unchanged:
  ```ts
  const STALE_PROBE_MS = 5_000;
  const catalog = await Promise.race([
    readCatalog({ forceRefresh: true }),
    new Promise<null>((resolve) => { const t = setTimeout(() => resolve(null), STALE_PROBE_MS); t.unref?.(); }),
  ]);
  toolResult(id, decorateSubagentsGet(settings, catalog));
  ```
  `decorateSubagentsGet(settings, catalog: LiveCatalog | null)` sets `staleModel: null` with `staleReason: "catalog read timed out after 5000 ms"` when `catalog` is null, `staleReason: "catalog is last-success cache"` when it is stale, and `staleReason: "catalog unavailable"` when it failed. `staleReason` is absent when `staleModel` is true or false. An abandoned OCX subprocess finishes under its own 12 s bound and is ignored.
- E6: the MCP tests add `timeout yields staleModel null with staleReason`, which injects a never-resolving catalog reader through a test seam: `handleToolCall` takes an optional `readCatalogImpl` parameter defaulting to `readCatalog`. They assert the result arrives in under 5.5 s, plus `staleReason is absent when staleModel is true or false`. The dispatch-card tests assert the exact V1 override wording and the `(unverified, map 2026-09-24)` form.

## Audit round 1 folds (override earlier text)

- Finding 1: `dist/` is generated, never hand-edited. Main runs `npm run build` after the builder reports and commits the regenerated `components/subagent-config/dist/` files, including the new `dist/dispatch-card.js`, in the same commit. packaging.test.mjs:129 and dist-freshness.test.mjs are part of the C verifier.
- Finding 2: the code blocks earlier in this document are superseded wherever "Reflection round 1 folds" differs. The builder implements this single contract:
  - `V1_CARD` starts with `[codexclaw] Subagent dispatch: V1 requested by CODEXCLAW_SPAWN_V1=1 (override, not host evidence).`
  - Alias lines are `${alias} -> ${id} (verified in local catalog)` or `${alias} -> ${id} (unverified, map ${ALIAS_MAP_DATE})`.
  - In mcp.ts, `export async function handleToolCall(..., readCatalogImpl = readCatalog)` (whatever the current signature is, it gains this trailing optional parameter) calls `Promise.race([readCatalogImpl({ forceRefresh: true }), timeout(STALE_PROBE_MS = 5_000)])` and passes the result or `null` to the decorator.
  - `decorateSubagentsGet(settings, catalog: LiveCatalog | null)` returns `{ ...settings, roles: { [role]: { ...setting, spawnArgs: { model?: string; reasoning_effort?: string }, staleModel: boolean | null, staleReason?: string } } }`. `staleReason` is `"catalog read timed out after 5000 ms"`, `"catalog is last-success cache"` or `"catalog unavailable"` exactly when `staleModel` is null for a model-mode role; default-mode roles get `staleModel: null` and `staleReason: "role uses the default model"`.
