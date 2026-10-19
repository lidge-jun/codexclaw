# wp3 — skills, references and structure wording (PR3)

Status: DONE

Agents read paths from prose. Every instruction that tells an agent to write `devlog/_plan`, `devlog/_fin`, `.codexclaw/evidence` or `.codexclaw/goalplans` gains the resolver form: "the plan unit under `$(cxc devlog path)/_plan` (`devlog/_plan` in repo mode)" and "the evidence root printed by `cxc state path`". Targets come from the wp1 inventory (research/01) and a fresh `rg` at B: pabcd SKILL.md D row, phase-control.md state files + attest table, dev-scaffolding implementation-log.md and source-of-truth-layout.md (SCAF-SOT-01), dev SKILL.md DEV-PRIVACY-01, loop references naming goalplan paths, subagent evidence instructions, structure docs describing the state layout, README state section, CHANGELOG.

Constraints: the prompt-architecture gate (`check-prompt-architecture.mjs`) budgets must still pass; wording stays short; no rule semantics change. A new section in `structure/` (the existing state-layout owner, found at B) documents modes, precedence, layout and the durable/volatile table from 000 D7.

Verifier: `npm run gate`, `npm test` (skill pin tests), review by sol.



## P re-verification (2026-10-20, wp3 cycle, on origin/dev 94eb2ec6)

Drafted edits (one sentence or table cell each, no rule semantics changed):
- skills: `pabcd/SKILL.md` D row (devlog via `cxc devlog path`), `pabcd/references/phase-control.md` (durable files live in the root `cxc state path` prints; P->A planUnit row), `pabcd/references/implementation-units.md` (UNIT-RESIDENCE-01 path), `dev/SKILL.md` DEV-PRIVACY-01 (codexclaw plans/evidence follow `cxc state path`), `dev-scaffolding/references/implementation-log.md` (devlog root paragraph), `dev-scaffolding/references/source-of-truth-layout.md` (SCAF-SOT-01 wording), `loop/references/durable-goalplan.md` (goalplan location), `qa/references/evidence-contract.md` (evidence root).
- structure: NEW `structure/80_state_layout.md` (modes, precedence, config, project id, durable/volatile table, evidence guard, commands incl. the enterprise migrate commands, known limits); `structure/INDEX.md` row + hub note.
- docs: `docs/security-hardening.md` goalplan containment root.
- README state section and migrate commands shipped with PR2 (#298).
Depends on #298 for the `cxc state` / `cxc devlog` commands it names. Verifier: `npm run gate` (prompt-architecture budgets), skill pin tests in `npm test`.
