# promptgap loop — Work-Phase 1 PLAN (P)

Session: `cli` · cycle 1 · 2026-07-01 · author: main agent (self-owned, not subagent-stitched)

> User directive: own and structure the 100-109 promptgap track myself, validate via a
> research PABCD loop until it passes A-gate, send A-gate auditors with an EMPTY model field
> (inherit parent), scope strictly 100-109. Text-only RESEARCH; no skill-body edits.

## Objective (this work-phase)

Take the 100-109 + `000_INDEX.md` promptgap docs from "subagent-drafted" to "main-agent-owned":
every citation resolvable, format normalized, cross-doc overlap reconciled, INDEX synthesis
standing on verified evidence.

## Ground-truth verification already done in P

- codexclaw-side anchors spot-checked and accurate: `dev/SKILL.md:17,121,269,300,346,399`;
  `dev-code-reviewer/SKILL.md:13,74,83,120,131,323`; `interview/SKILL.md:14,18,30,34`.
- Reference-side anchors spot-checked and accurate: omo `programming/SKILL.md:14,38,185`,
  `debugging/SKILL.md:3,8,61`; jawcode `reviewer.md` (priority/criteria/cross-boundary blocks),
  `web-search.md:3`, `eager-todo.md:1`, `auto-continue.md:1`; prompts-core
  `atlas/default.md:95-135` (the 6-section MANDATORY TASK packet — exact match for 109's claim).
- cli-jaw `skills_ref/*` and `devlog/_fin/260608_dev_skills/*` paths all exist.
- Full citation existence sweep over all 10 docs (`/tmp/cite_check.py`): all MISSING hits are
  checker root-shorthand artifacts (real files under implied roots), EXCEPT one real defect.

## Defects to fix in B

1. **106 phantom path depth (REAL).** Doc cites
   `.../ulw-loop/references/full-workflow.md`; true path is
   `ulw-loop/skills/ulw-loop/references/full-workflow.md`. And `.../sample-quality-gate.json`
   lives at `ulw-loop/test/fixtures/sample-quality-gate.json`. Line ranges (118-129, 175-196)
   resolve once the path is corrected. Fix both path strings.
2. **Elided `.../` citations are reader-hostile.** Acceptable as shorthand, but the INDEX must
   declare the citation convention (root-relative + `.../` elision) so a reader can resolve them.
   Add a one-line "How to read citations" note to `000_INDEX.md` rather than de-eliding 200 paths.
3. **Ownership framing.** `000_INDEX.md` says "10 parallel explorers ... each owning one doc."
   Re-frame to "drafted by a parallel sweep, then re-owned/verified by the main agent this loop"
   so the provenance is honest and the verification step is visible.
4. **Format normalization.** 108 and 109 lead with `Status:` differently from 100-107; align the
   header block (Title → Gap class/evidence → optional blockquote → parity table → Reinforcement
   shape → Status) across all 10.

## A-gate (next, A phase)

Dispatch subagent auditors with EMPTY model (inherit parent) to red-team:
- pick a random sample of citations per doc and independently confirm file:line says what the
  doc claims (not just that the line exists);
- challenge whether any "gap" is actually already covered in the codexclaw skill body
  (false-positive gaps);
- challenge INDEX synthesis: are the 5 recurring patterns real across the cited docs?
Auditors return file:line-backed PASS/FAIL per claim. Integrate, then B.

## Out of scope

- No skill-body edits (`plugins/codexclaw/skills/**` stays untouched).
- No docs outside `devlog/_plan/promptgap/`.
- No runtime/hook code.

Status: PLAN (P). Advancing to A for adversarial audit.

---

## Cycle 1 outcome (D — closed 2026-07-01, session `cli`)

A-gate: 3 subagent auditors (1 on `opencode-go/glm-5.2`, 2 default-model before they hit 429).
Verdicts: 101/104/107/109 PASS; 100/102/105/106/108 PASS-WITH-FIXES; 103 FAIL.

Fixes applied in B:
- **103 (FAIL → fixed):** postmortem "missing" was a FALSE gap — it ships at
  `dev-debugging/SKILL.md:270-280` + `references/postmortem-template.md`. Rewrote the row,
  principle, reinforcement item, and header blockquote. Dropped a misattributed
  `system-prompt.md:360-363` cite from rows 2 and 6 (it supports disconfirmation, not
  toggle-proof/anti-flake).
- **106 (paths):** `start-work-continuation/directive.md` is bundled-omo, not `jawcode/`;
  `full-workflow.md` needed the `skills/ulw-loop/` segment; `sample-quality-gate.json` is under
  `test/fixtures/`. All corrected and verified on disk. Struck "fresh verification output" from
  the row-4 missing list (exists at `pabcd/SKILL.md:59`).
- **102 / 100 / 105 / 108 (overstated rows):** scoped each gap to what is genuinely missing,
  citing the already-present discipline (`dev-devops:118,158`; `dev:360,376`;
  `dev-code-reviewer:62`; `search:57`).
- **109 / INDEX:** softened the TASK-packet + authority-marker absolutes (directive-layer
  markers + `pabcd:88-89` partial contract); dropped the false 103 sub-claim from INDEX
  pattern 3; flagged pattern 5 as single-source; added a "How to read citations" convention
  note and honest provenance (drafted by sweep, re-owned + audited by main agent).

C evidence: `npm run build` exit 0 (38 files); citation resolver reports 0 genuine-missing
citations across 100-109. The one `npm test` failure (L19: untracked `metric-cli.js`/
`metrics.js` dist) is from a concurrent session's in-flight `metric*.ts` and is unrelated to
this text-only track — left untouched per the no-revert rule.

Status: DONE (research cycle 1 closed). Track is RESEARCH; promotion to a skill-body
implementation loop remains a user decision.
