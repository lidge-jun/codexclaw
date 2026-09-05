# Implementation Log (devlog) Routine — the documentation loop inside PABCD

Canonical placement and documentation routine for implementation units.
Numbering and general residence belong to
[Implementation units](../../pabcd/references/implementation-units.md);
folder introduction belongs to ../SKILL.md §2.1.
Read this routine for C2+/multi-phase unit documentation, not every small edit.
cxc-dev §0.1 is canonical for the C0 exemption and existing-unit-only C1 record.

## The unit: one implementation unit = one plan folder

```
devlog/
  _plan/
    YYMMDD_slug/          <- one implementation unit (not one issue, not one commit)
      000_plan.md         <- master plan: objective, constraints, work-phase map
      001_research_*.md   <- research/spec docs (000-009 range)
      010_phase1_*.md     <- phase 1 design at diff-level precision
      020_phase2_*.md     <- phase 2 ...
  _fin/                   <- completed units move here (closure record kept, not deleted)
```

Numbering: decade ranges separate concerns — `000-009` research/specs/MOC, `010-019`
phase 1, `020-029` phase 2, and so on. This repo standardizes on three-digit prefixes
(`000_`, `010_`, `020_`). Never bare semantic filenames (`PLAN.md`, `RCA.md`) — the
numeric prefix is the ordering and the audit trail.

## How the routine rides PABCD (the loop)

| Phase | Documentation action | Gate |
|-------|---------------------|------|
| P | CONCRETIZE: write `000_plan.md` (objective, measured baseline, dependency-ordered work-phase map, risks) + research docs `001+`; decade docs for **EVERY roadmap phase** at **diff-level precision** (exact paths, NEW/MODIFY/DELETE, before/after for MODIFY) — DIFFLEVEL-ROADMAP-01 | plan exists as files, not chat |
| A | AUDIT THE DOCS: an independent reviewer checks the plan docs — paths/signatures real, research coverage complete, phases sized, no ownership violations, no contradictions vs research | FAIL → fix docs → re-audit |
| B | Implementation cites the doc it executes; deviations are edited back into the doc BEFORE coding past them | doc and code never diverge silently |
| C | Gate results (commands + tails) recorded into the unit; general SoT docs patched to match the change (SOT-SYNC-01 — recommend creating one if absent) | evidence lives next to the plan |
| D | Attestation/summary appended to `000_plan.md`; on unit completion the folder moves `_plan/` → `_fin/` | durable closure record |

Multi-cycle units: one full PABCD per work-phase; ALL phase design docs are written
to diff-level in the FIRST P (or the design-only Phase-0 pass) —
DIFFLEVEL-ROADMAP-01. P of each later cycle re-verifies its pre-written doc against
the current codebase (stale check) and amends it BEFORE building; it never writes
the doc fresh mid-unit. The attestation log in `000_plan.md` is the continuity spine
— each new P quotes the previous D conclusion from it (see `pabcd` LOOP-CONTINUITY-01).

## Mapping to mainstream developer practice (translation table)

This routine is NOT an issue tracker. Issues are the industry's unit of *tracking*
(small, cheap, closable); this is the industry's unit of *thinking* — the design-doc
lineage. Mature orgs run BOTH and link them. If a collaborator says "devlog isn't
standard", translate:

| This routine | Mainstream equivalent |
|--------------|----------------------|
| `_plan/YYMMDD_slug/` unit folder | Design doc / RFC per feature (Google design docs, Rust RFCs, PEPs) |
| `000-009` research docs | RFC "Motivation / Prior art" sections |
| Diff-level phase docs | Detailed design; kernel patch-series cover letter |
| A-phase doc audit | Design review / RFC final-comment-period — review BEFORE code |
| Evidence in C, attestation in D | CI gate records + review sign-off |
| `_fin/` closure record | Shipped postmortem + changelog entry |
| Hard-to-reverse decisions | ADR (see `dev-scaffolding` §2.1 — separate, immutable) |
| Issue/ticket | Still useful: one issue per unit LINKING to the folder; sub-issues for tracking granularity |

Two deliberate differences from common practice, kept on purpose:
1. **Diff-level precision in the plan** — most design docs stop at architecture;
   agents execute better from exact-path plans, and the A audit becomes mechanical.
2. **Docs gate execution** (A before B) — in many teams design review is advisory;
   here it is a hard gate because the executor (an agent) will otherwise
   confidently build from a flawed plan.

## Class-scaled documentation

The full master-plan, diff-level roadmap, and doc-audit routine is mandatory for
C4, multi-phase units, and C3 needing persistent contract/architecture evidence.
General unit residence belongs to pabcd's implementation-units reference.
C0/C1 follows cxc-dev §0.1: C0 needs no numbered unit record; C1 records only in
an existing owning unit. Do not create a unit solely for a fast-path record.
Preserve the smallest fresh verification and all safety rules.
