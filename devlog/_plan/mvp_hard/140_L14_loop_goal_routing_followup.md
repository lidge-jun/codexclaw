# L14 / 140 — Follow-up Patch Plan: Loop⇄Goal Activation + Skill Routing Enforcement

Status: PLANNED (root-cause documented; NO code change this pass) · 2026-06-30 · mvp_hard loop L14

> Captured at user request: "새 버그 원인 패치하지말고 후속 패치 계획으로 문서화 해놔."
> Three live defects were root-caused by parallel read-only explorers (Ohm/#1,
> Huygens/#2, Mendel/#3) with file:line evidence. This doc records the diagnosis
> and the intended fix shape ONLY. Implementation is a later loop.

## Scope

Three coupled defects in the loop / goal / skill-routing surface. They are grouped
because #1 and #2 share the same `handleStop` arming gate and the same
"documentation-only skill, no runtime wire" failure mode, and #3 is the routing
counterpart of the same model-autonomy-vs-enforcement gap.

## Defect 14.1 — `cxc-loop` does not actually drive PABCD, and reference-reading is not enforced

### Symptom
Invoking `$codexclaw:cxc-loop` (a) does not run a real PABCD cycle, and (b) the
agent reads referenced skills/reference files weakly.

### Root cause (verified)
- The loop skill body is pure prose contract. It contains no `cxc orchestrate
  P/A/B/C/D` directive and no `spawn_agent` instruction; the only FSM-advancing
  command strings live in `STOP_NEXT_COMMAND`
  (`plugins/codexclaw/components/pabcd-state/src/hook.ts:360`) and are emitted only
  by `buildStopBlock` (`hook.ts:373`).
- `detectTrigger` (`hook.ts:64`) recognizes `interview/orchestrate i`,
  `orchestrate p|plan this|계획`, `a|audit|감사`, `b|build|구현`, `c|check|검증` — but
  has NO token for `loop` / `cxc-loop` / `HOTL`. So invoking the loop skill matches
  no trigger, `orchestrationActive` stays false, and `handleStop` releases at
  `hook.ts:398`. PABCD never cycles.
- `cxc-loop` is `allow_implicit_invocation: false`
  (`plugins/codexclaw/skills/loop/agents/openai.yaml:5`), so it loads only on
  explicit mention — yet explicit mention produces no `detectTrigger` match, so
  loading it has zero FSM effect.
- Reference-reading is model-autonomous (progressive disclosure); no hook or loader
  compels it. The dev hub actively biases AGAINST reads
  (`plugins/codexclaw/skills/dev/SKILL.md:43`, `:483`). The loop skill names no
  reference files and gives no `read X` directive.

### Contradiction
`loop/SKILL.md:26` claims continuation is "enforced by the active Stop hook ... not
just this discipline doc," but the skill text is not what arms that hook; only an
active native goal + explicit P/A/B/C trigger does.

### Intended fix (later loop)
- Add a `loop`/`HOTL`/`cxc-loop` token to `detectTrigger` that turns on
  `orchestrationActive` and enters/`I`-or-`P` per the loop contract, OR make the
  loop skill body emit the concrete `cxc orchestrate <phase> --attest` ladder so
  invocation produces an executable directive, not just prose.
- Decide explicitly whether reference-reading for an armed loop should be nudged by
  an injected directive (e.g. the phase directive names the skills to read), since
  runtime enforcement of file reads is out of scope for hooks.

## Defect 14.2 — Loop never arms because nothing sets the goal (loop⇄goal handoff is dead)

### Symptom + user mental model
`cxc-loop` should SET a goal (loop creates a goal and drives autonomous PABCD), and
conversely setting a native `/goal` should drive the PABCD loop. Today cxc-loop sets
no goal, so the loop never arms.

### Root cause (verified)
- `handleStop` arming is an AND of two independent signals:
  `state.orchestrationActive && phase !== IDLE` (guard 2a, `hook.ts:398`) AND
  `getGoalActiveStatus(session_id) === "active"` (guard 2b, `hook.ts:400`).
- codexclaw reads the native goal DB READ-ONLY and has no write path:
  `goal-active.ts:51` opens `DatabaseSync(path, { readOnly: true })`; the only query
  is the `SELECT status` at `goal-active.ts:70`. No `INSERT/UPDATE` to `thread_goals`
  exists outside test fixtures.
- No skill owns goal creation. `loop/SKILL.md` never mentions `create_goal`/goal set.
  `goalplan/SKILL.md:21-30` explicitly declares codexclaw "does NOT own a goal store
  ... it does not create a new goal database."
- The one bridge that was meant to connect them is dead code:
  `GOAL_ACTIVATION_DIRECTIVE` (`freeze.ts:124`) is referenced only by
  `freeze.test.ts`; `runFreeze()` (`freeze-cli.ts:97`) does not emit it, and no
  `cli.ts`/`orchestrate-*` path references it. So freeze never surfaces the
  "call create_goal" handoff to the main session.

### Consequence
- `cxc-loop` invocation → no native goal set → guard 2b always releases.
- native `/goal` set alone → `orchestrationActive` still false → guard 2a releases.
- Either signal alone never arms the loop; the two are never wired to each other.

### Intended fix (later loop)
- Wire the `GOAL_ACTIVATION_DIRECTIVE` (or an equivalent) into a real emit path so a
  loop/freeze invocation instructs the main session to call `create_goal`
  (objective-only, unlimited per the existing budget guard). codexclaw stays
  read-only on the DB; the MAIN SESSION creates the goal — preserve that boundary.
- Define the reverse path: when a native goal is active and the user starts work,
  decide whether `orchestrationActive` should auto-arm (e.g. a goal-active branch in
  the trigger path) so "set a goal → PABCD loop runs" holds without a separate
  orchestrate trigger.
- Reconcile `loop/SKILL.md` and `goalplan/SKILL.md` so goal-creation ownership is
  stated in exactly one place and matches the runtime wire.

## Defect 14.3 — `dev` routing is too narrow: sibling dev-* skills are not consulted

### Symptom
After reading `cxc-dev`, surface-appropriate dev-* skills (dev-frontend,
dev-uiux-design, dev-backend, dev-testing, dev-architecture, ...) are not consulted;
routing collapses to dev alone.

### Root cause (verified)
- Routing is model-autonomous prose. The Companion Skills table
  (`dev/SKILL.md:117`, mappings `:123-135`) is introduced by weak wording
  (`:119-120` "also read the matching router skill's SKILL.md before writing code";
  `:161` "read each relevant skill file") — not `MUST`/STRICT, unlike other dev
  sections that do use `MUST`.
- Only `dev` is implicit-visible: `dev/agents/openai.yaml:5`
  `allow_implicit_invocation: true`; all 12 dev-* siblings are `false`
  (e.g. `dev-frontend/agents/openai.yaml:5`). skill-hub fixes this by design
  (`skill-hub/SKILL.md:30,32-33`; `references/catalog.md:10,16-26`).
- No runtime enforcement: the 6 hooks match only `create_goal`,
  `request_user_input`, pabcd-trigger, stop, provider-bridge — none intercept skill
  loading or surface routing (`skill-hub/SKILL.md:11-13,49` "No runtime hub engine
  or dynamic loader lives here; this is documentation").
- Asymmetry: each dev-* frontmatter carries a strong `"MUST USE for any <surface>"`
  trigger (`dev-frontend:3`), but because it is implicit-off it is not auto-rendered
  into context — strong enforcement text sits where it is not visible, while the
  visible dev routing table is weak.

### Intended fix (later loop)
- Strengthen the dev routing table wording from prose to STRICT
  (`MUST read the matching dev-* SKILL.md before writing code in that surface`), and
  make the per-surface mapping unambiguous enough that a single read of dev names the
  exact skills to pull.
- Consider whether the highest-traffic surface skills should be promoted to
  implicit-visible, or whether a `$cxc-dev` directive should explicitly enumerate the
  surface skills to load, trading a larger always-on set against routing reliability.

## Cross-cutting follow-up requested by the user

After the active goal/work finishes, re-run the subagent exploration, return to the
Interview (`I`) phase, and surface these contradictions to the user as questions
before any implementation — the fixes above must NOT be applied until that Interview
round confirms direction. (User: "goal 끝내고 다시 서브에이전트 탐색돌리고 i로 돌아가서
나한테 모순점들 질문".)

## Out of scope for this pass

- No code change, no skill-text change, no hook change. This is a diagnosis +
  intended-fix record only.
- The Interview round that turns these into user-facing questions is a separate,
  later step (post current goal), per the user instruction above.

## Evidence provenance

Three parallel read-only explorers, each restricted to "root cause + file:line, no
fix, contradictions only":
- #1 (Ohm): defect 14.1 — loop skill prose-only + `detectTrigger` has no loop token.
- #2 (Huygens): defect 14.2 — read-only goal DB, dead `GOAL_ACTIVATION_DIRECTIVE`,
  AND-gate asymmetry.
- #3 (Mendel): defect 14.3 — model-autonomous routing, dev-only implicit visibility,
  enforcement/visibility asymmetry.
