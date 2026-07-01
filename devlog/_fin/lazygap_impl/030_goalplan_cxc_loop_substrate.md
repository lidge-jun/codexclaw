# 030 — Goalplan / cxc-loop Substrate (runtime impl scaffold)

Status: DONE (shipped + tested) · 2026-07-01 · lazygap_impl loop 030 · class C3 (state/runtime)

> Source gap: `../lazygap/001` (durable loop/goalplan/quality-gate state) + its cxc-loop
> integration section. A-gate (Boyle, gpt-5.4) verified the design against shipped code and
> returned BLOCKERS that are CONSTRAINTS this doc must state — 030 is PROPOSED runtime work,
> NOT a description of shipped behavior. Every "today" claim below is the shipped baseline; every
> "030 adds" line is new.
>
> This is the substrate decade: `040` (work-aware Stop) and `080` (friction/seed) build on the
> `.codexclaw/goalplans/<slug>/` artifact and ledger this doc defines.

## Why

`$cxc-loop` is a prose contract (E7) today: "work-phase = one PABCD cycle, D closes to IDLE, the
agent self-advances." Nothing durable records WHAT the work-phases are, which criteria gate
completion, or what evidence each produced. omo's loop is a durable plan with per-criterion
evidence + a real quality gate; codexclaw's is a single FSM plus prose
(`../lazygap/001` parity table). 030 gives the prose a backbone so `040` can make Stop
work-aware and the dead `freeze.ts` acceptance-criteria slot reaches a live runtime.

## Ground Truth (read before edit — shipped baseline)

- Freeze manifest shape: `freeze.ts:37` `FreezeManifest { frozenAt, planFiles[{path,sha256}],
  planHash, objective, slug, evidenceBundle }`; `freeze.ts:29` `EvidenceBundle { dimensions,
  openAssumptions, contradictions, acceptanceCriteria, researchReportRef }`. There is NO
  workPhase/task structure anywhere — goalplan invents that decomposition.
- Shipped freeze runtime seeds `acceptanceCriteria` as `[]` today: `freeze-cli.ts:70`. The slot
  exists but is not populated. So "seed criteria from the evidence bundle" needs a population
  sub-pass (030.1), it is not free.
- Freeze handoff ordering (safe): freeze first, then `get_goal`, then `create_goal` — `freeze.ts:123`,
  surfaced by `freeze-cli.ts:108`. The interview has ENDED before any goal is created.
- Interview firewall: suppression fires only when goal status is `active`/`unreadable`
  (`goal-active.ts:62,88`); `UserPromptSubmit` I-suppression at `hook.ts:254,278,345`;
  `request_user_input` hard-deny at `goal-gate.ts:99`. So arming a goal AFTER freeze does not
  retroactively break the interview that already ran.
- Goal write reachability: codexclaw has a READ-ONLY sqlite reader (`goal-active.ts:4,33,58`);
  there is NO shipped app-server / JSON-RPC client. The old `thread/search` wrapper was retired
  (`cxc-ops.test.ts:131`); `pabcd/SKILL.md:10` states "no external orchestrator server". The
  shipped goal-write path is the MAIN SESSION calling host tools `create_goal`/`get_goal`/
  `update_goal` — NOT codexclaw code. `Feature::Goals` is not directly detectable; availability
  is inferred from `goals_1.sqlite` presence/readability.
- `.codexclaw/` layout: `state.ts:51` (`STATE_DIR=.codexclaw`, `SESSIONS_SUBDIR=sessions`,
  `LEDGER_FILE=ledger.jsonl`, `INTERVIEWS_SUBDIR=interviews`); `freeze.ts:19`
  (`.codexclaw/interview/freeze.json`); `freeze-cli.ts:67` (`.codexclaw/plan/<slug>/`).
- Stop loop today is COARSE-state-only: `hook.ts` `handleStop` reads `orchestrationActive`,
  `phase`, goal-active, stagnation cap — it does NOT read any plan artifact (`hook.ts:423`).
- D-close persists no work-phase cursor: `cxc orchestrate D` closes atomically to `IDLE`
  (`orchestrate-cli.ts:177`, `loop/SKILL.md:13`); the next work-phase starts with a fresh `P`.
- Reset scopes: `reset.ts:4` — `--state` removes sessions+ledger+interviews, `--generated`
  removes `.codexclaw/interview/`. Neither knows about goalplan paths yet.

## Design (diff-level)

### Storage (slug-namespaced, matches shipped plan layout — NOT a singleton)

```
.codexclaw/goalplans/<slug>/goalplan.json      # the plan + current-work-phase cursor
.codexclaw/goalplans/<slug>/ledger.jsonl       # append-only goalplan events
```

`<slug>` reuses `deriveSlug(objective)` (`freeze.ts:60`) so a goalplan lines up 1:1 with the
freeze manifest's slug. This avoids the project-wide singleton Boyle flagged and matches
`.codexclaw/plan/<slug>/`.

### Schema (`.codexclaw/goalplans/<slug>/goalplan.json`)

```jsonc
{
  "objective": "string",            // mirrors freeze.objective (provenance, not a host write)
  "slug": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "activeWorkPhaseId": "wp-2",      // the durable cursor the FSM does NOT hold across D-close
  "workPhases": [
    {
      "id": "wp-1",
      "title": "string",
      "status": "pending|in_progress|done",
      "tasks": [ { "id": "t-1", "title": "string", "status": "pending|done" } ],
      "criteriaIds": ["c-1", "c-2"]
    }
  ],
  "criteria": [
    {
      "id": "c-1",
      "scenario": "string",          // seeded from EvidenceBundle.acceptanceCriteria (030.1)
      "expectedEvidence": "string",
      "capturedEvidence": "string|null",
      "status": "open|met"
    }
  ],
  "host": {                          // the loose, one-directional link to the host goal
    "armed": false,                  // true only after a freeze-boundary set succeeds
    "armedAt": "ISO8601|null",
    "source": "freeze|none"
  }
}
```

### Module (`components/pabcd-state/src/goalplan.ts`, direct `node:fs` — matches state.ts/freeze.ts)

Pure shaping + file IO, no fs-injection seam (consistent with `state.ts`, `interview-ledger.ts`):

```ts
export const GOALPLANS_SUBDIR = "goalplans";
export const GOALPLAN_FILE = "goalplan.json";
export const GOALPLAN_LEDGER_FILE = "ledger.jsonl";

export interface GoalplanCriterion {
  id: string; scenario: string; expectedEvidence: string;
  capturedEvidence: string | null; status: "open" | "met";
}
export interface GoalplanTask { id: string; title: string; status: "pending" | "done"; }
export interface GoalplanWorkPhase {
  id: string; title: string; status: "pending" | "in_progress" | "done";
  tasks: GoalplanTask[]; criteriaIds: string[];
}
export interface GoalplanHostLink { armed: boolean; armedAt: string | null; source: "freeze" | "none"; }
export interface Goalplan {
  objective: string; slug: string; createdAt: string; updatedAt: string;
  activeWorkPhaseId: string | null;
  workPhases: GoalplanWorkPhase[]; criteria: GoalplanCriterion[]; host: GoalplanHostLink;
}

export function goalplanDir(cwd: string, slug: string): string;          // .codexclaw/goalplans/<slug>
export function readGoalplan(cwd: string, slug: string): Goalplan | null; // null if absent/unreadable
export function writeGoalplan(cwd: string, plan: Goalplan): void;         // atomic tmp+rename, mkdir -p
export function appendGoalplanLedger(cwd: string, slug: string, e: GoalplanLedgerEntry): void;

// derived helpers consumed by 040 (work-aware Stop):
export function remainingWorkPhases(plan: Goalplan): GoalplanWorkPhase[]; // status !== "done"
export function nextOpenTask(plan: Goalplan): { wp: GoalplanWorkPhase; task: GoalplanTask } | null;
export function unmetCriteria(plan: Goalplan): GoalplanCriterion[];       // status === "open"
export function isGoalplanComplete(plan: Goalplan): boolean;              // no remaining WP + no unmet criteria
```

### Loose, one-directional coupling (LOCKED — the core invariant)

- host goal active  → the cxc-loop contract fires; `040`'s Stop ALSO reads goalplan to ENRICH the
  block reason with remaining work. The host-active guard is the ARMING condition, unchanged.
- goalplan present but NO host goal → the shipped Stop loop does NOT arm (it releases unless
  `getGoalActiveStatus===active`, `hook.ts:443`). So a goalplan alone does NOT drive Stop today.
  A goalplan can still be read by the `cxc goalplan` CLI / validate gate without any host goal —
  that is the pure-local-plan use, NOT autonomous Stop continuation. (Corrected per Kuhn A-gate:
  the earlier "goalplan alone arms Stop" claim contradicted shipped `handleStop`; arming stays
  host-active-gated. A goalplan-arms-loop model would be a separate future decision, not 040.)
- NEVER "goal active REQUIRES a goalplan" (goal can run without one); NEVER "goalplan REQUIRES a
  host goal" (a plan can exist for CLI/validate use). When both exist, the host record is the
  ARMING gate and goalplan is the CONTENT that enriches the block reason.

### Host goal write — freeze boundary ONLY (the gated exception)

- 030 does NOT add an app-server client. `thread/goal/set` is NOT reachable from shipped code,
  so the host-goal write stays the SHIPPED path: the MAIN SESSION calls the host `create_goal`
  tool at freeze handoff (`freeze.ts:123` ordering). 030's only addition is: at that same freeze
  boundary, seed `goalplan.json` from the freeze manifest (objective + slug + criteria) and set
  `host.armed=true, host.source="freeze"`.
- NO mid-loop self-arm. The whole guard stack (interview hard-deny, goal-budget) assumes "a goal
  means user-approved autonomy". Freeze is the one place approval already exists.
- A direct codexclaw `thread/goal/set` client is explicitly DEFERRED to a future loop (needs a
  new app-server client + `Feature::Goals` gating); 030 records it as out-of-scope, not done.

### Quality gate (E8) — `cxc goalplan validate`

A read-only CLI subcommand: load goalplan, assert every `criteria[].status === "met"` has a
non-empty `capturedEvidence`, and `isGoalplanComplete()` holds. Exit non-zero on any unmet
criterion or missing evidence. This is the artifact `040`'s Stop consults before allowing a
final D-close, and a gate hook can shell to it.

### Reset awareness

`reset.ts` gains a `--goalplans` scope (removes `.codexclaw/goalplans/`); `--state` does NOT
touch goalplans by default (a goalplan can outlive a session reset, like the freeze manifest).
The doc must state this explicitly so reset semantics stay predictable.

## Sub-passes

- 030.2 — `cxc goalplan` CLI surface (`init`/`show`/`validate`) over `goalplan.ts`; `init
  --objective "<text>"` is the no-interview local-loop entry (the path that does not go through
  freeze). This is the SHIPPABLE objective source for this cycle: `init` takes a real objective
  string directly (not a slug placeholder), so the goalplan substrate is usable WITHOUT freeze.
- 030.1 — DEFERRED (re-scoped per A-gate Volta). Seeding `EvidenceBundle.acceptanceCriteria` at
  freeze is NOT a "pure freeze-cli change": the `InterviewTracker` (`interview.ts:59`) has no
  criteria field and `freeze.objective` is itself `state.slug || sessionId` (`freeze-cli.ts:65`),
  a placeholder — NOT captured prose. So two of the three freeze-seed inputs (objective, criteria)
  are hollow today. Freeze→goalplan seeding requires a PRIOR "objective + criteria capture"
  sub-pass that adds those fields to the tracker/state. Until that lands, the freeze-seed path is
  out-of-scope; `cxc goalplan init --objective` is the supported entry. Tracked as a follow-up.
- 030.3 — slug provenance (PREREQUISITE for 040, flagged by Kuhn A-gate). `state.slug` defaults to
  `""` (`state.ts:62`) and is only rehydrated if already persisted (`state.ts:87`); no shipped
  `writeState` sets a non-empty slug before Stop time, and `freeze-cli.ts:65` falls back to
  `state.slug || sessionId`. 040's Stop cannot locate `.codexclaw/goalplans/<slug>/` without a
  reliable slug. 030.3 persists the slug into `state.json` at freeze/goalplan-init time (derive
  via `deriveSlug(objective)`), so Stop can resolve the goalplan dir. Until 030.3 lands, 040 must
  treat "no resolvable slug" exactly like "no goalplan" (fall back to coarse reason).

## A-gate findings folded (Volta, gpt-5.5)

- B1/B2 (blockers): freeze-seeding deferred — see 030.1 above. No real objective/criteria source
  exists in the tracker or `State` today; `cxc goalplan init --objective` is the cycle's real
  objective source instead.
- Reset (note 4): `--goalplans` requires extending the `ResetScope` union (`reset.ts:16`),
  `parseResetScope` (`reset.ts:76`), and the help string (`cli.ts:37`). `--state` already leaves
  `goalplans/` untouched; `--all` already removes it. Implemented accordingly.
- Line-drift corrections (note 8): `acceptanceCriteria:[]` is `freeze-cli.ts:74`; D-close is
  `orchestrate-cli.ts:183`; goal-gate hard-deny is `goal-gate.ts:108-113`.
- Confirmed clean (notes 5/6): no host-goal write path; Stop arming stays host-active-gated and
  unchanged. Substrate design verified contradiction-free against shipped code.

## Invariants

- No goal-DB write from codexclaw code; host goal is armed only by the main session at freeze.
- All goalplan state is project-local under `.codexclaw/goalplans/<slug>/`.
- `readGoalplan` returns `null` (never throws) on absent/unreadable — callers degrade, never trap.
- Coupling is one-directional and loose (see above); neither layer requires the other.
- goalplan is the durable work-phase cursor the FSM does not hold across D-close; it never
  mutates `state.json` phase.

## Acceptance

| Check | Evidence |
|-------|----------|
| Schema round-trips | write then read returns an equal `Goalplan` |
| Slug-namespaced, no collision | path is `.codexclaw/goalplans/<slug>/`, distinct from plan/interview dirs |
| Absent/unreadable → null | missing file or bad JSON → `readGoalplan` returns `null`, no throw |
| Derived helpers | `remainingWorkPhases`/`nextOpenTask`/`unmetCriteria`/`isGoalplanComplete` correct on fixtures |
| Freeze seeding | after 030.1, a freeze with criteria yields a goalplan whose `criteria[].scenario` match |
| validate gate | unmet criterion or empty capturedEvidence → non-zero exit; complete plan → exit 0 |
| Host link is provenance-only | no app-server call; `host.armed` flips only via the freeze-boundary seed |
| reset scope | `--goalplans` removes the dir; `--state` leaves it |

## Verification

- `node --test plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts`
- `npm run build` (idempotent; +1 compiled module) ; `npm test` (full suite green) ;
  `npm run gate` (exit 0) ; `git diff --check`.

## PABCD plan (one full cycle)

- P: this diff-level design; confirm the slug path + the freeze-seed boundary.
- A: gpt-5.4 explorer challenges — does goalplan duplicate any freeze field instead of
  referencing it? does the host-link stay provenance-only (no accidental write path)? does the
  doc correctly state that Stop arming stays host-active-gated (goalplan enriches, does not arm)?
- B: implement `goalplan.ts` + `cxc goalplan` CLI (030.2) + 030.1 freeze criteria seeding + tests.
- C: build idempotent + unit + gate; capture tails.
- D: close to IDLE, commit `feat(lazygap-030): goalplan/cxc-loop substrate`, `goal update`.

## Depends on / feeds

Feeds `040` (work-aware Stop reads `remainingWorkPhases`/`unmetCriteria`) and `080` (seed
ontology absorbs into the same plan artifact). Connects the dead `freeze.ts` acceptance-criteria
slot to a live runtime. Independent of `010`/`020` (dispatch spine) — different surface.
