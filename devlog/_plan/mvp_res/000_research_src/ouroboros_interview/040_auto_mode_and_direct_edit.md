# 040 — Auto Mode & Direct Edit: Ouroboros Autonomous Triggers vs Codexclaw's Main-Agent-Owns-Everything Model

> Source clone (gitignored): `.ouroboros/` inside this research folder.
> All citations use paths relative to the clone root.

## 1. Ouroboros Auto Mode — Triggers and Guards

### 1a. What auto mode is

`skills/auto/SKILL.md` defines `ooo auto` as a full-quality auto pipeline that runs from a single task description to A-grade Seed and execution. It is invoked via the MCP tool `ouroboros_start_auto` (`skills/auto/SKILL.md:6-8`).

The pipeline (`skills/auto/SKILL.md:31-37`):
1. Starts an auto session.
2. Runs bounded Socratic interview rounds with source-tagged auto answers.
3. Generates a Seed.
4. Reviews and repairs until A-grade or blocked.
5. Starts execution only after A-grade.
6. When `complete_product=true`, chains RUN → RALPH_HANDOFF and iterates Ralph until QA passes, convergence, or a budget bound trips.

### 1b. Autonomous trigger

Auto mode is triggered explicitly by the user: `ooo auto "Build a local-first habit tracker CLI"` or `ooo auto --resume auto_abc123` (`skills/auto/SKILL.md:19-24`).

The skill MUST be executed by invoking MCP tool `ouroboros_start_auto`. It must NOT be manually emulated (`skills/auto/SKILL.md:9-14`):
> "This skill must be executed by invoking MCP tool `ouroboros_start_auto`. Do not manually inspect repositories, run shell commands, query GitHub, edit files, or otherwise emulate the auto pipeline as a substitute."

If `ouroboros_start_auto` is unavailable, the skill **stops and reports** — no manual fallback is allowed (`skills/auto/SKILL.md:14-16`).

### 1c. Auto-answerer — the core autonomous mechanism

During auto mode, the interview phase uses an **auto-answerer** that answers interview questions on behalf of the user when the answer is a safe, local, reversible fact. Answers are source-tagged (`skills/auto/SKILL.md:92-100`):
- `conservative_default` — safe-default policy
- `inference` — model reasoning
- `assumption` — auto-answerer fallback

The auto-answerer is implemented in `src/ouroboros/auto/answerer.py`. It uses bounded repository facts supplied by the caller and does NOT perform unbounded repository or network exploration itself (`docs/auto-interview-convergence-contract.md` outcome class 2).

### 1d. Convergence contract — guards against accidental closure

`docs/auto-interview-convergence-contract.md` defines the convergence contract. Every required ledger section must finish in exactly one outcome class:

1. **User-provided fact** — directly stated by the original goal or interview answer.
2. **Bounded repo fact** — caller supplies already-collected repository context with evidence paths.
3. **Safe auto assumption** — missing detail is local, reversible, non-destructive; auto mode chooses a conservative default with source tag and rationale.
4. **Explicit blocker** — gap requires human authority, secrets, external/destructive side effects, production/billing decisions, or regulated-domain judgment. The session BLOCKS instead of inventing a value.

Source: `docs/auto-interview-convergence-contract.md` "Required-section outcomes" section.

**A session is converged only when all required sections are resolved by outcomes 1-3 and no blocker is present.**

### 1e. Guard taxonomy

`skills/auto/SKILL.md:101-120` defines canonical stop reasons:

| Layer | Code | Meaning |
|-------|------|---------|
| Interview | `interview_max_rounds_exhausted` | Ran max_rounds without closure; genuine deadlock |
| Interview | `interview_unsafe_gaps_remain` | At least one section safely defaultable AND at least one unsafe section remaining |
| Interview | `interview_phase_deadline` | Interview phase exceeded per-phase timeout |
| Ralph | `iteration_timeout` | Single Ralph iteration exceeded per-iteration timeout |
| Ralph | `wall_clock_exhausted` | Wall-clock budget exhausted before convergence |
| Ralph | `oscillation_detected` | Oscillated between two grade states without progress |
| Ralph | `grade_regressing` | Subsequent generation produced strictly worse grade |
| Ralph | `max_generations reached` | Hit configured generation cap before A grade |

### 1f. Interview closure modes

`skills/auto/SKILL.md:122-137`:

| Value | Meaning |
|-------|---------|
| `None` | Mutual agreement — both backend and ledger declared seed-ready in the same round (healthy default) |
| `"ledger_only"` | `max_rounds` hit; ledger was structurally complete but backend refused closure. Closes on ledger-only consensus. |
| `"safe_default"` | `max_rounds` hit; safe-default policy filled every remaining required gap with auditable assumptions. |

Genuine-deadlock and partial-unsafe outcomes do NOT set a closure mode — they reach a `blocked` terminal with the matching `stop_reason_code`.

### 1g. Background monitoring

Auto runs as a background job. The main session retains `job_id`, `auto_session_id`, and `cursor`, then monitors with `ouroboros_job_wait` / `ouroboros_job_status` until terminal status (`skills/auto/SKILL.md:39-60`).

During the interview phase, the main session surfaces live Q&A via `ouroboros_session_status(session_id=<auto_session_id>)` — showing `meta.pending_question` and `meta.auto_answer_log` entries so the user sees what the interview is converging on (`skills/auto/SKILL.md:67-73`).

### 1h. Bounded loops

The pipeline must not hang indefinitely: all loops are bounded and timeout failures return a resumable `auto_session_id`. Resume with `ooo auto --resume <auto_session_id>` (`skills/auto/SKILL.md:139-141`).

CLI flags that control bounds (`skills/auto/SKILL.md:26-37`):
- `--max-interview-rounds N` → `max_interview_rounds=N`
- `--max-repair-rounds N` → `max_repair_rounds=N`
- `--pipeline-timeout-seconds X` → `pipeline_timeout_seconds=X`
- `--skip-run` → stop after A-grade Seed
- `--complete-product` → drive full Interview → Seed → Run → Ralph → Product chain

## 2. Ouroboros Evolve Mode — Autonomous Loop Guards

### 2a. The evolutionary loop

`skills/evolve/SKILL.md:12-19`:
```
Gen 1: Interview → Seed(O₁) → Execute → Evaluate
Gen 2: Wonder → Reflect → Seed(O₂) → Execute → Evaluate
...until ontology converges (similarity ≥ 0.95) or max 30 generations
```

### 2b. Wonder and Reflect phases

- **Wonder**: "What do we still not know?" — examines evaluation results to identify ontological gaps and hidden assumptions (`skills/evolve/SKILL.md:82-84`).
- **Reflect**: "How should the ontology evolve?" — proposes specific mutations to fields, acceptance criteria, and constraints (`skills/evolve/SKILL.md:85-86`).

These are the autonomous refinement mechanism: after each Evaluate, the system automatically generates new questions (Wonder) and proposes ontology changes (Reflect) without user involvement.

### 2c. Convergence and stagnation guards

- **Convergence**: ontology similarity ≥ 0.95 between consecutive generations (`skills/evolve/SKILL.md:87-88`).
- **Stagnation**: ontology unchanged for 3+ generations → triggers `ouroboros_lateral_think` (`skills/evolve/SKILL.md:55`).
- **Max generations**: 30 generations hard cap → `exhausted` action (`skills/evolve/SKILL.md:56`).
- **Rewind**: each generation is a snapshot; can rewind to any generation and branch (`skills/evolve/SKILL.md:78-80`).

### 2d. Evolve step isolation

`ouroboros_evolve_step` runs exactly ONE generation per call. State is fully reconstructed from events between calls (`skills/evolve/SKILL.md:64-67`). This makes the loop resumable and crash-safe — no in-memory state is lost between calls.

## 3. Codexclaw's Model — Main Agent Direct Edit During Interview

### 3a. The codexclaw loop

Per the task spec, codexclaw's interview loop is:

```
subagent(contradictions) → main(question) → main(plan edit) → main(re-question)
```

This means:
1. **Main agent** spawns subagents (one per Mind) to find contradictions in the current plan/devlog.
2. **Main agent** synthesizes contradictions and formulates ONE question for the user.
3. **User** answers the question.
4. **Main agent** edits the plan/devlog directly based on the answer.
5. Loop back to step 1.

### 3b. What the main agent does that ouroboros's main session does NOT

| Action | Ouroboros main session | Codexclaw main agent |
|--------|------------------------|----------------------|
| Edits plan/devlog during interview | **NO** — only edits Seed YAML during post-interview QA loop | **YES** — edits plan/devlog every loop iteration |
| Owns question generation | **NO** — MCP server generates questions | **YES** — synthesizes from subagent contradictions |
| Owns subagent dispatch | Partially — reads MCP payloads and spawns via natural-language delegation | **YES** — spawns directly via `spawn_agent` |
| Persists state | **NO** — MCP server persists to EventStore | **YES** — writes plan/devlog files directly |

### 3c. Why this is a fundamental architectural divergence

Ouroboros separates concerns:
- **MCP server** = state owner + question generator (pure, no tools, no code)
- **Main session** = answerer/router (reads code, asks user, spawns advisory subagents)
- **Subagents** = advisory assistants (find facts, challenge assumptions, simplify answers)

Codexclaw collapses these:
- **Main agent** = state owner + question generator + plan editor + subagent dispatcher
- **Subagents** = pure contradiction-finders (read-only, no questions, no edits, no user calls)

The codexclaw model is simpler (no MCP server, no separate state layer) but puts more responsibility on the main agent. The tradeoff is directness vs separation of concerns.

## 4. Auto-Mode Trigger/Guards Codexclaw Needs

### 4a. Trigger

Codexclaw needs an explicit trigger — the user says "interview me" or equivalent. Unlike ouroboros auto mode which runs a full pipeline, codexclaw's auto mode for interview hardening should:
- Start when the user asks to harden the plan/spec.
- Run the contradiction → question → edit → re-question loop.
- Stop when no more blocking contradictions are found OR the user says "done" OR a max-rounds cap is hit.

### 4b. Required guards (adapted from ouroboros)

| Guard | Ouroboros source | Codexclaw adaptation |
|-------|------------------|----------------------|
| Max rounds cap | `max_interview_rounds` (`skills/auto/SKILL.md:26`) | `max_interview_rounds` — prevent infinite loop |
| Phase timeout | `interview_phase_deadline` (`skills/auto/SKILL.md:111`) | Per-round timeout for subagent dispatch + user question |
| Stagnation detection | `stagnated` (ontology unchanged 3+ gens, `skills/evolve/SKILL.md:55`) | If same contradictions recur 3+ rounds with no plan changes, stop and ask user |
| Safe-default policy | `safe_default` closure mode (`skills/auto/SKILL.md:130-134`) | For local, reversible, non-destructive gaps, main agent can auto-fill with source tag |
| Explicit blocker | Outcome class 4 (`docs/auto-interview-convergence-contract.md`) | For human-authority gaps (secrets, production, billing), BLOCK — do not auto-fill |
| Dialectic rhythm | After 3 auto-answers, next MUST go to user (`skills/interview/SKILL.md` Dialectic Rhythm Guard) | After 3 rounds with no user input (auto-filled from code), next round MUST ask user |

### 4c. Convergence criteria (adapted from ouroboros)

Codexclaw should define convergence as:
- All 5 Minds return zero blocking contradictions.
- OR: remaining contradictions are all `minor` severity and the user has seen them.
- OR: `max_interview_rounds` is hit and the user accepts the current state.

This mirrors ouroboros's "converged only when all required sections are resolved and no blocker is present" (`docs/auto-interview-convergence-contract.md`).

## 5. Concurrency / Rollback Safety — Worker Write-Scope Discipline

### 5a. The core risk

Since codexclaw's main agent edits plan/devlog directly during interview (no MCP server, no EventStore), and the task spec says "others edit in parallel" in a shared codebase, there is a **concurrency risk**: the main agent's plan edits could conflict with parallel workers editing other files.

### 5b. Ouroboros's safety mechanisms (for reference)

Ouroboros handles concurrency through:
1. **EventStore (append-only SQLite)**: All state changes are immutable events. Conflicts are impossible because events are never modified, only appended (`docs/contributing/key-patterns.md:71-74`).
2. **File locking**: `src/ouroboros/core/file_lock.py` provides file-level locking (`checkpoint.py:24` imports `file_lock`).
3. **Immutable frozen dataclasses**: All data models are `frozen=True, slots=True` — thread-safe by construction (`docs/contributing/key-patterns.md:36-54`).
4. **Checkpoint rollback**: `CheckpointStore` supports recovery with rollback (max 3 levels) via SHA-256 integrity validation (`src/ouroboros/persistence/checkpoint.py:1-8,28-75`).
5. **MCP server as single state owner**: The MCP server process is the single writer — the main session never writes state directly during interview.

### 5c. Codexclaw's required safety mechanisms

Since codexclaw has no MCP server and no EventStore, it must implement safety at the file level:

| Safety need | Mechanism |
|-------------|-----------|
| **Write-scope discipline** | Main agent writes ONLY to plan/devlog files in its write scope. Subagents are read-only — they cannot write anything. This is enforced by the subagent contract (contradictions only, no edits). |
| **Parallel worker isolation** | Workers editing other files do not touch plan/devlog. The main agent does not touch worker files. This is the "write scope" contract from the task spec. |
| **Rollback** | Before each plan edit, the main agent should snapshot the current plan state (git stash or copy). If a round produces worse results, rollback to the pre-round state. Ouroboros's 3-level rollback limit (`checkpoint.py:7`) is a reasonable cap. |
| **Atomic writes** | Plan/devlog edits should be atomic — write to a temp file, then rename. This prevents partial writes if the process is interrupted. |
| **Idempotent subagent dispatch** | Subagent dispatch should be idempotent — if the same plan state is re-read, the same contradictions should be found. This makes retry safe. |
| **No shared mutable state** | The main agent is the sole writer to plan/devlog. Subagents are pure functions (read plan → return contradictions). No shared mutable state between main and subagents. |

### 5d. Write-scope enforcement

The task spec establishes the write-scope contract:
- Main agent writes ONLY to its 4 designated files (in this case, the research survey docs).
- Subagents write NOTHING — they are read-only contradiction-finders.
- Parallel workers have their own write scopes and do not overlap.

This is simpler than ouroboros's EventStore-based safety because:
- There is no shared mutable state between agents (subagents are pure readers).
- The main agent is the sole writer to its scope.
- No external process (MCP server) holds state that could diverge.

### 5e. Git as the rollback mechanism

Since codexclaw operates in a git repo, the simplest rollback mechanism is:
1. Before each interview round, the main agent commits the current plan/devlog state (or stashes if not committing).
2. If a round produces worse results (e.g., user rejects the edit), `git checkout` the plan/devlog files to rollback.
3. This replaces ouroboros's CheckpointStore with git's native versioning.

The task spec says "Commit nothing" for this research task, but for the actual codexclaw interview hardening implementation, git-based rollback is the natural mechanism.

## 6. Summary: Auto-Mode Architecture Comparison

| Dimension | Ouroboros | Codexclaw |
|-----------|-----------|-----------|
| Auto trigger | `ooo auto` → `ouroboros_start_auto` MCP tool | User says "interview me" → main agent starts loop |
| State owner | MCP server (separate process) → EventStore (SQLite) | Main agent → plan/devlog files |
| Question generator | MCP server (pure, no tools) | Main agent (synthesizes from subagent contradictions) |
| Plan edits | Post-interview QA loop only | During interview, every round |
| Subagent role | Advisory (findings, options, lateral plans) | Contradiction-finders only (read-only) |
| Convergence | Ontology similarity ≥ 0.95 or all sections resolved | Zero blocking contradictions from all 5 Minds |
| Stagnation guard | 3+ unchanged generations → lateral_think | 3+ recurring contradiction sets with no plan change → stop |
| Max rounds | `max_interview_rounds` (default 50) | `max_interview_rounds` (TBD, suggest 10-15 for interview hardening) |
| Rollback | CheckpointStore (SHA-256, max 3 levels) | Git checkout of plan/devlog files |
| Concurrency safety | EventStore (append-only) + file locking + frozen models | Write-scope discipline (main agent sole writer, subagents read-only) |
| Background execution | `ouroboros_job_wait` / `ouroboros_job_status` polling | N/A — main agent runs in foreground (codex-native) |
