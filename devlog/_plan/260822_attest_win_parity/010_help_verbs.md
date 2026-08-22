# 010 - issue #47: the sibling commands had no --help

## Why this belongs in the same unit

The attest fix was about codexclaw telling an agent to run something impossible.
This is the same theme one layer down: codexclaw telling an agent where to look
and then refusing to answer.

```
cxc --help              # mentions loop / orchestrate --help
cxc orchestrate --help  # OK
cxc loop --help         # loop: unknown loop verb '--help'
cxc scan --help         # scan: unknown scan action '--help'
cxc receipt --help      # receipt: unknown receipt verb '--help'
cxc --version           # codexclaw: unknown command '--version'
```

`orchestrate` was fixed long ago (`devlog/_fin/260709_cxc_help_agent_ux`); its
siblings never were. The top-level help points at them, so following the pointer
is what breaks.

## Measured cost, from this session

I hit this myself before the issue was filed. Arming the goalplan took six
rejections to get one command right:

```
loop steer: --session <id> is required
loop steer: --batch-json <path-or-json> is required
loop steer: idempotencyKey is required and must be a non-empty string
loop steer: rationale is required and must be a non-empty string
loop steer: evidence is required and must be a non-empty string
loop steer: ops must be a non-empty array
```

Each one is a good error message. Together they are a guessing game, because
there was no way to ask for the whole shape at once. That is the actual defect:
not that the errors are bad, but that discovery was only available through
failure.

## Fix

`help | --help | -h` on `loop`, `scan` and `receipt` now print usage and exit 0,
matching `orchestrate`'s contract. Unknown verbs still fail, but the message
names the way out (`run cxc loop --help`) rather than only listing verbs.

The `loop` usage spells out the steer batch shape explicitly, since that is the
one nobody can guess:

```
{ "idempotencyKey": "<unique>", "rationale": "<why>", "evidence": "<proof>",
  "ops": [ { "kind": "annotate", "note": "..." } ] }
```

`cxc --version` reads the installed manifest. Previously the only way to know
which payload was live was to read the cache directory name.

## `scan record --cwd`

Reported in the same issue and fixed here: `orchestrate` documents and accepts
`--cwd`, `scan` rejected it outright. The reporter's session had its answer
ledger in one tree and its process cwd in another, so `--derive` silently
matched nothing:

```
derived=0 dimension(s) from the answer ledger — WARNING: nothing matched
```

That is a preview of issue #48, which is the same split seen from the FSM side.

## Tests

`help-verbs.test.ts` asserts the CONTRACT — exit 0 plus a `Usage:` block — rather
than the wording, so the text can be edited freely. It also pins the flags that
were previously discoverable only through rejection (`--session`, `--batch-json`,
`idempotencyKey`), asserts that unknown verbs now point at `--help`, and covers
`scan record --cwd` in both the explicit and defaulted forms.
