# 020 - issue #48: one session id, two FSMs

## The failure

Session files live at `<cwd>/.codexclaw/sessions/<id>.json`. The id is stable;
the cwd is not. A Codex thread whose process cwd is one tree while its work is in
another therefore has TWO FSMs under the same id, and nothing says so:

```
~/.cli-jaw/.codexclaw/sessions/<id>.json    phase=I     13:16Z
~/kim_wiki/.codexclaw/sessions/<id>.json    phase=IDLE  13:22Z
```

The reporter closed D in the wiki tree and the next turn re-injected Interview
from the cli-jaw copy. `scan record --derive` matched nothing because the answer
ledger was in the other tree, and reported it as a warning rather than an error.

## Why not just move the store

The obvious fix — pin session files to the session-start workspace — would
invalidate every session file that exists today, in every checkout, with no
migration path. The failure is bad but it is not worth a flag day.

So the fix makes the split **visible** instead of silently picking one side.

## Fix

`findForeignSessionCopies(cwd, sessionId, candidates)` looks for the same id in
plausible sibling roots and returns the paths it finds. Detection only: the other
tree is never read from or written to.

`orchestrate status` now reports it:

```
session=split-demo-0001 phase=IDLE interview=false auditPassed=false checkPassed=false
WARNING: this session id also has state in 1 other tree(s); the phase above describes THIS cwd only.
  also at: C:\Users\super\cxc-split-a\.codexclaw\sessions\split-demo-0001.json
  Pass --cwd <path> to address a specific tree.
```

That is exactly the reporter's scenario: `phase=IDLE` here, a live cycle next
door, and now a line that says so. The `--json` form carries `alsoFoundAt`.

The candidate list is deliberately shallow — immediate children of `$HOME` plus
the parent of cwd — because this is a warning on a read-only command, not a
filesystem crawl. `node_modules` and `AppData` are skipped as places a workspace
never lives.

## `loop show --session`

The same issue reported that `loop show --slug` is cwd-only and prints
`no plan found` from the wrong tree. `loop init --session` already binds the slug
into the session file, so `resolveSlug` now falls back to that binding:

```
cxc loop show --session <id>        # no 47-character slug to retype
```

This also makes the session the source of truth when the id exists in more than
one tree, rather than whichever directory the shell happened to be in.

## Not fixed here

The underlying cwd-keyed storage is unchanged, so two trees still diverge — you
are now told about it rather than misled by it. Making `--session` resolve to one
canonical store is a larger change that needs a migration story.
