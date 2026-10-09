### Tier 1 — Hosted web search (discovery)
Use the built-in hosted web-search tool (the model-facing `web_search`) to run 1-3 focused,
rewritten queries. It returns candidate URLs plus source metadata (title, date, host). This
hosted tool is feature-gated, not guaranteed present (a provider may lack the capability, config
may disable it, and reviews disable it); when it is unavailable, go straight to Tier 2 on a known
URL or state that discovery is blocked. Tier 1 discovers; it does not prove. Never mark an answer
sufficient from Tier 1 output alone.
