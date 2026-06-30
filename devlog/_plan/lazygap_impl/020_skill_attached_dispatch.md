# 020 — Skill-Attached Base-Role Dispatch (runtime impl scaffold)

Status: PROPOSED (scaffold; no code yet) · 2026-07-01 · lazygap_impl loop 020 · class C3 (subagent routing)

> Source gap: `../lazygap/008` (the user's CORE ask). Runtime feasibility VERIFIED in
> `../lazygap/010` Q2. The E5 builder half ALREADY SHIPS (`spawn-wrapper.ts`); this loop adds
> the two missing pieces — a role×intent->surface map, and the deterministic **E3** PreToolUse
> `^spawn_agent$` attachment hook for the v1 spawn surface, with an E5 fallback for v2.
>
> Target sentence made real: "reviewer로 이 변경 `cxc-dev` + `cxc-dev-frontend` 기준 레드팀
> 검증해줘" -> a `reviewer`-intent spawn that actually loads those skills into the child.

## Why

The user wants to dispatch a subagent WITH a `$cxc-*` skill attached, not merely told about it
in prose. `structure/10_subagent_skill_routing.md` states the principle: "routing must travel
as an attachment, not a hope." The attachment channel exists, but two gaps remain:

1. No role×intent map: a dispatcher must hand-pick `surfaces`/`explicitSkillFolders`; there is
   no "red-team a frontend change -> reviewer + [dev, dev-code-reviewer, dev-frontend]" lookup.
2. No deterministic production attachment: `resolveSpawnPayloadWithSkills` only attaches when a
   dispatcher explicitly calls it (E5). A raw `spawn_agent` made outside the builder is still
   model-autonomous (the L15.2/E3 deferral). `../lazygap/010` Q2 proves E3 is feasible on v1.

## Ground Truth (read before edit — most of this already exists)

- SHIPPED builder (`subagent-config/src/spawn-wrapper.ts`):
  `Surface` (12 values) + `SURFACE_SKILL` (folder map) `:43-69`; `ROLE_BASE_SKILLS`
  (`explorer:[dev]`, `reviewer:[dev,dev-code-reviewer]`, `executor:[dev]`) `:78`;
  `skillItem`/`resolveAttachedSkillFolders`/`buildSpawnItems` (on-disk filtered, deduped) ;
  `SpawnPayload.items` `:215`; `resolveSpawnPayloadWithSkills` `:267`.
- Roles: `subagent-config/src/store.ts:15` `ROLES = ["explorer","reviewer","executor"]`.
- agent_type mapping: `spawn-wrapper.ts:27` `ROLE_AGENT_TYPE` (explorer/reviewer->explorer,
  executor->worker). NO NEW ROLES — locked (`../lazygap/008`).
- E3 runtime facts (`../lazygap/010` Q2): `^spawn_agent$` PreToolUse fires for
  `multi_agent_v1__spawn_agent` + default v2; `updatedInput` applied only on
  `permissionDecision == "allow"` (codex-rs `output_parser.rs:162`); v1 accepts injected
  `items` (`multi_agents/spawn.rs:218-221`); v2 is `deny_unknown_fields`, rejects `items`
  (`multi_agents_v2/spawn.rs:243-244`).
- Existing PreToolUse pattern: `plugins/codexclaw/hooks/pre-tool-use-guarding-goal-budget.json`
  (`"matcher": "^create_goal$"`) + the FAIL-CLOSED dispatcher `cli.ts:74`. NOTE: the new
  spawn-attach hook is FAIL-OPEN (allow untouched on any doubt), unlike the R-9 fail-closed one.

## Design (diff-level)

### Part A — role×intent map (pure, in spawn-wrapper.ts)

- `export type Intent` — a small closed set of dispatch intents, e.g. `"red-team" | "review" |
  "implement" | "investigate" | "research" | "debug"` (RESOLVE exact set in P).
- `export const INTENT_ROLE: Record<Intent, RoleName>` — e.g. red-team/review->reviewer,
  implement/debug->executor, investigate/research->explorer.
- `export function routeDispatch(input: { intent: Intent; surfaces?: Surface[];
  explicitSkillFolders?: string[]; task: string; skillsDir: string }): { role; items }` —
  composes `INTENT_ROLE[intent]` + `buildSpawnItems`. This is the one call a dispatcher makes:
  "red-team a frontend change" => `routeDispatch({ intent:"red-team", surfaces:["frontend"], ... })`
  => role `reviewer`, items `[cxc-dev, cxc-dev-code-reviewer, cxc-dev-frontend, TASK:...]`.

### Part B — deterministic E3 attach hook (the deferred L15.2 piece)

New manifest `plugins/codexclaw/hooks/pre-tool-use-attaching-skills.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^spawn_agent$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/components/subagent-config/dist/spawn-attach-hook.js\" hook pre-tool-use",
            "timeout": 10,
            "statusMessage": "(codexclaw) Attaching skills to spawn"
          }
        ]
      }
    ]
  }
}
```

New module `subagent-config/src/spawn-attach-hook.ts`:
1. Parse PreToolUse stdin (`tool_name`, `tool_input`, `cwd`).
2. **v2 / strict-schema guard (FAIL-OPEN):** if `tool_input` already has no `items` field AND
   we cannot prove the v1 surface, emit `{}` (allow untouched). NEVER deny — denying a v2 spawn
   we cannot rewrite would break dispatch (`../lazygap/010` Q2 fail-open rule).
3. If `tool_input` already carries `items` (caller used the E5 builder) -> allow untouched
   (don't double-attach).
4. Otherwise infer surfaces/intent from the spawn `message`/`agent_type` (best-effort, NARROW:
   only attach the role baseline + any surface keyword unambiguously present), build `items`
   via `buildSpawnItems`, and emit
   `{ "hookSpecificOutput": { "hookEventName":"PreToolUse", "permissionDecision":"allow",
   "updatedInput": { ...toolInput, items } } }`.
5. Any error -> `{}` (allow untouched).

> Determinism caveat (documented honestly): on v1, attachment is deterministic via updatedInput.
> On v2 (`deny_unknown_fields`) it is structurally impossible, so the hook is a NO-OP there and
> the E5 builder (`routeDispatch`/`resolveSpawnPayloadWithSkills`) remains the only attach path.
> This is the precise version of the mvp_hard G4 finding, now actionable.

### Invariants

- No new roles; `agent_type` always a built-in type (`ROLE_AGENT_TYPE`).
- E3 hook FAILS OPEN on every uncertainty: unknown surface, v2 schema, parse error, existing
  `items` -> allow untouched. It can only ADD skills on a provable v1 spawn, never deny/break.
- Only on-disk skills attach (`buildSpawnItems` already filters by `existsSync`).
- Role×intent map is pure + closed-set; an unknown intent falls back to `explorer` (read-only).

## Acceptance

| Check | Evidence |
|-------|----------|
| Intent->role mapping | `routeDispatch({intent:"red-team"})` -> role `reviewer` |
| Frontend red-team attaches the right skills | items contain `cxc-dev`, `cxc-dev-code-reviewer`, `cxc-dev-frontend`, then TASK |
| Explicit skill honored | `explicitSkillFolders:["search"]` attaches `cxc-search` even with no surface |
| E3 hook attaches on v1 | spawn_agent input w/o items -> updatedInput.items present, permissionDecision allow |
| E3 hook no-ops when items present | input already has items -> `{}` (no double-attach) |
| E3 hook fails open on doubt | v2-shaped / unknown / malformed input -> `{}` (allow untouched) |
| No-new-roles invariant | mapping only ever yields explorer/reviewer/executor |
| Trust pairing (with 010) | a reviewer dispatch's TASK names the `EVIDENCE_RECORDED:` contract |

## Verification

- `node --test plugins/codexclaw/components/subagent-config/test/spawn-wrapper.test.ts`
  (extend with routeDispatch + INTENT_ROLE cases).
- `node --test plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts` (new).
- extend `plugins/codexclaw/test/hook-e2e.test.mjs` with a `pre-tool-use` spawn-attach case
  (v1 attaches, items-present no-ops, malformed fails open) driving the real dist entrypoint.
- `npm run build` (idempotent; +2 compiled modules) ; `npm test` (full suite green) ;
  `npm run gate` (exit 0) ; `git diff --check`.

## PABCD plan (one full cycle)

- P: this doc; RESOLVE the exact `Intent` set + the message->surface inference rules (keep narrow).
- A: gpt-5.4 explorer challenges — does the E3 hook ever deny (must not)? does it double-attach?
  does inference over-reach on ambiguous messages? is the v2 no-op correct against `010` Q2?
- B: implement Part A (map) + Part B (hook + manifest + plugin.json registration) + tests.
- C: build idempotent + unit + e2e + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-020): skill-attached dispatch (intent map + E3 hook)`,
  `goal update`.

## Depends on / feeds

Depends on `010` (the receipt gate) for trust: a skill-attached reviewer/executor must return a
receipt the 010 SubagentStop gate accepts. Together they are the dispatch spine the user asked
for. Updates `structure/10_subagent_skill_routing.md` from "E3 deferred" to "E3 shipped on v1,
E5 fallback on v2".

## Cross-loop coupling with 010 (the agent_type ambiguity)

`010`'s SubagentStop gate matches on the child's `agent_type`, but `ROLE_AGENT_TYPE`
(`spawn-wrapper.ts:27-31`) collapses BOTH explorer and reviewer to `agent_type:"explorer"`
(only executor is distinct, as `worker`). So the gate cannot tell a write-review from a
read-only investigate by `agent_type` alone. This loop owns the fix if option (b)/(c) is chosen
in `010`'s blocking decision: when `020` dispatches a reviewer/executor intent, it should stamp
a distinguishing marker (e.g. a TASK line that names the `EVIDENCE_RECORDED:` contract, or an
explicit intent tag the gate can read from `last_assistant_message`/transcript) so `010` can
require a receipt from write/verify children while releasing read-only explorers. RESOLVE the
marker shape jointly with `010` P-phase before either ships.
