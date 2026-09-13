# wp2 — P revalidation and diff-level plan

## Revalidation of 010

wp1's D concluded that the confusion is a routing gap rather than a missing
fact, and that the fix is one owner file plus conditional edges into it. Reading
the live tree at `288d83e5` confirms 010's design still holds, with two
adjustments the audit forced.

`lunasearch/SKILL.md:18-20` turns out to be the sharpest example in the repo of
the thing being fixed: "The session surface is pinned on its first turn. V1 is
the default unless the model catalog selects V2 … Fan the lanes out as N spawns".
It already knows about V1 versus V2 and still calls the units "lanes" without
once saying they share a checkout. One sentence there is worth more than a
paragraph elsewhere.

`structure/20_pabcd_dispatch_doctrine.md:29` maps the cli-jaw "Employee" row onto
`spawn_agent` in a translation table that has no row for a Codex task at all.
Adding a row is better than editing the existing one, since the existing mapping
is correct as far as it goes.

## Exact changes

### New — `skills/pabcd/references/dispatch-surfaces.md`

Sections in order: DISPATCH-SURFACE-01 (name the surface first); the comparison
table; DISPATCH-ROUTE-01 (the routing decision); DISPATCH-SHARED-TREE-01 (the
shared-tree trap and the contradicted host wording); parallel lanes; the
thread-with-subagents hybrid; authority.

The comparison table's rows: working tree, git branch and HEAD, thread id,
`.codexclaw` session state, host goal, PABCD FSM, who owns the result, user
visibility, creation authority, addressing, waiting, and lifecycle end.

### Edits

| File | Anchor | Change |
|---|---|---|
| `pabcd/SKILL.md` | "## Delegation Model (subagents)" | a first paragraph routing to the taxonomy before a surface is chosen |
| `pabcd/references/delegation.md` | line 1 | a scope line: this file owns the subagent packet, the taxonomy owns surface choice |
| `pabcd/references/delegation.md` | DISPATCH-ISOLATION-01 | add that lanes share one working tree, so scopes must be disjoint by path |
| `loop/SKILL.md` | reading table | a row for parallel lanes and surface choice |
| `dev/SKILL.md` | "### Discovery delegation" | one sentence separating discovery from a parallel branch lane |
| `worktree-guardian/SKILL.md` | §2 WG-FACTS-01 | a WG-FACTS-02 note: a spawned child inherits this worktree and does not get one |
| `lunasearch/SKILL.md` | "## Hardcoded Spawn Path" | the lanes share one checkout; Luna lanes are read-only so they cannot collide |
| `structure/20_pabcd_dispatch_doctrine.md` | translation table | a row mapping a separate Codex task to `create_thread` |

## Out of this cycle

The delegation reference's "Live tool schema and role transport" section and
every `components/subagent-config` file belong to wp3. The audit confirmed the
two spans in `delegation.md` do not overlap: wp2 touches line 1 and
DISPATCH-ISOLATION-01 near line 103, wp3 touches lines 50-99.

## Check

`npm run gate` under `cxc receipt test`. The gate enforces inventory counts and
false-enforcement prose, both of which a new reference file can break: a skill
that claims a rule is "enforced" when nothing enforces it is exactly what the
gate rejects, so the new file states its rules as agent discipline.
