---
name: cxc-interview
description: "Use for Codexclaw Interview mode: persistent IPABCD I-phase requirements discovery, contradiction hunting, focused user questions, question/answer evidence recording, and readiness gating before Plan. Triggers: interview, 인터뷰, requirements clarification, ambiguity, contradiction scan, ask me questions, I phase, cxc-interview."
metadata:
  short-description: "Persistent I-phase clarification with contradiction tracking."
---

# cxc-interview

Use this skill for Interview work within the user's scope. Loading it or receiving
a natural-language I hint does not enter the phase. Actual entry uses an explicit
user command or authorized `cxc orchestrate I --session <id>` with the current
SessionStart binding. No-FSM requests remain advisory without a transition.

## Contract

- The main session owns questions, user answers, tracker updates, and devlog
  records.
- Subagents may search for contradictions and propose question candidates, but
  they do not ask the user directly.
- Ask across four dimensions: Goal, Constraint, Success criteria, Ontology.
- Re-scan contradictions after every user answer.
- Do not advance to Plan while a high contradiction or pending question remains.
- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview.
- When Interview reveals work that will span 2+ PABCD cycles, flag the unit as
  multi-cycle so that the first work-phase enters as a docs-only roadmap cycle
  (LOOP-DOCS-FIRST-01, `cxc-loop`). Interview settles unit residence
  (UNIT-RESIDENCE-01) but does not write decade docs — that is the roadmap
  cycle's job.

## Classify the loop before Plan

Before leaving Interview, identify whether the verifier defines done (specification
or repair) or only better (open-ended optimization), and record the corresponding
loop archetype. Ground the distinction in the repository and the user's outcome.
For a load-bearing architecture or workflow choice, explain the concrete trade-offs
before narrowing it; include a materially different approach when it helps expose
an assumption. When evidence cannot settle a cheap, bounded comparison, offer a
parallel spike and evidence-based selection. Do not invent irrelevant feature or
technology choices that the project already settles.

## Question quality (INTERVIEW-Q-01)

- Target the weakest dimension first and name why it is the current bottleneck.
- Ask focused questions that expose an ASSUMPTION or boundary — not a feature-list roundup.
  Bundle several only when they are INDEPENDENT: never batch two questions where one
  answer changes the other (INTERVIEW-INDEPENDENT-01). Independence governs, not a count.
  Note the transport limit: `request_user_input` accepts at most three questions per call,
  so a larger independent batch has to be split across calls.
- Prefer repo-grounded confirmation ("the code does X — is that intended?") over re-asking what
  the codebase already answers.
- Treat every answer as a claim to pressure-test: vague or hedged answers do not raise a
  dimension's readiness; they keep or deepen the gap.

## Grounding questions in state (INTERVIEW-GROUND-01)

Question quality is a STATE problem before it is a wording problem. A question generated with
no accumulated knowns and no recorded gaps comes out vague no matter how the prompt is phrased
— that is the failure mode behind questions like "이어서 어느 방향으로 진행할까요?".

The loop that prevents it:

1. Answers are captured automatically by the `PostToolUse` hook into
   `.codexclaw/interviews/<sessionId>.jsonl`.
2. Fold them into the tracker before asking again:
   `cxc scan record --session <id> --derive --map <questionId>=<goal|constraint|success|ontology>`.
   Each answered question becomes a `known[]` fact on its dimension; each asked-but-unanswered
   one becomes an explicit `unknown[]` gap, and answering it later retires the gap.
   Unmapped questions are skipped rather than guessed, so pass `--map` for every question that
   should count.
3. Read `.codexclaw/sessions/<id>.json` back and let the weakest dimension choose the next
   question. This is also what makes Mind routing adaptive: `selectMinds` ranks by dimension
   level, so with an empty tracker all four tie and it degrades to a fixed order.

**Readiness is reached through step 2, not through an assertion.** A dimension counts
toward I -> P when the session's interview ledger shows a question that was ASKED, an
answer that was RECORDED, and a `--map` attributing that question to that dimension.
That is why `--map` matters: an answered question nobody attributed proves nothing about
any dimension.

`--known <dimension>=<text>` records a fact you already hold. It moves a dimension off
`low` and can carry it to `high`, but it can NOT make it count for readiness — a typed
fact is not an answered question, and four `--known` flags would otherwise be a complete
interview in one command.

`--dim <dimension>=<low|mid|high>` records an explicit level assertion when coverage alone
understates what you know. It deliberately cannot set `max`: that level bypasses the ledger
check entirely, so it stays out of the writer's reach.

When the interview genuinely is not complete, the sanctioned way past the gate is the attested
`cxc orchestrate P --attest-file <path>` carrying
`{"from":"I","to":"P","did":"<why the interview is complete>","override":true}`,
which leaves a ledger row. It is the exception now, not the only door — until 260825 the gate
demanded a level no writer could produce, so every interview spent an override and the row
stopped distinguishing anything. (The file flag is required on Windows: PowerShell cannot pass
inline JSON as a single argument.) `from`/`to` are not optional here — the parser
coerces them before the override is ever read, so `{"override":true}` alone is
refused (ATTEST-SHAPE-01 in `cxc-pabcd`).

## Show the state before asking (INTERVIEW-RENDER-01)

Emit a short status block immediately before `request_user_input`: what is now known, which
dimension is weakest and why it is the current bottleneck, and what the answer will change.
The runtime cannot force this — hooks only inject text — so it is the main session's job.
Without it a well-grounded question still reads as context-blind, because the user cannot see
the reasoning that produced it.

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
- Runtime readiness has two halves. **Shape** (`isInterviewReady`): every dimension at `high` or
  `max` + contradictions empty + assumptions recorded + `scanRounds >= 1`. **Provenance**
  (the I -> P gate on the agent CLI path): every dimension counted at `high` must trace to a
  question that was asked, answered, and attributed with `--map`. `max` needs no ledger backing
  because no writer can produce it.
- The practical consequence: `--known` alone never opens I -> P. Ask the question, let the
  `PostToolUse` hook capture the answer, then `cxc scan record --derive --map <qid>=<dimension>`.
- Treat readiness as a coverage claim on top of that: each dimension has concrete knowns, no
  unresolved unknown changes scope, and every contradiction has exited into an answer or a
  recorded assumption. Summarize the remaining OPEN ASSUMPTIONS before claiming I -> P readiness.

## Closeout fork (INTERVIEW-FORK-01)

In non-goal HITL Interview only (under an active goal the Interview is suppressed and
`request_user_input` is hard-denied — see Goal firewall), after a scan round do not drift forward
silently. Present a numbered choice and let the user pick: `1. Proceed to Plan` ·
`2. Keep interviewing` · `3. Record assumptions and pause`. Do not offer a question BUDGET
("ask 2-3 more"): no tracker field persists it, so the number is unenforceable across turns,
and INTERVIEW-INDEPENDENT-01 governs batching by independence rather than count.
There is no build/execute path out of Interview — the only forward move is Plan, normally after
the readiness gate passes, unless the human explicitly overrides (override is recorded as an
audit entry); the agent CLI path also supports override via
an attest carrying `{"from":"I","to":"P","did":"<reason>","override":true}` with
equivalent ledger transparency (`from`/`to` are coerced before the override is
read, so `{"override":true}` alone is refused — ATTEST-SHAPE-01).
`proceed` means "advance to Plan", not permission to implement; the evolving
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
- Agent I→P override: when the agent CLI path (`cxc orchestrate P --session <id>
  --attest-file <path>`, carrying
  `{"from":"I","to":"P","did":"<reason>","override":true}`) encounters
  an unready interview tracker, it bypasses the readiness gate — mirroring the
  human chat override in `applyHumanTransition`. The tracker is NOT modified;
  `flags.interview` is pre-flipped at the transition level. The ledger records
  `actor:"agent"`, `override:true`, and a `scanEvidence` snapshot of the
  pre-override gate state. The `did` narrative must be non-empty and non-placeholder.

Goal firewall: the whole Interview is suppressed under an active goal — the explicit
trigger path, the passive re-injection paths (`UserPromptSubmit` modes 2/3), AND the
`Stop` continuation loop all check goal-active and refuse to drive the Interview, and
`request_user_input` is hard-denied. The Interview is HITL-only; `handleStop` releases
immediately at `phase === "I"` (it never blocks/continues an interview, even mid-cycle
under an active goal). The `InterviewTracker` discipline still governs the four
dimensions and OPEN ASSUMPTIONS.
