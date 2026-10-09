### lunasearch (dependent tool)
`$cxc-lunasearch` is a dependent discovery lane that rides on this skill's proof
ladder. It fans out cheap `gpt-5.6-luna` subagents for wide discovery,
then hands every candidate back here for Tier 2 source-proof. lunasearch
discovers; cxc-search proves. lunasearch names THIS skill (`cxc-search`) in each
spawn message; V1 parses the mention, while plaintext V2 paths use hook inlining as
qualified above. Manual V1 callers may instead use `items`. See the `$cxc-lunasearch` skill for its hardcoded
spawn path and swarm shape.

### Removed cli-jaw tiers (non-goals — do not re-add)
codexclaw has no server runtime, so the cli-jaw 4-tier ladder does not carry over.
Do **not** reintroduce any of these removed backends as available: a progrok tier, a hosted web-AI wait (Grok Expert / GPT Pro), or an Exa / Tavily / Perplexity / Brave provider promise.
