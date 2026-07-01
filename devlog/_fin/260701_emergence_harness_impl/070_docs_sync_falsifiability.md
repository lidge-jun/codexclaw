# 070 — Docs + Visual Sync + Falsifiability

Status: DONE (docs + E8 drift test shipped) · 2026-07-01 · emergence_harness_impl WP 070 · class C2 (docs + test gate) · E8 (drift gate)

> Design source: all of `../260701_emergence_harness/`; `003` (falsifiability). This is the closing
> decade: reconcile the layered model into one SOT, keep the HTML in sync, and lock the honest
> validation rule so the divergence layer is provable, not asserted.

## Why

The model now spans 000-007 + `emergence_gap.html` across several layers (`006` mode-axis, `007`
collapse-axis). Two axes describing one mechanism invites drift. And without a falsifiability rule,
"the divergence layer works" is an unfalsifiable claim — exactly the epistemic failure the whole
track exists to fix. This decade reconciles the SOT and fixes how the layer is validated.

## Ground Truth (read before edit)

- `006` (plateau mode-axis) + `007` (collapse-point axis) — the two layers to reconcile.
- `emergence_gap.html` sections 07-10 — the visual to keep in sync.
- `structure/50_emergence_gap.md` — the train/validation/holdout split discipline.
- Decade 045 harness + decade 050 race — what the ablation is run against.

## Reconciled SOT (006 + 007)

`006` and `007` are not rival doctrines. They are two axes:

1. **Mode axis (006):** normal execution is single-strategy convergence; divergence is a
   PABCD-layer mode. HITL PABCD may enter it deliberately during I/P when intent is open,
   algorithmic direction is uncertain, the objective is maximize/deceptive, or the user asks for
   comparison. Goal mode adds the automatic plateau Stop prompt when true-objective metrics stall.
   Up-front late divergence is the narrow exception: maximize-metric objective, local proxy is not
   the true objective, and no clear architecture winner exists.
2. **Collapse-point axis (007):** I records N>=2 approaches as anti-anchoring evidence, but that is
   NOT automatically a user question and NOT automatically N worktrees. With clear user intent, the
   agent records `strong-1 + add-1` and converges silently. With open intent, conflicting success
   criteria, or unseparated C/D evidence, the agent may ask.
3. **Early collapse:** satisfy-spec/build work records N>=2 cheaply and collapses at P by paper
   judgment, subagent critic compare, and repo/ecosystem convention research. A/B/C/D then execute
   one selected strategy.
4. **Late collapse:** maximize-metric/unclear work keeps N plans through A/B/C, builds candidates in
   isolated worktrees, runs the same harness, and races at D by fixed-seed true metric.
5. **Grounding:** candidates are not memory guesses. `strong-1` should be Tier 2 proven via
   `cxc-search`; `add-1` is at least Tier 1 discovered and must be promoted before concrete claims.
6. **Honesty:** only the goal-mode plateau Stop block is the shipped E2 lever. HITL divergence
   entry is valid but manual/agent-selected. Archives, cxc-search grounding, worktree fan-out,
   collapse-point choice, and human selection are agent-executed doctrine/evidence.

## Falsifiability Rule

Validate the divergence layer by OLD-vs-NEW ablation on a PREDEFINED seed/fold set:

- train/validation/holdout split; holdout stays UNTOUCHED during tuning.
- baseline and candidate run on IDENTICAL seeds/folds so the delta is attributable.
- judge by median + worst-10% + variance, not mean.
- require a noise/effect-size threshold before claiming improvement.
- official NYPC re-submission is external smoke, never causal proof.

Cheap-screen is allowed but not required by codexclaw. It is phase evidence when N>2 or builds are
expensive; it must not prune candidates unless the screen uses the same faithful `evaluate.sh`
contract and cannot become a second deceptive proxy.

## Invariants

- One reconciled SOT; the HTML never contradicts the markdown.
- N>=2 recording is separate from asking the user or building N worktrees.
- Satisfy-spec work collapses early at P; maximize/unclear work may collapse late at D.
- Candidate generation is grounded by `cxc-search`, not memory.
- Holdout fold untouched during tuning (else the fixture becomes the overfit target).
- median + worst-10% + variance, not mean (mean hides the deceptive-proxy tail).
- Remote NYPC score = external smoke, never causal proof of the layer.
- E2/E7 honesty: only the goal-mode plateau Stop branch is the shipped runtime lever; HITL
  divergence entry is doctrine + evidence, not a hidden hook.

## Acceptance

| Check | Evidence |
|-------|----------|
| Single SOT | 006+007 folded into collapse-point + mode-axis wording above |
| HTML in sync | sections 07-10 match the reconciled text |
| Falsifiability fixed | train/val/holdout + median/worst-10%/variance rule recorded |
| Drift gate | `emergence-doc-sync.test.mjs` asserts docs/skills/HTML invariants |

## Verification

- HTML tag-balance check + `git diff --cached --check` (whitespace) after any HTML edit.
- `node --test --test-concurrency=1 plugins/codexclaw/test/emergence-doc-sync.test.mjs`
- `npm run build`; targeted runtime/doc tests; `npm run gate` if the surrounding worktree allows it.

## PABCD evidence

- P: scoped WP3 to `000_INDEX`, this 070 doc, `emergence_gap.html`, and one E8 doc-sync test.
- A: Descartes read-only audit found the required nuances: N>=2 recording vs user question,
  collapse-point split, plateau trigger, cxc-search grounding, harness-first, falsifiability, and
  E2/E7 honesty.
- B: docs + visual sync + drift test.
- C: fresh verification.
- D: commit `docs(emergence-070): reconcile SOT + falsifiability rule`, `goal update`.

## Depends on / feeds

Depends on ALL prior decades (it reconciles them). Feeds nothing in-track — this closes the loop;
the next cycle is the first IMPLEMENTATION loop, starting at decade 010.
