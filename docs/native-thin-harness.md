# Native-thin harness contract

## Position

codexclaw is a discipline and evidence layer attached directly to OpenAI Codex. It is not an alternative coding-agent runtime.

Codex remains responsible for model execution, reasoning, session/context transport, shell and sandbox behavior, permissions, base editing, browser/computer-use capabilities, and native subagent scheduling. codexclaw is responsible for risk-scaled development method, surface-specific knowledge routing, PABCD state and evidence, dispatch eligibility, completion judgment, and thin adaptation to the capabilities exposed by the active Codex version.

This boundary is a product constraint. A feature is not automatically desirable because another harness ships it.

## Ownership matrix

| codexclaw owns | Codex owns |
| --- | --- |
| C0–C5 work/risk classification | model execution and reasoning |
| surface router/reference selection | shell, sandbox, permissions |
| PABCD FSM, attestation, goalplan | base edits/apply-patch behavior |
| HITL/HOTL and completion gates | browser/computer-use runtime |
| dispatch eligibility and evidence packet | native subagent scheduler/processes |
| capability/version adaptation | provider/model runtime |
| doctor, migration, recovery receipts | session/context transport |

## Progressive-disclosure contract

Four layers must remain distinct:

1. installed skill directories
2. implicit-visible metadata and trigger surface
3. router `SKILL.md` bodies actually selected for a task
4. references and subagent skill attachments actually selected

Installed skill count is not a context-cost proxy. References are never bulk-preloaded. A subagent receives only the skills needed for its bounded task. C0/C1 tasks should usually read no specialist reference; high-risk work must not miss the relevant router merely to minimize tokens.

`dev-frontend` and `dev-uiux-design` are maintainer-owned personal harnesses with established users. Their design grammar, implicit visibility, and lazy-loaded references are not normalization targets. They may be measured for activation economy, but their semantic direction remains maintainer-owned.

## PABCD boundary

`pabcd_initiative` is the methodology/provenance source of truth. codexclaw is the live Codex-specific adapter.

The methodology is capability-responsive:

- model judgment chooses work class, architecture, test strategy, and whether a task packet is dispatchable
- mechanics enforce only invariants that must not depend on probabilistic obedience, such as state transitions, attestation, Stop continuation, source identity, and evidence-backed completion
- C0/C1 retain fast paths; higher-risk work earns deeper process

## Dispatch boundary

Dispatch is decided by:

- **specifiability:** inputs, outputs, and decision boundary can be stated completely
- **verifiability:** the main agent can inspect anchors, metrics, receipts, or reproduction commands
- **judgment ownership:** collapse/crux judgment remains with the main agent

Complex work may be dispatched when the packet is specifiable and verifiable. Simple-looking work stays with the main agent when its decision boundary is unclear. Two distinct agents failing the same unchanged packet retires the packet; the main agent reclaims the slice.

Use native Codex spawn surfaces. Permanent roles remain explorer, reviewer, and executor; surface specialization is attached as skills rather than multiplied into a role catalog.

## Extension admission contract

A new component, hook, role, MCP, daemon, or always-on context block must declare:

```yaml
native_gap: why current Codex capabilities are insufficient
activation: when the feature is actually selected
hot_path: whether it runs per session, turn, tool, stop, or only on demand
cost_budget: token, process, filesystem, and p50/p95 budget
failure_mode: fail-open or fail-closed, with rationale
disable: exact one-command disable/remove path
sunset_when: native capability that causes adapter removal
evidence: eval or regression proving outcome improvement
```

Review rules:

- a new hook is for a machine-enforced invariant, not probabilistic judgment
- a new agent role is rejected unless the three stable roles plus attached skills cannot express the packet
- a new MCP must close a real native capability gap and remain dormant when unused
- a required daemon or proxy is presumed out of scope
- hidden provider/tool/model fallback is prohibited
- disabled or irrelevant optional features should have effectively zero context cost

## Hot-path and failure requirements

Hook count alone is not a performance metric. Measure session-once and hot-path hooks separately, including invocation frequency, no-op rate, process creation, filesystem IO, and platform-specific p50/p95. Security and PABCD invariants may intentionally cost more, but they still require an explicit budget and regression fixture.

Evaluation scripts are opt-in and run outside ordinary sessions. Compiled hook
replay measures synthetic invocation cost, not host matcher/trust activation.
Installed version, selected configuration, and actual routed model/service tier
are separate claims. Missing execution proof is unknown, never an inferred pass;
raw artifacts and parent/child provenance must be reviewed before adoption.

Failure behavior must be explainable. Unsupported capability, stale state, or malformed payloads must not silently invent a provider, tool, model, or success result.

## Deliberate non-goals

codexclaw does not seek to own:

- a general edit protocol or hash-anchored editor
- an LSP/DAP runtime
- a tmux/team scheduler
- a default active MCP fleet
- a required daemon, proxy, or provider router
- a broad model-provider fallback engine
- a large permanent agent-role catalog
- default opt-out telemetry

Operational discipline from broader systems is welcome: packed-install smoke tests, doctor/recovery evidence, typed subagent receipts, exact-candidate release proof, and controlled benchmarks. Their replacement-runtime machinery is not.

## Change-review checklist

Before merging an architectural feature:

- [ ] native gap and sunset condition are documented
- [ ] installed, visible, activated, and reference-loaded costs are not conflated
- [ ] ordinary irrelevant sessions remain dormant
- [ ] failure mode is explicit and tested
- [ ] platform-specific timing/regression budget exists for hot paths
- [ ] no frontend/UIUX semantic normalization is hidden in the change
- [ ] no PABCD methodology is copied blindly without recording the Codex adapter delta
- [ ] exact-head verification and rollback/disable path are recorded
