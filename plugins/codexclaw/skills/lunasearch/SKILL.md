---
name: cxc-lunasearch
description: "Use for cheap parallel web discovery (gpt-5.6-luna). Triggers: Luna search, parallel research, 루나검색, 루나 서치, 병렬 웹검색, 싸게 많이 찾아봐."
---

# lunasearch — Cheap Parallel Discovery Lane (depends on cxc-search)

Use for requested cheap, broad, parallel discovery (`루나검색`, `병렬 웹검색`, `싸게 많이 찾아봐`). Luna output is candidate evidence only; the main model runs `cxc-search` source-open proof before synthesis.

The user of this skill is already running on Luna, so do **not** call
`catalog_list` or any model-picker probe before spawning. Hardcode the model
directly on every spawn call:

```text
agent_type: "explorer"
model: "gpt-5.6-luna"
reasoning_effort: "low"
```

If the spawn call returns a model-not-found / invalid-model error, do not retry
with a probe. Fall through to **serial dispatch** immediately: re-issue the same
spawn without the `model` field so the subagent inherits the main session model.
State plainly which path each agent took. No silent fallback to 5.5 and no
catalog round-trip — the error itself is the signal, and the serial retry is the
recovery.

Default reasoning_effort is "low" — Luna lanes are cheap discovery, not deep reasoning. Keep final judgment in the main session regardless.

## Conditional References

| Condition | Reference |
| --- | --- |
| Before spawning discovery lanes | [Spawn surface](references/spawn-surface.md) and [skill attachment](references/subagent-attachment.md) |
| Choosing lanes, waiting, proof handoff or final report | [Swarm and report](references/swarm-and-report.md) |
