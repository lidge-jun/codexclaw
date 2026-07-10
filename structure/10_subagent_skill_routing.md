---
created: 2026-06-30
tags: [codexclaw, l14, subagent, skill-routing, design, sot]
aliases: [L14 Design, subagent skill routing, cxc skill attachment]
---

# L14 — Subagent Skill Routing + Loop/Goal Handoff (Design SOT)

Status: DESIGN + SHIPPED — **spawn surface status 260710: V1 is codexclaw's default; the model catalog pins sol/terra to V2 and luna to V1, while `features.multi_agent_v2` selects V2 only for fallback models. The surface pins on the first turn.** V2 requires task_name+message and rejects `items`; production builders emit `fork_turns:"none"` plus resolvable message mentions. Historical shape below documents the v1-era evolution. (E5 dispatch builder shipped in L15; lazygap_impl 020 added `INTENT_ROLE`/`routeDispatch` and the E3 spawn PreToolUse hook. When the spawn message is plaintext, the hook normalizes recognized mentions and inlines full SKILL.md bodies on V2-shaped spawns. Native ChatGPT-backend V2 presents ciphertext, making both operations no-ops; its reliable hook-borne channels are the leaf guard and model+effort injection. It never invents role baselines or missing surfaces. The old `CODEXCLAW_SPAWN_ATTACH=v1` opt-in is gone; V1 `items` remains a manual, strongest channel.) · 2026-07-10

> This is the design source of truth for the L14 hardening track. The defect
> diagnosis with file:line evidence lives in
> `devlog/_plan/mvp_hard/140_L14_loop_goal_routing_followup.md`; this file turns that
> diagnosis into the intended *shape* of the fix, grounded in the philosophy
> (`00_philosophy.md` section 1 enforcement tension, section 5 subagent doctrine).
>
> Governing principle: routing must travel as an **attachment**, not a **hope**.

---

## The user's target behavior

The surface skills already exist as independent on-demand skills
(`$codexclaw:cxc-dev-architecture`, `$codexclaw:cxc-search`, ...). The user wants to
dispatch a subagent **with that skill attached** — "go investigate per `cxc-search`" —
so the subagent actually loads the discipline instead of being told about it in prose.

---

## Current state (what is real today)

- Surface skills are split out and on-demand: `cxc-search`, `cxc-dev-architecture`,
  `cxc-dev-backend`, etc. (`plugins/codexclaw/skills/*/`). Step 1 is done.
- `spawn-wrapper.ts` builds resolvable message mentions for the production path on both
  surfaces. V1 callers may manually use `buildSpawnItems`/`SpawnPayload.items` as the
  strongest v1-only channel. `SURFACE_SKILL` and `ROLE_BASE_SKILLS` resolve the exact
  folders the dispatcher requested.
- The builder (`resolveSpawnPayloadWithSkills`/`routeDispatch`) is the E5 dispatch path:
  a dispatcher that routes through it names the role and surface skills deterministically.
- The E3 spawn PreToolUse hook is a repair boundary, not a routing oracle. On plaintext
  spawn paths it normalizes known broken/bare cxc mentions already in `message` and
  inlines recognized skill bodies on V2-shaped spawns; it does not supply an omitted
  role baseline or infer a surface skill.

Net: routing is "split into skills" and its attachment intent is encoded at dispatch only
when the dispatcher explicitly names the resolved role/surface set. Prefer
`[$cxc-<name>](skill://<abs SKILL.md>)`; use plugin-native
`$codexclaw:cxc-<name>` when a path is not link-safe. The hook recognizes bare
`$cxc-<name>` only as legacy normalization/dedupe input and rewrites it to a resolvable
form when the folder is known. It never emits a bare form and never adds a missing skill.
The same hook applies configured model+effort routing and the leaf-topology guard on both
surfaces; those responsibilities do not change the dispatcher's skill list.

---

## Why this is hard (the enforcement tension, applied)

There is **no hook on skill load**, and the spawn hook cannot select a skill that the
dispatcher omitted. The leverage point is the **spawn payload itself** — what the main
agent passes into `spawn_agent` at dispatch time. So the design target is: make the
wrapper produce a payload that attaches the explicitly resolved skills, and make the main
agent route every dispatch through the wrapper.

This keeps the honesty rule intact: we are not claiming a hook enforces routing. We are
attaching the discipline to the spawn so the autonomous choice (load the skill) is the
default, pre-loaded choice.

---

## L15 SHIPPED (2026-06-30) — the E5 attachment builder

The skill-attachment builder is implemented in
`components/subagent-config/src/spawn-wrapper.ts`:

- `SpawnPayload.items?: SpawnItem[]` — the v1 `items` channel (skill items + a trailing
  task text item).
- `SURFACE_SKILL` maps a coarse surface (`architecture`, `backend`, `search`, ...) to a
  `cxc-*` skill folder; `ROLE_BASE_SKILLS` anchors `dev` (and `dev-code-reviewer` for the
  reviewer) on every dispatch.
- `resolveAttachedSkillFolders(role, surfaces, explicitFolders)` computes the ordered,
  deduped folder set; an explicit folder the caller names (e.g. `search`) wins.
- `buildSpawnItems(...)` emits one `{type:"skill",name:"cxc-<folder>",path}` per folder
  that exists on disk, then `{type:"text",text:"TASK: ..."}`. Dangling folders are dropped.
- `resolveSpawnPayloadWithSkills(...)` is the production entry: role prompt, resolvable
  skill mentions, and task all ride in `message`; it does not emit `items`.

So the builder can turn "dispatch per `cxc-search`" into a real skill attachment, verified
by tests (`test/spawn-wrapper.test.ts`, the `L15:` cases). This is **E5** strength and only
takes effect when the dispatcher routes through the builder: production V1 and V2 payloads
use the explicit message mention block; a manual V1 caller may choose `items`. The hook can
repair an emitted mention but cannot replace this routing decision.

### Hard runtime constraint (codex-rs verified) — REVISED by WP2
Only **v1** `spawn_agent` accepts `items` (`UserInput::Skill { name, path }`). The **v2**
spawn handler uses `#[serde(deny_unknown_fields)]` with no `items` field. Message mentions
are therefore the production shared channel, but their delivery differs: V1 turns the
spawn message into `UserInput::Text` and parses link/plugin mentions natively; V2 sends
`InterAgentCommunication`, which upstream excludes from skill collection. The codexclaw
spawn hook compensates only when the V2 message reaches it as plaintext by inlining full
SKILL.md bodies for recognized cxc mentions. Native ChatGPT-backend V2 presents encrypted
ciphertext, so normalization and inlining are safe no-ops there; skill delivery relies on
fork inheritance. Child sessions are proven to fire SessionStart hooks, but using them
for delivery is future work. The native V2 hook still reliably prepends the leaf guard
and injects configured model/effort fields.

### L15.2 follow-up (SHIPPED as WP2, E3 — mention normalization)
When `message` is plaintext, the spawn PreToolUse hook scans it for known cxc mentions,
repairs broken links or bare names via `updatedInput`, and appends recognized skill bodies
on V2-shaped spawns. It never invents a missing message or a missing skill. The preferred output is
`[$cxc-<name>](skill://<abs SKILL.md>)`; when the path is not link-safe, the output is the
plugin-native `$codexclaw:cxc-<name>` fallback. Bare `$cxc-<name>` recognition remains
only as legacy detection/dedupe input, never as an emitted or taught attachment form.

---

## Design 14.A — Skill attachment in the spawn payload

The shipped `SpawnPayload` retains an optional manual V1 `items` channel mirroring the
V1 `spawn_agent` structured input (`type: "skill"` with `name` + `path`,
`type: "mention"`, or `type: "text"`).

```ts
export interface SpawnSkillRef {
  name: string;   // e.g. "cxc-search"
  path: string;   // absolute SKILL.md path
}

export interface SpawnPayload {
  agent_type: "explorer" | "worker";
  message: string;
  model?: string;
  items?: SpawnItem[];   // skill attachments + the task text, when used
}
```

`buildSpawnItems` composes the strongest manual V1 form: one `skill` item per attached
`cxc-*` skill, then a trailing `text` item carrying the concrete task. The production
`resolveSpawnPayloadWithSkills`/`routeDispatch` path instead emits resolvable mentions and
the task in `message`, which is valid on both surfaces and enables hook inlining on
plaintext V2 provider/proxy paths.

Resolved: the production role prompt, skill mentions, and task stay in `message` as one
source. Manual V1 `items` remains a separate helper for callers that deliberately choose
the structured channel.

---

## Design 14.B — Declarative role-to-skill routing map

Today the surface mapping is prose inside each role TOML. Promote it to a small,
testable declaration the wrapper reads, so "explorer investigating an architecture
question" deterministically attaches `cxc-dev-architecture`.

Two candidate homes (decide in P):

1. A `routing` table in the subagent-config store / a sibling const module:
   `role + surface -> [skill names]`.
2. A structured key in each role TOML the narrow reader already parses.

Surface is either passed explicitly by the dispatcher (`dispatch(role, surface, task)`)
or inferred from an explicit skill request like the user's "per `cxc-search`." An
explicit skill request always wins over inferred surface.

Illustrative default map (STYLE_SAMPLE, not locked):

| Role | Default attached skills |
|------|-------------------------|
| explorer | `cxc-dev` + surface (`cxc-dev-architecture` / `cxc-dev-backend` / `cxc-dev-debugging`) |
| reviewer | `cxc-dev-code-reviewer` + `cxc-dev-security` (risk surfaces) |
| executor | `cxc-dev` + surface router (`cxc-dev-frontend` / `cxc-dev-backend` / `cxc-dev-testing`) |
| any (explicit) | the user-named skill, e.g. `cxc-search`, attached verbatim |

QA dispatch note: `cxc-qa` oracle passes (dual visual/functional review, C3+) are
explorer-role read-only dispatches carrying the captures/artifacts in the prompt;
DISPATCH-ACTOR-01/DISPATCH-RETIRE-01 govern reuse across revision rounds, and QA delegated to a
`worker` rides the SubagentStop evidence-receipt gate like any other worker.

---

## Design 14.C — Route real dispatches through the wrapper

The wrapper only matters if the main agent actually calls it. (Historical note: this
section originally claimed a hook cannot intercept the spawn tool call. That was
superseded — V1 canonicalizes to hook name `spawn_agent`, while namespaced V2 may arrive
as `collaborationspawn_agent`; the shipped matcher covers both plus collaboration
variants. The wrapper contract below remains the richer explicit path — role/surface
resolution and message mentions — that the hook cannot infer when omitted:)

- The `cxc-dev` / subagent doctrine instructs the main agent to build dispatch payloads
  via the wrapper and pass its fresh-context payload (task_name, fork_turns:"none",
  mention-block message) into `spawn_agent`; manual `items` is v1-only and rejected on V2.
- The wrapper knows the skill paths and role-to-skill map; the hook independently reads
  configured model/effort values. Following this contract is easier than hand-rolling a
  spawn.

This is named as guidance (section 1), not a hook-enforced guarantee. We do not write
"the hook attaches the skill"; we write "the dispatch helper attaches the skill, and
the doctrine says route through it."

---

## Coupled defects from the L14 diagnosis (design intent)

### 14.1 — `cxc-loop` prose does not drive PABCD
`detectTrigger` (`hook.ts:64`) has no `loop`/`HOTL` token, so invoking the loop skill
arms nothing. Intent: add a loop token that turns on `orchestrationActive` and enters
the loop contract, OR make the loop skill body emit the concrete
`cxc orchestrate <phase> --attest` ladder. Also stop claiming "enforced by the Stop
hook" until the arming path exists.

### 14.2 — Loop never arms because nothing sets the goal
`handleStop` arming is `orchestrationActive && phase != IDLE` AND `goal == active`.
codexclaw is read-only on the goal DB. The forward bridge (`GOAL_ACTIVATION_DIRECTIVE`,
`freeze.ts:124`) is now LIVE as of L14: `runFreeze` emits it when the interview is ready,
surfaced via the top-level `cxc freeze` command, so the **main session** is instructed to
call `create_goal` (objective-only) while codexclaw never writes the DB. Still PLANNED:
the **reverse** path — a goal-active branch that auto-arms `orchestrationActive` so
"set a goal -> loop runs" holds without a separate orchestrate trigger. The user's mental
model remains the target: **loop sets a goal; a set goal drives the loop.**

### 14.3 — `dev` routing collapses to `dev` alone
Routing table wording is weak prose and (until the 2026-07-05 implicit expansion —
which added six metadata rows, not router bodies) only `cxc-dev` was implicit-visible;
`dev-*` routers remain implicit-off today. Intent:
strengthen the routing table to STRICT ("MUST read the matching `dev-*` SKILL.md before
writing in that surface"), and let the `$cxc-dev` directive enumerate the exact surface
skills to attach. Design 14.A/14.B make this concrete for the **subagent** path; the
main-agent path is the same routing map surfaced as a directive.

---

## Proposed work-phase split (each one full PABCD cycle)

| WP | Slice | DONE means |
|----|-------|------------|
| L14.A | message mention builder + manual V1 `SpawnPayload.items` helper + tests | production wrapper emits resolvable mentions; manual V1 helper proves `items` shape |
| L14.B | Declarative role-to-skill routing map + resolver + tests | `dispatch(role, surface)` returns deterministic skill set; explicit request overrides |
| L14.C | Dispatch-through-wrapper doctrine in `cxc-dev`/subagent docs | doctrine + README updated; no false "hook enforces" wording |
| L14.1 | `detectTrigger` loop token / loop ladder emission | invoking loop arms a real PABCD cycle; tests green |
| L14.2 | `GOAL_ACTIVATION_DIRECTIVE` emit path + reverse auto-arm | loop sets goal via main session; goal-active arms loop; boundary intact |
| L14.3 | STRICT dev routing table + surface enumeration | routing wording is STRICT; main-agent surface attach matches subagent map |

Sequencing note: L14.A -> L14.B -> L14.C is the routing spine the user asked for and is
independent of the loop/goal handoff (14.1/14.2). The routing spine can ship first.

---

## Honesty checklist for this track (apply before any DONE)

- [ ] No sentence claims a hook enforces skill loading or routing.
- [ ] Read-only goal DB boundary preserved; only the main session writes goals.
- [ ] `cxc-loop` / `goalplan` goal-ownership stated in exactly one place and matches the wire.
- [ ] Status synced across INDEX row, loop doc header, this SOT.
- [ ] Subagent attachment verified by a real spawn payload, not prose.

---

## Cross-cutting: the Interview round the user requested

Per the user, after the prior goal finished, the next step is to **re-run subagent
exploration, return to the `I` phase, and surface these contradictions as questions**
before implementing L14. That interview ran and the L14-L19 work then shipped (the E5
dispatch builder landed in L15); this design SOT now records shipped behavior, with the
L15.2 E3 PreToolUse hook as the one remaining deferred piece (see the L15.2 follow-up above).
