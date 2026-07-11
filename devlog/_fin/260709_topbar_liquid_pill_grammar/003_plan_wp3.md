# WP3 Plan — ima2-First Workflow + Reference Capture (D6, D7)

Phase: P (session `019f4754-031e-7fc0-b53e-cf146a123cee`)
Decision source: `000_interview.md` D6/D7, W-series triage (W1-W12), F-series
(F1/F3/F8/F9), rounds 2/4 answers (ima2 mandate "너무 안쓰잖아"; capture =
analysis-only; long-prompt + video assets over CSS gradients).

## Loop-spec (HOTL bounds)

- Write scope: `dev-uiux-design/SKILL.md` (§2.5 UX-CONCEPT-GEN-01 rewrite +
  §2 native-tool line), `dev-frontend/references/core/asset-requirements.md`,
  NEW `dev-frontend/references/core/reference-capture.md`,
  `dev-frontend/references/core/brand-asset-sourcing.md` (boundary section),
  `dev-frontend/SKILL.md` (§4 assets line + reference table row),
  `dev-frontend/references/core/iterative-design.md` +
  `prototype-variants.md` (precedence/sequence stub lines only).
- Tools: apply_patch, rg, gpt-5.5 workers + reviewer. 1 wave, ~45min soft.

## Edits

### E1. UX-CONCEPT-GEN-01 rewrite (worker A, dev-uiux-design/SKILL.md §2.5)

- Tooling mandate (W2/F3): step 0 is `ima2 status`; if down, ATTEMPT
  `ima2 serve` (background) and re-check before any skip; `$imagegen` is the
  fallback ONLY when ima2 is truly unavailable after the serve attempt; the
  chosen generator + skip reasons must be STATED in the deliverable. The pass
  is underused — wording changes from "when ima2 is available" to an active
  obligation ("probe, start, then generate").
- Skip-list fix (W1): "user already supplied a concrete design/reference/
  mockup" splits into (a) user handed a FINISHED design -> skip stands;
  (b) reference material captured/collected to ground mockups -> NOT a skip;
  it becomes generation input (--ref).
- Scope (H7 assumption): mandate fires on C2+ NEW/redesigned expressive or
  brand-visible surfaces (landing, hero, key chrome like top bar, major
  redesign); C0/C1 patches + utility CRUD/dashboard screens exempt.
- Component-level concepts (W4): context-strip shape — ~3 renders of the
  component INSIDE its top-viewport context (e.g. bar+hero), not isolated
  64px strips; element ledger shrinks to the component's tokens (material,
  radius, fills, type).
- Evidence contract (W8/W11): mockups land under the devlog unit assets dir;
  DESIGN.md cites per-token source variant; stated skips persist in the
  devlog; mockup != render verification (visual-verification.md still owns
  done-ness).
- Precedence (W6/W7): concept synthesis governs PRE-CODE; iterative-design
  Alive/Dead governs POST-CODE rounds; prototype-variants runs AFTER concept
  lock when structural variants are still needed — one sentence each, with
  matching stub lines added in iterative-design.md + prototype-variants.md.
- Long-prompt discipline (round-4): concept prompts remain maximally specific;
  asset prompts inside mockups/builds are VERY EXPLICIT LONG prompts; motion
  wants `ima2 video`; real/generated assets over CSS gradient washes.

### E2. asset-requirements.md rewrite (worker B)

- Shipped-pixel boundary (W3/F1): generated CONCEPT mockups (page or
  component) are exploration artifacts — legal, never shipped as UI pixels;
  the "never AI-generate the product UI itself" rule is SCOPED to shipped
  assets; generated photographic/texture/illustration/motion CONTENT assets
  are legal in builds (they are not UI pixels).
- Sourcing order (W9): the existing source-priority list applies to CONTENT
  assets; the concept-mockup pass is a process step outside that order.
- Tool naming (W10/F3): `ima2` canonical (probe/serve), `$imagegen` fallback —
  align the "generate it with..." wording.
- Long-prompt + video rule (round-4 answer): image assets generated with very
  explicit long prompts; motion via `ima2 video` where wanted; prefer real
  generated/photographic assets over CSS gradients (cross-ref
  opaque-gradient discipline / FE-GRADIENT-01).
- Provenance rule points to reference-capture.md manifest for captured
  third-party material (F8).

### E3. NEW reference-capture.md (worker B)

- Purpose: capturing another site's HTML/CSS/assets to LEARN structure and
  GROUND mockups (ima2 --ref), analysis-only.
- Mechanics: in-app browser `pageAssets` capability, `curl`/`wget` for public
  files, DOM snapshot for structure; store under the devlog unit, never under
  shipped project assets.
- Legal line (W5/round-4): captured assets NEVER ship; webfont binaries are
  NEVER copied (license-restricted by default); photography/logos analysis-only;
  what CAN ship comes from brand-asset-sourcing.md channels (press kits,
  licensed libraries).
- Provenance manifest (W12/F8): per capture — source URL, capture date,
  license status (unknown = assume restricted), intended use
  (analysis/mockup-ref), storage path. Manifest lives next to the captures in
  the devlog unit.
- Ship-gate row: "no captured third-party asset in the shipped build" joins
  the pre-flight (cross-ref in asset-requirements rules).

### E4. Boundary + table rows (main)

- brand-asset-sourcing.md: add "Captured reference material vs shippable
  assets" section stub pointing to reference-capture.md (F9): fonts never
  copied; nominative fair use covers shipped integration logos only.
- dev-frontend/SKILL.md: reference table row for reference-capture.md; §4
  Assets bullet updated to ima2-first (probe/serve, $imagegen fallback) +
  long-prompt/video discipline.
- dev-frontend/SKILL.md §2 concept-pass stub (line ~147): "when ima2 is
  available" -> active probe/serve mandate wording + C2+ expressive/key-chrome
  scope, matching the §2.5 canonical rewrite (audit R1 blocker 1).
- preflight-full.md: add "no captured third-party asset in the shipped build;
  capture manifest present for any reference captures" row (audit R1
  blocker 2; assigned to MAIN, not worker B, to keep ownership disjoint).
- dev-uiux-design/SKILL.md §2 "Native tool support" line: ima2 canonical,
  $imagegen fallback (F3).

## Audit synthesis (round 1)

Reviewer FAIL, 2 blockers ACCEPTED: dev-frontend SKILL.md §2 stub kept the old
soft "when ima2 available" gate (now E4 target), and the ledger's "no captured
asset shipped" pre-flight row had no actual preflight target (now E4, main-owned).
Finding 5 ACCEPTED: c6 gains rg for stale "when `ima2` is available" wording;
c7 gains the preflight row check.

## Dispatch plan

- Worker A: dev-uiux-design/SKILL.md §2.5 only. Worker B:
  asset-requirements.md + NEW reference-capture.md. Main: E4 + stub lines in
  iterative-design.md / prototype-variants.md + integration read-back.
- Reviewer: same-reviewer plan audit; post-build check in WP6.

## WP3 acceptance (criteria c6-c7)

- c6: §2.5 read-back shows probe/serve mandate, skip fix, context-strip,
  evidence contract, precedence lines; rg "ima2 status" + "ima2 serve" in
  dev-uiux-design/SKILL.md; rg finds no stale "when `ima2` is available"
  soft-gate wording in either SKILL.md.
- c7: reference-capture.md exists with manifest schema + never-ship rules;
  asset-requirements.md shipped-pixel boundary + long-prompt/video + ima2
  naming; brand-asset-sourcing boundary section; SKILL.md table row present;
  preflight-full.md carries the "no captured asset shipped" row.
