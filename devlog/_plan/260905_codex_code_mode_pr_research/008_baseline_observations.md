# Baseline observations before implementation

Date: 2026-09-05. Phase: wp0 P, research only. These are observed results, not the final benchmark.

## Host and source

- macmini-cf: user junny, Node 22.22.0, Codex CLI 0.146.0, OCX 2.43.0.
- OCX live health: version 2.43.0, PID 38505, loopback 10100. Source symlink resolves to `/Users/junny/opencodex`.
- CodexClaw baseline installed version: `0.2.16+codex.260830094500`.
- Baseline experiment source is a `git archive` copy of local `065fa1e887f1d64dcd9c822f34c5fb8626d80a55`, in `/Users/junny/codexclaw-probes/01a0702d-c493-7510-801f-7d8772a2689c/baseline-source`.

## Existing tests

The explicit remote test command in `010_roadmap_lock.md` returned exit 0, 145 tests passed, 0 failed, 0 skipped. Artifact: sibling `baseline-tests-confirmed.log`.

An earlier shell wrapper attempted `status=$?`; zsh reserves that variable. The tests themselves printed 145/0, but the wrapper failed. That sample is preserved as `baseline-tests.log`; it is not the exit-code proof. The confirming invocation used `rc=$?` and returned 0. No production repair or test weakening occurred between these runs.

## Native preflight

Arguments selected `-m gpt-6-astra`, `-c model_reasoning_effort="high"`, `-c service_tier="priority"`, `--json`, `--dangerously-bypass-approvals-and-sandbox`; the prompt asked for `ASTRA_PREFLIGHT_OK` without tools or file changes.

- stdout JSONL: `astra-preflight.jsonl`, ending with `turn.completed` and agent output `ASTRA_PREFLIGHT_OK`.
- stderr: `astra-preflight.stderr`, including an HTTP 426 WebSocket-upgrade error on local `/v1/responses`; the CLI nevertheless completed the turn. This transport behavior is not treated as a hook regression.
- final: `astra-preflight.final.txt`.
- CLI session: `01a0704d-eb45-7961-9e4a-f2023fb046e7`.
- rollout: `/Users/junny/.codex/sessions/2026/09/05/rollout-2026-09-05T15-42-29-01a0704d-eb45-7961-9e4a-f2023fb046e7.jsonl`.
- observed turn context: model `gpt-6-astra`, effort `high`, approval policy `never`, sandbox policy `danger-full-access`.
- reported usage: input 22,705 tokens, output 9, cached input 0. This is one preflight sample, not measured candidate savings or proof that all input is hook overhead.

This initial preflight used the already installed global Codex home to verify connectivity. Candidate comparison must use controlled candidate-specific state and record any necessary credential access. The initial wrapper also hit the zsh `status` error, so JSONL completion—not a successful shell exit—is the result claim here. WP1 recorder must own exit status correctly.

## Fast evidence is not yet conclusive

The contemporaneous OCX usage record with timestamp `1788590551903` reports:

```json
{
  "provider": "openai",
  "requestedModel": "gpt-6-astra",
  "resolvedModel": "gpt-6-astra",
  "requestedEffort": "high",
  "callerServiceTier": "priority",
  "requestedServiceTier": "priority",
  "responseServiceTier": "default",
  "tierOutcome": {
    "canonical": "priority",
    "wireKind": "service-tier",
    "wireValue": "priority",
    "fastOutcome": "applied",
    "confirmation": "assumed",
    "responseServiceTier": "default"
  },
  "status": 200
}
```

The CLI thread ID and OCX conversation ID differ by design. Initial discovery used bounded recent-log inspection; subsequent source inspection and direct hashing established exact correlation: `sha256("01a0704d-eb45-7961-9e4a-f2023fb046e7").hex.slice(0,32)` equals `4638501770e9fbbacdf9e4fffc518d10`, the recorded OCX conversation ID. Owner: opencodex `src/server/request-log-conversation.ts:31`.

An `applied` label with `confirmation=assumed` is not confirmation of upstream scheduling. However, opencodex `src/providers/fastwire.ts:383` explicitly treats the internal Codex backend's tier echo as non-authoritative: `default` can neither confirm nor deny Fast for that destination. Therefore this is not evidence of a downgrade either. The evaluator must distinguish exact requested/forwarded priority configuration from authoritative server scheduling confirmation. Priority-configured trials may compare plugin behavior and overhead while disclosing unknown scheduler confirmation; they may not claim measured proof of priority scheduling itself.

User steering, 2026-09-05: the returned default tier is a known OCX response bug already tracked upstream; ignore it in this task. It is not a blocker or an OCX repair work item. Exact Astra/high and priority wire evidence remain required; a matching request with this known echo is eligible for plugin comparison. The goalplan steering ledger records this boundary explicitly.

## Benchmark validity findings

The existing `hook-bench.mjs` drops hook matcher information and supplies generic event payloads. Its empty-output no-op classification includes silent state writers. These limitations were independently found by two exploration lanes and source-checked by the main agent. WP1 must distinguish synthetic entrypoint cost, matcher eligibility, branch activation, state mutation and model-observed behavior.

The opt-in activation recorder is not hooked into every runtime read. Its bytes/4 values are estimates, not actual model-token measurements. The final evaluator must not manufacture activation proof from an unused recorder or skill-body presence.
