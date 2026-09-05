### Implementation-Unit Documents

Full documentation routine (P concretizes the docs, A audits them as a hard gate, D
archives to `_fin/`, plus the mainstream design-doc/RFC translation table):
[Implementation log](../../dev-scaffolding/references/implementation-log.md).

**Difflevel roadmap plan (STRICT, DIFFLEVEL-ROADMAP-01):** for any multi-phase unit
(2+ work-phases), the FIRST P — or the dedicated design-only Phase-0 pass — must
deliver the entire roadmap concretized: `000_plan.md` (objective, constraints,
dependency-ordered work-phase map) PLUS every phase's decade doc written to full
diff-level precision (exact paths, NEW/MODIFY/DELETE, before/after diffs) — each one
a copy-paste-executable PRD, not an outline. Scaffolding empty decade files to "fill
per cycle" does NOT satisfy this rule. Each later cycle's P starts from its
pre-written doc: re-verify it against the current codebase (stale check — earlier
phases may have moved lines, signatures, or files), amend the doc, then execute.
LOOP-CONTINUITY-01 applies on top.

**Lexicographic separation (STRICT, LEXICO-SPLIT-01):** every document in a unit
carries a numeric lexicographic prefix — bare semantic filenames (`PLAN.md`,
`DIFF_PLAN.md`, `PHASES.md`, `RCA.md`, an unnumbered `mvpplan/`-style folder) are an
A-phase FAIL, not a style nit. Research/spec material (000-range) and implementation
phase designs (decade ranges) are SEPARATE documents: no diffs inside a research
doc, no survey prose padding a phase doc — a document that mixes both fails the
audit.

**Unit residence (STRICT, UNIT-RESIDENCE-01):** C2+ development belongs to an
implementation unit (devlog/_plan/YYMMDD_slug/). Ceremony scales with class.
C0/C1 record behavior is canonically defined by [cxc-dev §0.1](../../dev/SKILL.md):
C0 is exempt from numbered unit records; C1 records in the owning unit only when
one already exists. Do not create a unit solely for a C0/C1 fast-path record.
This exception does not waive verification, safety, or behavior-based promotion.
When residence is required and no unit exists, use the existing repository's
unit convention; interview resolves placement when interview is in scope.

Devlog plan artifacts use decade-range numbering to separate concerns:

| Range | Purpose | Examples |
|-------|---------|----------|
| 000-009 | Research, specs, MOC | `000_plan.md`, `001_api_survey.md`, `002_competitor_analysis.md` |
| 010-019 | Phase 1 | `010_phase1_auth_module.md`, `011_phase1_db_schema.md` |
| 020-029 | Phase 2 | `020_phase2_frontend.md` |
| 030-039 | Phase 3 | ... |

Rules:
- 000-range durable research is mandatory for C4, and for C3 when cross-turn,
  contract, architecture, or repository-convention needs require it. It is optional
  for C0-C2 and low-persistence C3. C2+ still follows UNIT-RESIDENCE-01;
  C0/C1 follows cxc-dev §0.1 without a forced new unit.
- Default: sequential within decade (`000`, `001`, `002`...).
- Overflow (>10 docs in a range): use sub-index (`000_0_name.md`, `000_1_name.md`).
- NEVER use bare filenames like `PLAN.md`, `DIFF_PLAN.md`, `PHASES.md`, `RCA.md`.
- This repo uses 3-digit prefixes (`000_`, `010_`, `020_`). Do not mix with 2-digit.

**Loop / multi-pass tasks**: a "loop"/"루프" request (or work too large for one cycle) runs
as MULTIPLE PABCD passes — one per work-phase. Pre-plan the full slice map and WRITE
all per-phase decade docs (010_phase1, 020_phase2, ...) to diff-level up front
(DIFFLEVEL-ROADMAP-01) — scaffolding empty files is not pre-planning. Each
later cycle's P re-verifies its pre-written doc against the current codebase and
amends it before building. The first pass MAY be a design-only PABCD pass (Phase 0):
a code-free whole-system design/documentation cycle that produces exactly this
difflevel roadmap before the first implementation work-phase. Under a `cxc-loop`
multi-cycle entry this Phase-0 docs-only pass is the DEFAULT first work-phase, and
STRICT for HOTL goal loops (LOOP-DOCS-FIRST-01, `cxc-loop`) — there the roadmap
cycle's D locks the goalplan work-phase map before any implementation cycle starts.
The slice map is APPEND-friendly (LOOP-UNIT-CHAIN-01): an independent unit discovered
mid-loop — including a feature unrelated to the current slice — becomes a NEW
work-phase appended to the map/goalplan via a P-phase amendment, then runs as the next
cycle in the same session. "This needs its own PABCD" is a plan statement, never a
reason to close the goal or wait for a new session.

HITL and goal PABCD may both use `cxc-loop` divergence/collapse. In HITL, the agent
may choose divergence deliberately during I/P when intent is open, algorithmic direction
is uncertain, the objective is maximize/deceptive, or the user asks for alternatives.
In goal mode, the shipped automatic entry is the plateau Stop directive after recorded
non-improving metrics. Either way, record N>=2 grounded candidates, choose early
collapse at P for satisfy-spec work or late collapse at D for deceptive metrics, and
keep all candidate provenance in `.codexclaw/divergence/`. The agent still owns every
phase transition; no hook builds or races candidates automatically, and HITL P/A/B
pauses remain real confirmation points.

Faithful execution and PLAN-TRACK-01 remain in [Work-phase loop](../SKILL.md#work-phase-loop-multi-pass-tasks).
