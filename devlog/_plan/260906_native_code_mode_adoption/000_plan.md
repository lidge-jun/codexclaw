# Native Code Mode adoption

## Loop spec

Satisfy-spec, C3 instruction/contract change. Trigger: user asks main Astra and
Grok-4.6 to interview autonomously, implement native eval adoption and submit a PR.
Goal: a common capability-aware execution policy that an agent can actually reach
and use, not a new evaluator or a promise that every task must use Code Mode.
Non-goals: new hooks/runtime/daemon/MCP, global flags, hidden schema arguments,
merge/release/deploy, changing prior research criteria or unrelated browser policy.
Verifier: executable reference examples run against independent controlled tool
responses on macmini; link targets checked against files; native host observations
and independent forward testing; existing package/gate/full suite and exact-head CI.
Stop: reviewed implementation and evidence-backed PR targeting dev, no merge.
Memory artifact: this numbered unit and session evidence/native-code-mode/.
Outcomes: DONE for criteria met; NEEDS_HUMAN for new authority; BLOCKED for actual
unavailable prerequisites per host contract. No made-up time/token budget. Calls
are bounded; two Grok peers initially, more only for distinct scoped questions.
Escalation: main decides routine tradeoffs, reclaims after two failed workers;
new production/config authority requires user input.

## Existing structure and proposed ownership

```text
plugins/codexclaw/skills/
  dev/SKILL.md                 common owner route
  dev/references/              native policy and worked examples
  loop/SKILL.md                entry route for cxc-loop
  pabcd/SKILL.md               standalone phase-work entry route
plugins/codexclaw/test/        executable examples and link contract
structure/60_native_capabilities.md   dated capability SOT
```

Current dev base: 4ab9cc2b9bc2415cdc5edc0ede21d7ef87bf5025. New branch:
codex/native-code-mode-routing. Previous release docs remain on their original
branch; the old goalplan is unchanged. The stale C cycle was explicitly reset to
IDLE for this new scope, not marked successful. New goal was then created/bound.
Agent-to-agent interviews are design evidence, not fabricated human I-phase Q/A.

## Dependency-ordered work phases

1. wp0: source discovery, Grok questions/main answers, exact roadmap audit; docs only.
2. wp1: implement the common policy, routing edges and executable reference tests
   specified in 010. Tests accompany their instruction contract, not a later promise.
3. wp2: exercise actual native selection and failure handling, independent forward
   review, final regressions/count synchronization and PR delivery specified in 020.

One cohesive PR: the common owner and its routing/tests are one bounded contract;
splitting each pointer into a separate PR would not produce useful standalone layers.
No native GitHub stack is declared. Branch PR explicitly targets dev.

## Acceptance and authority

- Common entrypoints dev/loop/pabcd reach one owner; substantial details stay conditional.
- For composition, response projection or in-context JS computation, prefer
  exposed native Code Mode.
  Simple direct calls, tool-specific restrictions and absent native capability remain valid.
- No blanket wrapper or automatically enabled flags; Node shell, browser eval and
  native Code Mode are different execution surfaces.
- Promise rejection, tool-level errors, incomplete command status and malformed
  results remain observable; no later dependent write or blind retry.
- Store values are disposable, bounded, task-scoped data, not permissions or receipts.
- Check example outputs/side effects and link destinations, not matching prose phrases.
- Retain semantic review and actual native observations separately from Node fixture tests.

Enforcement claim: E7 guidance only; surface is skill/reference text; bypass is
not loading/following it; residual is agent choice/host availability; wording is
preferred-use policy, not enforced routing. Final enforcement layer: none added.
Existing authorization/hooks still govern actual tool execution.

## Cycle records

P/wp0: repository and native description inspected; two Grok-4.6 interview lanes
dispatched. No production instruction changed before the roadmap audit.
