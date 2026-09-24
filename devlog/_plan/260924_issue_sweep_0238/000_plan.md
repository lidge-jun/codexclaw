# Issue sweep for 0.2.38: PDF export completion, paged report layout, desktop evidence

Four open codexclaw issues describe defects this repository can fix. The paged-report exporter fails a valid report when Chrome 154 writes the PDF but never exits, and it does not print why (#240). The paged-report template breaks English contents labels, hides translatable header strings in CSS, and nothing catches SVG labels painted under later connectors (#241). The goalplan CLI silently drops misspelled flags and a misplaced `--surface`, desktop artifact identity files are never validated, native UI work has no render-observation path, and the lipo rule has no behavioral oracle (#239, the code half of #232). This unit fixes them, releases 0.2.38 and closes the issues. It also records why codexclaw closes #191 without a quota override (003_issue_191_decision.md).

Reader: a maintainer deciding whether to merge and release; familiarity with the dev-visualizer exporter, goalplan CLI and QA receipts is assumed.

## Loop contract

- Loop archetype: satisfy-spec HOTL, docs-first (LOOP-DOCS-FIRST-01).
- Trigger: user request on 2026-09-24 to record the #191 decision and close it, fix the other four open issues, release, and close them after release, through cxc-loop with gpt-6-sol subagents.
- Goal: codexclaw 0.2.38 published with wp2-wp5 shipped; #191, #240, #241, #239 and #232 closed with evidence.
- Non-goals: Codex core or desktop-app changes; #209 and #213 (their remaining defects live in the host); quota config writes; installing the release on any host; hook retrust; other repositories.
- Verifier: per-phase focused tests named in each decade doc; at every C, `npm run build` (dist freshness) and the phase's focused test globs through `cxc receipt test`; at wp6, full `npm test`, `npm run gate`, `inventory.mjs --check`, `check-versions.mjs 0.2.38`, hosted CI on the PR, dev and main at exact SHAs, release.yml dry-run then publish, local SHA256SUMS check. Skill prose is read by no test; its review is human (PLAN-VERIFIER-REAL-01).
- Stop condition: all ten goalplan criteria met with fresh evidence, or a real blocker after root-cause work.
- Memory artifact: this unit and .codexclaw/evidence/01a0d143-ac30-70c0-b494-27e596c0c7a7/.
- Expected terminal outcomes: DONE (release published, issues closed); BLOCKED (CI or release infrastructure outside scope); NEEDS_HUMAN (missing GitHub permission or protected-branch refusal); UNSAFE (a step would expose secrets).
- Escalation: those same conditions. Delegation follows DISPATCH-RETIRE-01; a builder slice not in a decade doc needs a P amendment.
- Resource bounds: this checkout, gh with the user's credentials, local Chrome 153, pdfinfo/pdftotext, Xcode and CLT 27.0 lipo. Writes limited to the IN scope. No token or wall-clock bound was stated; host limits apply.

## Scope and file map

IN (details in each decade doc):

```
plugins/codexclaw/skills/dev-visualizer/{scripts,assets,reference,SKILL.md}   wp2 (010), wp3 (020)
plugins/codexclaw/test/report-export.test.mjs, test/fixtures/visualizer-export-tools.mjs   wp2, wp3
plugins/codexclaw/components/pabcd-state/{src,dist,test}   wp4 (030), wp5 (040)
plugins/codexclaw/skills/qa/scripts/validate-evidence.mjs and its tests   wp5
plugins/codexclaw/skills/dev-devops/{references,scripts}   wp5
plugins/codexclaw/skills/loop/references/durable-goalplan.md   wp4, wp5
version metadata, READMEs, CHANGELOG, inventory, docs-site lines   wp6 (050)
```

## Ordered work phases

- wp1 (this cycle): docs-only roadmap: 001 research, 002 architect consultation, 003 #191 decision, 010-050 diff-level docs. No production edits. #191 is closed at this cycle's D.
- wp2: exporter completion on a hung Chrome and visible failure reasons (010, #240).
- wp3: contents column, header locale lint, paint-order rule, SVG crossing diagnostic (020, #241). After wp2 because the diagnostic pass reuses the reworked `runTool`.
- wp4: goalplan CLI per-verb flag validation (030, #239 part D). Foundation for wp5's `--presented` flag.
- wp5: artifact identity validation and receipt binding, presented native criteria and render observation, lipo oracle (040, #239 parts A-C). After wp4.
- wp6: release 0.2.38 and issue closure (050).

Dependency order follows the build order: exporter process handling before the exporter QA pass that reuses it; CLI parsing before the criterion attribute it carries; everything before release. One branch (`codex/issue-sweep-0238`), ordered commits, one ordinary PR to dev, then the usual dev → main promotion PR. No native stacks: the phases are small enough to review as one PR with per-phase commits. Main owns git, the FSM and delivery; gpt-6-sol subagents draft docs, build within disjoint write scopes, and review.

## Issue acceptance mapping

| Issue item | Where it lands |
|---|---|
| #240 complete staged PDF accepted from a Chrome that never exits | 010 D2.1, D2.2 |
| #240 failure reason always printed in the text summary | 010 D2.3 |
| #241 contents label column sized from content | 020 D3.1 |
| #241 running-header strings locale-bound or marked translatable, with a QA warning | 020 D3.1 (translator comment), D3.2 (P2 lint) |
| #241 DIAGRAM-LAYOUT-01 paint-order and halo rule | 020 D3.3 |
| #241 export QA reports SVG label crossings as P2 | 020 D3.4 (best-effort REVIEW diagnostic) |
| #239 `--surface` ignored on four verbs; misspelled flags skipped | 030 D4.1 |
| #239 artifact identity inside receipts | 040 5A (D5.1) |
| #239 native render observation keyed on presented surface | 040 5B (D5.2) |
| #239 tool-usage oracle for lipo | 040 5C (D5.3) |
| #232 code follow-ups | closed through #239 at wp6 |

## Architect consultation

- Handle: 01a0d14c-2ee0-7dc2-9091-b6c01f5d9809 (gpt-6-sol). Decisions D2.1-D6.1 and dispositions are in 002_architect_consultation.md.
- Reflection: recorded in 002 after this plan revision is sent back.

## Source of truth sync

Each implementation C patches the skill text that describes the changed behavior (report-pipeline.md, SKILL.md DIAGRAM-LAYOUT-01, durable-goalplan.md, native-desktop-acceptance.md) and, when a component contract changes, the matching structure/INDEX.md row. wp6 patches CHANGELOG, README badges and docs-site lines.

## Audit synthesis

Reviewer 01a0d197-6cfe-7d82-af8f-eda6a8f8fceb (gpt-6-sol) audited this roadmap in four rounds with the same handle.

- Round 1, FAIL, seven blockers. Main accepted eleven of twelve findings and rebutted one: a single native observation clearing the advisory for every criterion stays a disclosed soft-advisory residual. The design changes (attributable kill for `stage-stable`, whole-result rejection of malformed DOM data, a directory-shaped `.app`, criterion-bound identities, v2+ scope of the final-gate check, symlink containment) went back to the architect, who returned ALIGNED. Folds are at 6bdddb33.
- Round 2, FAIL, three blockers: a double-escaped trailer regex, an `.app` without byte binding, and an inventory command that only checks. Folded at 9c579026.
- Round 3, FAIL, two blockers: a stale "sha256 must be absent" check, and bundle symlinks escaping the tree digest. Folded at 7aef6798.
- Round 4, PASS.

Each round found different and smaller defects, so the loop was converging rather than repeating. LOOP-REPAIR-01's replan trigger (the same failure repeated) did not apply.

The roadmap is locked here. Implementation starts with wp2 from 010_export_completion.md, and each later cycle rechecks its decade doc against the tree at its own P.
