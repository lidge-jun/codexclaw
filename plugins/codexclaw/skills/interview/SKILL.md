---
name: cxc-interview
description: "Use for Codexclaw Interview mode: persistent IPABCD I-phase requirements discovery, contradiction hunting, focused user questions, question/answer evidence recording, and readiness gating before Plan. Triggers: interview, 인터뷰, requirements clarification, ambiguity, contradiction scan, ask me questions, I phase, cxc-interview."
metadata:
  short-description: "Persistent I-phase clarification with contradiction tracking."
---

# cxc-interview

Use this skill to enter or continue Codexclaw's IPABCD Interview phase.

## Contract

- The main session owns questions, user answers, tracker updates, and devlog
  records.
- Subagents may search for contradictions and propose question candidates, but
  they do not ask the user directly.
- Ask across four dimensions: Goal, Constraint, Success criteria, Ontology.
- Re-scan contradictions after every user answer.
- Do not advance to Plan while a high contradiction or pending question remains.
- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview.

## Question quality (INTERVIEW-Q-01)

- Target the weakest dimension first and name why it is the current bottleneck.
- Ask one focused question that exposes an ASSUMPTION or boundary — not a feature-list roundup.
- Prefer repo-grounded confirmation ("the code does X — is that intended?") over re-asking what
  the codebase already answers.
- Treat every answer as a claim to pressure-test: vague or hedged answers do not raise a
  dimension's readiness; they keep or deepen the gap.

## Sub-modes (INTERVIEW-CATALOG-01)

Pick by the user's knowledge level:

- **Clarification** (default) — the user already knows roughly what they want; questions
  structure goals, constraints, success criteria.
- **Catalog Discovery** — the user names a vague domain but no features ("사주 앱 만들고
  싶어", "뭘 만들지 모르겠어"); present the option ontology from
  `$cxc-pabcd` `references/catalog-discovery.yaml`. See below.
- **Configurator** — compile the selections into a spec (PRD sections, MVP cut, risk
  register, PABCD plan seed).

Heuristic: concrete feature/goal -> Clarification; vague domain, no tech specifics ->
Catalog Discovery; explicit user request -> honor it.

## Catalog Discovery — design/UX LEADS (CATALOG-DESIGN-FIRST-01)

The user cannot choose from options they have never seen (strong form of INTERVIEW-TEACH-01).
Present the option ontology in `references/catalog-discovery.yaml` (under `$cxc-pabcd`).

**Hard barrier:** iterate `axis_order` by ascending `stage`; do NOT present a stage until
every `required` entry of all earlier stages is answered. Stage 1 is design (6 dials: mood,
lightness, density, shape, typography, motion), all `required: true` — MUST be answered
before any Stage 2 (domain) or Stage 3 (feature/data/security/ops/cost) question appears.

- *Design methodology* — Product-Personality Selection first (from dev-uiux-design §1): for
  each design dial show `question_options` (labels + trade-offs) anchored on familiar
  products, then ask. Refine via Korean Request Translation, Reference Discovery, Design Read.
- *Deriving backend questions* — two paths populate Stage 3: **structural** (chosen Stage-2
  domain `implies[]` + Stage-3 `derived_from`, resolved transitively) and **keyword** (scan
  user's initial free-text against Stage-3 `auto_activate_rules`). Confirm high-impact
  activations.
- The catalog is a DATA STRUCTURE — do not invent entries not in it.

**Configurator**: once selections are complete, compile them (with resolved `implies[]`
chains) into: PRD sections, an MVP cut ordered by `cost_class`, a risk register of every
`risk_class: high` entry, and a PABCD plan seed carrying the work class + loop archetype.

## Option-set quality (INTERVIEW-OPTION-01)

When presenting options during Interview, generate against typicality bias: the 2-3 options
a model volunteers are usually one attractor family. Deliberately include at least one
atypical (low-probability) approach. Offer `A · B · BOTH (parallel spike, select by
evidence)` instead of forcing one pick. A `BOTH` answer becomes an explore-and-select
work-phase (loop-engineering §11.4).

## Rescan + readiness (INTERVIEW-SCAN-01)

- Run a contradiction rescan after every answer, AND one final rescan before any proceed/close
  decision — surface what still remains. (This final rescan is process discipline; the runtime
  does not encode scan recency.)
- Runtime readiness predicate (`isInterviewReady`): all dimensions at `max` + contradictions
  empty + assumptions recorded + `scanRounds >= 1`. Treat readiness as a coverage claim on top of
  that: each dimension has concrete knowns, no unresolved unknown changes scope, and every
  contradiction has exited into an answer or a recorded assumption. Summarize the remaining OPEN
  ASSUMPTIONS before claiming I -> P readiness.

## Closeout fork (INTERVIEW-FORK-01)

In non-goal HITL Interview only (under an active goal the Interview is suppressed and
`request_user_input` is hard-denied — see Goal firewall), after a scan round do not drift forward
silently. Present a numbered choice and let the user pick: `1. Proceed to Plan` ·
`2. Ask 1 more question` · `3. Ask 2-3 more questions` · `4. Record assumptions and pause`.
There is no build/execute path out of Interview — the only forward move is Plan, normally after
the readiness gate passes, unless the human explicitly overrides (override is recorded as an
audit entry). `proceed` means "advance to Plan", not permission to implement; the evolving
plan/devlog stay draft interview artifacts until then.
A chosen `proceed` executes as a real transition — `cxc orchestrate P --session <id>` (or the
chat free-pass `orchestrate p`) — never as narration alone: a "moving to Plan" sentence without
the persisted I->P edge is not Plan entry (ORCH-MANDATE-01, canonical in `cxc-loop`).

## Runtime Status (shipped)

The interview runtime is shipped, not planned:

- `PostToolUse` auto-capture for `request_user_input` records each question/answer
  round to `.codexclaw/interviews/<sessionId>.jsonl` (`handlePostToolUse`,
  `captureInterviewAnswers`).
- L18: after each captured answer, the same PostToolUse hook REINJECTS the rescan
  directive as `additionalContext` (`RESCAN_REINJECT_DIRECTIVE`) when the session is
  in an interactive I-phase — so the Mind contradiction rescan fires after every
  answer instead of fading with transcript distance. Under an active/unreadable goal
  it stays silent (capture only, firewall intact).
- The I-phase directive carries the Mind-dispatch contract (`MIND_DISPATCH_DIRECTIVE`),
  so the main session runs the contradiction-rescan loop: select Minds, dispatch
  read-only contradiction lenses, triage (high -> ask the user; low/medium -> recorded
  assumption), then ask the user to proceed or keep interviewing.
- Mind spawn shape (MIND-SPAWN-SHAPE-01): dispatch each Mind as `agent_type "explorer"`,
  `task_name mind_<mindname>`, and a NON-full-history fork (V2 `fork_turns:"none"`; V1 omits
  `fork_context`) — a full-history fork rejects model/effort overrides upstream AND skips the
  `.codexclaw/subagents.json` role-config injection. Mind lenses ride the **explorer** role
  config: pin lens strength with `cxc subagents set explorer --effort <low|medium|high|xhigh>`
  (or pass `reasoning_effort` explicitly); omitted fields inherit the parent session. Known
  caveat: role inference is keyword-based, so a packed snapshot containing review words
  ("review"/"검증"/"검토") can route the reviewer role's config instead — harmless (it only
  changes which configured model applies). Minds are stateless: pack the lens prompt plus a
  compact interview snapshot (dimension scores, knowns, open assumptions, draft plan path)
  into each task message.
- Readiness gating requires recorded scan evidence (`scanRounds >= 1`) before I -> P.

Goal firewall: the whole Interview is suppressed under an active goal — the explicit
trigger path, the passive re-injection paths (`UserPromptSubmit` modes 2/3), AND the
`Stop` continuation loop all check goal-active and refuse to drive the Interview, and
`request_user_input` is hard-denied. The Interview is HITL-only; `handleStop` releases
immediately at `phase === "I"` (it never blocks/continues an interview, even mid-cycle
under an active goal). The `InterviewTracker` discipline still governs the four
dimensions and OPEN ASSUMPTIONS.
