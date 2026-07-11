# WP2 Plan — Motion 3-Bucket Map + Media Budget (D4, D5)

Phase: P (session `019f4754-031e-7fc0-b53e-cf146a123cee`)
Decision source: `000_interview.md` D4/D5, M-series triage (M1-M10), G1-G4, round 2-3 answers.

## Loop-spec (HOTL bounds)

- Write scope: `dev-frontend/references/core/motion.md`,
  `dev-frontend/references/core/performance-budget.md`,
  `dev-frontend/references/core/visual-verification.md`,
  `dev-frontend/SKILL.md` (§2 signature line + §3 dial rows + liquid-glass/motion
  table row if needed), `dev-uiux-design/SKILL.md` (UX-DEFAULT-ISM-01 motion
  clause + §2 Dial Setting inference rules),
  `dev-frontend/references/core/preflight-full.md` (perf row wording if stale).
- Tools: apply_patch, rg, gpt-5.5 workers + reviewer. Budget: 1 wave, ~40min soft.

## Edits

### E1. motion.md — 3-bucket domain map + floor/ceiling (worker A)

- NEW rule FE-MOTION-BUCKET-01 (DEFAULT) near the top domain-gates table:
  - **Landing bucket** (landing/marketing/editorial/portfolio + marketing-facing
    pages of ANY product incl. AI tools/education/community): scroll-driven
    motion floor 2, ceiling ~4. A "scroll motion" = one distinct choreographed
    scroll-driven moment (signature or supporting reveal). Per-section identical
    fade-up repetition counts as ONE supporting moment total, not N.
  - **App bucket** (logged-in/in-app consumer views, education/community app
    screens): feedback + state-transition motion only; no scroll-motion floor.
  - **Tool bucket** (dashboards/admin/finance/gov/B2B repeated-work/dev
    consoles): scroll-driven motion = 0 (hard); feedback/state transitions
    (levels 1-4) preserved. Games: domain-specific, exempt.
  - Floor applies to the BASE experience only: `prefers-reduced-motion` and
    missing `@supports` legitimately deliver zero motion (M3).
- Doctrine line rewrite: "One well-choreographed moment > 10 scattered effects"
  becomes "One signature moment + a small number of supporting reveals beat 10
  scattered effects" and the landing floor is stated as
  "1 signature + >= 1 supporting reveal = floor 2" (M1).
- Reconcile level gates: scroll-driven sections currently gated "Level 8+"
  relax to "Level 5+ when needed to satisfy the landing floor" (M2/G4) — the
  bucket map, not the dial, is the primary gate.
- Dashboards row: state explicitly "scroll-driven = 0" while keeping the 1-4
  feedback allowance (M6).
- Bottom "Scroll Pattern Decision Tree": tool/dashboard/admin/auth/payment
  branch changes from "Prefer static layout or feedback-only motion" (soft) to
  "scroll-driven = 0 (hard, FE-MOTION-BUCKET-01); feedback-only motion allowed"
  (audit R1 blocker 1).

### E2. performance-budget.md — landing media exemptions (worker B)

- NEW rule FE-MEDIA-BUDGET-01 (DEFAULT): on landing-bucket surfaces, motion
  media (autoplay loop video, scroll-scrub video, frame sequences, large hero
  imagery) is EXEMPT from the byte-cap rows (500KB first-load / 100KB hero /
  200KB above-fold / image-audit flags) provided the loading mechanics hold:
  poster-first LCP (poster counts toward the hero image budget), lazy/IO-gated
  loading outside first paint, `prefers-reduced-motion`/`prefers-reduced-data`
  fallbacks to poster, stable layout (no CLS). No byte ceiling is imposed
  (user decision, round-3) — CWV field gates (LCP/INP/CLS) remain supreme (G1/G2).
- Byte-cap table rows get a "landing motion media: exempt, see
  FE-MEDIA-BUDGET-01" annotation; build-time image audit excludes declared
  motion-media assets (G3).
- Lighthouse row: resolve the internal contradiction toward SKILL.md —
  "Lighthouse Performance is advisory smoke only; CWV field metrics are the
  gate" (M5); preflight-full.md perf row aligned if stale.
- "Optimize heavy media / do not ship huge video without reason" wording keeps
  the rationale + mechanics requirement but drops the byte framing (G4-budget).

### E3. visual-verification.md — motion verification rows (main)

- Add checklist rows: landing bucket floor >= 2 / ceiling <= ~4 distinct scroll
  moments observed; tool surfaces show 0 scroll-driven motion; autoplay video
  has poster + pauses offscreen + respects reduced-motion/reduced-data (M9/M10).

### E4. Dial + doctrine reconciliation (main)

- dev-uiux-design/SKILL.md UX-DEFAULT-ISM-01 motion clause: "exactly ONE
  signature moment" -> "one signature moment + >= 1 supporting scroll reveal on
  landing-bucket surfaces (floor 2, ceiling ~4); feedback baseline elsewhere"
  with pointer to FE-MOTION-BUCKET-01.
- dev-uiux-design/SKILL.md §2 Dial Setting inference: "Marketing/landing ->
  MOTION 3-5" becomes "MOTION 5-7 (scroll floor applies)"; dashboards stay 1-2
  with "scroll-driven = 0" note.
- dev-frontend/SKILL.md §2 "What ONE thing will make this unforgettable?" gets
  a clarifying parenthetical (signature moment; supporting reveals may exist);
  §3 MOTION_INTENSITY row note pointing to the bucket map.
- dev-frontend/SKILL.md §4 Motion bullet: "One well-choreographed page load >
  10 scattered effects" -> "One signature moment + a few supporting reveals >
  10 scattered effects; landing floor/ceiling per FE-MOTION-BUCKET-01"
  (audit R1 blocker 2).

## Audit synthesis (round 1)

Reviewer FAIL with 2 blockers, both ACCEPTED as missing edit targets: motion.md
bottom decision tree (soft "prefer static" -> hard zero) and SKILL.md §4 old
one-moment doctrine line — folded into E1/E4 above. Finding 5 ACCEPTED: c4
verification widened to rg stale "One well-choreographed" variants and the
decision-tree tool branch.

## Dispatch plan

- Worker A (gpt-5.5): motion.md only. Worker B (gpt-5.5): performance-budget.md
  (+ preflight-full.md perf row) only. Main: E3 + E4 + integration read-back.
- Reviewer: same-lane plan audit now, consistency check post-build.

## WP2 acceptance (criteria c4-c5)

- c4: FE-MOTION-BUCKET-01 exists; dial tables + UX-DEFAULT-ISM-01 reconciled;
  rg finds no surviving unqualified "exactly ONE signature moment", no stale
  "One well-choreographed" one-moment variants, and the decision-tree tool
  branch states hard zero.
- c5: FE-MEDIA-BUDGET-01 exists with poster/lazy/CWV mechanics; Lighthouse
  advisory wording consistent across SKILL.md + performance-budget.md +
  preflight-full.md; visual-verification motion rows present.
