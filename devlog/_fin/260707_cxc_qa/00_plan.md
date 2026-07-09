# 260707 cxc-qa — manual QA gate skill (Codex-native)

Status: A-audited plan (4 blockers folded, see Audit synthesis)
Owner: Boss
Work class: C3 (new public skill surface + evidence contract; no new hooks)
Session: 019f352b-5a13-7c51-a970-29dd4f6cb971

## Loop-spec

- Archetype: spec-satisfaction (skill ships, examples verified, tests green).
- Verifier: `npm test` + grep gate on rule IDs + a live self-run of the skill
  against one real surface (this repo's own `cxc` CLI as the TUI/CLI case).
- Stop: skill + routing + doctrine sync landed, self-run evidence captured.
- Terminal outcomes: DONE / NEEDS_HUMAN (owner scope changes).
- Escalation: if the evidence contract collides with subagent-evidence.ts
  receipt shapes, return to P.

## Why (the gap)

`dev-testing` routes AUTOMATED verification (unit/contract/E2E/CI). What
codexclaw lacks is lazycodex's "manual QA" discipline: proving a built surface
actually works by DRIVING it — real invocations on real surfaces with captured
artifacts — before D. Today C-phase says "run real verification + adversarial
review" but gives no procedure for surface-level proof; a green test suite can
still ship a broken TUI border, a dead route, or a UI that only renders in the
developer's head. lazycodex closes this with three pieces we translate:

1. `visual-qa` — objective capture (image-diff / tui-check JSON) feeding two
   parallel read-only oracle passes, synthesized to PASS/REVISE/FAIL.
2. `review-work` — 5 parallel all-must-pass review lanes.
3. `lazycodex-qa-executor` — the manualQa matrix contract: surfaceEvidence /
   adversarialCases / artifactRefs; "Trust nothing"; every PASS points at a
   non-empty artifact.

## Source evidence (read 2026-07-07)

- `devlog/.lazycodex/plugins/omo/skills/visual-qa/SKILL.md` (253L)
- `devlog/.lazycodex/plugins/omo/skills/review-work/SKILL.md` (607L)
- `devlog/.lazycodex/plugins/omo/components/ultrawork/agents/lazycodex-qa-executor.toml`
- `devlog/.lazycodex/packages/web/content/docs/manual-qa.md`
- Existing codexclaw: `skills/dev-testing/SKILL.md` (automated-test router),
  `components/pabcd-state/src/subagent-evidence.ts` (worker receipt gate,
  `.codexclaw/evidence/`), doctrine DISPATCH-TASK-01/ACTOR-01/RETIRE-01.

## Translation decisions (philosophy-checked)

| lazycodex piece | cxc-qa translation | why |
| --- | --- | --- |
| `call_omo_agent`/`task` oracles | Codex-native `multi_agent_v1.spawn_agent` (explorer role, read-only), 2 parallel passes | already our dispatch surface |
| bundled bun `image-diff`/`tui-check` scripts | NOT vendored in v1. Web: Codex `view_image` + browser/playwright screenshot; TUI: `tmux capture-pane -p` + a plain `awk/wc` width check inline in the skill | no new runtime dep (bun), no vendored component; scripts are a v2 candidate if inline proves weak |
| `.omo/evidence/<goal>/` | `.codexclaw/evidence/<session>/qa/` | rides the EXISTING subagent-evidence receipt dir; worker receipt gate keeps working unchanged |
| 5-lane review-work orchestrator | NOT adopted as a separate skill. A-gate reviewer + C adversarial review + REVIEW-SYNTHESIS-01 already cover 4 lanes; cxc-qa IS the missing QA-executor lane | avoid duplicate review machinery; all-must-pass across 5 spawns is token-heavy for marginal gain |
| all-must-pass verdict | per-scenario verdict matrix; any FAIL blocks the C>D claim (E7 discipline, no hook) | owner rule: no new guards |
| WORKING:/BLOCKED: mailbox protocol | adopt as prose in the dispatch packet | matches DISPATCH-TASK-01 |

**Adversarial strictness (intentional translation choice, audit blocker 3):**
lazycodex-qa-executor rejects skipped/inferred/partial/not_applicable adversarial
cases outright; manual-qa.md allows N/A with a one-line ledger reason. cxc-qa
adopts the manual-qa.md position deliberately: `inferred`/`partial` verdicts are
FORBIDDEN (a case either ran against the real surface or it did not), genuine
inability to run a case is a FAIL with the named blocker, and N/A is legal ONLY
when the class structurally cannot apply to the surface (e.g. viewport class on
a headless API), always with a recorded reason. This is stricter than plain
skip-with-reason and softer than the executor TOML; named here so the lineage
is honest.

Rejected outright: `~/.codex/agents/` role installs (we inline role prompts —
B-opt2 pattern), background lane respawn budgets as hook logic (E7 prose only),
lazycodex marketplace/installer surfaces (N/A).

## Deliverable: `plugins/codexclaw/skills/qa/SKILL.md` (cxc-qa)

Frontmatter triggers: manual QA, QA this, does it actually work, visual QA,
screenshot, TUI alignment, smoke test, 수동 QA, 실제로 되는지, 동작 확인, plus
MUST-USE wording for "after building/changing any user-facing surface (web UI,
TUI, CLI, HTTP API) before claiming done".

Body sections (~150-200 lines, single-owner: procedure here, dispatch rules
stay in doctrine, automated testing stays in dev-testing):

1. **Scope split** — dev-testing owns automated gates; cxc-qa owns
   surface-driving proof. Both feed C; neither replaces the other.
2. **Surface detection + faithful channels** (from qa-executor): HTTP ->
   `curl -i`; CLI -> real invocation captured; TUI -> `tmux capture-pane -p`
   (+ `-e` ANSI copy) with a stated real width; web -> browser skill
   screenshot at a stated viewport, inspected with `view_image`.
3. **Evidence contract** — `.codexclaw/evidence/<session>/qa/<scenario-id>/`:
   `invocation.txt` (exact command), artifact (capture/screenshot/response),
   `verdict.json` ({scenario, criterion, surface, verdict, artifactRefs[]}).
   Every PASS points at a non-empty artifact (FAMILY-PROOF-01 alignment).
4. **Adversarial classes** — per scenario, probe at least: empty/absent input,
   malformed input, boundary size, concurrent/repeat invocation, and (web/TUI)
   narrow viewport + CJK text. Skips need a one-line N/A reason in the matrix.
5. **Dual-oracle option (C3+)** — for visual surfaces, dispatch 2 parallel
   read-only explorer passes (design/functional integrity vs visual/CJK
   fidelity), paste captures into prompts, synthesize PASS/REVISE/FAIL in the
   main session (REVIEW-SYNTHESIS-01 applies on FAIL). C2 work may run a
   single self-review pass instead — depth scales by class, like dev-pabcd.
6. **Teardown receipts** — every QA resource (server PIDs, ports, tmux
   sessions, temp dirs, browser tabs) gets a teardown line with proof
   (`lsof -i :PORT` empty / `tmux ls` clean). No QA asset left running.
7. **Honesty labels** — everything here is E7 discipline; the only E2 touchpoint
   is that worker-dispatched QA rides the existing SubagentStop receipt gate.

## File change map

1. NEW `plugins/codexclaw/skills/qa/SKILL.md` — the skill (above).
2. NEW `plugins/codexclaw/skills/qa/agents/openai.yaml` — display_name
   `cxc-qa`, `allow_implicit_invocation: false` (on-demand skill), required by
   manifest-policy.test.mjs:57 and doctor.ts:82.
3. `plugins/codexclaw/skills/skill-hub/references/catalog.md` — registry row
   (category: surface? no — capability; load_when: manual surface-driving QA
   after building/changing a user-facing surface; implicit false), required by
   manifest-policy.test.mjs:144.
4. `plugins/codexclaw/skills/dev/SKILL.md` — Capability Routing Hub sentence +
   **Skill Ownership Map row**: rule area "Manual surface QA / evidence
   matrix" -> canonical owner `cxc-qa`, stub locations `dev-testing` (§4.6
   keeps the native-tool routing: which browser/CU tool drives which surface;
   the PROCEDURE and evidence contract are cxc-qa's).
5. `plugins/codexclaw/skills/dev-testing/SKILL.md` — §4.6 gains a canonical
   pointer: exploratory-tier tool choice stays here; the QA procedure,
   evidence matrix, adversarial classes, and teardown receipts are owned by
   `cxc-qa` (stub, not duplicate). Resolves the single-ownership conflict
   (audit blocker 2).
6. `plugins/codexclaw/skills/pabcd/SKILL.md` — C-phase sentence: user-facing
   surface changes close C with a cxc-qa evidence matrix (E7).
7. `structure/INDEX.md` + `structure/10_subagent_skill_routing.md` — skill
   inventory row + QA dispatch note (oracle passes are explorer-role,
   read-only, DISPATCH-ACTOR-01 applies across revision rounds).
8. Devlog: this plan folder, numbered follow-on docs per phase.

OUT of scope: new hooks/guards (owner rule), vendored diff scripts (v2 note),
a review-work-style 5-lane orchestrator skill, changes to
subagent-evidence.ts, cli-jaw/jawcode ports (follow-on initiative sync).

## Accept criteria

- `rg 'cxc-qa'` hits: qa/SKILL.md, dev routing hub, dev-testing boundary line,
  pabcd C-phase, structure INDEX/10.
- Skill loads standalone: frontmatter parses, <500 lines, triggers include KO.
- Self-run evidence (audit blocker 4 — no theater): a real CLI-surface QA
  matrix against `cxc skill search`, exercising the happy path PLUS at least
  two adversarial classes (empty/absent input -> usage error captured;
  malformed flag/source -> error behavior captured), each scenario with
  invocation.txt + artifact + verdict.json under
  `.codexclaw/evidence/<session>/qa/`, plus a teardown line (stateless CLI ->
  explicit "no resources spawned" receipt with the checked evidence).
- `npm test` green including manifest-policy (new skill passes openai.yaml +
  catalog registration checks).
- No new "enforced" claims; every gate word labeled E7 except the existing
  SubagentStop receipt note.

## Resolved questions (owner continue-signal 2026-07-07)

1. Skill name `cxc-qa`, directory `skills/qa/` (matches cxc-dev convention).
2. Dual-oracle: C3+ only; C2 runs a single self-review pass.
3. Vendored diff scripts: deferred to a v2 note; no plan folder yet.

## Audit synthesis (REVIEW-SYNTHESIS-01, round 1)

Reviewer verdict: FAIL, 4 blockers. All ACCEPTED, none rebutted:

1. Registration incomplete (openai.yaml + catalog.md row) — root cause: file
   map drafted from skill-body needs, not the packaging test contract. Fixed
   in file map items 2-3.
2. Ownership conflict with dev-testing §4.6 (TEST-CU-QA-01 already binds
   exploratory QA evidence to C) — root cause: plan claimed a clean gap that
   was actually a partial overlap. Fixed: cxc-qa owns procedure/contract,
   §4.6 keeps tool routing as stub; ownership map row added (item 4-5).
3. Silent softening of executor strictness — accepted; now an explicit named
   translation choice (see Translation decisions).
4. Self-run criterion was theater — accepted; upgraded to a matrix with two
   adversarial classes + teardown receipt.

No cross-blocker conflicts; fixes are disjoint. Minor confirmations kept:
no subagent-evidence.ts collision (gate validates only the worker's
EVIDENCE_RECORDED marker path), naming convention ok, depth split consistent
with pabcd class table.
