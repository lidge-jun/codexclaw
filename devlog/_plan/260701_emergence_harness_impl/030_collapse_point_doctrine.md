# 030 — Divergence-Mode + Collapse-Point Doctrine

Status: PLANNED (no code yet) · 2026-07-01 · emergence_harness_impl WP 030 · class C2 (skill doctrine + state) · E7 + persisted state

> Design source: `../260701_emergence_harness/004`, `006`, `007` (collapse-point model). This
> decade encodes the runtime-facing rule the agent follows; it CONSUMES decade-020's E2 signal
> but adds no lever of its own.

## Why

The divergence flow + collapse-point model live only in this devlog; no skill encodes them, so
the agent has no runtime-facing rule. The core decision (from `007`): the collapse point is a
VARIABLE. satisfy-spec -> converge EARLY at P (a subagent critic + convention research pick the
winner before build). maximize-unclear -> converge LATE (A-B-C built in parallel, raced at D).
Without doctrine, the agent defaults to PABCD's single-track convergence and the metric lever
from 020 has nothing telling it what to do when it fires.

## Ground Truth (read before edit)

- `cxc-loop` skill: `plugins/codexclaw/skills/loop/SKILL.md` (the loop doctrine to extend).
- `pabcd` skill: `plugins/codexclaw/skills/pabcd/SKILL.md` (phase semantics).
- Honesty rule: `50_emergence_gap.md` — skill text must match shipped Stop behavior (no over-claim).
- 020's diverge directive is the runtime trigger this doctrine reacts to.

## Design (diff-level)

1. 030.1 — add the collapse-point doctrine to `cxc-loop` / `pabcd` SKILL.md:
   - I records N>=2 (strong-1 + add-1) when intent is open; converges silently when intent is clear.
   - EARLY collapse at P for satisfy-spec (locally checkable -> pick before build).
   - LATE collapse (A-B-C race at D) for maximize-unclear (deceptive proxy -> build then race).
   - divergence is a PLATEAU-TRIGGERED mode, not preemptive: default N=1; arm only when 020 fires;
     return to N=1 after the plateau breaks. Keep N small (2-3) — each candidate is a full build.
   - label honestly: E7 doctrine + the E2 lever lives in 020, not here.
2. 030.2 — a `.codexclaw/` divergence-mode flag + candidate-archive shape so a fresh pass knows it
   is mid-divergence and which candidates exist (survives compaction).
3. 030.3 — drift check: skill text matches shipped Stop behavior (the `50_emergence_gap.md` rule).

## Invariants

- No over-claim: the skill states E2 lives in 020; this decade is doctrine + persisted state.
- divergence is OFF by default (N=1); it is a stagnation response, not a standing posture.
- Project-local mode flag under `.codexclaw/`; no goal-DB write.

## Acceptance

| Check | Evidence |
|-------|----------|
| Doctrine present | `cxc-loop`/`pabcd` state diverge-at-I, early-vs-late collapse |
| Mode flag persists | a fresh pass reads divergence-mode + candidate list |
| No over-claim | skill text matches shipped Stop (drift check green) |
| Default N=1 | doctrine says divergence arms only on plateau, reverts after |

## Verification

- drift test asserting skill text ↔ shipped Stop behavior ↔ this plan stay consistent.
- `npm run build` ; `npm test` ; `npm run gate` ; `git diff --check`.

## PABCD plan (one full cycle, FUTURE loop)

- P: lock the early-vs-late wording + the divergence-mode flag shape.
- A: gpt-5.4 explorer — does any skill line over-claim an E2 the runtime does not enforce? is the
  default truly N=1? does the mode flag survive compaction?
- B: write the doctrine + mode flag + drift check.
- C: build + drift/unit + gate.
- D: close, commit `feat(emergence-030): collapse-point doctrine + divergence-mode flag`, `goal update`.

## Open Q

divergence-mode archive shared with decade 050's candidate archive, or separate?

## Depends on / feeds

Depends on 010, 015, 020 (consumes the E2 signal). Feeds 040 (grounded generation of the N>=2
candidates), 050 (the late-collapse fan-out this doctrine authorizes), 060.
