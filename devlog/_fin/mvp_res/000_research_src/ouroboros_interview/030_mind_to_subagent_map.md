# 030 — Mind-to-Subagent Mapping: Ouroboros Personas → Codexclaw Minds → Codex Subagent Roles

> Source clone (gitignored): `.ouroboros/` inside this research folder.
> All citations use paths relative to the clone root.

## 1. Ouroboros Persona Inventory (source of mapping)

Ouroboros has two distinct persona-like systems (see 010 doc for full detail):

### 1a. Lateral Thinking Personas (5)
Defined in `src/ouroboros/resilience/lateral.py:50-68`:
- `HACKER` — unconventional workarounds (affinity: Spinning)
- `RESEARCHER` — seeks more information (affinity: No Drift, Diminishing Returns)
- `SIMPLIFIER` — reduces complexity (affinity: Diminishing Returns, Oscillation)
- `ARCHITECT` — restructures fundamentally (affinity: Oscillation, No Drift)
- `CONTRARIAN` — inverts assumptions, questions everything (affinity: all patterns)

### 1b. Interview Advisory Lanes (5)
Defined in `src/ouroboros/mcp/tools/subagent.py:1290-1332`:
- `code_context` — repo-local facts (maps to `researcher` agent)
- `web_context` — current external facts (maps to `researcher` agent)
- `ambiguity_contrarian` — hidden assumptions, vague terms (maps to `contrarian`)
- `answer_simplifier` — easy choices/draft answers (maps to `simplifier`)
- `architecture_implications` — system shape, ownership, rollout (maps to `general`)

### 1c. Agent Roles (under `src/ouroboros/agents/`)
- `socratic-interviewer.md` — pure question generator, no tools
- `seed-closer.md` — decides when interview is safe to stop
- `qa-judge.md` — evaluates seed quality, returns verdict JSON
- `seed-architect.md` — generates seed from interview results
- `evaluator` — qualitative evaluation

## 2. Codexclaw's 5 Chosen Minds

Per the task spec, codexclaw chooses 5 Minds for interview hardening:
1. **Contrarian** — challenges assumptions
2. **Socratic** — probes through questioning
3. **Ontologist** — examines what things ARE, root cause vs symptom
4. **Evaluator** — assesses quality, completeness, tradeoffs
5. **Simplifier** — reduces complexity, removes unnecessary elements

## 3. ⭐ Mapping Table: Ouroboros → Codexclaw → Codex Subagent Role

| Codexclaw Mind | Ouroboros Source | Ouroboros Persona/Lane | Codex Subagent Role | What It Reads | What It Returns |
|----------------|------------------|------------------------|--------------------|---------------|-----------------|
| **Contrarian** | `ThinkingPersona.CONTRARIAN` | Lateral persona + `ambiguity_contrarian` advisory lane | Contradiction-finder: challenges assumptions, finds hidden risks | Current plan/devlog sections, stated constraints, user's latest answer, prior Q&A context | **Contradictions only**: list of assumptions that don't hold, conflicts between stated goals and constraints, risks the plan ignores |
| **Socratic** | `socratic-interviewer.md` agent + interview question-generation logic | Not a lateral persona — it's the interview methodology itself | Gap-finder: identifies what is NOT yet specified | Current plan/devlog, stated goals vs acceptance criteria, what's missing | **Contradictions only**: gaps where the plan is silent on a decision that would change execution, unstated non-goals, missing verification expectations |
| **Ontologist** | `ontology_questions.py` + `ARCHITECT` persona's structural lens | `architecture_implications` advisory lane + `ontology_questions.py` | Structure-finder: examines what things ARE vs what they're assumed to be | Ontology schema in plan, entity definitions, field types, data model | **Contradictions only**: entities referenced but undefined, type mismatches, root-cause-vs-symptom confusions, circular definitions |
| **Evaluator** | `qa-judge.md` agent + `evaluate` skill's Stage 2 | QA Judge role + evaluation principles from seed | Quality-finder: assesses measurability and testability | Acceptance criteria, evaluation principles, exit conditions in plan | **Contradictions only**: unmeasurable criteria, untestable claims, exit conditions that can't be verified, weight imbalances |
| **Simplifier** | `ThinkingPersona.SIMPLIFIER` + `answer_simplifier` advisory lane | Lateral persona + `answer_simplifier` advisory lane | Complexity-finder: identifies what should be removed or merged | Full plan/devlog, acceptance criteria count, constraint list | **Contradictions only**: redundant criteria, over-fragmentation (criteria that are sub-steps of siblings), unnecessary constraints, scope that can be cut |

### Source citations for each mapping

**Contrarian**:
- Ouroboros persona: `src/ouroboros/resilience/lateral.py:67` (`CONTRARIAN = "contrarian"`)
- Ouroboros advisory lane: `src/ouroboros/mcp/tools/subagent.py:1311-1317` (`ambiguity_contrarian` lane task: "Challenge the question and the likely answer. Identify hidden assumptions, overloaded terms, missing constraints, and decisions the human might accidentally skip.")
- Interview assist usage: `skills/interview/SKILL.md` "Main-session direct-answer assistance" section (`personas=["researcher","contrarian","simplifier"]`)

**Socratic**:
- Ouroboros agent: `src/ouroboros/agents/socratic-interviewer.md:1-60` (pure question generator, targets biggest ambiguity, breadth control, stop conditions)
- Interview methodology: `skills/interview/SKILL.md` Path A (MCP is question generator, main session is answerer/router)
- Note: In codexclaw, Socratic is NOT the question-asker (the main agent asks questions). The Socratic subagent finds GAPS — places where the plan is silent — and returns them as contradictions.

**Ontologist**:
- Ouroboros source: `src/ouroboros/core/ontology_questions.py` (ontological questions: "What IS this?", "Root cause or symptom?", "What are we assuming?")
- Ouroboros advisory lane: `src/ouroboros/mcp/tools/subagent.py:1324-1329` (`architecture_implications` lane task: "Check whether the answer would affect system shape, ownership, interfaces, rollout, data model, or verification strategy.")
- Ouroboros persona affinity: `src/ouroboros/resilience/lateral.py:103-106` (`ARCHITECT` — "Restructures fundamentally, changes perspective")
- Note: Codexclaw's Ontologist is a new Mind not directly present in ouroboros's 5 lateral personas. It maps from the intersection of `ARCHITECT` (structural lens) and `ontology_questions.py` (what-IS-this questioning).

**Evaluator**:
- Ouroboros agent: `src/ouroboros/agents/qa-judge.md` (returns verdict JSON: `pass`/`revise`/`fail`, score, dimensions, differences, suggestions, reasoning)
- Ouroboros skill: `skills/evaluate/SKILL.md:29-33` (Stage 2: AC compliance, goal alignment, drift measurement)
- Seed QA loop: `skills/seed/SKILL.md` "QA Refinement Loop" (pass threshold 0.90, max 5 iterations)

**Simplifier**:
- Ouroboros persona: `src/ouroboros/resilience/lateral.py:66` (`SIMPLIFIER = "simplifier"`)
- Ouroboros advisory lane: `src/ouroboros/mcp/tools/subagent.py:1318-1323` (`answer_simplifier` lane task: "Turn the question into an easy response surface: 2-3 concrete answer options or one recommended draft the user can approve or edit.")
- Seed QA quality bar: `skills/seed/SKILL.md` QA call — "Flag over-fragmentation (more than 7 criteria, or any criterion that is a sub-step of a sibling) as a difference with the same severity as a missing piece — merging redundant criteria is as important as adding missing ones."

## 4. Subagent Output Contract (per Jun's Rule)

**Jun's rule**: Subagents output **CONTRADICTIONS ONLY** — no questions, no plan edits, no user calls.

This is a significant departure from Ouroboros's subagent output model. Ouroboros subagents return:
- Advisory findings + suggested options + unresolved ambiguities (`subagent.py:1366-1375`)
- Lateral alternative plans + challenged assumptions + verdicts (`subagent.py:1867-1878`)
- QA verdicts with suggestions (`skills/seed/SKILL.md` QA loop)

Codexclaw subagents return ONLY contradictions. This means:

### Output format (proposed for codexclaw)

Each subagent returns a structured contradiction list:

```json
{
  "mind": "contrarian|socratic|ontologist|evaluator|simplifier",
  "contradictions": [
    {
      "severity": "blocking|major|minor",
      "type": "assumption_conflict|missing_decision|structural_gap|untestable|redundant",
      "location": "plan.md:42 or devlog/section-name",
      "description": "The plan assumes X at line 42 but constraint Y at line 15 makes X impossible.",
      "evidence": "Exact quote or file:line reference"
    }
  ]
}
```

### What subagents MUST NOT do (enforced by contract)

| Prohibited action | Ouroboros allows it? | Codexclaw allows it? |
|-------------------|----------------------|----------------------|
| Ask the user a question | Yes (advisory lanes suggest options) | **NO** — main agent only |
| Edit the plan/devlog | No (MCP server owns state) | **NO** — main agent only |
| Generate new questions | Yes (Socratic interviewer) | **NO** — main agent only |
| Propose solutions | Yes (lateral personas produce plans) | **NO** — contradictions only |
| Call MCP tools | No (subagents are isolated) | N/A (no MCP) |
| Return suggested options | Yes (answer_simplifier lane) | **NO** — contradictions only |

### What each Mind reads vs returns

| Mind | Reads (input scope) | Returns (output scope) |
|------|--------------------|-----------------------|
| Contrarian | Stated goals, constraints, user's latest answer | Assumptions that conflict with constraints; risks the plan ignores |
| Socratic | Plan completeness, gaps between goals and acceptance criteria | Decisions the plan is silent on that would change execution |
| Ontologist | Entity definitions, field types, data model, ontology schema | Undefined entities, type mismatches, root-cause/symptom confusions |
| Evaluator | Acceptance criteria, evaluation principles, exit conditions | Unmeasurable criteria, untestable claims, unverifiable exit conditions |
| Simplifier | Full plan, criteria count, constraint list | Redundant criteria, over-fragmentation, unnecessary scope |

## 5. Dispatch Model Comparison

### Ouroboros dispatch (MCP-mediated, natural-language delegation)

```
MCP tool returns meta.question_advisory_subagents or meta._subagents
    ↓
Codex main session reads payload array
    ↓
Spawns one Codex subagent per payload (natural-language delegation)
    ↓
Each subagent gets: prompt, context (session_id, lane_id/persona, question)
    ↓
Results correlated by context.lane_id or context.persona
    ↓
Main session synthesizes advisory findings → user
```

Source: `src/ouroboros/backends/capabilities.py:202-223` (Codex `orchestrate_subagents` guidance).

### Codexclaw dispatch (codex-native spawn_agent, no MCP)

```
Main agent reads current plan/devlog state
    ↓
Main agent spawns 5 subagents via spawn_agent (one per Mind)
    ↓
Each subagent gets: read-only plan/devlog snapshot + Mind-specific lens
    ↓
Each subagent returns: contradictions only (structured JSON)
    ↓
Main agent synthesizes contradictions → formulates ONE question for user
    ↓
Main agent edits plan/devlog based on user answer
    ↓
Main agent re-spawns subagents (loop)
```

### Key difference in correlation

Ouroboros correlates subagent results by `context.persona` (lateral) or `context.lane_id` (advisory) — these keys are set by the MCP server in the payload (`capabilities.py:215-221`). Codexclaw must implement its own correlation since there is no MCP server to set these keys — the main agent must track which Mind produced which contradiction set.

## 6. Persona Selection Strategy

Ouroboros uses deterministic persona routing for QA failures (`src/ouroboros/auto/lateral_routing.py:122-150`):
- Pattern-based primary persona selection (each stagnation pattern maps to a persona)
- Fallback chain excluding already-tried personas
- "Each persona may be invoked at most once per evaluate session" guard

For codexclaw, the selection strategy could be simpler: spawn all 5 Minds in parallel each round (since they're lightweight contradiction-finders, not full advisory agents). This eliminates the need for pattern-based routing — all perspectives run every round, and the main agent prioritizes contradictions by severity.
