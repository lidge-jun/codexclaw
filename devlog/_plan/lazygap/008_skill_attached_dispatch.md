# 008 — Skill-Attached Base-Role Dispatch (CORE ASK)

Gap class: HARNESS (routing) · evidence: explorer Plato + user steering

> This is the user's central request. omo specializes by inventing roles. codexclaw must
> specialize by **attaching `$cxc-*` skills to the three base roles** at dispatch time, so
> "act as a reviewer, red-team this per `cxc-dev` + `cxc-dev-frontend`" actually loads that
> discipline into the child.

## The principle (LOCKED)

- Roles stay three: `explorer`, `reviewer` (-> explorer), `executor` (-> worker).
- Expertise = an attached skill, not a new role TOML.
- Reject the sweep's "split into librarian/planner/gate-reviewer/qa-executor" suggestion
  for codexclaw — that is the omo way, not ours.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 (our way) |
| --- | --- | --- | --- |
| `ultraresearch/SKILL.md:12-20` + `~/.codex/agents/lazycodex-*.toml` (8 selectable roles) | `agents/README.md:7-13` + 3 role TOMLs | omo specializes via many roles | codexclaw specializes via skill attachment to 3 roles — do NOT add roles |
| omo role TOML carries the specialist prompt | `spawn-wrapper.ts` builds `{agent_type,message,model}` with no skill-attachment channel; no production caller (contradiction C1) | codexclaw can't attach a skill to a dispatch | add `SpawnPayload.items` (skill refs) per `structure/10_subagent_skill_routing.md`; route real dispatches through the builder |
| `ultraresearch/SKILL.md:22,34,38` (first-line marker, authority override, TASK imperative) | `search`/`agents` guardrails are prose, no marker/override | omo's dispatch contract is stronger | the attached skill IS the contract; the spawn message names the skill + a TASK line |

## Reinforcement shape

1. `SpawnPayload.items`: attach one or more `cxc-*` skills (name + abs path) plus the task.
2. A role+intent -> skill map: e.g. "red-team a frontend change" -> `reviewer` +
   [`cxc-dev`, `cxc-dev-frontend`, `cxc-dev-code-reviewer`]; "research X" -> `explorer` +
   [`cxc-search`] (+ ultraresearch protocol from `007`).
3. Deterministic attach via `^spawn_agent$` PreToolUse input-rewrite (E3) IF the runtime
   exposes that matcher; else the main agent routes through the builder by doctrine (E5).
4. Pair with `002`: a skill-attached reviewer must return an evidence receipt, so the
   red-team verdict is trustworthy, not just prose.

## Worked example (the user's sentence, made real)

"reviewer로 이 변경 `cxc-dev` + `cxc-dev-frontend` 기준 레드팀 검증해줘" becomes:

```
spawn_agent({
  agent_type: "explorer",          // reviewer maps to explorer (read-only)
  items: [
    { type: "skill", name: "cxc-dev",          path: ".../skills/dev/SKILL.md" },
    { type: "skill", name: "cxc-dev-frontend",  path: ".../skills/dev-frontend/SKILL.md" },
    { type: "text",  text: "TASK: red-team <diff>. Return findings + EVIDENCE_RECORDED: <path>." }
  ]
})
```

## Enforcement tier

E3 (spawn input-rewrite) if the matcher exists, else E5 (builder doctrine) + E1 receipt
gate from `002`. This is the L15 routing spine, now with the explicit no-new-roles rule.
