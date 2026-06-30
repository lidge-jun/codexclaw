# 007 — Search Engine + Deep Research

Gap class: FUNCTIONAL + HARNESS · evidence: explorer Plato

> omo's search strength is not prose — it is a bundled `engine/`, the R1-R7 harness, a
> `bias_check.py` CI gate, and ultraresearch's EXPAND/journal/claim-ledger protocol.
> codexclaw's `cxc-search` is a clean 3-tier ladder but thin on execution.

## Parity table — insane-search engine

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `ultimate-browsing/references/insane-search/README.md:15-35` + `engine/fetch_chain.py:91-177` + `engine/__main__.py` (R1/R2/R6: blocked URL -> single `python3 -m engine` entry; "200 is not success"; declare failure only after full grid) | `search/SKILL.md:23-45` (3-tier description) | omo binds blocked-URL handling to one executable harness; codexclaw describes tiers only | add a bundled `skills/search/engine/` (ast-grep-style no-server script) + a MUST rule: blocked URL routes to the single entry |
| `insane-search/README.md:78-119` + `jina.md` + `media.md` + `public-api.md` + `json-api.md` (Phase 0 official-API index: Reddit/HN/npm/PyPI/Bluesky/GitHub; Jina; yt-dlp) | `search/SKILL.md:25-39` (source-open proof principle, no API index) | omo says what backend to try first; codexclaw has no catalog | add `search/references/` for the official-API index + Jina/media/JSON-API recipes; wire priority into the skill body |
| `insane-search/README.md:35-58` + `playwright.md` (R7: on WAF + list-intent, run HTML grid in background while doing Playwright network recon -> internal JSON API) | `search/SKILL.md:31-38` (blocked-url reader mention) | omo has an API-first parallel branch; codexclaw does not | add R7-style API-first branch as a Tier-2 internal rule (browser network observe -> re-fetch); portable without a server |
| `insane-search/engine/bias_check.py:1-170` + `waf_detector.py` (No-Site-Name rule enforced by exit-code-1 CI gate) | `search/SKILL.md:14-21,52-74` (Source-Proof / Korean Intent Guard, prose only) | omo enforces no-hardcoded-site via CI; codexclaw guardrails are prose | if a `search/engine/` lands, add a `bias_check`-style denylist scan as an E8 gate |

## Parity table — ultraresearch

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `ultraresearch/SKILL.md:34-39,71-217` (first-line marker, authority override, `## EXPAND` tail, wave journal, claim-ledger, verified-claims) | `search/SKILL.md:40-45` (Tier 3 one paragraph) | omo has a deep-research operating system; codexclaw has a sentence | split Tier 3 into an `ultraresearch` reference (or skill): EXPAND/wave/journal/claim-ledger protocol |
| `ultraresearch/SKILL.md:119-166` (min first-wave workers, explore/librarian protocol, 2+ expansion waves, 3-no-lead / 5-wave cap) | `search/SKILL.md:40-45,76-81` (opt-in swarm + stop principle, no worker economics) | omo has convergence rules; codexclaw has none | add spawn-floor + 2-wave-minimum convergence to Tier 3 |

## Portability verdict (code-grounded)

insane-search is NOT a server — it's a skill-internal `engine/` module run as
`python3 -m engine "<URL>"` (`ultimate-browsing/SKILL.md:40,55,129`; `engine/executor.py`).
So it ports like `ast-grep`: a no-server bundled script skill. Split into three layers:
1. base (curl_cffi / Jina / official APIs / yt-dlp) — fully in-philosophy;
2. optional Playwright MCP handoff — session-tool dependent;
3. optional local Chrome fallback — needs Node/Chrome, opt-in.

## Steering-principle note

ultraresearch's roles (librarian/explore) do NOT become codexclaw roles. The deep-research
swarm runs as base `explorer` subagents with the research protocol/skill attached (`008`).

## Enforcement tier

Engine: E1-ish executable contract + E8 bias gate. Research protocol: E7 prose + E5
skill-attachment for the swarm.
