# 030 - round 2: interpolation and truthiness

Second hunting pass with the same harness. Two more landmines, both silent, both
of the worst kind: the shell does exactly what it promises and the result is
wrong anyway.

## 5. `$1`, `$2` and `$100` are real variable names (filed #10)

```
"s/(a)(b)/$2$1/"   -> "s/(a)(b)//"      sed backreferences deleted
"{print $1}"       -> "{print }"        awk field deleted
"$100-$200"        -> "-"               a price range became a hyphen
```

Digits are legal identifier characters, so these are unset variables expanding to
empty. Proof that they are genuinely variables:

```powershell
$100 = "SET"; node argv.mjs "price $100"     # 0: "price SET"
```

`Set-StrictMode -Version Latest` does catch it, but it is off by default and
nobody enables it in the shell where one-off commands get typed.

Negative results worth keeping: globs (`*.ts`, `file[1].txt`), semicolons,
commas, UNC paths and backtick-n all pass through intact. `$` is the whole
problem, and single quotes solve all of it.

## 6. `if (nativecmd)` tests output, not exit status (filed #11)

| tool | exit | `if` says | correct? |
|---|---|---|---|
| silent, succeeds | 0 | falsy | no |
| silent, fails | 1 | falsy | by accident |
| prints, fails | 1 | truthy | no |
| prints, succeeds | 0 | truthy | by accident |

The branch tracks verbosity. Quiet well-behaved tools are exactly the ones it
always gets wrong.

Same area, separate surprise: the captured value's TYPE depends on line count.
One line is a `String`, two lines is an `Object[]`. So `-eq`, `.Trim()` and
`.Length` silently change meaning when a tool adds a log line.

## Running index

| # | category | what |
|---|---|---|
| 6 | args-quoting | escaping a quote ends the quoted span |
| 7 | encoding | the recommended encoding fix writes a BOM; utf8NoBOM absent on 5.1 |
| 8 | streams | Out-String inflates 2 lines to 8, injects script source |
| 9 | aliases | Get-Command vs where.exe disagree; both unrunnable |
| 10 | args-quoting | `$1`/`$100` are variables; regex and money get deleted |
| 11 | exit-codes | `if (nativecmd)` branches on output, not exit code |

Skipped as already covered: empty-arg vanishing, `ErrorRecord` wrapping,
`$?` unreliability, the UTF-16 `Out-File` default, `.ps1` shim precedence.
