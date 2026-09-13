# 001 — Raw evidence for the dispatch-surface taxonomy

Everything the roadmap asserts about the runtime traces back to one of the four
records below. They are kept verbatim so a later reader can re-run them instead
of trusting the summary.

## E1 — V1 subagent filesystem probe

Dispatched with `multi_agent_v1__spawn_agent`, model `xai/grok-4.6`, effort
`high`, from session `01a09876-4f94-7d60-9664-74329d3eb262` in
`/Users/jun/.codex/worktrees/4f59/codexclaw` on branch
`codex/dispatch-taxonomy-hardening` at `af445635`.

Returned handle: `{ agent_id: "01a09877-aef9-7872-9470-fc35deac9a00", nickname:
"Goodall" }`.

Its answers, abridged to the decisive lines:

```text
1. /Users/jun/.codex/worktrees/4f59/codexclaw
2. /Users/jun/.codex/worktrees/4f59/codexclaw
3. codex/dispatch-taxonomy-hardening
   af445635b3aa6db480728426ea701212fbdd2d6a
4. /Users/jun/Developer/new/700_projects/codexclaw                 a4396f28 [dev]
   /Users/jun/.codex/worktrees/4f59/codexclaw                      af445635 [codex/dispatch-taxonomy-hardening]
   /Users/jun/Developer/new/700_projects/codexclaw-pr91            c2558a4c [pr91]
   /Users/jun/Developer/new/700_projects/codexclaw-visual-release  1695074e [codex/visual-document-skill]
6. 01a09877-aef9-7872-9470-fc35deac9a00
9. ?? PROBE_SUBAGENT_A.tmp
   DELETED: PROBE_SUBAGENT_A.tmp is gone
10. This filesystem is the same as /Users/jun/.codex/worktrees/4f59/codexclaw,
    proven by pwd and git toplevel matching that path, ls of that path
    succeeding, and PROBE_SUBAGENT_A.tmp appearing as an untracked file in that
    worktree's git status before deletion.
```

Line 4 is the quiet one. `git worktree list` from inside the subagent enumerates
the parent's worktrees and contains no entry for the subagent, because the
subagent never got one.

Line 6 is the trap. The subagent holds a `CODEX_THREAD_ID` of its own, distinct
from the parent's. A distinct thread id is what makes "thread" feel like the right
word for it, and it proves nothing about the filesystem.

## E2 — the subagent holds no session state

After E1 returned, `.codexclaw/sessions/` in this worktree contained exactly one
file: `01a09876-4f94-7d60-9664-74329d3eb262.json`. The subagent's id has no
session file, therefore no phase, no ledger and no goalplan binding.

## E3 — one thread, one worktree, one FSM

A scan of `~/.codex/worktrees/*/*/.codexclaw/sessions/` during the concurrent
opencodex merge run returned one session json per worktree slot:

```text
0292/opencodex  01a09869-79e9-7d62-aebc-424b3025e1c9.json
0e20/opencodex  01a09866-e847-7fc0-8c77-76a876ffc9ff.json
4921/opencodex  01a09866-e843-7972-8b78-06f6a7f2a6b0.json
638d/opencodex  01a09866-e83f-7393-840b-1f0a8b2749ca.json
6e5e/opencodex  01a09869-cb7c-75f2-a074-bfada0c84986.json
ac0b/opencodex  01a09869-79af-72b1-a479-a0a4394baad9.json
4f59/codexclaw  01a09876-4f94-7d60-9664-74329d3eb262.json
```

Seven parallel lanes, seven checkouts, seven independent FSMs. That is the shape
a subagent cannot produce.

## E4 — the source, twice

Two independent lanes read `/Users/jun/developer/codex/121_openai-codex` at
`095da4b7e8b70b01afb5c6131ef926dcb8c0d85d`. The second was given the first's
claims as assertions to refute rather than to confirm. Both landed on the same
cwd mechanism:

```rust
// core/src/tools/handlers/multi_agents_common.rs:237-252
/// make a child agent disagree with its parent about approval policy, cwd, or sandboxing.
pub(crate) fn apply_spawn_agent_runtime_overrides(...) {
    let turn_cwd = turn.cwd.clone();
    config.cwd = turn_cwd;
```

called from `multi_agents/spawn.rs:109` (V1) and `multi_agents_v2/spawn.rs:145`
(V2). Neither lane found `WorktreeManager` or `create_worktree` anywhere on the
spawn path.

The second lane corrected the first on three points, all folded into 000_plan
Revision 2: the V2 namespace default is configurable and `multi_agent_v2` is a
feature-flag name rather than a namespace; V1's schema `required` is `None` but
`parse_collab_input` still rejects a spawn carrying neither `message` nor
`items` (`multi_agents_common.rs:145-147`); and the shared-directory text is
`DEFAULT_MULTI_AGENT_V2_SHARED_USAGE_HINT_TEXT`, a usage hint rather than a
system prompt.

That last correction is the one that explains the whole failure mode. The
sentence "All agents share the same directory" is delivered **only on V2**. A V1
session is never told it, and the V1 tool description tells it the opposite:

```text
// core/src/tools/handlers/multi_agents_spec.rs:713
- When delegating coding work, instruct the submodel to edit files directly in
  its forked workspace and list the file paths it changed in the final answer.
```

`fork_context` and `fork_turns` fork thread history. Nothing forks the
filesystem. On a V1 host the only correction available is the one the skills
provide, which is why this unit exists.
