# 010 — wp2: lane-loop authority

One sentence blocks the feature; one reference makes the shape usable. Both land together
so the skill never says "a lane may loop" without saying what the packet must carry.

## MODIFY `plugins/codexclaw/skills/loop/SKILL.md` (lines 28-29)

Before:

```markdown
Only the main session owns host goals and PABCD transitions. A delegated task
follows its packet; loading loop never authorizes a leaf to start a goal or spawn.
```

After: keep the leaf rule, scope it to leaves, and name the lane case explicitly — a
dispatched worktree task is not a leaf, it owns its own goal and FSM, and its packet is
what turns that ownership into authority. Cross-link the new reference.

## NEW `plugins/codexclaw/skills/loop/references/lane-dispatch.md`

Three rules, each earning its place from 001:

- **LANE-LOOP-AUTH-01 (STRICT).** A subagent never opens a goal or runs `cxc orchestrate`.
  A dispatched TASK does own both, because codexclaw keys them to the task — but it runs a
  loop only when its packet grants the objective, the criteria and the completion
  condition. Absent that grant the lane does the stated work and reports; it does not
  invent a goal. The coordinator never advances a lane's FSM and a lane never advances the
  coordinator's.
- **LANE-PACKET-01 (DEFAULT).** The `create_thread` prompt is the only channel: the lane
  cannot read the coordinator's goalplan. The packet therefore carries objective, scope
  boundary with an explicit write scope, base ref and branch, whether to loop, whether it
  may merge, what evidence to return, and how to report a blocker. A lane told to "run
  cxc-loop" without an objective and criteria has been told to invent them.
- **LANE-MERGE-GRANT-01 (STRICT).** Merge authority is a separate sentence in the packet.
  Default is evidence-return: the lane pushes its branch, opens a PR and hands back CI
  evidence; the coordinator sequences landing (DISPATCH-LANE-MERGE-01). A lane granted
  merge may land only its own branch, never another lane's.

Plus the measured operating envelope: addressing via `thread://<threadId>?hostId=<host>`,
canonical id versus `clientThreadId`, `wait_threads` 1-8 targets and 0-120000 ms, no
model-visible resolver for a queued lane, the subagent cap of six with its config key, and
the fact that finishing a lane wakes nobody.

## MODIFY `plugins/codexclaw/skills/loop/SKILL.md` reading table

Add: `| Dispatching tasks that will run their own loop | [Lane dispatch](references/lane-dispatch.md) |`

## NEW `plugins/codexclaw/test/lane-dispatch.test.mjs`

Assertions that fail if the authorising text is removed or weakened:

1. `loop/SKILL.md` no longer contains the unscoped "A delegated task follows its packet"
   sentence, and does contain a leaf-scoped replacement.
2. `lane-dispatch.md` exists, defines LANE-LOOP-AUTH-01, LANE-PACKET-01 and
   LANE-MERGE-GRANT-01, and is linked from `loop/SKILL.md`.
3. The measured bounds appear verbatim where a reader would look for them: 8 targets,
   120000 ms, the `thread://` shape, `clientThreadId`, and the six-subagent cap.
4. Every local markdown link in the new reference resolves on disk.

## MODIFY `plugins/codexclaw/test/manifest-policy.test.mjs`

Add the new reference to the hard-coded router-link list (`:153-203`) so a missing link or
an empty file fails CI rather than passing silently.
