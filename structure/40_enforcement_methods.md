---
created: 2026-06-30
tags: [codexclaw, enforcement, hooks, sot, design]
aliases: [Enforcement Methods Catalog, codexclaw enforcement ladder, how to enforce]
---

# Enforcement Methods Catalog (SOT)

> `00_philosophy.md` §1 states the tension: a hook can enforce, or prose can only
> suggest. This file is the full catalog of *how strongly* codexclaw can enforce a
> given intent, given the four Codex hook surfaces, ranked from hardest to softest.
> Use it to pick the strongest available mechanism for each contradiction in
> `30_contradiction_register.md`, and to stop writing "the hook enforces X" when only
> a soft mechanism exists.

---

## The enforcement ladder (strongest -> weakest)

| Tier | Mechanism | Surface that owns it | Can it truly block? | Cost / limit |
| --- | --- | --- | --- | --- |
| E1 | **Tool-call deny** | `PreToolUse` `permissionDecision:"deny"` | YES — the tool call does not run | only fires on a tool call codexclaw matches; fail-closed must be deliberate |
| E2 | **Stop-continuation block** | `Stop` `decision:"block"` + reason | YES — refuses to end the turn | needs an arming condition; bounded by stagnation/context guards so it cannot trap |
| E3 | **Tool-input rewrite** | `PreToolUse` modified input | PARTIAL — alters args, not whether it runs | narrow; only where the tool input is the lever (e.g. spawn payload) |
| E4 | **Injected directive** | `UserPromptSubmit` `additionalContext` | NO — context the model usually follows | model-autonomous; strong wording raises compliance, never guarantees it |
| E5 | **Spawn-time attachment** | the `spawn_agent` payload the main agent builds | NO — pre-loads discipline into a subagent | depends on the main agent routing through the builder |
| E6 | **Frontmatter visibility** | `allow_implicit_invocation:true` | NO — auto-renders a skill into context | every always-on skill costs context budget |
| E7 | **Skill/doc prose** | SKILL.md / structure SOT | NO — pure guidance | weakest; the default false-enforcement trap |
| E8 | **Out-of-band gate** | CI script / test (`npm test`, a drift gate) | YES at commit/CI time, not at runtime | catches drift after the fact, not during a turn |

Rule of thumb: **claim "enforced" only for E1, E2, and E8.** E3-E7 are "encouraged",
"pre-loaded", or "documented" — never "enforced". E8 enforces the repo, not the turn.

---

## What each tier is good for

### E1 — PreToolUse deny (the hardest runtime lever)
Already used twice: `^create_goal$` budget guard and `^request_user_input$`
interview-in-goal deny. Use E1 when an action must be *forbidden* under a condition you
can detect from tool name + input + `.codexclaw/` state. Fail-closed for security paths;
fail-open elsewhere so codexclaw never bricks Codex. This is the only tier that can stop
a specific action cold.

### E2 — Stop block (the only autonomous-continuation lever)
The loop's spine. Use E2 to refuse premature termination *while a real cycle is in
flight*. It cannot transition phases or read minds; it can only say "don't stop yet,
here's the next command". Must carry the stagnation cap + context-pressure bail so it
can never trap a session. Arming is the hard part (see L14 loop⇄goal handoff).

### E3 — PreToolUse input rewrite (the routing lever)
`PreToolUse` can *modify* the tool input before it runs. For `spawn_agent`, this is the
place codexclaw can repair an already-authored skill mention before dispatch. SHIPPED
(WP2): the `^spawn_agent$` hook (`spawn-attach-hook.ts`) normalizes known broken/bare
cxc mentions in the spawn `message` to link-form `[$cxc-*](skill://…)`, or to the
plugin-native `$codexclaw:cxc-*` fallback when the path is not link-safe. Message rewrite
is schema-safe on BOTH v1 and v2 (unlike `items`, which v2's `deny_unknown_fields`
rejects), but it never invents role baselines or inferred surface skills. Dispatchers
still name every required skill; the hook additionally applies v1 model routing and the
v2 leaf guard.

### E4 — UserPromptSubmit directive (the nudge)
Used by the pabcd-trigger hook to inject the phase directive. Strong, visible, but
model-autonomous. Good for "you are in phase B, here is the next command"; bad as a
claimed guarantee. When a directive names the skills to read, that raises routing
compliance but does not enforce a file read.

### E5 — Spawn-time attachment (subagent pre-load)
The main agent builds the `spawn_agent` payload; attaching a skill there pre-loads
discipline at subagent launch. Strength depends entirely on the main agent routing
through the builder (a doctrine contract, not a hook). Pair with E3 to make it
deterministic.

### E6 — Implicit visibility (always-on skills)
Flipping a skill to `allow_implicit_invocation:true` auto-renders it into every turn's
context. Strong for the highest-traffic skills, but each costs context budget, so it is
a deliberate trade, not a default. Since 2026-07-09 the implicit set is
`{dev, search, interview, pabcd, recall, loop, dev-frontend, dev-uiux-design}` (~30
tokens of metadata per skill); `dev` remains the only skill whose BODY carries always-on
discipline — the others are metadata rows that make on-demand loading discoverable.
`dev-frontend` and `dev-uiux-design` are the design-surface exception (anti-slop grammar
must reach every UI-generating session); every other `dev-*` router stays implicit-off.

### E7 — Prose (guidance only)
SKILL.md and SOT text. Necessary for nuance, useless as enforcement. Every "MUST" in
prose is still E7 unless an E1/E2/E3 branch backs it. The contradiction register exists
because E7 was repeatedly mislabeled as enforcement.

### E8 — Out-of-band gates (repo-level truth)
Tests and CI scripts. Cannot shape a live turn, but can refuse a commit/build. This is
where the cli-jaw `check-doc-drift.sh` / `verify-counts.sh` / `CAPABILITY_TRUTH_TABLE`
freshness gates live. Use E8 to mechanize the status-sync and forbidden-claims checks so
false-DONE cannot re-enter.

---

## Picking a tier per contradiction (mapping)

| Register cluster | Best available tier | Why |
| --- | --- | --- |
| A1/A2/A3 loop/Stop auto-advance claims | E2 (arm Stop) + E7 honesty downgrade | Stop can block, but cannot transition; prose must stop claiming transitions |
| A4 interview capture "planned" | E7 fix only | the runtime is shipped; the doc is just stale |
| A5 interview trigger breadth | E4 (widen `detectTrigger`) | more trigger tokens = more directive coverage |
| A6 dev routing collapse | E3 (`^spawn_agent$` input rewrite) + E6 (selective implicit) + E7->STRICT | E3 is the deterministic upgrade; E6/E7 are partial |
| B1-B7 status drift | E8 (status-sync gate) | only a commit/CI gate keeps four surfaces aligned |
| C1-C6 dead code | E5 wire-in OR delete | connect via the builder/hook, or remove and stop claiming a surface |
| C7/C9 count + test-script drift | E8 (count/verify gate) | mechanical, CI-checkable |
| C8 dist packaging | E8 (packaging test) | a build/pack test that asserts every loaded `dist/*.js` ships |

---

## Hard limits (do not propose these)

- No hook fires on **skill load** or **reference-file read** — file-read enforcement is
  impossible; the closest lever is E3/E5 pre-loading.
- No hook can append a **visible assistant-output footer** — status footers are an E4
  model-instruction at best, or upstream Codex UI work.
- The spawn tool IS interceptable — VERIFIED: the runtime canonicalizes
  the collab spawn tool to tool_name `spawn_agent` on BOTH surfaces (v1 namespaced,
  v2 flat — registry.rs:727), and the
  shipped `^spawn_agent$` PreToolUse hook (spawn-attach) rewrites its input. The former
  "cannot intercept" claim here was stale; what remains impossible is forcing a spawn
  to HAPPEN (no hook can initiate a tool call).
- codexclaw stays **read-only on the goal DB** — goal creation is always the main
  session's `create_goal`, never a codexclaw write (E1 can deny, never author).
