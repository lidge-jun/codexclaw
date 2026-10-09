# wp3 — core skills, the standard file and the gate

Goal: `dev`, `loop` and `pabcd` become small routers (dev ≤ 12 KiB, loop and pabcd ≤ 8 KiB each; working targets 8 / 3 / 4 KiB), each obligation in their reference set has one owner, dated narrative leaves the instruction text, and a gate keeps it that way. Duplication map, narrative list, guard-backed passages and test pins: research/20_core_skills.md (aliases D, L, P, PP, PC, DEL, DS, PO, IU, LD, RL, DG, W, SP, DP, SO).

Before: D 32,812 B, L 11,159 B, P 12,335 B (56,306 B); references DS 23.4 KB after #287, DEL 28.4 KB, SP 28.9 KB.

## B1 — standard and gate (main)

- NEW `structure/70_prompt_architecture.md`: 001_layering_standard.md, with the devlog-only notes removed. MODIFY `structure/INDEX.md`: one row.
- NEW `plugins/codexclaw/scripts/check-prompt-architecture.mjs` (≈150 lines, node only). Checks: (1) L2 `description` ≤ 320 chars, `short_description` ≤ 100 chars; (2) L3 body ceilings dev 12,288 B, loop/pabcd 8,192 B, others 10,240 B, with an `EXCEPTIONS` map {skill: {max: current bytes, reason, owner: "wp4"}} that may only shrink; (3) every relative Markdown link under skills/** resolves; (4) a rule ID is defined (heading or `ID (STRICT|DEFAULT|HEURISTIC|ESCALATE|STYLE_SAMPLE)` in a definition line) in at most one file, with an allow-list for known shared definitions found at B; `--report` adds L4 sizes > 24 KiB and verbatim ≥ 80-char sentences repeated across files. Exit 1 on (1)-(4) failures.
- MODIFY `plugins/codexclaw/scripts/gate.mjs`: call it (spawnSync node, fail the gate on exit ≠ 0). NEW `plugins/codexclaw/test/prompt-architecture.test.mjs`: the script passes on the repo; a temp fixture with a 400-char description, a broken link and a doubly defined ID fails with all three reported (negative cases prove the checks fire).

## B2 — dev/SKILL.md (sol lane "dev"; writes skills/dev/**)

Target outline (≈ 8 KiB): frontmatter (description from wp4 table) · authority paragraph · C0-C5 table + fast path + tie-break + C4 promotion (merged, one table) · rule classes (5 lines) · universal rules: verification gate (5 steps + claim table), FAMILY-SLOP/READER/CITE/PROOF in one list, safety list (DEV-GIT-COMMIT-01, DEV-GIT-PUSH-01, DEV-SHELL-TEXT-01, DEV-PRIVACY-01, destructive ESCALATE, public contracts) one line each · reading contract (full selected reads, truncation recovery; stated once here) · surface router table (unchanged rows) · discovery delegation (≤ 8 lines + packet link) · conditional routes table: PR/stack, methodology, practice (`0.5/`1/`1.5/`2 merged into one row), debugging, CI evidence, async questions, peers, native execution, browser, recall, skill discovery, static analysis, resource budget, ownership.

Moves: `3 hosted-CI block (D:356-411) → NEW `skills/dev/references/hosted-ci-evidence.md` (keeps DEV-CI-EVIDENCE-01 and the gh recipes). Background-terminal sentence (L1 owner gap) → `references/native-execution.md`. Must keep exact link targets pinned by MT:156-160,187-192, NT:45-55, MT:196-203 (`references/skill-catalog.md`) and the JSON-quoted one-line description (SAT:1179-1189).

## B3 — loop/SKILL.md and pabcd/SKILL.md (sol lane "loop-pabcd"; writes those two files only)

loop (≈ 3 KiB): frontmatter · intent and authority (bare cxc-loop = scoped HOTL; explicit limits win; HOTL adds persistence, never permissions) · leaf vs dispatched task in 3 lines + dispatch-surfaces link · reading rule pointer to dev · routing table (all MT:172-183 targets kept) · invariants as one list: ORCH-MANDATE-01, HOTL needs goal + in-flight cycle, one work-phase = one cycle, LOOP-CONTINUE-01, LOOP-CONTINUITY-01, LOOP-GIT-01 (one line each) · docs-first (LOOP-DOCS-FIRST-01, LOOP-READS-PABCD-01) · outcomes. Removed: DISPATCH-SURFACE-01 essay (owner DS), peer/async paragraphs (owner dev), binding algorithm (owner PC).

pabcd (≈ 4 KiB): frontmatter · one-paragraph what/where-state · intent boundary (1 sentence + dev pointer) · FSM diagram · phase table (I, P, A, B, C, D: work + mandatory owner; B and D lines keep DEV-GIT/stack pointers) · work-phase invariant · implementation units pointer · class depth → "dev `0.0 owns class; PABCD depth per class:" keep the 5-row depth table (it is PABCD-specific) · delegation: 3 lines + DS/DEL links · loop engineering pointer (LOOP-REPAIR-01, LOOP-DOOM-01, REVIEW-SYNTHESIS-01 names kept) · state files moved to phase-control. All MT:161-170 targets kept.

## B4 — core references (sol lane "refs"; writes skills/pabcd/references/{dispatch-surfaces,delegation}.md, skills/loop/references/{lane-dispatch,waiting,runtime-lifecycle,durable-goalplan}.md, skills/pabcd/references/{implementation-units,plan-output}.md, skills/dev/references/stacked-prs.md)

- DS: surface choice, isolation, grant only. DISPATCH-FORK-LANE-01 (from #287) keeps its rule (fork = thread with own task; confirm actual permission; create own worktree, `cxc session bind` then `cxc session source`, lane path as every workdir; prefer worktree thread when its permission is intact; a queued worktree fork with no assignment may be routed another way). The 2026-10-09/10-01 observations and the 25-minute incident move to NEW `devlog/_plan/261009_prompt_reduction/evidence/dispatch-observations.md` with a link from DS. Same for DS:57-62,73-78.
- DEL: subagent packet/role/family/managed fallback only; thread envelope (DEL:240-268) → LD; dated model observations (DEL:194-202) → evidence file; dispatch-card probe/alias table (moved out of L1 by wp2 lane C) lands here.
- LD: one host envelope table (wait_threads max 8, timeoutMs 120000, keepCount 15, maxThreads 6 and the "agent thread limit reached" signature). W and DEL point to it. Tests LT:377-388 change: waiting and delegation assert the link to lane-dispatch instead of the numbers; LT:346-367 stay on LD.
- W: remove the session-id incident (W:15-18); keep visibility cadence, retirement, wake, observer budget, automation ownership.
- RL: drop the "loop costume" narrative (RL:9-13); attest/binding steps become pointers to PC; completion matrix becomes a pointer to the gate behavior with "never weaken criteria".
- DG: resolve the budget contradiction: record the user's bounds or "none stated; host limits apply"; do not invent one (aligns with PO).
- IU: remove the divergence algorithm (IU:71-79) and the second docs-first restatement (IU:54-64); keep DIFFLEVEL-ROADMAP-01, LEXICO-SPLIT-01, UNIT-RESIDENCE-01 once.
- SP: move dated incidents (SP:133-136,192-193,208-211,404-417) to the evidence file; keep invariants.

phase-control stays the single attest schema; the table rows pinned by AST:214-249 keep their exact form.

## Accept criteria

- `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` exit 0, including dev ≤ 12,288 B and loop/pabcd ≤ 8,192 B; the negative fixture test fails as designed.
- Every rule ID that appears in the three routers before B still resolves to exactly one defining location after B (script: list IDs from `git show origin/dev:<file>` for the 16 core files, then `rg` each in skills/**; zero missing).
- `manifest-policy`, `native-execution`, `lane-packet`, `attest-shape-hint`, `spawn-attach-hook` tests pass; then `npm test` and `gate.mjs`.
- Independent review (sol, fresh context) of the three routers against the old text: lists any obligation lost without an owner. Zero unresolved items.


## Amendments after A round 1

- Blocker 1 (gate staging). PR B turns the gate on with `prompt-architecture-baseline.json`: every description and router currently over budget is recorded at its exact size (no growth, shrink only by lowering the record). wp4 removes the description entries and most router entries. The eligible set is frozen in the script as the skills over budget at B.
- Blocker 6 / G2 / G3 (false green). The script fails on: a recorded size that differs from the file; an unlisted file over budget; a baseline skill outside the frozen eligible set; an ID defined in a file not in its frozen legacy list, or a new ID with two definitions. The test adds isolated negative fixtures for missing link target, missing `#anchor`, description over budget, grown recorded file, new exception outside the eligible set, and a duplicate definition. Migrated core IDs (those in dev, loop, pabcd and the 13 core references before B) must end with exactly one definition, checked by a script over `git show origin/dev:<file>` versus the tree.
- Obligation ledger. A fresh sol reviewer writes `evidence/core-obligation-ledger.md`: every obligation in the old three routers (with or without an ID) → its new owner path#anchor, or "removed: duplicate of <owner>" / "removed: history, moved to evidence". Any permission, safety or correctness obligation without an owner blocks C.
- Blocker 3 / G5. Main moves the dispatch-card probe and alias table into `delegation.md` and shortens `subagent-config/src/dispatch-card.ts` in the same PR (tests `dispatch-card.test.ts:17,26,73`, `fallback-dispatch-cli.test.ts:90`). Hosted-CI recipes move to `dev/references/hosted-ci-evidence.md` in this PR, and `stacked-prs.md:112` is repointed in the same PR.
- Blocker 4 (scopes). Lane "dev" writes `skills/dev/SKILL.md`, `skills/dev/references/hosted-ci-evidence.md` (NEW) and nothing else under dev/. Lane "loop-pabcd" writes the two SKILL.md files. Lane "refs" writes the nine reference files listed in B4 plus `pabcd/references/phase-control.md` (state-file section) and `plugins/codexclaw/test/lane-packet.test.mjs`. Main writes the standard, gate, baseline, tests, evidence files and dispatch card.

- R1 (round 2). The refs lane is the only writer of `delegation.md`: it adds the dispatch-card probe/alias table there (main gives it the text from `dispatch-card.ts` before it starts). Main edits only `subagent-config/src/dispatch-card.ts` and its tests. Main's test scope is `test/prompt-architecture.test.mjs` and the subagent-config card tests; `lane-packet.test.mjs` belongs to the refs lane alone.

## wp3 P revalidation (2026-10-09)

Continuity, quoting the wp2 D summary: "Next: deliver PR A, then wp6 ... and wp3." Order changed: the goalplan cursor activates the first ready phase in map order, so wp3 runs now and wp6 (appended last) runs after wp5; wp6's plan (050) and its audit stay valid until then.

Tree check: since the audited snapshot, skills changed only in `dev/references/native-execution.md` (+3 lines: the terminal owner sentence and `/ps` `/stop`, from wp2) and the PR #287 additions (already in the research/20 anchors, which were taken after #287 merged). Current sizes are the "Before" figures above. The dispatch card is still in `subagent-config/src/dispatch-card.ts` and `delegation.md` still points readers at its helper; B moves both per R1.

Additions from wp6 research (research/50 `3, ADOPT-NOW), assigned to the refs lane in `delegation.md`:

- Neutral review packets: a reviewer packet carries the original brief, constraints, rubric and source anchors, and not the parent's or a previous reviewer's conclusion; repair rounds may carry the prior findings list for continuity.
- Failure classes for delegated calls: transport (e.g. an encrypted task the parent cannot read), capacity (rate limit), timeout, and child failure are reported separately; equivalent retries stop after a transport failure; a timeout proves neither a rate limit nor encryption; no settings are changed to work around one.
- Compact routing (research/50 `3 row 1) is already this unit's L3 method; nothing new.

PR B branches from `codex/prompt-reduction` (PR #288, not yet merged) as `codex/prompt-reduction-core` and is retargeted to `dev` after #288 merges.

