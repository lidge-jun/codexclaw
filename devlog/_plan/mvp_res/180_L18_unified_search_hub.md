# L18 (Decade 180) -- Unified Search Hub + Korean Search Intent Guard

Status: PLANNED
Cluster: 2 (part B) · Phase: expansion · Shorthand: cxc
Source-of-record: 260629_codexclaw_mvp/120_unified_search_hub.md (J4), 090.1 J-6/J-10

## Goal (one slice)
Ship a single `search` skill for codexclaw that merges the cli-jaw 4-tier
escalation and the omo browsing/research skills into a codex-only ladder, with
the Korean "검색" intent guard ported in. web exploration uses Codex Browser Use
/ Computer Use as the primary backend; search discovers, browser proves.

## Why now / dependencies
- Upstream: L12-L17 stabilize the dev skill set first. `search` is an **on-demand**
  skill (policy `allow_implicit_invocation: false`); the ONLY implicit-on skill is
  `dev` (L19.2 default-trigger policy). `search` is NOT implicit-visible.
- L18 is the last Cluster-2 skill before L19 rewrites the hub; L19 catalogs
  `search` as an on-demand entry (NOT an implicit peer of `dev`). L18 is NOT a hard
  prerequisite for L19 (the hub hard-depends on L12-L17 only; `search` is cataloged
  if present).
- Downstream: feeds L22 librarian-style external research routing.

## Scope (decision-complete)
Files to add/edit:
- `plugins/codexclaw/skills/search/SKILL.md` (new; trigger-rich description)
- `plugins/codexclaw/skills/search/agents/openai.yaml` (allow_implicit_invocation: FALSE — on-demand, trigger-routed)
- `plugins/codexclaw/skills/search/references/blocked-url-reader.md` (absorbed
  from omo ultimate-browsing reader ladder; helper, not a new tier)
- `plugins/codexclaw/skills/search/references/query-rewrite.md` (rewriteQueries
  template; replaces agbrowse research plan as a soft dependency)

Exact behavior -- codex-only ladder (J-10, dead tiers removed):
- Tier 1 `built-in web_search`: hosted `web_search` / current web tool for 1-3
  focused queries. Results are URL candidates only; never `sufficient` on
  snippet consensus.
- Tier 2 `browser-use / computer-use`: open/read/DOM/screenshot candidate URLs.
  Absorbs cli-jaw browser-fetch adaptive ladder + omo insane-search/agent-reach
  public-API/reader catalog as a reference helper. Computer Use only for OS UI
  / browser chrome the in-app browser cannot reach.
- Tier 3 `subagent swarm (ultraresearch mode)`: top-level orchestration for
  long deep-research; opt-in only, never auto-fires on ordinary search.

Must-NOT-Have:
- No progrok / hosted web-AI tiers (no codex-native equivalent; removed per J-10).
- No CloakBrowser / agent-browser vendoring; document only as optional external
  adapter.
- No hard dependency on `agbrowse` binary; rewriteQueries runs prompt-side.
- `ultimate-browsing` blocked-URL reader is a reference helper, NOT a new tier,
  and never replaces hosted web search.

## IPABCD micro-cycle
- I: not interview-bearing.
- P: add `search` skill dir with SKILL.md + openai.yaml + two reference files;
  no code, no MCP, no binary. Korean intent guard text ported near-verbatim with
  cli-jaw->codex substitutions (native search -> hosted web_search; browser fetch
  -> Browser Use open/verify).
- A: audit angle = "does the ladder stay codex-only and keep the search/browser
  invariant?" Reviewer (explorer/librarian variant) checks no dead tiers leaked
  and that proof-before-sufficient is preserved.
- B: write SKILL.md description with triggers (`search`, `검색`, `웹검색`,
  `찾아봐`, `알아봐`, `latest`, `news`, `real-time`, `X/Twitter`, `deep research`);
  set openai.yaml implicit FALSE (on-demand, routed by trigger description); port
  intent guard + reader references.
- C: load skill in a codex session, confirm it is registered as an ON-DEMAND skill
  (not in the implicit list — only `dev` is implicit); run `cxc doctor` skill-presence
  check; dry-run a Korean query to confirm rewrite -> candidate URLs -> browser verify.
- D: done = `search` is registered on-demand, the trigger description fires on bare
  "검색", and the ladder names only built-in web_search / browser-use / subagent swarm.

## Acceptance (1-3 testable criteria)
1. `search/SKILL.md` + `agents/openai.yaml` parse; skill registers as ON-DEMAND
   (NOT in the implicit list — only `dev` is implicit; verify via `codex debug prompt-input`).
2. Ladder text contains exactly three tiers and no progrok / web-AI tier.
3. Korean intent guard block present with the 8 numbered rules and the
   candidate-URL-vs-proof invariant.

## QA channel (node:test path / CLI stdout / tmux / data dump)
- `codex debug prompt-input` JSON dump -> grep skill name in implicit set.
- node:test fixture validating SKILL.md frontmatter keys (name/description/
  metadata.short-description only) and openai.yaml policy flag.

## Commit unit (one atomic conventional commit)
`feat(search): add codex-only unified search hub skill with Korean intent guard`

## Blocked-on (jun decision id, if any)
None. J-6 (implicit set = dev only; search/pdf/skill-hub on-demand) and J-10 (codex-only ladder) resolved.

## References (codex-rs paths, omo skills, ouroboros, source-of-record docs)
- 260629_codexclaw_mvp/120_unified_search_hub.md (J4 full analysis)
- /Users/jun/.cli-jaw-3459/skills/search/SKILL.md:13,128,149,160
- devlog/.lazycodex/plugins/omo/skills/ultimate-browsing/SKILL.md:3,8,12
- devlog/.lazycodex/plugins/omo/skills/ultraresearch/SKILL.md:6,26
- codex-rs/tools/src/tool_spec.rs:30 (web_search), core/src/tools/hosted_spec.rs:20
- codex-rs/features/src/lib.rs:149,1007 (in_app_browser, computer_use stable)
