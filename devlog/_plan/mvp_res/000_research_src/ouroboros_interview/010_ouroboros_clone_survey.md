# 010 — Ouroboros Clone Survey: Loop, Minds, and Decision Recording

> Source clone (gitignored): `.ouroboros/` inside this research folder.
> All citations use paths relative to the clone root, e.g. `skills/interview/SKILL.md`.

## 1. Repo Topology

Ouroboros (v0.43.3, by Q00) is a **specification-first AI workflow engine** that sits between the user and their AI runtime (Claude Code, Codex CLI, Copilot, Gemini CLI, OpenCode). It transforms vague ideas into verified code via a structured pipeline: interview → crystallize → execute → evaluate → evolve.

Key directories in the clone:

| Path | Purpose |
|------|---------|
| `skills/*/SKILL.md` | 23 skill definitions (interview, seed, evaluate, evolve, auto, ralph, unstuck, qa, pm, run, status, etc.) — the primary instruction surface the host LLM reads |
| `commands/*.md` | 14 slash-command shims — each just reads the corresponding `skills/*/SKILL.md` and follows it (`commands/interview.md:1-7`) |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest: name, version, `skills: ./skills/`, `mcpServers: ./.mcp.json` (`.claude-plugin/plugin.json:1-22`) |
| `.claude-plugin/marketplace.json` | Claude marketplace entry (`.claude-plugin/marketplace.json:1-31`) |
| `.mcp.json` | MCP server definition: `uvx --from ouroboros-ai[mcp,claude] ouroboros mcp serve` (`.mcp.json:1-7`) |
| `.codex/config.toml` | Codex CLI MCP config — same server command as `.mcp.json` (`.codex/config.toml:1-7`) |
| `.codex/hooks.json` | Codex hooks: PostToolUse drift-monitor, UserPromptSubmit keyword-detector (`.codex/hooks.json:1-25`) |
| `hooks/hooks.json` | Claude-format hooks: SessionStart, UserPromptSubmit, PostToolUse (`hooks/hooks.json:1-27`) |
| `src/ouroboros/` | Python core: bigbang (interview/seed), auto (pipeline), mcp (tools/server), resilience (lateral), persistence (EventStore), core (types/lineage), evaluation, orchestrator |
| `crates/ouroboros-tui/` | Rust TUI (secondary) |
| `docs/` | Architecture, RFCs, runtime semantics, convergence contracts |
| `llms.txt` / `llms-full.txt` | LLM-consumable project summary (648 lines / full) |
| `.ouroboros/seeds/` | In-project seed YAML artifacts (2 example seeds present) |
| `.ouroboros/mechanical.toml` | Mechanical evaluation config: `build`, `test`, `timeout` (`.ouroboros/mechanical.toml:1-3`) |

## 2. The Real Loop — Stage Names and Transitions

The loop is documented in `skills/evolve/SKILL.md:12-19` and `llms.txt:8-18`:

```
Gen 1: Interview → Seed(O₁) → Execute → Evaluate
Gen 2: Wonder → Reflect → Seed(O₂) → Execute → Evaluate
Gen 3: Wonder → Reflect → Seed(O₃) → Execute → Evaluate
...until ontology converges (similarity ≥ 0.95) or max 30 generations
```

### Stage-by-stage detail

**Interview** (`skills/interview/SKILL.md`):
- Socratic dialogue to crystallize vague requirements. The MCP tool `ouroboros_interview` is a **pure question generator** — it does NOT read code, browse the web, or call tools (`skills/interview/SKILL.md` Path A architecture section).
- The main session is the **answerer and router**: receives MCP questions, answers them by reading code (PATH 1a/1b), routes to user for human judgment (PATH 2), or does research (PATH 4).
- Non-skippable gates: Refine free-text answers, maintain visible ambiguity ledger, Seed-ready Acceptance Guard, Restate gate before seed generation (`skills/interview/SKILL.md` "Non-Skippable Gates" section).
- Dialectic Rhythm Guard: after 3 consecutive non-user answers (auto-confirms), the next question MUST go to the user (`skills/interview/SKILL.md` "Dialectic Rhythm Guard" section).

**Seed** (`skills/seed/SKILL.md`):
- Generates a validated Seed YAML from interview results via `ouroboros_generate_seed`.
- Runs a **QA Refinement Loop** (max 5 iterations, pass threshold 0.90) using a Wonder → Reflect → Refine → Restate cycle (`skills/seed/SKILL.md` "QA Refinement Loop" section).
- The first generation runs exactly once and establishes the seed's ontology. All subsequent revisions are **direct YAML edits by the main session** — `ouroboros_generate_seed` is never re-called (`skills/seed/SKILL.md` "The first generation runs exactly once" paragraph).
- Seed components: GOAL, CONSTRAINTS, ACCEPTANCE_CRITERIA, ONTOLOGY_SCHEMA, EVALUATION_PRINCIPLES, EXIT_CONDITIONS, METADATA (`skills/seed/SKILL.md` "Seed Components" section).

**Run** (execute):
- Executes a seed specification through the workflow engine. Decomposes ACs into tasks and runs them via the configured backend (`llms.txt:51`).

**Evaluate** (`skills/evaluate/SKILL.md`):
- Three-stage verification pipeline:
  1. Stage 1: Mechanical Verification ($0 cost) — lint, build, test, static analysis (`skills/evaluate/SKILL.md:22-27`)
  2. Stage 2: Semantic Evaluation — AC compliance, goal alignment, drift measurement (`skills/evaluate/SKILL.md:29-33`)
  3. Stage 3: Multi-Model Consensus (optional) — multiple models vote, majority ratio determines outcome (`skills/evaluate/SKILL.md:35-38`)

**Evolve** (`skills/evolve/SKILL.md`):
- Evolutionary loop: iteratively refines ontology and acceptance criteria across generations until convergence.
- `ouroboros_evolve_step` runs exactly ONE generation per call. State is fully reconstructed from events between calls (`skills/evolve/SKILL.md:64-67`).
- Termination actions: `continue`, `converged` (similarity ≥ 0.95), `stagnated` (ontology unchanged 3+ gens), `exhausted` (max 30 gens), `failed` (`skills/evolve/SKILL.md:51-57`).
- Rewind: each generation is a snapshot; can rewind to any generation and branch evolution from there (`skills/evolve/SKILL.md:78-80`).

**Auto** (`skills/auto/SKILL.md`):
- Full pipeline from a single task description: Interview → Seed → Review/Repair → Execute → (optional Ralph chain).
- Runs as a background job via `ouroboros_start_auto`, monitored with `ouroboros_job_wait` / `ouroboros_job_status` (`skills/auto/SKILL.md:9-18`).

**Unstuck** (lateral thinking):
- Breaks through stagnation using lateral thinking personas. Triggered when evaluate fails or evolution stagnates.

### Transition diagram

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
  Interview ──→ Seed ──→ Run ──→ Evaluate ──→ (APPROVED?)        │
     │           │       │         │                               │
     │           │       │         ├── REJECTED Stage 1 ──→ Run   │
     │           │       │         ├── REJECTED Stage 2 ──→ Evolve│
     │           │       │         └── REJECTED Stage 3 ──→ Interview
     │           │       │                                         │
     │           │       └── (Ralph loop: Run ↔ Evaluate)         │
     │           │                                                 │
     │           └── QA Refinement Loop (Wonder→Reflect→Refine→Restate)
     │                                                             │
     └── (auto mode: bounded rounds with safe-default closure) ───┘
```

## 3. The "Nine Minds" — Persona Model

### ⭐ There are FIVE lateral thinking personas, not nine

The "Nine Minds" terminology in the task prompt does not match the clone. The clone defines **5 lateral thinking personas** in a single enum:

**`src/ouroboros/resilience/lateral.py:50-68`** — `ThinkingPersona(StrEnum)`:

| Persona | Value | Description | Affinity (stagnation patterns) |
|---------|-------|-------------|-------------------------------|
| `HACKER` | `"hacker"` | Unconventional, bypasses obstacles, finds workarounds | Spinning (same error repeated) |
| `RESEARCHER` | `"researcher"` | Seeks more information, explores context | No Drift, Diminishing Returns |
| `SIMPLIFIER` | `"simplifier"` | Reduces complexity, challenges assumptions | Diminishing Returns, Oscillation |
| `ARCHITECT` | `"architect"` | Restructures fundamentally, changes perspective | Oscillation, No Drift |
| `CONTRARIAN` | `"contrarian"` | Inverts assumptions, questions everything | All patterns |

Source: `src/ouroboros/resilience/lateral.py:64-68` (enum values), `:73-80` (descriptions), `:83-114` (affinity patterns).

### Where "9" comes from

The architecture doc mentions "9 specialized agents" and "9 skills" (`docs/architecture.md` Section 1):
- **9 Agents** — separate from the 5 lateral personas. These are agent role markdown files under `src/ouroboros/agents/` (e.g., `socratic-interviewer.md`, `seed-closer.md`, `qa-judge.md`, `seed-architect.md`, `evaluator`). The architecture diagram labels "Agents (9)".
- **9/14 Skills** — the architecture says "14 core workflow skills" but the diagram says "Skills (9)". The skills directory has 23 entries.

The "Nine Minds" likely conflates the 9 agents + 5 lateral personas. The actual persona system that matters for codexclaw's mapping is the **5 ThinkingPersonas**.

### Interview advisory lanes (a second persona-like layer)

The interview skill defines **5 advisory lanes** for question-first fanout (`skills/interview/SKILL.md` "Question-first advisory fanout" section, and `src/ouroboros/mcp/tools/subagent.py:1297-1332`):

| Lane ID | Role | Persona mapping |
|---------|------|-----------------|
| `code_context` | Inspect repo-local facts, exact file/config evidence | (uses `researcher` agent if no persona set) |
| `web_context` | Browse/search current external facts only when needed | (uses `researcher` agent) |
| `ambiguity_contrarian` | Find hidden assumptions, vague terms, missing decisions, risky defaults | `contrarian` |
| `answer_simplifier` | Turn question into 2-3 easy choices or one concise draft answer | `simplifier` |
| `architecture_implications` | Check whether answer changes ownership, interfaces, rollout, or system shape | (no explicit persona — `general` agent) |

Source: `src/ouroboros/mcp/tools/subagent.py:1290-1332`.

### Lateral review for interview assist

For milestone lateral-review dispatch and main-session direct-answer assistance, the interview skill uses `personas=["researcher","contrarian","simplifier"]` by default, adding `architect` when the answer changes system shape (`skills/interview/SKILL.md` "Milestone lateral-review dispatch" and "Main-session direct-answer assistance" sections).

## 4. ⭐ Where Does Ouroboros RECORD Decisions?

This is the critical question for codexclaw. Ouroboros has a **multi-layer decision recording system**:

### 4a. Seed YAML — the primary decision artifact

The Seed is the **single source of truth for what should be built** (`llms.txt:11`). It is an **immutable frozen Pydantic model**:

```python
class Seed(BaseModel, frozen=True):
    goal: str = Field(..., min_length=1)
    constraints: tuple[str, ...] = Field(default_factory=tuple)
    ...
```

Source: `docs/contributing/key-patterns.md:46-54` (frozen Pydantic pattern), `docs/architecture.md` Section 2 ("Seed: Immutable frozen Pydantic model").

**Storage location**: Seed YAML files are written to `.ouroboros/seeds/seed_<hash>.yaml` (in-project, as seen in the clone: `.ouroboros/seeds/seed_78c8e6e41813.yaml`, `.ouroboros/seeds/seed_73827177a2a3.yaml`).

**Format**: YAML with fields: `goal`, `task_type`, `brownfield_context`, `constraints`, `acceptance_criteria`, `ontology_schema`, `evaluation_principles`, `exit_conditions`, `metadata` (containing `seed_id`, `version`, `created_at`, `ambiguity_score`, `interview_id`, `parent_seed_id`).

Source: `.ouroboros/seeds/seed_78c8e6e41813.yaml` (full example).

**Mutability**: The Seed model is **immutable** (`frozen=True`). Revisions create new instances with changed values rather than mutating. However, the QA Refinement Loop does **direct YAML edits in place** — "Edit the previous seed YAML in place. Apply ONLY user-accepted items. Do not start from scratch." (`skills/seed/SKILL.md` "Phase 4 — Restate" section). So the YAML file is mutable across iterations, but each generation's seed is conceptually immutable (a snapshot).

### 4b. EventStore (SQLite) — append-only event sourcing

All state changes are recorded as immutable events in a SQLite database at `~/.ouroboros/ouroboros.db`:

- **Append-only**: Events are never modified after creation (`docs/contributing/key-patterns.md:71-74`).
- **Full replay**: Any past state can be reconstructed from events (`docs/architecture.md` Section 4).
- **Implementation**: `src/ouroboros/persistence/event_store.py` — SQLAlchemy Core with aiosqlite backend (`event_store.py:1-5,16-17`).
- **5 optimized indexes** for performance (`docs/architecture.md` Section 4).

### 4c. Interview session state — persisted by MCP server

The interview session state (Q&A rounds, ambiguity scores, milestones) is persisted by the MCP server process. The interview skill references:
- `state.rounds` — stores answers intact (security validator allows up to 10 KB) (`docs/rfc/interview-hardening.md` Change 1).
- Session IDs are returned by `ouroboros_interview` and used to resume interviews across turns.
- `interview_session_id` is persisted before the first question generation call returns, so a timeout still leaves a resumable handle (`docs/auto-runtime-semantics.md` #687).

### 4d. Seed revision audit trail

Each seed revision in the QA loop appends an audit block to `~/.ouroboros/seed-revisions/<revision_key>.md`:

```markdown
## Iteration N — score X.XX
### Candidates
- [A] [QA+Simplifier] sharpen criterion 3 — **accepted**
- [B] [Socrates] re-add single-user constraint — **accepted**
### Diff vs. iteration N-1
- criteria[2]: "easy to use" → "first-time user completes flow in < 3 clicks"
```

Source: `skills/seed/SKILL.md` "Audit trail" section. The `revision_key` is derived from `session_id` or a slugified goal + UTC timestamp.

### 4e. CheckpointStore — workflow recovery

`src/ouroboros/persistence/checkpoint.py` provides checkpoint and recovery:
- `CheckpointData`: immutable checkpoint with SHA-256 hash for integrity validation (`checkpoint.py:28-75`).
- Recovery with rollback support (max 3 levels per NFR11) (`checkpoint.py:1-8`).
- `PeriodicCheckpointer`: background task for automatic checkpointing.

### 4f. Preferences and lineage

- `~/.ouroboros/prefs.json` — user preferences (e.g., `star_asked`, `welcomeShown`) (`skills/seed/SKILL.md` "After Seed Generation" section).
- Lineage tracking — causal chain of events and decisions through the workflow (`llms.txt:20`, `src/ouroboros/core/lineage.py`).

### Summary: Decision recording architecture

| Layer | Path | Format | Mutable? | Purpose |
|-------|------|--------|----------|---------|
| Seed YAML | `.ouroboros/seeds/seed_<hash>.yaml` | YAML | Immutable per-gen, edited across QA iterations | Primary spec — the decision artifact |
| EventStore | `~/.ouroboros/ouroboros.db` | SQLite rows (JSON payloads) | Append-only (immutable) | Full event sourcing, replay, auditability |
| Interview state | MCP server process → EventStore | In-memory → persisted | Mutable during interview, frozen at seed-ready | Q&A rounds, ambiguity scores, milestones |
| Seed revisions | `~/.ouroboros/seed-revisions/<key>.md` | Markdown | Append-only | QA loop audit trail |
| Checkpoints | `~/.ouroboros/` (via CheckpointStore) | JSON + SHA-256 hash | Immutable per checkpoint | Workflow recovery, rollback (max 3 levels) |
| Preferences | `~/.ouroboros/prefs.json` | JSON | Mutable | User onboarding state |
| Lineage | EventStore | Event chain | Immutable | Causal chain of decisions |

**Key insight for codexclaw**: Ouroboros records decisions primarily in the **Seed YAML** (the crystallized spec) and the **EventStore** (the append-only audit log). The interview itself does not write to the seed directly — it persists Q&A to the MCP server's state, which then feeds `ouroboros_generate_seed` to produce the Seed YAML. The main session never edits the seed during interview; it only edits during the post-generation QA Refinement Loop. This is a critical contrast with codexclaw's model where the main agent edits plan/devlog directly during interview.
