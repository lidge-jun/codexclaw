# wp3 — skills, references and structure wording (PR3)

Status: PLANNED

Agents read paths from prose. Every instruction that tells an agent to write `devlog/_plan`, `devlog/_fin`, `.codexclaw/evidence` or `.codexclaw/goalplans` gains the resolver form: "the plan unit under `$(cxc devlog path)/_plan` (`devlog/_plan` in repo mode)" and "the evidence root printed by `cxc state path`". Targets come from the wp1 inventory (research/01) and a fresh `rg` at B: pabcd SKILL.md D row, phase-control.md state files + attest table, dev-scaffolding implementation-log.md and source-of-truth-layout.md (SCAF-SOT-01), dev SKILL.md DEV-PRIVACY-01, loop references naming goalplan paths, subagent evidence instructions, structure docs describing the state layout, README state section, CHANGELOG.

Constraints: the prompt-architecture gate (`check-prompt-architecture.mjs`) budgets must still pass; wording stays short; no rule semantics change. A new section in `structure/` (the existing state-layout owner, found at B) documents modes, precedence, layout and the durable/volatile table from 000 D7.

Verifier: `npm run gate`, `npm test` (skill pin tests), review by sol.

