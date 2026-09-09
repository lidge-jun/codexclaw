# Installed natural-call scenarios

Date: 2026-09-10 (Asia/Seoul).

Jun authorized actual configured subagent calls on isolated fixtures, then asked
that architect permissions be judged consistently with existing agents rather
than adding architect-specific restrictions.

## Method

Fresh `codex exec --approve-for-me` processes used the current installed plugin
and global role settings. Each worked in a separate tiny Git fixture under
`/tmp/cxc-natural-call-check`. Prompts, event JSONL and final answers remain there.
The main model was not overridden. No production project was edited. These are
bounded observations, not a statistical trigger-rate evaluation.

- `design-prompt.txt`: ask for a formal P plan to persist an in-memory queue and
  suppress duplicate execution. The prompt did not name architect. It allowed
  two child contexts and one alignment check, and prohibited implementation/FSM.
- `review-prompt.txt`: ask for independent review of an at-most-once claim. The
  fixture intentionally permits duplicate `take` calls. One child context allowed.
- `simple-prompt.txt`: ask only to correct `procesed` to `processed` in README.

## Discovered and repaired entrypoint defect

First design and review runs chose the intended logical role but created no child:
installed `bin/cxc.mjs subagents dispatch` returned `unknown subcommand 'dispatch'`.
The repository CLI supported this route; the payload dispatcher did not. This was
an installed entrypoint bug, not an unavailable provider or a registration failure.

Commit `5894a019` forwards payload dispatch calls and stdin to the existing
`fallback-dispatch-cli.js`. The existing payload test now checks this subcommand
without writing state; all three payload tests and the drift gate pass. The fix
was applied locally and preserved outside cache alongside the source archive.

## Fresh rerun evidence

Design parent: `01a086e6-5a66-7673-ab55-b9fea000af5c`.

- Native `architect` child `01a086e7-2ef8-7b82-9de1-ad4a7aa300c1`, requested model
  `anthropic/claude-fable-5-1`, effort `high`; recorded in child turn context.
- Main obtained a proposal, revised the plan, sent one reflection to the SAME
  child, and received `ALIGNED`. Managed architect dispatch reached `complete`.
- Main then created a distinct independent reviewer
  `01a086ea-ab5f-7282-ae43-7ded0aa364b9` for the plan.
- Independent plan review returned PASS. Both managed dispatches completed, and
  the parent delivered the plan using exactly two child contexts and one same-
  architect reflection. This validates the consultation sequence without claiming
  FSM transitions (explicitly excluded) or implementation completion.

Independent code-review parent: `01a086e6-7695-7450-8761-720ef2c13cb1`.

- Native reviewer `01a086e7-58d4-7391-8c4e-523d653716bf`, requested model
  `main/gpt-daybreak-blue-latest`, effort `high`; recorded in child turn context.
- Child found the intentional duplicate-consumer bug and reproduced it. Main
  independently observed `processed: 2` and `takeAfterFinish: true`.
- Spawn, completion and close succeeded; managed dispatch reached `complete`.
- Main initially used wrong created-report fields, then corrected to
  `action: report, outcome: created`. No extra child was spawned. Improving
  instruction examples is a follow-up candidate, not a completed change here.

Simple-edit parent: `01a086e4-01b7-75e2-943a-15d797f1d750`.

- No child spawn events. Only the requested README typo changed.

## Permissions and limits

Architect and reviewer child records BOTH inherit workspace-write filesystem
permissions in this native host. The architect role file's read-only declaration
does not establish a narrower effective filesystem boundary in these runs.
Treat this as the shared host behavior, not an architect-specific adoption blocker.
No additional permission constraint was installed. Design/review tracked source
files stayed unchanged; operational `.codexclaw` state is expected.

Model names above are requested/routed names in actual native runtime records;
they do not independently attest the ultimate provider backend identity. No
provider failure was deliberately injected, so these successful calls do not
prove a live primary-to-fallback transition. Natural selection was tested with
explicit formal-P and independent-review requests, not every ambiguous user prompt.

An unrelated memory-write hook also rejected an initial read-only memory search.
The test did not bypass it or alter memory permissions; this remains a separate
false-positive observation.

## PR refresh validation

Before updating PR #110, integrated upstream dev at `1ca63c86772d9860fd00f0373f2b092bc01557bd`. Its new CI-script tests change the combined suite count. Full suite with existing dependencies and a clean TMPDIR under `/var/tmp`: 2,896 tests, 2,824 passed, zero failed, 72 skipped (exit 0). Published counts and drift gate pass. An earlier attempt lacked the temporary dependency link and failed the router module import; the complete rerun above supersedes that attempt. Local branch history is preserved; publication uses an identical tree with the existing public noreply identity because GitHub rejected private-email commits (GH007). No privacy setting or forced push is used.
