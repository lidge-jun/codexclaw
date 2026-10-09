## Use Case

Use Luna search when breadth matters and each subtask can be narrow:

- release/news/changelog sweeps across many vendors
- competitor or ecosystem scans
- "find many sources first, judge later" research
- Korean requests such as `루나검색`, `luna로 5개 돌려봐`, `병렬 웹검색`,
  `싸게 많이 찾아봐`
- workflows where a 5.5 main session should conserve quota by delegating source
  discovery to Luna

Do not use it for local repository grep, one-source latest/current facts,
implementation work, or high-stakes final advice without primary-source proof.

## Swarm Shape

Default to five `explorer` subagents. Use three for smaller research and two for
corroboration only.

Assign one distinct lane per agent. Do not send duplicate prompts — rewrite the
user request into query families, then give each agent one family:

- official docs/changelogs (`site:<docs-domain> changelog`)
- vendor blogs/release notes (`site:<blog-domain> "release notes"`)
- GitHub releases/issues/discussions (`site:github.com <topic>`)
- standards/specs/API references (`filetype:pdf <topic> spec` or
  `intitle:specification <topic>`)
- independent reports, benchmarks, community findings
  (`site:reddit.com OR site:news.ycombinator.com <topic> after:<date>`)

Search English first — it is the largest authoritative corpus. Add a
local-language sweep only when the topic is inherently local or the user asks
for sources in a specific language.

## Spawn Contract

Each Luna subagent gets: (1) the `cxc-search` mention in its message and (2) a short
task naming its lane (see [skill attachment](subagent-attachment.md)). V1 may use structured `items`
when the caller supplies that channel manually. The skill carries the tool list and
proof rules; the task carries only the lane assignment and return shape. No five-part
hand-written message — the attached skill is the tooling contract.

Spawn all lanes in one turn — parallel, not sequential. Report the spawned
agent ids/nicknames to the user. The runtime may choose nicknames; do not claim
manual naming unless the spawn tool supports it.

## Proof Handoff (to cxc-search)

Luna output is candidate evidence only. After the swarm returns, the main agent
runs the `cxc-search` proof ladder on the strongest candidates:

1. Build a compact claim ledger:
   - claim, source URL, date, source type, Luna lane, status
   - status: `candidate`, `verified`, `contradicted`, or `unreachable`
2. Open primary sources (cxc-search Tier 2) before final synthesis. Prefer
   official docs, release notes, source repositories, specs, and original
   announcements.
3. When sources conflict, state which source wins and why. Do not average.
4. Mark snippet-only or unreachable items as unverified leads.

For a high-risk non-code claim (price, market share, dated, causal), require
>=2 independent source domains plus a counter-search before promoting it to
verified — the ultraresearch claim-ledger gate, applied lightly.

## Final Report

Return compactly:

1. Spawn path: hardcoded Luna used, or serial-fallback after error.
2. Swarm: number of agents and lanes.
3. Verified findings: source-opened claims only.
4. Open leads: promising but unverified Luna results.

Never treat Luna snippets or subagent summaries as final proof.
