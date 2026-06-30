# L14-L19 / 141 — Contradiction Patch Plan (decomposed)

Status: PLANNED (decomposition; NO code change this pass) · 2026-06-30 · mvp_hard

> Decomposes the `30_contradiction_register.md` findings into per-loop work-phases
> L14-L19, each a full PABCD cycle (`I/P->A->B->C->D --attest`). The diagnosis lives in
> `140_L14_loop_goal_routing_followup.md`; the enforcement-tier vocabulary (E1-E8) lives
> in `structure/40_enforcement_methods.md`. DONE = shipped + tested (two-axis status).
>
> Sequencing principle: ship the honesty fixes (cheap, prose/E7) and the deterministic
> levers (E1/E2/E3) before the soft ones. The user instruction stands: surface these as
> Interview (I) questions before implementing — this doc is the interview input, not a
> license to code.

## Loop map

| Loop | Decade | Scope | Register rows | Strongest tier | Depends on |
| --- | --- | --- | --- | --- | --- |
| L14 | 140/142 | loop⇄goal arming + Stop honesty | A1, A2, A3, C5 | E2 + E7 | — |
| L15 | 150 | subagent skill-routing attachment | A6, C1 | E3 + E5 | L14 (shared spawn surface) |
| L16 | 160 | dev routing STRICT + selective implicit | A6 (main-agent side) | E6 + E7 | L15 (same routing map) |
| L17 | 170 | interview runtime honesty + trigger breadth | A4, A5, C2, C3, C4 | E4 + E7 | — |
| L18 | 180 | status-sync + forbidden-claims gate | B1-B7, C7, C9 | E8 | — |
| L19 | 190 | dist packaging contract + test | C8 | E8 | — |

---

## L14 / 142 — Loop⇄goal arming + Stop-continuation honesty

Register: A1, A2, A3, C5 (`GOAL_ACTIVATION_DIRECTIVE` dead).

Problem: `loop`/`goalplan` skills claim Stop re-enters `P` and auto-advances `I->P`;
`handleStop` does neither. The loop never arms because nothing sets a goal, and the one
bridge (`GOAL_ACTIVATION_DIRECTIVE`) is test-only.

Work-phases:
1. L14.1 — Honesty pass (E7): rewrite `loop/SKILL.md` + `goalplan/SKILL.md` so they stop
   claiming phase transitions the hook does not perform. State plainly: Stop can BLOCK
   termination, not TRANSITION phase; the agent advances via `cxc orchestrate`.
2. L14.2 — Goal arming bridge (E2 + main-session create_goal): wire
   `GOAL_ACTIVATION_DIRECTIVE` into a real emit path so invoking the loop instructs the
   MAIN session to call `create_goal` (objective-only). codexclaw stays read-only on the
   DB. Reverse path: a goal-active branch that sets `orchestrationActive` so "set a goal
   -> loop runs" holds.
3. L14.3 — Stagnation/honesty test: prove the Stop block arms only with an active goal +
   in-flight cycle, and that the prose matches the branch.

DONE when: skills no longer over-claim; loop arms on goal set; `GOAL_ACTIVATION_DIRECTIVE`
has a production caller; tests green.

Open question for Interview: should native `/goal` set auto-arm `orchestrationActive`, or
require an explicit `cxc orchestrate P`? (reverse-path ambiguity)

---

## L15 / 150 — Subagent skill-routing attachment

Register: A6 (subagent side), C1 (`spawn-wrapper` dead).

Problem: routing lives as prose in role TOMLs; `spawn-wrapper.ts` builds a payload with
no production caller and no skill-attachment channel.

Work-phases:
1. L15.1 — `SpawnPayload.items` + skill-attachment builder (per `structure/10`): add the
   `items` channel and a role/surface -> skill map; tests prove attachment shape.
2. L15.2 — `^spawn_agent$` PreToolUse input-rewrite (E3) IF the Codex runtime exposes a
   spawn-tool matcher: deterministically attach the mapped `cxc-*` skill to the dispatch.
   VERIFY the matcher exists before claiming it; if not, fall back to E5 doctrine.
3. L15.3 — Dispatch-through-builder doctrine (E5/E7) in `cxc-dev` + subagent README.

DONE when: a dispatched subagent launches with the matching skill attached, verified by a
real spawn payload (not prose); `spawn-wrapper` has a production path.

Open question for Interview: does a `PreToolUse` matcher on `spawn_agent` / 
`multi_agent_v1__spawn_agent` actually exist in this Codex build? (decides E3 vs E5)

---

## L16 / 160 — dev routing STRICT + selective implicit visibility

Register: A6 (main-agent side).

Problem: the `dev` routing table is weak prose; only `cxc-dev` is implicit-visible, so
strong `MUST USE` triggers on `dev-*` siblings never render into context.

Work-phases:
1. L16.1 — STRICT routing table (E7->STRICT): rewrite `dev/SKILL.md` mappings to
   "MUST read the matching `dev-*` SKILL.md before writing in that surface", unambiguous
   per surface.
2. L16.2 — Selective implicit promotion (E6): decide which (if any) highest-traffic
   surface skills flip to `allow_implicit_invocation:true`, weighed against context cost.
3. L16.3 — `$cxc-dev` directive enumerates surface skills (E4): the injected phase/dev
   directive names exact skills to pull.

DONE when: a single `dev` read names the exact skills; chosen implicit set documented with
its context-budget tradeoff; tests/doc-checks green.

Open question for Interview: how many always-on dev skills are worth the context budget?

---

## L17 / 170 — Interview runtime honesty + trigger breadth

Register: A4 (capture "planned" but shipped), A5 (trigger too narrow), C2/C3/C4
(`minds`/`triage`/`rescan-coordinator` test-only).

Work-phases:
1. L17.1 — Honesty pass (E7): `interview/SKILL.md` stops calling PostToolUse capture
   "planned"; it is shipped (`handlePostToolUse`).
2. L17.2 — Trigger breadth (E4): widen `detectTrigger` I-branch beyond
   `interview|인터뷰|orchestrate i` to the documented variations, OR narrow the doc to
   match the code — pick one and make them agree.
3. L17.3 — Wire or retire (E5/delete): decide whether `minds`/`triage`/`rescan-coordinator`
   get a production caller (interview rescan dispatch) or are removed; no test-only
   "surfaces" left claiming to be live.

DONE when: interview docs match shipped runtime; trigger doc == trigger code; each helper
is either wired or gone.

Open question for Interview: keep the 5-mind/triage engine and wire it, or delete it?

**RESOLVED 2026-06-30 (DONE — shipped+tested, 335/335):**
- L17.1 (A4): `interview/SKILL.md` now has a "Runtime Status (shipped)" section; PostToolUse
  capture is no longer "planned".
- L17.2 (A5): chose doc-fix over widening `detectTrigger` (Carson MED-risk on broad regex).
  `pabcd/SKILL.md` Interview Trigger now splits narrow hook auto-trigger from broad agent judgment.
- L17.3 (C2/C3/C4): KEEP + WIRE. `hook.ts` imports `MIND_DISPATCH_DIRECTIVE`; `interviewDirective()`
  emits it into the live I directive (C2 RESOLVED). `triage`/`rescan-coordinator` are documented as
  directive-reachable helpers (the agent triages/decides proceed-vs-interview when acting on the
  Mind-dispatch contract) — NOT hook-wired by design, since goal-active suppresses Interview so a
  Stop-time rescan would contradict the firewall (C3/C4 DOCUMENTED).
- Carson A-gate HIGH blocker fixed FIRST: passive I re-injection (modes 2/3) now also checks the
  goal firewall (`hook.ts:261`), not just the explicit trigger path.

---

## L18 / 180 — Status-sync + forbidden-claims gate (E8)

Register: B1-B7 (status drift), C7 (hook count), C9 (test-script asymmetry).

Work-phases:
1. L18.1 — Status-sync gate: a script that diffs each `mvp_hard` ledger row against the
   loop doc header + `structure/` SOT + README + roadmap; fails on divergence.
2. L18.2 — Forbidden-claims scan: flag any "hook enforces/automatically/Stop drives"
   sentence in SKILL.md lacking a backing E1/E2/E3 branch (cli-jaw claim-audit analogue).
3. L18.3 — Count/verify gate: assert manifest hook count == doc count; every component
   test dir has a package-local `test` script or is intentionally root-only.

DONE when: `npm test` (or a `gate:*` script) fails on status drift, false-enforcement
prose, or count mismatch; current drift rows resolved.

---

## L19 / 190 — dist packaging contract (E8)

Register: C8.

Problem: `.gitignore` ignores `dist/` but only a subset is tracked; some runtime
`dist/*.js` that `bin`/hooks load are untracked, so install relies on a local build.

Work-phases:
1. L19.1 — Decide topology: track all runtime `dist/`, OR add a build step to the install
   path, OR an `.npmignore`/allowlist so the package ships runtime `dist/`.
2. L19.2 — Packaging test: assert every `dist/*.js` referenced by `bin/codexclaw.mjs` and
   the hook JSONs exists in the shipped artifact.

DONE when: a fresh install/pack produces a runnable plugin without a manual build; test
guards it.

Open question for Interview: track `dist/` in git, or build-on-install?

---

## INDEX ledger rows to add (after Interview confirms)

| L15 | 150 | subagent skill-routing attachment (`SpawnPayload.items` + E3/E5) | DONE | DONE |
| L16 | 160 | dev routing STRICT + selective implicit | DONE | DONE |
| L17 | 170 | interview runtime honesty + trigger breadth + helper wire/retire | DONE | DONE |
| L18 | 180 | status-sync + forbidden-claims + count gates (E8) | DONE | DONE |
| L19 | 190 | dist packaging contract + test (E8) | DONE | DONE |
