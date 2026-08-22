# PowerShell landmine probes

Four scripts that answer questions about what a shell ACTUALLY did, rather than
what it claims. Every case filed from this unit was measured with one of these
first; nothing was reported from recollection.

## `argv.mjs` - what did the child really receive?

```powershell
node argv.mjs --attest '{"a":"b c"}'
# argc=2
# 0: "--attest"
# 1: "{a:b c}"          <- quotes gone
```

Use it whenever a CLI rejects input you believe you sent correctly. If the error
names words from your own prose, the shell split the argument.

## `bytes.mjs` - what is actually in that file?

```powershell
"not ok 1" | Out-File -Encoding utf8 run.log
node bytes.mjs run.log "^not ok"
# bytes=13 head=efbbbf6e6f74206f bom=UTF-8 BOM
# utf8 matches=0        <- the BOM broke the anchor
# utf16le matches=0
```

Use it when a grep returns zero and you are sure the content is there. Reports
the anchor match under both decodings, because decoding correctly is not
sufficient - a surviving BOM still defeats `^`.

## `exit.mjs` - a child with a known exit code and both streams

```powershell
node exit.mjs 3
# stdout-line
# stderr-line     (exits 3)
```

Use it as a controlled subject when testing how a construct propagates failure.
It is how `if (nativecmd)` was shown to branch on output volume, and how
`Start-Process` was shown never to touch `$LASTEXITCODE`.

## `resolve.mjs` - can this resolved path actually be spawned?

```powershell
node resolve.mjs "C:\Program Files\nodejs\npm.ps1"
# result=EFTYPE
node resolve.mjs "C:\Program Files\nodejs\npm.cmd"
# result=exit 0 / stdout=10.9.2
```

Use it when a tool "exists" but will not run. Note the `.cmd` branch wraps the
ComSpec line in a second pair of quotes, because `cmd /s /c` strips the outer
pair - without that, a path containing a space fails with
`'C:\Program' is not recognized`.

## Method

Three rules that made this productive:

1. Measure the observable, not the intent. `argc` and byte offsets do not have
   opinions.
2. Verify the workaround too. Several "fixes" from the wider archive turned out
   to fail on this host (`Out-File -Encoding utf8`, `utf8NoBOM`).
3. Record the negative results. Half the value of a probe run is knowing that
   globs, UNC paths and `$LASTEXITCODE` propagation are fine, so nobody spends
   an afternoon re-testing them.
