# 050 — Phase 5: Additional Skill Overlap Resolution

## Objective
Resolve 5 discovered overlaps and 3 contradictions across 9 skill files.

## File Change Map

### 5A. pabcd + orchestrate + interview

#### MODIFY `skills/pabcd/SKILL.md` (277 lines)

1. **Line 27-38: DELETE** — I-phase dimension/contradiction rules duplicated in
   interview. Replace with: "**I — Interview**: HITL-only requirements discovery.
   Canonical rules (four dimensions, contradiction scanning, readiness gating,
   Q/A capture) live in `cxc-interview`; PABCD owns the phase edge I->P and
   the return-to-Interview affordance from any phase."

2. **Line 40-43: DELETE** — "Do NOT" bullets for interview also duplicated.

3. **Line 56: REPLACE** stale "self-advances" wording with: "In goal mode the
   agent must explicitly run `cxc orchestrate P` to start each PABCD cycle;
   nothing self-advances into P automatically, but the P->D sequence is never
   skipped."

4. **Line 76: REPLACE** — Phase 0 (I) description shortened to reference
   `cxc-interview` as canonical.

5. **After line 57: INSERT** — New `## Phase Control / Orchestrate` section
   absorbing the full content of orchestrate/SKILL.md lines 13-64:
   - Chat surface grammar
   - Human vs agent semantics
   - Per-phase artifact obligation (ORCH-ARTIFACT-01)
   - ATTEST-EVIDENCE-01
   - Control surfaces (shipped): chat free-pass, terminal agent-gated, footer

6. **Line 276: REPLACE** — Notes section updated to reference the merged
   Phase Control section instead of external orchestrate skill.

#### MODIFY `skills/orchestrate/SKILL.md` (64 lines)

**Full replacement — deprecation header:**
```markdown
---
name: cxc-orchestrate
description: "DEPRECATED — merged into cxc-pabcd. Use $cxc-pabcd for phase control."
metadata:
  deprecated: true
  redirect: cxc-pabcd
---

# cxc-orchestrate (DEPRECATED)

Phase control semantics have been merged into `$cxc-pabcd` under
"Phase Control / Orchestrate". Use `$cxc-pabcd` instead.
```

#### `skills/interview/SKILL.md` — NO CHANGES
interview stays as-is; pabcd now references it instead of duplicating.

---

### 5B. dev-frontend + dev-uiux-design

#### MODIFY `skills/dev-frontend/SKILL.md` (502 lines)

Strip design-judgment rules, add pointers to dev-uiux-design:

1. **Line 12-13: REPLACE** description — "Build production-grade frontend
   implementations from an established product/design direction. For design
   judgment, typography/color/layout direction, UX decision gates, load
   `dev-uiux-design` first."
2. **Line 23-24: DELETE** — visual direction/density profiling -> uiux-design
3. **Line 31-37: DELETE** — iterative design, typography judgment, macro layout
4. **Line 45: REPLACE** — add explicit role-separation row pointing to uiux
5. **Line 53-54: REPLACE** — remove default design-reference loading
6. **Line 72-93: REPLACE** — "Frontend Implementation Routing" stripped of
   design-judgment content, points to uiux-design for those decisions
7. **Line 110-153: REPLACE** — "Design Handoff Boundary" section: objective
   implementation gates stay, design judgment gates point to uiux-design
8. **Line 156-165: REPLACE** — Implementation section keeps execution, strips
   typography/color/layout philosophy
9. **Line 169-212: REPLACE** — "Anti-Slop Implementation Stub": frontend
   enforces enforceable constraints, full pattern catalog -> uiux-design
10. **Line 421-466: REPLACE** — Pre-Flight Checklist stripped of design-judgment
    items, adds "design direction from uiux-design or project conventions"

#### MODIFY `skills/dev-uiux-design/SKILL.md` (311 lines)

Strip implementation rules, add pointers to dev-frontend:

1. **Line 20-25: REPLACE** — Role separation statement: uiux owns judgment,
   frontend owns implementation
2. **Line 27-31: REPLACE** — remove browser-operation wording
3. **Line 35-39: REPLACE** — UX-STYLE-01 note: taste is STYLE_SAMPLE,
   implementation correctness enforced by frontend
4. **Line 45-59: REPLACE** — reference table uses decision language, not
   code/CSS ownership
5. **Line 129-157: REPLACE** — Visual Preference: decision only, CSS/token
   translation -> frontend
6. **Line 177-188: REPLACE** — Vague Request Disambiguation: decide direction
   here, implement through frontend
7. **Line 196-200: REPLACE** — rendered verification owned by frontend + testing
8. **Line 206-217: REPLACE** — Design Read template uses intent, not CSS tokens
9. **Line 264-311: REPLACE** — Design Vocabulary Translation: map to design
   intent, not code; after intent, load frontend

---

### 5C. dev-backend + dev-devops

#### MODIFY `skills/dev-backend/SKILL.md` (412 lines)

Strip deployment/operational gates, keep app-level hooks:

1. **Line 3: REPLACE** description — remove deployment/SRE from triggers
2. **Line 26-27: REPLACE** — observability/health reference descriptions:
   app-level hooks only, operational gates -> devops
3. **Line 40-43: REPLACE** — route operational requirements to devops
4. **Line 135-137: REPLACE** — connection registry/drain/memory as app hooks;
   deployment sequencing -> devops
5. **Line 160-162: REPLACE** — BACKEND-RUNTIME-01: app hooks stay, deployment
   gates -> devops
6. **Line 235: REPLACE** — observability table: app metrics only
7. **Line 299-312: REPLACE** — API Response Contract: remove operational gates
8. **Line 330-339: REPLACE** — "App-Level Observability Hooks": backend owns
   instrumentation; devops owns SLOs/alerts/dashboards
9. **Line 360-375: REPLACE** — "API Performance Signals": app measurements;
   SLO definition -> devops
10. **Line 385-391: REPLACE** — "Deployment Handoff" section: backend owns
    app compatibility hooks, devops owns delivery
11. **Line 402-409: REPLACE** — Checklist: remove rollback/operational items,
    add devops cross-reference

#### MODIFY `skills/dev-devops/SKILL.md` (340 lines)

Absorb operational ownership from backend:

1. **Line 11-12: REPLACE** — description absorbs deployment strategy, rollback
   proof, observability operations, health/readiness gates
2. **Line 28-30: REPLACE** — reference table makes ops ownership explicit
3. **After line 45: INSERT** — Backend handoff rule: backend implements app
   hooks, devops defines operational gates
4. **Line 122-149: REPLACE** — rollback/release proof includes health/readiness
   smoke evidence
5. **Line 311-325: REPLACE** — canonical ownership table with clear backend vs
   devops split

---

### 5D. dev + skill-hub + implicit visibility

#### MODIFY `skills/dev/SKILL.md` (514 lines)

1. **Line 86-90: REPLACE** — routing table: observability/release entries
   updated with devops ownership
2. **Line 161-162: REPLACE** — skill ownership: frontend -> implementation,
   backend -> app-level hooks
3. **Line 169: REPLACE** — uiux-design ownership description updated
4. **Line 173-180: REPLACE** — **Canonical visibility decision**: only cxc-dev
   is implicit-visible. All others on-demand. Stale claim removed.
5. **Line 196-201: REPLACE** — ownership map updated for all 3 overlap pairs +
   design intent row added
6. **After line 180: INSERT** — "Capability Routing Hub" section absorbing
   skill-hub routing content

#### MODIFY `skills/skill-hub/SKILL.md` (78 lines)

**Full replacement — deprecation header:**
```markdown
---
name: cxc-skill-hub
description: "DEPRECATED: capability routing now lives in cxc-dev."
metadata:
  deprecated: true
  redirect: cxc-dev
---

# skill-hub (DEPRECATED)

Capability routing is now canonical in `dev/SKILL.md` under "Capability
Routing Hub". The former implicit set claim is stale.

Load `cxc-dev`, then follow its routing table.
```

#### MODIFY `skills/search/SKILL.md` (implicit visibility fix, 2 locations)

1. **Line 11-14: REPLACE** — "This skill is on-demand; only cxc-dev is
   implicit-visible."
2. **Line 211-212: REPLACE** — same consistency fix in Notes section

(These changes also serve Phase 1's ultraresearch merge on the same file.)

---

## Scope Boundary
- IN: 9 skill files modified, 3 deprecated (orchestrate, skill-hub, goalplan+ultraresearch from Phase 1)
- OUT: runtime code (no hook/FSM changes in this phase), reference/ subdirectory files

## Accept Criteria
1. orchestrate + skill-hub have deprecation headers with redirect
2. pabcd contains merged Phase Control / Orchestrate section
3. pabcd references interview instead of duplicating I-phase rules
4. pabcd "self-advances" wording fixed
5. dev-frontend contains no design-judgment rules; points to dev-uiux-design
6. dev-uiux-design contains no implementation/code rules; points to dev-frontend
7. dev-backend contains no deployment/SRE gates; points to dev-devops
8. dev-devops absorbs operational ownership with backend handoff rule
9. dev contains Capability Routing Hub (absorbed from skill-hub)
10. Implicit visibility claim consistent: only cxc-dev is implicit across dev, search, skill-hub
