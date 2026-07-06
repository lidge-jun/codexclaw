---
created: 2026-06-30
tags: [codexclaw, l14, subagent, skill-routing, design, sot]
aliases: [L14 Design, subagent skill routing, cxc skill attachment]
---

# L14 — Subagent Skill Routing + Loop/Goal Handoff (Design SOT)

Status: DESIGN + SHIPPED (E5 dispatch builder shipped in L15 — `SURFACE_SKILL`/`buildSpawnItems`/`SpawnPayload.items`; lazygap_impl 020 added `INTENT_ROLE`/`routeDispatch` and the E3 `^spawn_agent$` PreToolUse attach hook; **WP2 upgraded the E3 hook to the MENTION CHANNEL**: it now rewrites the spawn `message` to prepend link-form `[$cxc-*](skill://…)` mentions — schema-safe on BOTH v1 and v2 because `message` is a shared field — so it is ALWAYS-ON (the old `CODEXCLAW_SPAWN_ATTACH=v1` opt-in and `items` injection are gone). v2 `deny_unknown_fields` only blocks the structured `items` key, not message mentions) · 2026-07-02

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

Net: routing is "split into skills" AND "attached at dispatch" — deterministically, on
both spawn surfaces. WP2 upgraded the lazygap_impl 020 hook (`spawn-attach-hook.ts`) from
a v1-only opt-in `items` injector to an ALWAYS-ON message rewriter: it prepends link-form
`[$cxc-*](skill://…)` mentions (role baseline + inferred surfaces) to the spawn `message`,
which the child's first turn parses into full SKILL.md injections. It no-ops when the
caller already attached `items` (E5 builder path) or already mentioned the same skills,
and never invents a message. The old `CODEXCLAW_SPAWN_ATTACH=v1` gate is removed.
The hook is also the MODEL/EFFORT-ENFORCEMENT point: it infers the role (`worker` -> executor;
review/audit/검증-keyword explorer spawns -> reviewer; else explorer), reads
`.codexclaw/subagents.json` via `resolveSpawnConfig`, and injects the configured model
id into `updatedInput.model` when the role is model-mode AND the caller did not pick a
model — a caller's explicit model is never overridden. A configured reasoning effort is
likewise injected into `updatedInput.reasoning_effort` (a real spawn schema field on
both v1 and v2; invalid values hard-fail the spawn, so the store validates against the
codex catalog-supported set low/medium/high/xhigh). Effort is mode-independent: it can
override on a main-model spawn. This closes the gap where the GUI-saved per-role config
was only honored on the explicit E5 builder path.

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

### Hard runtime constraint (codex-rs verified) — REVISED by WP2
Only **v1** `spawn_agent` accepts `items` (`UserInput::Skill { name, path }`). The **v2**
spawn handler uses `#[serde(deny_unknown_fields)]` with no `items` field, so STRUCTURED
attachment is impossible on v2. But structured items are not the only injection trigger:
the child's turn-input pipeline also parses **text mentions** out of `UserInput::Text` —
plain `$skill-name` (unique-name match) and link-form `[$skill-name](skill://<abs path>)`
(exact path match) — and injects each matched SKILL.md body (codex-rs injection.rs,
`collect_explicit_skill_mentions` stage 2 / `extract_tool_mentions`). The spawn `message`
becomes exactly such a text input in the child's first turn, and `message` exists on BOTH
spawn schemas. So a PreToolUse rewrite of `message` is a deterministic, surface-agnostic
E3 attachment channel. Residual risk: this rests on codex-rs source analysis of the
mention parser; verify against a live child transcript when the runtime version changes.

### L15.2 follow-up (SHIPPED as WP2, E3 — mention channel)
The `^spawn_agent$` PreToolUse hook now prepends the resolved link-form mentions to
`message` via `updatedInput` (full replacement, only `message` changed), so attachment
does not depend on the main agent remembering to route through the builder. It (a) works
identically on v1 and v2 (no surface detection needed), (b) no-ops when `items` is
present (never double-attaches on the builder path), (c) dedupes against `$cxc-*` /
`$codexclaw:cxc-*` / `skill://` mentions already in the message, and (d) never invents a
missing message. Paths that are not link-safe (whitespace/parens) degrade to the plain
`$cxc-<name>` mention form.

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

QA dispatch note: `cxc-qa` oracle passes (dual visual/functional review, C3+) are
explorer-role read-only dispatches carrying the captures/artifacts in the prompt;
DISPATCH-ACTOR-01/RETIRE-01 govern reuse across revision rounds, and QA delegated to a
`worker` rides the SubagentStop evidence-receipt gate like any other worker.

---

## Design 14.C — Route real dispatches through the wrapper

The wrapper only matters if the main agent actually calls it. (Historical note: this
section originally claimed a hook cannot intercept the spawn tool call. That was
superseded — the runtime canonicalizes the collab tool `multi_agent_v1.spawn_agent` to
tool_name `spawn_agent` (registry.rs:727), so the shipped `^spawn_agent$` PreToolUse
hook DOES intercept it and rewrites `message`. The wrapper contract below remains the
richer explicit path — model resolution and structured `items` — that no generic hook
can infer:)

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
