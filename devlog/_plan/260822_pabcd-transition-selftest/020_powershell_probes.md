# 020 - the PowerShell probe harness and what it measured

The transition failure that started this unit was not an FSM bug. Inline
`--attest` JSON never reaches the CLI intact on PowerShell. Proving that needed a
harness, and the harness then paid for itself four more times.

## Harness

Three probes under `.codexclaw/psprobe/`:

| probe | answers |
|---|---|
| `argv.mjs` | what argv the child ACTUALLY received, one entry per line |
| `bytes.mjs` | true bytes, detected BOM, and whether an anchor matches under utf8 vs utf16le |
| `exit.mjs` | controllable exit code with one line on each stream |
| `resolve.mjs` | whether a resolved shim path can actually be spawned |

Everything below is measured output, not recollection.

## 1. Escaping a quote ends the quoted span (filed #6)

```
'{"a":"b"}'          -> 1: "{a:b}"                  quotes eaten
'{\"a\":\"b\"}'       -> 1: "{\"a\":\"b\"}"           looks fixed
'{\"a\":\"b c\"}'     -> argc=3, split at the space  actually broken
"b c d"              -> argc=1                      control: spaces are fine
```

The escape works right up until a value contains a space. Every alternative
failed too: here-strings, `ConvertTo-Json` into a variable, and `--%` (which
additionally swallowed `2>&1` as an argument).

The one form that survives is PowerShell's doubling escape inside single quotes,
verified end to end through `JSON.parse`:

```powershell
$j = '{""from"":""P"",""did"":""two words here""}'   # parses correctly
```

## 2. The recommended encoding fix still breaks grep (filed #7)

| how | head | BOM | `/^not ok/` |
|---|---|---|---|
| `Set-Content` | `6e6f74...` | none | 1 |
| `Out-File` | `fffe6e00...` | UTF-16LE | 0 |
| `Out-File -Encoding utf8` | `efbbbf6e...` | **UTF-8 BOM** | **0** |
| `[IO.File]::WriteAllText` | `6e6f74...` | none | 1 |

`utf8NoBOM` does not exist on 5.1 — the binder lists the legal values and refuses.
So both remediations the archive recommends fail on this host, one silently.

## 3. Out-String inflates one line to eight (filed #8)

```
node exit.mjs 0 2>&1 | Out-String | Set-Content run.log
lines: 8   (expected 2)
```

The extra six are the invocation position, the source line, a squiggle underline,
and two metadata rows — your own script text becomes log content. `Set-Content`
and `Select-String` on the same merged stream stay clean, so the formatter is the
culprit, not the redirection.

Worth recording as a negative result: `$LASTEXITCODE` propagated correctly as 3
through `Select-String`, `Tee-Object`, `Out-String` and `Select-Object`. Exit
codes are not part of this problem.

## 4. Two resolvers, two different worlds (filed #9)

```
Get-Command npm -> npm.ps1  -> spawn EFTYPE
where.exe npm   -> npm      -> spawn ENOENT
```

`Get-Command` ranks `.ps1` first; `where.exe` does not list it at all. And the
`.cmd` fix needs double quoting, because `cmd /s /c` strips the outer pair:

```
"<path>" --version    -> 'C:\Program' is not recognized
""<path>" --version"  -> exit 0, 10.9.2
```

## Deliberately not filed

- Empty-string arguments vanishing — already covered by `oss-native-arg-quoting`.
- `ErrorRecord` wrapping itself — already covered by `native-stderr-errorrecord`;
  #8 covers only what happens when you render it.
- Array splatting, trailing backslashes, leading `@`, and `-`-prefixed values all
  behaved correctly and are not landmines.
