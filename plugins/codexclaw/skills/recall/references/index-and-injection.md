## Maintenance

The sidecar index self-refreshes on every chat query (changed files only) unless
`--no-refresh`. `cxc chat index --status` shows freshness; `--rebuild` drops and
re-ingests after schema-level doubts. Deleting `~/.codexclaw/recall/index.sqlite`
is always safe (rebuildable cache).

## Automatic session-start injection

Separate from these commands, the SessionStart hook injects a short CWD-scoped
list of recent sessions, including the start that follows a compaction. That
list rotates: a session already injected several times is pushed back so a
start sees something it has not seen yet. Counts live in the same rebuildable
sidecar, so deleting the index also resets the rotation to plain newest-first.

The rotation applies to the automatic injection ALONE. `cxc chat search` and
`cxc memory search` never consult it: the same query returns the same ranking
however many times you run it. After compaction the same hook re-fires with
`source=compact` and a smaller block plus a recovery pointer; the PostCompact
recall handler itself emits nothing.
