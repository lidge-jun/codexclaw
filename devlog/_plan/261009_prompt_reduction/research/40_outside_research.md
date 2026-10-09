# Outside research: prompt layering and reduction

2026-10-09. All six supplied reports (01–06) were read completely. This is source-grounded synthesis, not independent reproduction of upstream behavior. Target quantities (~29 skills, 1.8 MB of routers/references, 12 KB descriptions, SessionStart/UserPromptSubmit injections, rule IDs, TypeScript guards) are delegation inputs, not fresh measurements.

Optimize what a task loads, not total Markdown on disk: entrypoint cost recurs at invocation; branch references cost context only when opened. [BMAD economics][b]. Selected Codex instruction files still require complete reads. [Codex loading][load].

## 1. Cross-project layering patterns

Always-on = baseline; triggered = path/event/intent; on-demand = selected bodies/resources; enforced = code/validation. Missing mechanisms were not established by the reports.

| Project | Always-on | Triggered | On-demand | Enforced / source |
|---|---|---|---|---|
| Anthropic Skills | Name/description catalog | Model selects skill | Body, references, scripts/assets | Metadata validator; deterministic scripts. [Layers][a], [validator][av] |
| superpowers | SessionStart bootstrap on supported harnesses; Codex hook removed | Description/explicit invocation | Bodies, harness references, templates | Scripts; scoped structure test; behavioral evals. [Release][sr], [authoring][s], [test][st] |
| Cursor | Team/user/project rules; alwaysApply | Globs/descriptions/events | Skills and file pointers | Deny/exit 2, optional failClosed. Closed-source loader. [Rules][c], [hooks][ch] |
| Cline | Unscoped rules; skill metadata | Paths/hooks | Body/resources | Hook cancellation, loader tests; Memory Bank read-all is prose. [Rules][cr], [skills][cs] |
| Continue | Implicit root-global rules; catalog | Globs/content regex/directory | request_rule/read_skill | Loader tests; cn check diff agents. Request-tool enablement is report inference. [Loader][co], [tool][ct] |
| OpenHands | Root instructions/indexes/catalog | Keywords; nested/path rules once per conversation | Bodies/resources | Hook exit 2, metadata/memory caps, registry checks. [Layers][h], [source policy][ho] |
| Aider | Coder prompt; configured conventions | Model flags; trailing reminder if room | Manually added files; no skills catalog | Edit parser/lint/tests; inherited prompts. [Conventions][ac] |
| goose | Global/local hints; catalog | Nested dirs; fresh per-turn persistent text | Skills, plain references, recipes | PreToolUse/Stop blocks; recipe schema/checks. Per-turn prose remains advice. [Hints][g], [persistent][gp], [recipes][gr] |
| Claude Code | CLAUDE.md/unscoped rules/catalog | Paths/invocation/hooks | Bodies/support files | Permission/hook guards; context caps/evals. Imports still load. [Memory][cm], [skills][ck], [hooks][hk] |
| ECC | Common/language rules/catalog | Paths/events/hook profiles | Skills; legacy commands | Dispatcher guards, fingerprints/drift CI; body target not enforced. [Selection][es], [hooks][eh], [validator][ev] |
| diet103 | Trigger configuration | UserPromptSubmit suggest/warn/block routing | Bodies/resources | PreToolUse blocks only block-level skills. [Contract][d] |
| spec-kit | Opt-in managed instruction block; contributor router | Commands/phases; hooks in prompt procedures | Constitution/templates/presets | Scripts and prompt-text tests; procedure execution depends on model. [Managed block][f], [tests][ft] |
| BMAD | Managed repo context; activated facts/principles | Description/branch routing | One route file at a time | Deterministic validator + judgment pass; counters/evals. [Canon][b], [validator][bv] |
| opencode | Model prompt, first matching project instructions/catalog | Nested instructions on read; mode reminders | Skill body/sampled resource paths | Permissions/dedup/replacing context updates; plan prose is not guard proof. [Loader][n], [refresh][nr] |
| omo-codex | Repo/startup rules | Prompt/path/post-compact rules; mode pointer | Full mode skill/directive | Event budgets, transcript dedup, write/mode guards, generated-copy checks; layout unstable. [Package][m], [limits][mc], [dedup][md] |

awesome-claude-code is an index, not an agent runtime; useful mechanics are natural-key dedup and generated views. [Parser][w].

## 2. Concrete stated budgets

Short quotes/constants come from the reports' cited sources. Guidance, warnings, validation, runtime caps and output limits are distinct. These numbers are not automatically codexclaw defaults.

| Surface | Stated size / quote | Enforcement and boundary |
|---|---|---|
| Agent Skills metadata | “Maximum is 1024 characters.”; name ≤64 chars | Authoring validator rejects overflow. [Validator][av] |
| superpowers one skill | `WORD_BUDGET=1000` | Test for diagnosing-superpowers only. [Test][st] |
| Cursor rules | “Keep rules under 500 lines” | Docs-only. [Rules][c] |
| Cline hook output | `MAX_CONTEXT_MODIFICATION_SIZE = 50000` | Visible truncation marker; ~50 KB report label does not establish UTF-8 byte measurement. [Factory][cf] |
| goose persistent text | “Content is capped at 64 KB” | UTF-8-safe runtime cap; no body line/word ceiling found. [Docs][gp] |
| Claude Code instructions | “target under 200 lines”; “skips a file over 4 MiB” | Warning vs hard skip; memory first 200 lines or 25 KB. [Memory][cm] |
| Claude Code catalog | “truncated at 1,536 characters”; “1% of the model's context window” | Runtime listing limits/drop policy. [Skills][ck] |
| Codex instruction chain | `32 KiB` default | Root-first combined bytes; deepest guidance can be cut. [Guide][oa] |
| Codex catalog | “at most 2% of the model's context window” | Descriptions shortened then skills omitted; fallback 8,000 chars; configured override ceiling 10,000 tokens. [Docs][os], [renderer][or] |
| Codex hooks | `DEFAULT_HOOK_OUTPUT_TOKEN_LIMIT: usize = 2_500` | Default per-handler spill/head-tail preview, not aggregate plugin budget. [Spill][op] |
| Codex plugin body | `MAX_SKILL_PROMPT_BYTES: usize = 8_000` | **Applicability unverified:** is_agent_plugin_skill packaging branch not traced to codexclaw. [Branch][ob] |
| BMAD entry | “800 tokens”; “1,200” for agents | Review trigger, not CI cap; total branches uncapped. [Ship][bt] |
| omo event rules | Static 12,000/40,000; compact 3,500/4,000; dynamic 4,000/10,000; prompt 6,000/16,000 chars | Per-rule/total defaults; overrides/never-truncate exemptions qualify ceilings. [Constants][mc], [truncator][mt] |
| omo pointer | “<4096 bytes” | Plugin-specific target/test; Codex App truncation claim is upstream observation, not independent host proof. [Package][m] |

spec-kit has output limits (3 clarification markers, 50 findings), not a demonstrated input-prompt cap. [Specify][fs], [analyze][fa]. Continue reports no numeric rule cap; opencode no base-prompt cap; Aider no explicit conventions cap. These absences are bounded search findings, not guarantees. [Continue loader][co], [opencode][n], [Aider][ac].

## 3. Mechanisms resisting accretion

| Mechanism | Projects and URLs | Boundary |
|---|---|---|
| Single owner | Codex entry/reference separation; Continue shallowest covering node; OpenHands one hand-authored source/generated derivatives. [Codex][o], [Continue][ci], [OpenHands][ho] | Legitimate generated repetition differs from competing handwritten definitions. |
| Identity/dedup | Continue source-file identity/--rule regression; OpenHands once-only rules; opencode claim sets; omo transcript filter. [Continue test][cd], [OpenHands][h], [opencode][n], [omo][md] | Dedup cannot prove semantic consistency; compaction needs recovery. |
| Lint/drift | Anthropic metadata; BMAD deterministic/judgment split; ECC hook IDs/fingerprints; omo source freshness. [Anthropic][av], [BMAD][bv], [ECC][eh], [omo][mf] | Syntax validity is not decision quality. |
| Routing tests | Cline empty paths/context; Continue implicit globals; Codex match/not_match exec-policy examples. [Cline][clt], [Continue][cg], [Codex][rules] | Loader tests differ from LLM description selection. |
| Admission/no-op | Cursor repeated mistakes; OpenHands 3+ similar review comments; ECC Already Covered/Too Specific. [Cursor][c], [OpenHands][learn], [ECC][distill] | Recurrence prompts review, not automatic always-on promotion. |
| Evals/removal | superpowers baseline failures/micro-tested cuts; Anthropic tests removals; BMAD bare/full/stripped comparison. [superpowers][s], [audit][audit], [BMAD][be] | Upstream measurements not rerun; budget tests cannot prove preserved behavior. |
| Retirement | BMAD registry/migration; OpenHands API two-minor-release runway; OpenAI repo redirect; ECC legacy inventory. [BMAD][ret], [OpenHands][dep], [OpenAI][old], [ECC][legacy] | **No verified universal per-rule calendar sunset.** Report 02's date-expiry CI is a proposal; OpenHands checker covers APIs, not prose IDs. |
| Test ownership | omo one strongest-boundary owner; spec-kit pins copied hook sentences; BMAD/omo oppose prose pins. [omo][test], [spec-kit][ft], [BMAD][ba] | No shared test philosophy: resource/identity tests are not behavioral proof. |

## 4. Candidates for codexclaw

Recommendations, not upstream facts. ADOPT-NOW means docs plus budget/duplication test; LATER needs runtime work or evals. This leaf implements none.

1. **ADOPT-NOW — Four-layer guide and one owner per existing rule ID:** proven handwritten repeats become pointers; no registry migration needed. [Codex][o], [Continue][ci].
2. **ADOPT-NOW — One budget/duplication check:** separately count catalog chars/bytes, router bytes and existing renderable hook payloads; distinguish definitions from pointers/generated copies; fail unapproved growth, not exact wording changes. [Scoped test][st], [consumer policy][test].
3. **ADOPT-NOW — Explicit local budget proposals:** descriptions ≤1024 chars (aim ≤500), aggregate catalog ratchet at measured baseline (input says ~12 KB), router review ~800–1200 tokens; measure hook maxima before setting baselines. These are proposals with owner/reason exceptions, not token-to-byte guarantees. [Metadata][or], [BMAD][b], [review][bt].
4. **ADOPT-NOW — Trigger intent first, procedure outside descriptions, categories instead of growing synonym inventories:** structure fits now; selection quality needs evals. [Creator][o], [audit][audit].
5. **ADOPT-NOW — Common constraints/routing in SKILL.md, substantial conditional detail in direct references:** preserve complete selected reads; avoid tiny splits whose indirection costs more. [Loading][load], [economics][b].
6. **ADOPT-NOW — Admission/removal checklist:** observed failure, owner/layer, existing coverage, retirement condition, no-change option; incident history stays outside loaded rules. [Distill][distill], [audit][audit].
7. **ADOPT-NOW — Shorten duplicate existing-guard prose after coverage verification:** retain scope/safe path; do not call judgment machine-enforced. [Enforcement distinction][cm], [creator][o].
8. **LATER — Selective UserPromptSubmit pointers/current state:** routing, fallback/resume and behavior proof exceed docs scope. [omo][m], [Codex hooks][oh].
9. **LATER — Once-only path rules, transcript dedup and post-compact recovery:** requires lifecycle/reload correctness. [OpenHands][h], [omo][md], [opencode][nr].
10. **LATER — Held-out routing/removal evals on actual served models:** trigger/near-miss/no-guidance controls and outcome/cost comparison precede removing load-bearing instructions. [superpowers][s], [BMAD][be].
11. **LATER — Registry/compiler, aliases and expiry:** inventory must show payoff; define compatibility before migration; calendar sunsets are our extension. [Generation][ho], [retirement][ret], [API runway][dep].
12. **REJECT — Remove all hooks because superpowers removed its bootstrap:** project-specific activation evidence does not discharge codexclaw guard duties. [Release][sr], [contracts][oh].
13. **REJECT — Whole-corpus MB ceiling or count-only deletion:** total references hide task-path cost and may contain useful rare guidance. [Cost][b], [keep criteria][audit].
14. **REJECT — Universalize Claude caps, omo's 4 KB claim or Codex's uncertain 8 KB branch:** reproduce packaging/host applicability first. [Claude][ck], [omo][m], [branch][ob].
15. **REJECT — Blanket phrase snapshots/MUST bans or semantic-dedup regex as correctness proof:** verify resource/identity invariants; evaluate meaning/behavior separately. [Creator][o], [omo][test], [spec-kit contrast][ft].

## Qualifications carried forward

Reports 01/03 pin commits; others mostly use moving branches/live docs. Report 06 did not verify omo refactor stability or read its entropy-gate skill/all framework docs. [Package][m]. Report 01's ~500 Codex rereads/session and compliance/persuasion gains are upstream self-reports, not replicated; its separate eval repo was not read. No recommendation assumes those gains. [Redesign][sd].

Report 05 did not establish which packages hit the 8,000-byte branch, or inspect absent react-best-practices build tooling. A README-described generator is not a verified runnable generator in that vendored copy. [Branch][ob], [README][react]. Report 02 inferred Continue tool enablement and did not investigate CLI hook injection semantics; Cursor loader is closed source. [Tool][ct], [Cursor][c].

Report 04's ECC probes prove discovery inventories, not outcomes/savings; awesome is an index and its linked HumanLayer essay was not fetched. [Probe boundary][ep], [parser][w]. Enforcement, warning, spill and truncation are distinct here. [Cline][cf], [Codex][op].

## Source URLs from the reports

[a]: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
[av]: https://github.com/anthropics/skills/blob/683bc88e56f3e09ba94f7055977f3d3aa499f202/skills/skill-creator/scripts/quick_validate.py
[s]: https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/writing-skills/SKILL.md
[sr]: https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/RELEASE-NOTES.md#L173
[st]: https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/tests/diagnosing-superpowers/test-skill-structure.sh
[sd]: https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/docs/superpowers/specs/2026-06-10-positive-instruction-redesign-design.md
[c]: https://cursor.com/docs/context/rules
[ch]: https://cursor.com/docs/agent/hooks
[cr]: https://github.com/cline/cline/blob/main/docs/customization/cline-rules.mdx
[cs]: https://github.com/cline/cline/blob/main/docs/customization/skills.mdx
[cf]: https://github.com/cline/cline/blob/main/apps/vscode/src/core/hooks/hook-factory.ts
[clt]: https://github.com/cline/cline/blob/main/apps/vscode/src/core/context/instructions/user-instructions/__tests__/rule-conditionals.test.ts
[co]: https://github.com/continuedev/continue/blob/main/core/llm/rules/getSystemMessageWithRules.ts
[ct]: https://github.com/continuedev/continue/blob/main/core/tools/definitions/requestRule.ts
[ci]: https://github.com/continuedev/continue/blob/main/.continue/checks/update-agents-md.md
[cd]: https://github.com/continuedev/continue/blob/main/extensions/cli/src/integration/rule-duplication.test.ts
[cg]: https://github.com/continuedev/continue/blob/main/core/llm/rules/implicitGlobalRules.vitest.ts
[h]: https://github.com/OpenHands/docs/blob/558ac4184c27782fec909574cde904d14d56f58f/overview/skills.mdx
[ho]: https://github.com/OpenHands/extensions/blob/d008b81c44ae4d56d319e3b8f28ca35fc40aacbc/AGENTS.md
[learn]: https://github.com/OpenHands/extensions/blob/d008b81c44ae4d56d319e3b8f28ca35fc40aacbc/skills/learn-from-code-review/SKILL.md
[dep]: https://github.com/OpenHands/extensions/blob/d008b81c44ae4d56d319e3b8f28ca35fc40aacbc/scripts/check_deprecations.py
[ac]: https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/website/docs/usage/conventions.md
[g]: https://github.com/aaif-goose/goose/blob/0f4768025f517f5812f6d962a90aa52d509863cf/documentation/docs/guides/context-engineering/using-goosehints.md
[gp]: https://github.com/aaif-goose/goose/blob/0f4768025f517f5812f6d962a90aa52d509863cf/documentation/docs/guides/context-engineering/using-persistent-instructions.md
[gr]: https://github.com/aaif-goose/goose/blob/0f4768025f517f5812f6d962a90aa52d509863cf/documentation/docs/guides/recipes/recipe-reference.md
[cm]: https://code.claude.com/docs/en/memory
[ck]: https://code.claude.com/docs/en/skills
[hk]: https://code.claude.com/docs/en/hooks
[es]: https://github.com/affaan-m/ECC/blob/main/docs/capability-surface-selection.md
[eh]: https://github.com/affaan-m/ECC/blob/main/hooks/README.md
[ev]: https://github.com/affaan-m/ECC/blob/main/scripts/ci/validate-skills.js
[ep]: https://github.com/affaan-m/ECC/blob/main/docker/context-profiles/README.md
[distill]: https://github.com/affaan-m/ECC/blob/main/skills/rules-distill/SKILL.md
[legacy]: https://github.com/affaan-m/ECC/blob/main/docs/legacy-artifact-inventory.md
[d]: https://github.com/diet103/claude-code-infrastructure-showcase/blob/main/.claude/skills/skill-developer/SKILL.md
[f]: https://github.com/github/spec-kit/blob/main/extensions/agent-context/README.md
[ft]: https://github.com/github/spec-kit/blob/main/tests/test_command_template_hooks.py
[fs]: https://github.com/github/spec-kit/blob/main/templates/commands/specify.md#L128
[fa]: https://github.com/github/spec-kit/blob/main/templates/commands/analyze.md#L117
[b]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-toolsmith/canon.md
[bv]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/tools/skill-validator.md
[bt]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-toolsmith/ship.md
[be]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-eval/SKILL.md
[ret]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmod-method/retired.toml
[ba]: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/AGENTS.md#L33
[n]: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/session/instruction.ts
[nr]: https://github.com/anomalyco/opencode/blob/dev/packages/core/src/system-context/index.ts
[m]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/omo-codex/AGENTS.md
[mc]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/rules-engine/src/engine/constants.ts
[md]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/omo-codex/plugin/components/rules/src/static-injection.ts#L47
[mt]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/rules-engine/src/engine/truncator.ts
[mf]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/packages/omo-codex/plugin/components/ultrawork/AGENTS.md
[test]: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/.omo/rules/test-discipline.md
[o]: https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md
[load]: https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/catalog_prompt.rs
[oa]: https://developers.openai.com/codex/guides/agents-md
[os]: https://developers.openai.com/codex/skills
[or]: https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/render.rs#L19-L27
[op]: https://github.com/openai/codex/blob/main/codex-rs/hooks/src/output_spill.rs#L12
[ob]: https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/host_prompt.rs#L79-L88
[oh]: https://developers.openai.com/codex/hooks
[rules]: https://developers.openai.com/codex/rules
[old]: https://github.com/openai/skills/blob/main/README.md
[react]: https://github.com/openai/plugins/blob/main/plugins/build-web-apps/skills/react-best-practices/README.md
[audit]: https://github.com/anthropics/skills/blob/683bc88e56f3e09ba94f7055977f3d3aa499f202/skills/claude-api/shared/prompt-audit.md
[w]: https://github.com/hesreallyhim/awesome-claude-code/blob/main/resources/parse_issue_form.py
