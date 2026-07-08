# 300 - Recommendations

## Priority 1: Native Extension Contributor Track

Current state:

- Codex-rs exposes an extension contributor registry with `ToolContributor`, `ToolLifecycleContributor`, `ContextContributor`, `TurnLifecycleContributor`, `TurnInputContributor`, `McpServerContributor`, and `ApprovalReviewContributor`.
- Codexclaw currently attaches skills/subagent routing through plugin hooks, message mentions, MCP/CLI surfaces, and `.codexclaw` files.

Recommendation:

- Survey whether Codex plugins can register extension contributors, or whether this requires upstream/in-core Codex-rs work.
- Prototype a narrow Codexclaw extension shape on paper first: context contributor for skill prompt fragments, tool contributor for `cxc` commands, lifecycle contributor for evidence/events, approval contributor for policy review.
- Keep TypeScript hooks/CLI as compatibility adapters until an extension path is real.

Acceptance evidence for a future implementation:

- A Codex-rs host loads a Codexclaw contributor registry without a sidecar daemon.
- Tool/context/lifecycle contributions have stable namespaces and tests.
- Existing plugin hook behavior remains backward compatible.

## Priority 1a: Native Subagent Attachment Track

Current state:

- Codexclaw attaches skills to subagents through structured `items` on v1 where possible and portable link-form mentions in `message` for both v1/v2 (`structure/10_subagent_skill_routing.md:103-116`).
- The shipped spawn attach hook rewrites `spawn_agent` input, which is deterministic for payload shaping but still not true runtime enforcement (`structure/40_enforcement_methods.md:52-61`).
- Codex-rs has `SubagentStart` and `SubagentStop` hook surfaces with agent id, agent type, turn id, and transcript path.

Recommendation:

- Track an upstream Codex-rs proposal for first-class spawn attachments or skill items in the v2 spawn schema.
- If upstream does not expose that, prototype `SubagentStart` context injection as a replacement for message prefix injection.
- Keep `subagent-config` as the owner. Do not move this into PABCD state.

Acceptance evidence:

- Spawned subagent receives the intended skill without message-prefix duplication.
- V1 and v2 spawn schemas remain valid.
- `SubagentStop` evidence gate still verifies completion separately.

## Priority 2: Event-Ledger Alignment

Current state:

- Codexclaw has `.codexclaw/ledger.jsonl`, goalplans, divergence candidates, metric rows, and render observation ledgers.
- OMX docs define a stronger Rust-owned model: commands, events, snapshots, authority, backlog, replay, readiness, and worker lifecycle (`runtime-command-event-snapshot-schema.md:1-42`, `rust-runtime-thin-adapter-contract.md:3-18`).

Recommendation:

- Define a Codexclaw event vocabulary that can later map onto Codex-rs or Rust-owned semantic events.
- Start with documentation only: phase transition, goal armed, workphase started/done, subagent assigned, subagent evidence accepted/rejected, verifier passed/failed, blocked_on_user, blocked_on_system.
- Avoid rewriting the runtime until a concrete native event API is available.

Acceptance evidence:

- Existing `.codexclaw/ledger.jsonl` remains readable.
- New docs state which events are semantic truth versus compatibility views.
- No watcher-derived state becomes authoritative.

## Priority 3: Goal/Goalplan Convergence Via Native Goal Extension

Current state:

- Codexclaw goal mode uses the host goal DB read-only; the main session owns `create_goal` / `update_goal`.
- Local goalplans hold work phases and criteria.
- Codex-rs has an `ext/goal` tree with API, events, runtime, spec, steering, and tool files.

Recommendation:

- Investigate whether `ext/goal` can expose criteria/workphase metadata or goal events to plugins.
- Keep Codexclaw goalplans as local durable plans until native goal APIs can represent criteria and captured evidence.
- Never write the host goal DB directly from Codexclaw.

Acceptance evidence:

- Goal active check stays read-only.
- Workphase evidence still lives in the devlog/goalplan until native criteria are equivalent.

## Priority 4: Search Ladder Native Proof Mode

Current state:

- `cxc-search` relies on Tier 1 hosted search plus `agbrowse` fetch/render proof, then browser/chrome/computer fallback.
- Codex-rs has `ext/web-search`.

Recommendation:

- Keep `agbrowse` as the proof helper for now because it returns a useful evidence envelope.
- Investigate whether `ext/web-search` can provide source-open proof, not just search result discovery.
- Do not weaken the "snippets are not evidence" rule.

Acceptance evidence:

- A native proof call returns URL, final URL, source type, content excerpt/summary, blocked status, and fetch/render mode.
- Public claims remain Tier-2 proven or explicitly unverified.

## Priority 5: Harness Parity Without Product Drift

Current state:

- Cursor leads in polished background-agent, PR-review, memory, and MCP setup UX.
- Goose leads in recipes, MCP extension ecosystem, MCP Apps, ACP server posture, and broad desktop/CLI/API packaging.
- OpenHands leads in event-stream/platform framing, custom agents, sandbox/runtime surfaces, and team canvas positioning.
- Claude Code leads in documented hook event breadth and loop/schedule UX.

Recommendation:

- Codexclaw should not chase all product UX. Its strongest wedge is disciplined local development loops with evidence and source-of-truth docs.
- Close parity gaps that strengthen that wedge: native subagent attachment, event-ledger semantics, goal criteria, source-proof search, and reviewer evidence.
- Defer background cloud UX, marketplace UI, and ACP server work unless a user-facing Codexclaw product goal emerges.

Acceptance evidence:

- Each parity project maps to a Codexclaw invariant: evidence, phase control, subagent correctness, source proof, or goal criteria.
- Projects that only improve aesthetics or broad product surface are documented as out of scope.

## Priority 6: Fable-Inspired Unknowns Workflow

Recommendation:

- Add an `Unknowns` section to C3/C4 plan docs:
  - known knowns
  - known unknowns
  - unknown knowns
  - unknown unknowns
- Add `Plan Deviations` during B.
- Add `Reviewer Objections` and optional `Self Quiz` during D.

Why:

- This imports the useful part of Thariq's Fable guide without binding Codexclaw to Fable-specific model behavior.
- It makes loop memory durable and inspectable.

## Next Experiments

1. `subagent-native-attachment-spike`: prove whether `SubagentStart` can inject enough context to replace message-prefix skill mentions.
2. `event-ledger-vocabulary`: write a docs-only event schema mapping current `.codexclaw` ledgers to semantic events.
3. `native-goal-extension-survey`: inspect `ext/goal` deeply and compare with Codexclaw goalplan schema.
4. `source-proof-web-search-spike`: compare `agbrowse` evidence envelope with Codex-rs `ext/web-search` output.
5. `unknowns-template-pilot`: apply the unknowns/deviation/objection pattern to one future C3 unit and measure whether A/C review catches more real blockers.
