# 260913 Logic-analysis skill unit — roadmap

## Objective

Distill a **logic-analysis methodology** (로직 파악 — understanding how a system
works, as opposed to fixing a defect) from three reverse-engineering learning
repos and integrate it into one existing codexclaw skill, then ship it through
the dev → main release pipeline.

The failure this unit closes: agents asked "figure out how this app / AI tool /
undocumented API works" too often answer "I can't" or skim the surface. Classic
reverse-engineering pedagogy is exactly the discipline of comprehending an
unknown system from observation, but its presentation (assembly, debuggers,
GUI tools) does not transfer to an agent context. This unit translates the
*method*, not the tooling.

Host goal: `distill-logic-analysis-methodology-from-re-learn`, session
`0d7e3cc3-8bdf-4645-8cf6-a7d42a2fb2ab`. This unit is the docs-only pass required
by LOOP-DOCS-FIRST-01; its D locks the work-phase map below.

## Source material (measured, this session)

Shallow clones at `/tmp`, verified present this session:

| Clone | Upstream | Stars | Shape |
|---|---|---|---|
| `/tmp/re-mytechnotalent` | mytechnotalent/Reverse-Engineering | 14.3k | Per-lesson tutorial folders, x86/x64/ARM/AVR/RISC-V, 424 files |
| `/tmp/re-wtsxdev` | wtsxDev/reverse-engineering | 10.4k | Awesome-list README taxonomy, 34 files |
| `/tmp/re-z0f` | 0xZ0F/Z0FCourse_ReverseEngineering | 5.9k | Chapter course (1-8), Lingo/FAQ, 242 files |

Three parallel explorer subagents (grok-4.6) each mine one clone for:
methodology principles with `path:line` evidence, agent-translatable
techniques, anti-give-up patterns, and content that must NOT be generalized.
Raw synthesis lands in `001_analysis_synthesis.md`.

## Target-skill decision (audit result)

Candidates audited against the request surface ("understand how X works",
not "fix X"):

| Candidate | Fit | Verdict |
|---|---|---|
| `dev-debugging` | Owns systematic investigation of unknown behavior (Phase 1 trace/instrument, Phase 3 hypothesis discipline). Its boundary statement scopes it to *defects*; logic analysis is the same epistemics aimed at *comprehension*. 414/500 lines — headroom for a compact routing section. | **CHOSEN** — add `references/logic-analysis.md` + routing section + trigger metadata |
| `search` | Owns external/public-web evidence. Logic analysis is primarily *local observation* of a target system; search is one rung, not the owner. | Rejected — cross-link only |
| `qa` | Owns driving user-facing surfaces for verification. Overlaps on black-box probing but its gate is release verification, not comprehension. | Rejected — cross-link only |
| New skill | User explicitly prefers extending an existing skill; dev-debugging's Phase 1/3 machinery is 80% of the method. | Rejected unless A-phase audit finds a boundary collision |

Boundary rule for the edit: dev-debugging keeps defect RCA as its core; the new
reference is routed to when the request is **comprehension without a defect**
("how does X work", "뜯어봐", "로직 파악", "reverse-engineer this flow").

## Constraints

- Skill text English; SKILL.md ≤ 500 lines; bulk content in `references/`
  (workspace AGENTS.md §2/§8).
- Commit format `[agent] {type}: {description}`; work stays on `dev`.
- Push + dev→main merge + release are explicitly user-authorized for this goal.
- No component/hook code changes; docs/skill content only.
- No new dependencies. No destructive git operations.

## Work-phase map

| WP | Title | Decade docs | Depends on |
|---|---|---|---|
| wp0-roadmap | This docs-only pass: parallel analysis, target decision, locked roadmap | `000_`, `001_` | — |
| wp1-skill-content | Integrate methodology into `dev-debugging` + validate (gate/tests) | `010_` | wp0-roadmap |
| wp2-release | Push dev, PR + merge dev→main, confirm release deploy | `020_` | wp1-skill-content |

## Acceptance criteria (goalplan c-1..c-4)

1. Analysis notes for all three clones under this unit dir with repo
   `path:line` evidence.
2. Target skill chosen with rationale (this section); methodology integrated;
   SKILL.md ≤ 500 lines; English.
3. Fresh validation output (repo gate / relevant tests) passes after the edit.
4. dev pushed; dev→main PR merged; release/deploy outcome confirmed with link
   or CI status.

## Resource bounds (HOTL)

Write scope: this repo on `dev` + `/tmp` clones. Tools: shell, gh, explorer
subagents (analysis only). No credential/settings changes. Wall-clock: this
session. Subagent budget: the three dispatched explorers + at most one
reviewer in wp1 A-phase.
