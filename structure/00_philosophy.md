---
created: 2026-06-30
tags: [codexclaw, philosophy, sot, design-principles]
aliases: [Codexclaw Implementation Philosophy, codexclaw 구현 철학, philosophy sot]
---

# Codexclaw Implementation Philosophy (SOT)

> This file is the maintainer source of truth for *why* codexclaw is shaped the way it
> is. `INDEX.md` answers "what is where"; this file answers "what we are allowed to do,
> and what we deliberately refuse to do." When a design decision conflicts with a
> principle here, the principle wins or the principle is amended in the same change —
> never silently violated.

---

## 0. One-sentence identity

codexclaw is a **single Codex plugin** that adds PABCD/IPABCD discipline, dev-skill
routing, and configurable multi-model subagents **on top of** the Codex runtime — it
never forks Codex, never replaces the user's prompt, and runs no server — except the
opt-in loopback messenger bridge (`cxc serve`, §2 scoped exception, 2026-07-03).

---

## 1. The load-bearing tension: model autonomy vs runtime enforcement

Every hard design call in codexclaw comes back to one question:

> **Can a hook actually enforce this, or are we only writing instructions the model
> may choose to follow?**

Codex gives a plugin exactly four enforcement surfaces, all via hooks:

1. `UserPromptSubmit` — append `additionalContext` (inject a directive).
2. `PreToolUse` — `permissionDecision: "deny"` a tool call.
3. `Stop` — `decision: "block"` with a continuation reason.
4. `SessionStart` — emit one-time context.

Everything else — which skill the model reads, whether it consults `dev-backend`,
whether a subagent honors its role prompt — is **model-autonomous**. There is no hook
that fires on "skill load" or "reference read."

The philosophy:

- **Enforce at the surfaces hooks own.** Goal-budget guard, interview-in-goal deny,
  and PABCD Stop-continuation are real because a hook can intercept them.
- **Everywhere else, make the autonomous choice the easy choice.** Strong frontmatter
  triggers, an explicit routing table, and skill mentions injected into the spawn
  payload raise the probability the model does the right thing — but we name them as
  *guidance*, not *enforcement*, and we never claim a prose contract is "enforced by a
  hook" when no hook arms it. (That false claim is exactly the L14.1 defect.)
- **When a contract reads as enforced, prove the arming hook exists.** If it does not,
  either wire the hook or downgrade the wording to guidance.

This is the single most common source of "false DONE" in this repo. Treat any
"the hook enforces X" sentence as a claim that must point at a live `PreToolUse` /
`Stop` / `UserPromptSubmit` branch.

---

## 2. Boundary invariants (non-negotiable)

- codexclaw is **loaded by Codex**; it does not patch or replace Codex binaries.
- Hooks **append context or deny tool calls**; they never swallow or rewrite the
  user's prompt.
- State is **project-local `.codexclaw/`** files only — no jaw-style server, no shared
  database, no network service. One scoped exception (owner directive 2026-07-02,
  `devlog/_plan/260702_codex_recall/`): user-level **rebuildable derived caches** under
  `~/.codexclaw` (recall's FTS index; ast-grep runtime precedent). A cache is never a
  source of truth — deleting it only costs a rebuild — and durable state stays
  project-local.
- The messenger bridge is a **second scoped exception** (owner-approved plan,
  2026-07-03, `devlog/_plan/260703_messenger_bridge_active/`): `cxc serve` runs an
  opt-in, loopback-only (`127.0.0.1`) bridge process with a project-local
  `.codexclaw/bridge.db` (`node:sqlite`) for channel/binding/job state. It is not a
  jaw-style orchestrator: it never dispatches subagents, never writes the goal DB,
  and nothing else in codexclaw depends on it running. The no-server invariant
  still bans *required*, *non-loopback*, or *orchestration* servers.
- The native goal DB is **read-only** to codexclaw. Only the main session calls
  `create_goal`; codexclaw reads `thread_goals` to gate behavior, never writes it.
- The provider bridge is **detect-only**. codexclaw observes whether `ocx` is present;
  it never runs `ocx ensure`/`ocx sync` or mutates provider state.
- `$cxc-*` are **skill mentions / autocomplete**, not slash commands. Native plugin
  mentions render as `$codexclaw:cxc-*`; bare `$cxc-*` is a hook-parsed shorthand.
- `cxc` is a **local CLI alias** for plugin ops, not a server API.

If a feature needs to break one of these, it is no longer codexclaw — it is a
different product. Stop and re-scope rather than quietly crossing the line.

---

## 3. Truthfulness regime

- **DONE means shipped + tested.** "Decision made" or "plan written" is `PLANNED`,
  never `DONE`. A loop reaches `DONE` only with code present, tests green, and a
  devlog evidence path. A pure decision/parity slice that ships no runtime is
  recorded on its own axis (see the two-axis note below), not as a code-DONE.
- **Status tokens are a locked enum.** Lifecycle: `PLANNED` / `ANALYZED` /
  `DESIGN` / `DONE` / `DEFERRED` / `RETIRED`. Interview/freeze: `FROZEN` /
  `BLOCKED(<Q-id>)`. Do not invent new tokens to paper over a half-finished state;
  if a genuinely new lifecycle state is needed, add it here in the same change.
- **Status is two-axis where decision and implementation can diverge.** The
  `mvp_hard` ledger separates a *decision* column from an *impl* column. A loop may
  be decision-`DONE` while impl is `PLANNED`. Never collapse the two axes into a
  single `DONE` that hides un-shipped runtime — that is the most common false-DONE
  pattern the contradiction register keeps catching.
- **All four status surfaces stay in sync**: the `mvp_hard` INDEX ledger row, the
  per-loop doc header, this `structure/` SOT, and any roadmap/README. A reviewer that
  finds one surface ahead of another has found a real defect.
- **No placeholder evidence.** `todo`, `tbd`, `stub`, "fake pass" never count. A
  validation summary cites a real file path or command output.

---

## 4. Two coexisting control modes

codexclaw runs two workflows that must not bleed into each other:

- **HITL — IPABCD interview.** Human-in-the-loop. The `I` phase gathers requirements,
  dispatches contradiction-rescan subagents, and ends by asking the user to *proceed*
  or *keep interviewing*. Interviews are for when direction is uncertain.
- **HOTL — goal PABCD loop.** Human-on-the-loop. Under an active native goal the agent
  drives full P→A→B→C→D cycles autonomously and does **not** interview mid-goal —
  `request_user_input` is denied while a goal is active. Goals are for when direction
  is settled and execution is the work.

The boundary rule: **a goal suppresses the interview.** This is why the originally
planned "I-phase Stop guard" was dropped — it had no valid domain (goal-active already
suppresses interview; goal-inactive must pause for the human per the Stop-continuation
contract). Recording that dropped idea here keeps a future maintainer from
"rediscovering" it as a gap.

---

## 5. Subagent doctrine

- **Roles are prompt sources, not registered agents.** Codex plugin manifests expose
  `skills`/`hooks`/`mcpServers`/`apps` — there is no `agents` field. So role TOMLs
  (`explorer`/`reviewer`/`executor`) are canonical *prompts* injected inline at spawn
  time (the "B-opt2" pattern), mapped onto the two built-in agent types codex offers:
  `explorer` (read-only) and `worker` (scoped write).
- **The store owns the model; the TOML owns the prompt.** `model = "default"` is an
  inherit sentinel. The durable per-role model lives in `.codexclaw/subagents.json`;
  default mode omits the `model` key so the subagent inherits the main model, and an
  explicit `promptOverride` replaces the TOML body.
- **Routing should travel as an attachment, not a hope.** When a subagent is dispatched
  for a surface, the matching `cxc-*` skill should be attached to the spawn so the
  subagent actually loads that discipline — "go read dev-backend" in prose is the weak
  form; a skill mention in the spawn `items` is the strong form. (This is the L14
  routing target — see `10_subagent_skill_routing.md`.)
- **Use subagents to widen evidence, not to rubber-stamp.** Audit/A-gate work fans out
  to read-only explorers; their output is contradictions/gaps with file:line, never
  questions or solutions. Integrate, then close (`SUB-CLOSE`); inconclusive results are
  recorded as not-approved.

---

## 6. Evidence-first execution

- Every PABCD phase leaves documentation evidence (a devlog path or a structure
  update), implementation evidence (changed source/test paths, or an explicit no-code
  rationale), and verification evidence (a fresh command/test tail).
- Verification scales to blast radius: a one-file local patch needs the smallest proof
  that validates the claim; shared-behavior or security changes need the full suite.
- Commits are **small, atomic, conventional**, each independently reversible.
  `push` / `reset` / `force` require explicit human approval.

---

## 7. How to use this file

When you add a feature, walk the principles in order and ask:

1. Does it cross a §2 boundary? If yes, stop or re-scope.
2. Is the enforcement claim real (§1) or am I writing hopeful prose?
3. Will I mark it `DONE` only when shipped + tested (§3)?
4. Does it respect the HITL/HOTL split (§4) and subagent doctrine (§5)?
5. What is my documentation + implementation + verification evidence (§6)?

If you cannot answer all five, the design is not ready.
