---
created: 2026-06-30
tags: [codexclaw, l14, subagent, skill-routing, design, sot]
aliases: [L14 Design, subagent skill routing, cxc skill attachment]
---

# L14 — Subagent Skill Routing + Loop/Goal Handoff (Design SOT)

Status: DESIGN + SHIPPED (the E5 dispatch builder shipped in L15 — `SURFACE_SKILL`/`buildSpawnItems`/`SpawnPayload.items` in `subagent-config/src/spawn-wrapper.ts`; only the L15.2 E3 PreToolUse hook remains deferred) · 2026-06-30

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
- `spawn-wrapper.ts` builds a `SpawnPayload` that now INCLUDES an `items` attachment
  channel: `buildSpawnItems` + `SURFACE_SKILL` attach the matching surface skill as a
  skill mention (shipped in L15). The role TOMLs still carry the inline "consult the
  matching `dev-*` skill" prose as a secondary cue.
- The builder (`resolveSpawnPayload`/`buildSpawnPayload`) is the E5 dispatch path: a
  dispatcher that routes through it gets the surface skill attached deterministically.
  What is NOT yet shipped is automatic production attachment without an explicit builder
  call — that is the L15.2 **E3** PreToolUse hook (feasible on the v1 spawn surface only),
  still deferred.

Net: routing is "split into skills" AND "attached at dispatch when routed through the E5
builder." The remaining gap is a deterministic hook that attaches without the builder call
(L15.2/E3); absent that, a spawn made outside the builder is still model-autonomous.

---

## Why this is hard (the enforcement tension, applied)

There is **no hook on skill load or subagent spawn**. codexclaw cannot force a
subagent to read a skill after the fact. The only leverage point is the **spawn payload
itself** — what the main agent passes into `spawn_agent` at dispatch time. So the design
target is: make the wrapper produce a payload that *attaches the skill*, and make the
main agent route every dispatch through the wrapper.

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
- `resolveSpawnPayloadWithSkills(...)` is the production entry: role prompt stays in
  `message` (single source), skills + task ride in `items`.

So the builder can turn "dispatch per `cxc-search`" into a real skill attachment, verified
by tests (`test/spawn-wrapper.test.ts`, the `L15:` cases). This is **E5** strength and only
takes effect WHEN the main agent routes a v1 spawn through this builder and passes the
`items` — there is no non-test caller yet, so attachment today depends on following the
dispatch doctrine, not on an automatic hook. The deterministic (hook-driven) version is
the L15.2 follow-up below.

### Hard runtime constraint (codex-rs verified)
Only **v1** `spawn_agent` accepts `items` (`UserInput::Skill { name, path }`). The **v2**
spawn handler uses `#[serde(deny_unknown_fields)]` with no `items` field, so skill
attachment is impossible on v2 regardless of mechanism. PreToolUse CAN rewrite spawn input
(`updatedInput` on a native tool, `permissionDecision:"allow"`), so an **E3** hook that
deterministically attaches skills is feasible **for v1 only** — tracked as the L15.2
follow-up below, not shipped.

### L15.2 follow-up (PLANNED, E3)
A `^spawn_agent$` PreToolUse hook that injects the resolved `items` via `updatedInput`,
so attachment does not depend on the main agent remembering to route through the builder.
Gated on: (a) detecting v1 vs v2 at the hook, (b) a no-op on v2, (c) not clobbering items
the agent already set. Until it ships, attachment is the E5 builder contract above.

---

## Design 14.A — Skill attachment in the spawn payload

Extend `SpawnPayload` with an `items` channel mirroring the `spawn_agent` tool's
structured input (`type: "skill"` with `name` + `path`, `type: "mention"`, or
`type: "text"`).

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

The builder composes `items` as: one `skill` item per attached `cxc-*` skill, then a
trailing `text` item carrying the concrete task. The legacy `message` form stays valid
for callers that do not attach skills, so this is additive, not breaking.

Open design question (resolve in P): whether the role prompt stays in `message` or
moves into a leading `text` item when `items` is used. Recommendation: keep the role
prompt in `message` (one source) and use `items` only for skill attachments + task.

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

---

## Design 14.C — Route real dispatches through the wrapper

The wrapper only matters if the main agent actually calls it. The honest constraint:
codexclaw cannot intercept the `multi_agent_v1__spawn_agent` tool call from a hook. So
"route through the wrapper" is a **discipline contract**, not a runtime interception:

- The `cxc-dev` / subagent doctrine instructs the main agent to build dispatch payloads
  via the wrapper and pass the resulting `items` into `spawn_agent`.
- The wrapper becomes the single place that knows the skill paths, the role-to-skill
  map, and the model resolution — so following the contract is easier than hand-rolling
  a spawn.

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
Routing table wording is weak prose and only `cxc-dev` is implicit-visible. Intent:
strengthen the routing table to STRICT ("MUST read the matching `dev-*` SKILL.md before
writing in that surface"), and let the `$cxc-dev` directive enumerate the exact surface
skills to attach. Design 14.A/14.B make this concrete for the **subagent** path; the
main-agent path is the same routing map surfaced as a directive.

---

## Proposed work-phase split (each one full PABCD cycle)

| WP | Slice | DONE means |
|----|-------|------------|
| L14.A | `SpawnPayload.items` + skill-attachment builder + tests | wrapper emits skill `items` for a named skill; tests prove attachment shape |
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
