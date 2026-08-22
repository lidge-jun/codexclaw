# 060 - closeout: eleven landmines, and what was deliberately left alone

This unit started as a PABCD self-test after a transition failed. The failure
turned out not to be the FSM at all - inline `--attest` JSON never survives
PowerShell - and the probe built to prove that became a hunting tool.

## What was filed

| # | category | what it costs you |
|---|---|---|
| 6 | args-quoting | escaping a quote ends the quoted span; one argument becomes several |
| 7 | encoding | the archive's own recommended fix writes a BOM; `utf8NoBOM` absent on 5.1 |
| 8 | streams | `Out-String` inflates 2 lines to 8 and injects your script's source |
| 9 | aliases | `Get-Command` and `where.exe` disagree; both return unrunnable paths |
| 10 | args-quoting | `$1`/`$100` are variables; sed backreferences and money get deleted |
| 11 | exit-codes | `if (nativecmd)` branches on output volume, not exit status |
| 12 | collections | a one-line file makes `Get-Content` a String; `[0]` returns a character |
| 13 | collections | `-ne` against a list is a filter; a denylist fails OPEN |
| 14 | collections | `return` does not suppress other output; functions leak values |
| 15 | serialization | `ConvertTo-Json -Depth 2` default replaces nested data with a type name |
| 16 | env-paths | `Test-Path` validates a trailing-space path that Node cannot open |
| 17 | exit-codes | `Start-Process` never sets `$LASTEXITCODE`; a failure inherits the last success |

Every one was measured on this host before filing, with the probe output pasted
into the issue verbatim.

## The pattern worth naming

Nine of the eleven are **silent**. That is not an accident of selection - it is
what makes PowerShell landmines expensive. The shell does exactly what it
documents, produces a plausible result, exits 0, and the damage surfaces later in
someone else's process.

Three of them fail in the dangerous direction specifically:

- #13 a denylist reports ALLOWED for the value it exists to block
- #15 secrets vanish from a config while the JSON stays valid
- #16 a validation step certifies a path the consumer cannot open
- #17 a CI gate passes on a process that exited 1

And two are traps set by the *fix* rather than the original bug: #7 (the
recommended encoding still breaks anchored grep) and #6 (the escape works right
up until a value contains a space).

## Deliberately not filed

Checked against the archive and skipped as already covered:

- empty-string arguments vanishing -> `oss-native-arg-quoting`
- `ErrorRecord` wrapping itself -> `native-stderr-errorrecord`
- `$?` being unreliable -> `exit-code-vs-dollar-q`
- the UTF-16 `Out-File` default -> `oss-outfile-bom`
- `.ps1` shim precedence -> `npm-ps1-not-comspec`

Measured and found NOT to be landmines - recorded so nobody re-tests them:

- globs (`*.ts`, `file[1].txt`), semicolons, commas, UNC paths, backtick-n:
  all pass through argv intact
- array splatting, trailing backslashes, leading `@`, dash-prefixed values: fine
- `$LASTEXITCODE` propagation through `Select-String`, `Tee-Object`,
  `Out-String` and `Select-Object`: correct in every case
- `-like` wildcards, `$Matches` population, `-eq`/`-ceq` case sensitivity: as
  documented
- `+=` on an array: a performance footgun, not a correctness bug

## 11. `Start-Process` leaves the result invisible (filed #17)

```powershell
node -e "process.exit(3)"; "before=$LASTEXITCODE"      # before=3
Start-Process -FilePath node -ArgumentList "-e","process.exit(7)" -Wait -NoNewWindow
"after=$LASTEXITCODE"                                   # after=3
```

`Start-Process` is a cmdlet, not a native invocation, so it never touches
`$LASTEXITCODE` - the variable is not zeroed, it is LEFT ALONE holding the
previous command's value. A CI gate written correctly against `$LASTEXITCODE`
therefore reports on a command from an earlier step:

```
node -e "process.exit(0)"; Start-Process ... exit 1; if ($LASTEXITCODE -eq 0)
-> CI GATE PASSED (wrong)
```

`$?` does not rescue it either - it is True, because launching succeeded.

Output has the matching trap: `$out.StandardOutput` is empty while the text
visibly prints to the console, so it looks captured and is not. `-PassThru` plus
`.ExitCode`, and `-RedirectStandardOutput` to a file, are the working forms.

The archive's two Start-Process cases are both about ARGUMENTS reaching it;
grepping them for ExitCode, LASTEXITCODE and PassThru returns nothing.

Negative results from this pass: `& $exe` with a spaced path, `Invoke-Expression`
with embedded quotes, and `Start-Process -Wait -PassThru` exit capture all work
correctly.

## The harness

`probes/` holds four scripts, committed so every claim reruns:

| probe | answers |
|---|---|
| `argv.mjs` | what argv the child ACTUALLY received |
| `bytes.mjs` | true bytes, BOM, anchored match under utf8 vs utf16le |
| `exit.mjs` | controllable exit code with output on both streams |
| `resolve.mjs` | whether a resolved shim path can be spawned |

The rule that made this productive: never report a behaviour you have not
watched a process actually perform.
