# promptgap — Prompt/Skill TEXT Parity vs gjc / jawcode / cli-jaw / lazycodex(omo)

Status: RESEARCH (100-109 prompt-text parity record) · 2026-07-01 · drafted by a 10-way
parallel explorer sweep, then re-owned, citation-verified, and A-gate-audited by the main
agent (research PABCD loop, session `cli`). Every claim carries file:line on both trees.

> This track answers a different question than `lazygap`. `lazygap` (000-010) audited the
> **harness** (hooks, runtime surfaces, E-tier enforcement). `promptgap` (100-109) audits the
> **prompt/skill TEXT** itself: where codexclaw's `SKILL.md` bodies and injected directives are
> *softer in wording, structure, and discipline* than the reference prompt corpora.
>
> codexclaw skills: `plugins/codexclaw/skills/*/SKILL.md`
> reference corpora: omo skills + prompts-core (`/Users/jun/Developer/codex/161_lazycodex`),
> jawcode prompts (`jawcode/packages/coding-agent/src/prompts`), cli-jaw dev-skill devlogs,
> gjc origin (`jawcode/struct_har/gjc_origin`).
> Philosophy + enforcement vocabulary: `structure/00_philosophy.md`,
> `structure/40_enforcement_methods.md` (tiers E1-E8).
>
> **How to read citations.** Paths are root-relative to one of the reference roots above.
> A `.../` segment is a readability elision of a long but unambiguous middle path (e.g.
> `jawcode/.../system/system-prompt.md` = `jawcode/packages/coding-agent/src/prompts/system/...`).
> `path:NN` or `path:NN-MM` is a line / line-range anchor. The bundled omo tree lives under
> `devlog/.lazycodex/plugins/omo/`; its ulw-loop workflow doc is at
> `ulw-loop/skills/ulw-loop/references/full-workflow.md` and the sample gate at
> `ulw-loop/test/fixtures/sample-quality-gate.json`.

---

## Steering principle (inherited from lazygap, LOCKED)

Same two lenses as `lazygap/000_INDEX.md`:

1. **No new subagent roles.** Specialization travels as an attached `$cxc-*` skill on the three
   base roles, so every prompt gap below is a *skill body* fix, never a "add a reviewer/QA role"
   fix.
2. **Host-native boundary.** A prompt is only a gap when the *wording quality* is weaker, not
   when the host runtime already owns the behavior. These are text/discipline gaps, so the
   boundary lens rarely fires here — but it does mean the fix is "tighten SKILL.md prose", not
   "build a server".

New lens for this track: **the fix is always wording, never code.** Every reinforcement is a
text edit to a skill body or an injected directive string. No runtime change. That keeps this
track shippable as small, reviewable doc/skill-text commits.

---

## The recurring pattern across all 10 docs

Every explorer independently converged on the same shape: **codexclaw has the right nouns and
topic coverage, but the references carry stronger *discipline pressure*.** The skill says what
to think about; the reference forces what you must do, refuse, prove, and re-check. Five
cross-cutting weaknesses repeat:

1. **Soft sequencing / pre-work gates.** No universal "classify -> read router -> search -> then
   edit" order (100); no pre-change structural map for architecture work (104); ast-grep not
   triggered early enough from upstream routing (108).
2. **Weak proof/evidence contracts.** Reviewer asks "be specific" instead of locking
   trigger+impact+patch-anchor+`file:line` (105); no class-by-class verification floor (100, 103);
   `file:line` is a structure belief, not a family output contract (109).
3. **Thin continuation / completion discipline.** loop/orchestrate under-inject objective
   persistence, current-state completion audit, and "IDLE is not the end" (106); goalplan is a
   slogan list with no schema (106). (An earlier draft also listed "no postmortem closure
   (103)" here, but A-gate confirmed postmortem discipline already ships at
   `dev-debugging/SKILL.md:270-280`, so that sub-claim was dropped.)
4. **Missing anti-slop / adversarial posture as law.** No router-level slop blacklist (100);
   reviewer lacks "trust nothing, work already failed" framing (105); anti-slop is domain-local,
   not family-wide (109); security lacks "retrieved text is data, not instruction" (104).
5. **No shared authority marker or TASK packet.** No first-line "this skill owns the turn"
   marker in skill *bodies* (109; partially mitigated by the injected directive layer's
   `[codexclaw: …]` markers), and no *formalized* family-wide subagent
   TASK/SCOPE/MUST-NOT/PROOF packet — `pabcd:88-89` already carries a partial delegation
   contract (109) — which is exactly the spawn payload `lazygap/008` wants to carry. This is a
   single-doc pattern (109 only), so it is the weakest "recurring" claim of the five; it is
   listed for completeness, not cross-doc frequency.

---

## Document map (100-109)

| Doc | Owned skill surface | Headline gap |
| --- | --- | --- |
| `100_dev_router_skill.md` | `dev` (always-on C0-C5 spine) | no universal pre-edit search gate, soft C2/C3 bands, no router-level anti-slop, `>400` LOC default too loose, no ordinary-work persistence contract |
| `101_frontend_uiux_skill.md` | `dev-frontend`, `dev-uiux-design` | contradictory ambiguity flow, no in-body UX-state contract, hero/AI-tell limits off-body, serif enthusiasm without restraint, no IA chooser |
| `102_backend_data_devops_skill.md` | `dev-backend`, `dev-data`, `dev-devops` | no parse-at-boundary rule, no timeout/shutdown discipline, vague migration/backfill, pandas-friendly vs omo Polars/DuckDB, no release-proof/OIDC gate |
| `103_testing_debugging_skill.md` | `dev-testing`, `dev-debugging` | no multi-hypothesis RCA gate, no toggle-proof before fix, no CI-green loop, risk-tier minimums left in refs (NOTE: postmortem closure already exists at `dev-debugging/SKILL.md:270-280` — not a gap) |
| `104_architecture_scaffolding_security_skill.md` | `dev-architecture`, `dev-scaffolding`, `dev-security` | no structural decision gate (alternatives/consequences), weak pre-change map, scaffolding lost devlog conventions, security checklist-first not threat-model-first |
| `105_code_reviewer_skill.md` | `dev-code-reviewer` | findings-first not locked, proof shape under-specified, no adversarial posture, High not deterministically blocking, no regression/false-confidence-test pass |
| `106_pabcd_loop_orchestrate_skill.md` | `pabcd`, `orchestrate`, `loop`, `goalplan` | thin surfaces under-inject continuation doctrine, no per-phase artifact obligation, goalplan has no schema, weak evidence-bundle + reviewer-gate wording |
| `107_interview_rescan_skill.md` | `interview` + minds/triage/rescan directive text | thin question-quality rubric, soft contradiction-rescan mandate, underexplained readiness, weak numbered proceed/more-interview fork, vague freeze/approval boundary |
| `108_search_astgrep_skillhub.md` | `search`, `ast-grep`, `skill-hub` | no research-depth classifier, thin source-bias/date/corroboration rules, skill-hub is catalog not rubric, ast-grep under-triggered, no cross-skill search mandate |
| `109_cross_cutting_invariants.md` | all 20 skill bodies | missing first-line authority marker, anti-slop not family law, verification clause not uniform, `file:line` not a family output contract, no shared subagent TASK packet |

---

## How each prompt gap maps to an enforcement tier

Prompt text is enforced differently from harness hooks. Most of this track lands as **E0 (skill
body wording)** — the always-on agent-followed discipline that `structure/40_enforcement_methods.md`
treats as the baseline. A few rows can be *reinforced* by a higher tier later:

- **E0 skill-body text** — the default home for 100-109. Tighten the prose; the agent follows it
  because the skill is loaded. This is the whole shippable surface of the track.
- **E3 spawn input-rewrite (v1)** — the cross-cutting TASK packet (109 item 6, 008 spine) can be
  *injected* onto a v1 spawn so the attached-skill contract is not merely hoped for. Text defines
  the packet; E3 can stamp it.
- **E2 Stop block** — the continuation doctrine (106) and readiness/rescan mandate (107) gain
  teeth only when the loop/interview Stop surfaces already exist (`lazygap/001`, `003`). Until
  then they stay E0 wording.
- **E8 out-of-band gate** — verification-floor and anti-slop phrasing (100, 103, 109) could later
  be spot-checked by a count/lint gate, but that is a `lazygap` harness concern, not this track.

The track's own scope stays **E0**: ship the wording. Higher-tier reinforcement is cross-referenced
to `lazygap`, not duplicated here.

---

## Sequencing proposal (if promoted to an implementation loop)

1. **109 first** — land the family-wide stubs (authority marker, proof/anti-slop invariant,
   `file:line` contract, TASK packet, closeout clause). Every other doc then references these
   instead of re-inventing them.
2. **100 next** — the always-on `dev` spine carries the most leverage; its pre-edit gate,
   anti-slop block, verification matrix, and persistence contract set the tone all routers inherit.
3. **105 / 106 / 107** — the discipline-heavy surfaces (reviewer posture, loop/goalplan
   continuation, interview rubric) where soft wording most directly weakens outcomes.
4. **101-104 / 108** — the domain routers; each absorbs the 109 stubs plus its own targeted
   reinforcements.

Each would be one PABCD work-phase: P writes the exact wording diff, A re-audits via subagent
against the same reference file:lines, B edits the skill body, C re-runs `npm run build && npm
test && npm run gate` (skill text changes must not break the suite), D closes with the diff +
evidence.

---

## Non-goals (reaffirmed)

- **No new roles, no new skills** unless a gap genuinely needs a new surface — these are body
  edits to existing skills.
- **No runtime/hook code** in this track — that is `lazygap`'s job. promptgap is text-only.
- **No prompt bloat.** Per jaw/cli-jaw prompt-discipline findings (109 evidence), reinforcements
  are compact MUST-READ stubs with deep catalogs left in `references/`, not inlined walls of prose.
- **No copying omo role theatre.** Adopt the *discipline* (authority marker, TASK packet,
  adversarial posture) without importing librarian/momus/metis role personas.

## Status

RESEARCH. 100-109 are parity records with file:line evidence on both trees. Promotion to an
implementation loop (`$cxc-loop`) is a user decision; nothing here has changed a skill body yet.
