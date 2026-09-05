# Check phase

4. **C — Check**: Run the relevant real verification at the dev §3 work-class floor, plus adversarial review. Runnable source changes use the applicable build/typecheck/tests; docs-only changes use document/contract checks and semantic review, not unrelated product suites. Capture fresh output as evidence. Do not claim pass without artifact-level proof. When the unit changed a user-facing surface (web/TUI/CLI/API), C also closes with a `cxc-qa` evidence matrix — real invocations, adversarial classes, teardown receipts (E7 discipline; see `../../qa/SKILL.md`).

   **SoT sync (DEFAULT, SOT-SYNC-01):** locate the repo's general source-of-truth
   docs (architecture/INDEX docs, or equivalent) — found in P, patched HERE so SoT
   and code never diverge silently; if the repo has none, recommend creating one
   (dev-scaffolding §2.1) in the D summary.

   **DEFAULT (C-RENDER-GROUNDING-01):** When the work-phase produces a render artifact
   (HTML, SVG, layout-defining CSS, canvas/animation/chart JS, .jsx/.tsx layout
   components) whose correctness only shows when run or rendered, C MUST include a
   render-grounding loop before C->D: (1) **RUN** it in its natural execution
   environment -- headless-browser screenshot for web, SVG->PNG render, execute scripts,
   drive stateful artifacts until the first interactive state change; (2) **OBSERVE** the
   output -- actually read the screenshot/console back; a produced-but-unread screenshot
   is not observation; (3) **FIX** what the observation reveals, then re-run and
   re-observe. Trigger on artifact type + change ("could this look or behave wrong in a
   way that only shows when it runs?"), never on task depth alone. Stop after ONE clean
   observation; re-render only after a change. Well-formed (tsc/lint/parse passing) is
   not correct -- static gates do not satisfy this rule. Defaults (HEURISTIC -- deviate
   with a stated reason): 1280x720 viewport; stateful artifacts driven until the first
   interactive state change. Evidence scales with class: C2-C3 record the observation in
   the attestation narrative; C4 (STRICT) additionally persists the screenshot to the
   devlog. The render observation is valid `checkOutput` evidence for C->D and the `did`
   must reference it. Excluded: pure logic/config/prose covered by its own test suite.
   (Adopted 2026-07-05 from fablize verification-grounding; devlog
   `260705_pabcd_render_grounding`.)

   **DEFAULT (C-ACTIVATION-GROUNDING-01):** The conditional-path sibling of render
   grounding. When the work-phase adds or changes a code path that only runs under a
   trigger condition absent from the default/happy path — error handlers, fallbacks,
   retries, caches, guards, feature-gated branches, mode switches, migration/upgrade
   handlers, "from turn/size/load X" behaviors — C MUST include activation evidence
   before C->D: (1) **TRIGGER** the condition for real (a test or scenario that drives
   it, a fixture that crosses the threshold, a fault injection); (2) **OBSERVE** the
   new path execute with its intended effect (a hit test assertion, log/debug line,
   counter, or trace — read back, not just produced); (3) **FIX** and re-trigger if the
   observation contradicts intent. "All tests green" does not satisfy this rule when no
   test drives the trigger; a branch nobody can show firing is unverified regardless of
   suite status. Two loud signals that mandate this check retroactively: a change whose
   observable output is byte-identical to the baseline everywhere (presume the path is
   dead, instrument before concluding "no effect"), and a D-summary claim of
   "handled/defended/falls back" with no fired-path artifact behind it. The activation
   observation is valid `checkOutput` evidence for C->D and the `did` must reference
   it. Excluded: unconditional straight-line changes fully exercised by existing
   coverage. P names the activation scenario for each such path when planning it, and
   the A reviewer checks that every planned conditional path has one (see phase P/A).
   For score-optimization loops the specialized forms LOOP-MECHANISM-PROOF-01 /
   LOOP-RESIDUAL-TRACE-01 apply on top. (Grounded 2026-07-06: a contest bot's endgame
   branch shipped inside a passing combo while structurally unreachable — its solo
   ablation was baseline-exact and no gate asked "did it fire?"; devlog
   `260706_loop_mechanism_research`.)
