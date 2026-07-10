---
name: cxc-search
description: "MUST USE for external, current, real-time, or public-web lookups — latest releases/versions, news, prices, docs, status, X/Twitter, and deep research. Routes Korean and English lookup verbs to a codex-native search ladder, never an accidental repository grep. Triggers: search, look up, latest, current, news, real-time, X, Twitter, deep research, 검색, 검색해, 찾아봐, 찾아줘, 알아봐, 웹검색."
metadata:
  last-verified: "2026-07-02"
  short-description: "Codex-native unified search: 3-tier discover->prove->deep-research ladder + Korean intent guard."
---

# search — Unified Search Hub

Search discipline for any lookup that leaves the repository. This skill is
implicit-visible as metadata (`allow_implicit_invocation: true`); load the
full body on explicit trigger or `dev`-hub routing, never by an external
dispatcher.

## Source-Proof Invariant (read first)

Search results are **candidate URLs, not evidence.** Snippets, summaries, and
search-result consensus discover where a fact might live; they never settle it.
When recency, factual accuracy, version/compatibility, or source attribution
matters, open the original page and confirm it before you treat the answer as
sufficient. This invariant precedes every sufficiency rule below — no tier may
declare an answer final on snippet text alone.

## Divergence Candidate Grounding

When any PABCD workflow enters divergence mode (HITL manual entry or goal-mode
plateau prompt), every N>=2 candidate must carry search provenance in the divergence
archive:

- `strong-1`: Tier 2 proven by opening the original source. Concrete numbers or
  claims may be cited only after this proof step.
- `add-1`: at least Tier 1 discovered, with candidate URL recorded. Promote to
  Tier 2 before using detailed claims from it.
- Record provenance URLs with `cxc divergence candidate add ... --source <url>`.
  The archive enforces non-empty source URLs; it does not certify the search tier.
  The agent must state Tier 1/Tier 2 evidence in the rationale or phase notes.

Do not invent a candidate from memory and then search only for confirmation. Search
discovers rival approaches first; the archive records which sources justified each
candidate.

## The Ladder (exactly three codex-native tiers)

### Research-depth classifier (SEARCH-DEPTH-01)

Before climbing the ladder, name the depth — it is distinct from the target classifier in the
Korean Intent Guard (which picks web vs docs vs repo):

- **latest/current fact** — one entity, a version/date/price/status. Tier 1 discover + Tier 2
  open one primary source. Capture the exact date.
- **official-doc fact** — API/library behavior. Prefer official docs first, then open for proof.
- **implementation/source fact** — how something is built. Open the source/repo, not a summary.
- **comprehensive research** — multi-source/contested. This is the only depth that justifies
  Tier 3; ordinary latest/current lookups never auto-escalate to a subagent swarm.

### Tier 1 — Hosted web search (discovery)
Use the built-in hosted web-search tool (the model-facing `web_search`) to run 1-3 focused,
rewritten queries. It returns candidate URLs plus source metadata (title, date, host). This
hosted tool is feature-gated, not guaranteed present (a provider may lack the capability, config
may disable it, and reviews disable it); when it is unavailable, go straight to Tier 2 on a known
URL or state that discovery is blocked. Tier 1 discovers; it does not prove. Never mark an answer
sufficient from Tier 1 output alone.

### Tier 2 — Browse-Use Ladder (proof, default) (SEARCH-BROWSE-01)
Open candidate URLs and read the real source, escalating through the ladder below —
each rung is a NAMED live tool (`structure/60_native_capabilities.md`), not a vague
"browser use" phrase. Stop at the first rung that yields primary evidence.

**agbrowse is the PRIMARY Tier-2 surface.** Resolve it ONCE per session with
`scripts/agbrowse_helper.py doctor`; while it resolves, rungs 1-2 own proof and the
native tools are the FALLBACK tier (rung 3) — do not reach for a native browser tool
when a resolvable agbrowse rung can do the job.

1. Scripted HTTP proof — `agbrowse fetch "<url>" --json --browser never` returns an
   ok/verdict/source/finalUrl/content/evidence envelope; `agbrowse search --verify
   "<url>" --json --browser never` gives a compact verdict on a KNOWN url. The JSON
   envelope IS the evidence artifact. Mandatory first attempt when agbrowse resolves.
2. agbrowse CDP (render / interact, still primary): one-shot render-read
   `agbrowse fetch "<url>" --json --browser auto` for JS-rendered/blocked pages; a full
   interactive session when steps must act on the page — `agbrowse start --headed` ->
   `agbrowse navigate "<url>"` -> `agbrowse snapshot --interactive` (element refs
   e1, e2, ...) -> `agbrowse click e1` / act -> re-snapshot -> `agbrowse stop`.
   `agbrowse doctor` diagnoses CDP/start/profile failures. Local Chrome CDP only;
   remote/hosted CDP is out.
3. Native fallback tier — use ONLY when agbrowse is unresolvable, its CDP session
   cannot complete the flow, or conversational control genuinely fits better:
   `browser:control-in-app-browser` (Codex-owned browser: JS/PDF/visual checks, local
   dev servers) and `chrome:control-chrome` (conversational real-profile CDP via
   `browser_use_full_cdp_access` for logged-in/WAF/DevTools-grade needs). State WHY
   agbrowse was insufficient when you drop to this rung.
4. GUI last resort — `computer-use:computer-use`: only for browser chrome or OS UI
   no browser tool can reach (per-app approval applies; never drive terminals).

**Verification loop (SEARCH-BROWSE-VERIFY-01, cli-jaw CDP doctrine ported):** for any
interactive rung, verify state before and after acting — inspect -> act -> re-inspect
(in agbrowse terms: `snapshot --interactive` -> `click eN` -> re-snapshot). When DOM
inspection fails or the target is canvas/WebGL/shadow-DOM, fall back to screenshot +
`view_image`, then pointer-level interaction via `computer-use:computer-use`. Never
chain blind actions; never use `curl`/`wget` hand-rolling when a ladder rung applies.

Either way confirm date, author/source identity, the exact claim, and whether
the page is primary evidence. When a source is blocked, JS-rendered, PDF-only, or table-only,
apply the tactics in `references/blocked-url-reader.md` — that helper is Tier 2 guidance,
**not** a fourth tier.

Do **not** use plain `agbrowse search "<query>"` as discovery: without `--stdin-results` it
fabricates candidate URLs. Discovery stays Tier 1 (hosted `web_search`); `agbrowse` is a
proof-of-a-known-url helper only.

**Tier 2 proof rules (SEARCH-PROOF-01):** for time-sensitive or public claims, record the exact
date and source type, and whether the claim is corroborated by a second independent source.
Prefer official docs / announcements / specs before reporting a settled answer. When sources
conflict, state which source wins and why rather than averaging them.

### Tier 3 — Deep Research Protocol (opt-in, formerly cxc-ultraresearch)

For broad, costly, or multi-source research, the main agent deliberately spawns
an explorer swarm: one query family or source class per explorer, source URLs
returned, no edits, no hidden providers. Tier 3 is opt-in and must be requested
deliberately — it never auto-fires for ordinary latest/current lookups. It is
not a durable/background facility; durability is Phase 3 work.

#### EXPAND — query families first

Before fetching, expand the question into distinct query families (entities,
time windows, source classes, rival hypotheses). Each family is a separate line
of proof, not a reworded duplicate. Record the expanded set so a reader can see
the search space you chose.

#### Waves

- First wave: assign one query family or source class per explorer. Spawn a real
  floor of at least two explorers when the question is genuinely multi-source; a
  single agent is not a "swarm."
- Run at least two expansion waves before converging: wave 1 discovers, wave 2
  fills the gaps and chases the strongest leads from wave 1.
- Stop rule: stop after three consecutive no-new-lead results, or at five waves,
  whichever comes first. State which stop fired.
- Dispatch mechanics depend on the session-pinned surface. On V2, spawn each explorer
  with a distinct `task_name`, wait through the no-content mailbox, and chase a lead
  with `followup_task(task_name)`; `interrupt_agent` stops a runaway turn. On V1,
  `wait_agent` returns final status plus content, `send_input(agent_id)` reuses an
  explorer, and `close_agent`/`resume_agent` retire or restore one. Spawn the whole
  wave before waiting. Concurrency is V1 `agents.max_threads` (default 6) versus V2
  `max_concurrent_threads_per_session` (default 4, root included).

#### Journal + claim-ledger

- Journal: each wave appends what was searched, what was found, and what remains
  open. The journal is the audit trail of the research, not a summary written at
  the end.
- Claim-ledger: every factual claim is recorded with its proving source URL and
  the tier it reached (Tier 1 discovered vs Tier 2 proven). A claim with no
  Tier-2 proof is marked unverified, never promoted silently.
- Verified-claims: the converged answer cites only claims that reached Tier-2
  proof; unverified leads are listed separately as open questions.

#### Grounding (no invention)

Snippet consensus is not verification: agreement among any number of search
snippets never substitutes for opening the source — a claim reaches verified
only via Tier-2 proof. Every candidate and claim must come from a real search
result, not memory. Discovery stays Tier 1 (hosted `web_search`); proof opens
the source (`cxc-search` Tier 2, optionally the `agbrowse` HTTP-first proof
helper). Do not fabricate URLs; do not cite a number before the source is
opened.

#### Boundaries

- No new subagent role: this protocol rides base `explorer` subagents.
- No server/daemon and no hidden providers; the swarm is one-shot agent work the
  main agent requested.
- This protocol is on-demand Tier 3 work; it is selected deliberately and
  nothing auto-loads or auto-runs it.

### Subagent Skill Attachment (SEARCH-ATTACH-01)
Any search subagent — Tier 3 deep-research explorers, `$cxc-sparksearch` lanes,
or ad-hoc research spawns — should receive THIS skill as a real skill
attachment, not a hand-written tool directive in the message. The subagent
auto-loads the skill at launch and follows its Tier 1/2 tool guidance
(`web_search` for discovery, then open the source for proof). The skill body is
the single source of truth for the tool list; do not duplicate it as prose in
the spawn message.

PABCD A-gate audit/reviewer dispatches are in scope too: a plan auditor must
verify references and external/current claims, so the audit dispatch packet
explicitly names `$codexclaw:cxc-search` alongside
`$codexclaw:cxc-dev-code-reviewer` (AUDIT-LOOP-01). The spawn wrapper's
`ROLE_BASE_SKILLS.reviewer` resolves the same pair when that builder is used.

The shared payload form is a **link-form mention in the spawn message**. On V1 the
child's first turn parses the mention and injects the full SKILL.md body. When a
V2-shaped spawn message reaches the codexclaw hook as plaintext (non-encrypted
provider/proxy paths), the hook recognizes the same mention and inlines the full body.
Native ChatGPT-backend V2 sends the hook ciphertext, so mention normalization and body
inlining are no-ops there; when no body can be inlined, a plaintext
`[CXC-SKILL-AFFORDANCE]` block tells the child to self-load any `$cxc-<folder>` /
`$codexclaw:cxc-<folder>` mention from `<skillsDir>/<folder>/SKILL.md`; fork inheritance
remains a secondary channel. If the path is not link-safe, use the plugin-native
`$codexclaw:cxc-search` fallback instead:

```text
message: "[$cxc-search](skill://<this skill's SKILL.md absolute path>)
TASK: <lane / query family>"
```

On the v1 surface the structured `items` channel is equivalent and slightly
stronger (exact selection, no parse step) — use it when routing through the
spawn-wrapper builder:

```text
items: [
  { type: "skill", name: "cxc-search", path: "<this skill's SKILL.md absolute path>" },
  { type: "text",  text: "TASK: <lane / query family>" }
]
```

(v2 `deny_unknown_fields` rejects `items`; plaintext V2 paths use the recognized
mention plus the hook-inlined body. The always-on spawn-attach hook never adds
`cxc-search` when the dispatcher omits it.)

Do not write a long inline TOOLS block in either path — the skill already says
"web_search for discovery, then open the source; snippets lie; the page is the
evidence." A subagent that cannot open pages must flag every finding as
`candidate — unverified snippet` in its return.

### sparksearch (dependent tool)
`$cxc-sparksearch` is a dependent discovery lane that rides on this skill's proof
ladder. It fans out cheap `gpt-5.3-codex-spark` subagents for wide discovery,
then hands every candidate back here for Tier 2 source-proof. sparksearch
discovers; cxc-search proves. sparksearch names THIS skill (`cxc-search`) in each
spawn message; V1 parses the mention, while plaintext V2 paths use hook inlining as
qualified above. Manual V1 callers may instead use `items`. See the `$cxc-sparksearch` skill for its hardcoded
spawn path and swarm shape.

### Removed cli-jaw tiers (non-goals — do not re-add)
codexclaw has no server runtime, so the cli-jaw 4-tier ladder does not carry over.
Do **not** reintroduce any of these removed backends as available: a progrok tier, a hosted web-AI wait (Grok Expert / GPT Pro), or an Exa / Tavily / Perplexity / Brave provider promise.
There is no codex-native equivalent and J-10 removed them deliberately.

## Korean Intent Guard (8 rules)

When the user says **검색 / 검색해 / 찾아봐 / 찾아줘 / 알아봐 / 웹검색** (or English
*search / look up / latest / current / news*) without naming local files or code:

1. **Classify the target first**: external/public/current info -> the ladder
   above; programming library/framework/API docs -> official docs or the active
   documentation retrieval path, then source-open proof; this repository's
   code/logs/config -> file search (`rg`, `rg --files`, local code tools).
2. **Do not send the full natural-language sentence as the only query.** Rewrite
   it into 1-3 focused keyword queries (see `references/query-rewrite.md`).
3. **Preserve anchors** in the rewrite: entities, source hints (official, Naver,
   GitHub), dates, locale, and content type.
4. **Treat results as candidate URLs**, not final evidence — fetch/open the
   original page when factual accuracy, recency, or attribution matters.
5. **Repository targets use file search**, never web search. Do not misroute a
   code/log/config lookup to the web.
6. **Docs queries prefer official documentation** (or the active docs retrieval
   path) before general web search, then open the source for proof.
7. **Bare ambiguous "검색"** (no local-file and no clear web target) -> ask ONE
   short clarification before launching either a repo-wide grep or a web search.
8. **No hidden fallback** between web, docs, and file search. State the
   classification you chose; never silently chain web -> docs -> grep.

## When to stop

Stop escalating when any holds: a sufficient primary source is found and
confirmed; all candidate URLs are dead or unreachable; or the task needs a user
clarification. Do not keep climbing tiers past a confirmed answer, and do not
spend Tier 3 subagents on a question Tier 1+2 already settled.

## Notes

- This skill is implicit-visible as metadata (`allow_implicit_invocation:
  true`, part of the implicit set with `dev` — canonical list: `dev` SKILL.md
  Visibility decision); the body is reached
  by trigger words or by `dev`-hub routing.
- Query rewrite runs prompt-side. `agbrowse` is an OPT-IN, lazily-resolved Tier-2 proof
  helper (HTTP-first; local-CDP escalation only); it is not bundled and not required —
  without it, Tier 2 starts at rung 2 (`browser:control-in-app-browser`) and escalates
  to `chrome:control-chrome` / `computer-use:computer-use` per SEARCH-BROWSE-01.
- The blocked-URL reader and ultraresearch decomposition are absorbed as Tier 2
  helper tactics and Tier 3 method, not as new tiers or vendored browsers.
- `$cxc-sparksearch` is a dependent tool, not a tier. It hardcodes the Spark
  model and skips catalog probing; its error fallback is serial dispatch
  (re-spawn without the model field), not a probe round-trip.
