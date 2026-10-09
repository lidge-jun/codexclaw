# Prompt reduction 2026-10-09: one layering standard, shorter injections and skills, release 0.2.42

Codexclaw's instructions grew one incident at a time. The same rule is stated in three to six places, a new session receives about 4.3 KB of tutorials before the user says anything, a loop request adds another 3.2 KB, and the 29 skill descriptions that sit in every catalog cost 11.6 KB. This unit writes down one placement standard (which layer a rule belongs in, who owns it, how big each layer may be), applies it to the always-on injections, the three core skills and the remaining routers, adds a cheap repository gate so the surface cannot quietly grow back, and ships the result as 0.2.42 to `main` and the SSH hosts.

Reader: the maintainer deciding whether to merge each PR and publish 0.2.42. Familiarity with the hook components, cxc-dev/cxc-loop/cxc-pabcd and the release script is assumed.

## Loop contract

- Loop archetype: satisfy-spec HOTL, docs-first (LOOP-DOCS-FIRST-01). Byte budgets are acceptance thresholds, not an optimization target.
- Trigger: the user's 2026-10-09 request to take the open PR and run a general prompt-reduction pass that turns case-by-case rules into a logical system, using parallel gpt-6.1-sol agents and repeated PABCD cycles, aligning judgment criteria for the skill layers, dispatching parallel Aside exec research into other open-source projects, then merging and deploying.
- Goal: the layering standard committed (`structure/70_prompt_architecture.md`) and enforced by a gate; measured reductions in L1 injections, core skills, routers and descriptions; PR #287 handled; 0.2.42 released and deployed.
- Non-goals: changing any guard decision, FSM edge, receipt or identity check (L0 semantics); removing a rule that a guard or test depends on without moving it to its owner; new hooks; Codex core; other repositories.
- Verifier: per phase, the focused tests named in each decade doc, then `npm run build`, `npm test` (TAP totals), `node plugins/codexclaw/scripts/gate.mjs` (which will call the new `check-prompt-architecture.mjs`), `inventory.mjs --check`; hosted CI on each PR head; for release, check-versions, main CI, the release workflow and checksums. Skill prose is read by almost no behavioral test: the new gate observes size, links and declarations; review observes meaning (PLAN-VERIFIER-REAL-01).
- Stop condition: goalplan criteria c-1..c-7 met with fresh evidence, or a real blocker after root-cause work.
- Memory artifact: this unit; goalplan `.codexclaw/goalplans/codexclaw-prompt-reduction-and-layering-pass-end/`; `research/` (agent reports) and 003_outside_research.md.
- Expected terminal outcomes: DONE (merged, released, deployed with per-host evidence); BLOCKED (CI infrastructure, credentials, unreachable hosts reported as such); NEEDS_HUMAN (a guard behavior change or a protected design-owner rewrite the maintainer must judge); UNSAFE (a cut would drop a safety or permission rule that has no owner).
- Escalation: main owns plan, FSM, git and delivery; gpt-6.1-sol subagents are leaves with disjoint write scopes; a packet two agents fail is reclaimed by main (DISPATCH-RETIRE-01).
- Resource bounds: this checkout `/Users/jun/.codex/worktrees/55e8/codexclaw`, `gh` with the user's credentials, ssh to the hosts in 040. No token or wall-clock bound was stated; host limits apply. The release (040) is C4 and was explicitly authorized ("머지하고 배포까지").
- Review independence: reviewers are gpt-6.1-sol subagents in fresh contexts; main is claude-opus-5-5, so review comes from a different model family.

## Work-phase map (dependency order)

| WP | Doc | Layer | Output | PR |
|---|---|---|---|---|
| wp1 | 000-003 | standard | Roadmap, standard, research; PR #287 merged to dev (6520b7b8) | devlog travels with PR A |
| wp2 | 010 | L1 + CLI output | Shorter SessionStart/UPS/compact/PreToolUse text and loop CLI receipts | PR A |
| wp3 | 020 | L3/L4 core + L5 gate | Standard file, gate script, dev/loop/pabcd routers, core reference consolidation | PR B |
| wp4 | 030 | L2 + L3 routers | 29 descriptions; dev-* and other routers moved to references | PR C |
| wp5 | 040 | release | 0.2.42 dev->main, GitHub release, SSH deploy | release PR |

Order: the standard (wp1) fixes budgets. L1 (wp2) only points at L3/L4 owners that already exist, so it lands first. wp3 creates the gate and moves the core owners; the gate then holds wp4 to the same budgets.

## Scope and file map

IN:

    devlog/_plan/261009_prompt_reduction/**                                         wp1
    plugins/codexclaw/components/{cxc-ops,pabcd-state,subagent-config,recall,bg-wake,provider-bridge,config-guard}/{src,dist,test}   wp2, text renderers only
    structure/70_prompt_architecture.md (NEW), structure/INDEX.md                   wp3
    plugins/codexclaw/scripts/check-prompt-architecture.mjs (NEW), scripts/gate.mjs wp3
    plugins/codexclaw/skills/{dev,loop,pabcd}/**                                    wp3
    plugins/codexclaw/skills/*/SKILL.md frontmatter, */agents/openai.yaml           wp4
    plugins/codexclaw/skills/{dev-*,qa,search,recall,interview,lunasearch,stubs}/** wp4
    plugins/codexclaw/test/{lane-packet,manifest-policy,recall-skill-synopsis}.test.mjs   pins that move with their owners
    CHANGELOG.md, README badges, inventory.json, version files                      each phase, wp5

OUT: guard predicates and decisions; hooks/*.json registrations and handler identities (so no hook retrust); FSM, attest, receipt and identity logic.

## Consultation and research

- 001_layering_standard.md: the adopted standard (main's dispositions applied to the architect proposal).
- 002_architect_consultation.md: proposal D1-D12, dispositions, reflection verdict.
- 003_outside_research.md: what six open-source families do and what was adopted.


## wp1 D summary (2026-10-09)

Conclusion: the roadmap is locked. 001 is the standard; 010-040 are the executable phase docs, amended through three audit rounds (research/02 FAIL, 04 FAIL, 05 PASS) and two architect reflections (01 MISALIGNED, 03 ALIGNED). PR #287 is merged to `dev` as-is (6520b7b8); its dated narrative is condensed in wp3. A new work-phase wp6 (pstack / pstack-opencodex comparison and PRs) was appended at the user's request.

What did not go well: the first plan scheduled the description budget a PR before the descriptions were trimmed, and merged child-scope texts that a trust recognizer compares byte for byte; both were caught only by the independent audit. The hypothesis that died: that L1 owners "already exist", so injections can be cut first without coordinating with the skill rewrite (the dispatch card and the terminal sentence had no other owner). Evidence the direction is wrong: wp2 tests needing to keep long phrase locks to stay green, or measure-l1 showing that the aggregate UPS text cannot reach 1,200 B without dropping a guard-relevant fact.

Next: wp2 per 010, re-verified against the tree at P.

