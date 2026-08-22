# 040 - round 3: comparison operators

## 8. `-ne` against a list is a filter, not a boolean (filed #13)

The most dangerous one found so far, because it fails toward "allow".

```powershell
$forbidden = @("admin","root"); $user = "admin"
if ($forbidden -ne $user) { "ALLOWED" } else { "denied" }   # ALLOWED
```

With a collection on the left, comparison operators return the matching elements
rather than a boolean:

```
@("x","y","x") -eq "x"  ->  Object[] count=2  value=x,x
@("x","y")     -ne "x"  ->  count=1           value=y
```

`$forbidden -ne "admin"` is `@("root")`, which is truthy. The check is really
asking "are there entries that are not admin", and there are.

The failure curve is the problem:

```
@("admin")         -ne "admin"  -> falsy  -> denied   correct
@("admin","root")  -ne "admin"  -> truthy -> ALLOWED  wrong
@()                -ne anything -> falsy  -> denied   correct
```

One entry works. Two entries invert it. So it passes the unit test and the first
deploy, then breaks when someone extends a config list.

`-contains` is the fix and was verified. Also recorded: `-contains` is
membership, NOT substring - `"hello" -contains "ell"` is False while
`"hello".Contains("ell")` is True. The operator that sounds like substring search
is membership, and the ones that look like comparison are filters.

Negative results from this pass: `-like` wildcards, `$Matches` population after
`-match`, and case-insensitive-by-default `-eq` with `-ceq` as the sensitive form
all behave as documented and are not landmines.

## Running index

| # | category | what |
|---|---|---|
| 6 | args-quoting | escaping a quote ends the quoted span |
| 7 | encoding | recommended encoding fix writes a BOM; utf8NoBOM absent on 5.1 |
| 8 | streams | Out-String inflates 2 lines to 8, injects script source |
| 9 | aliases | Get-Command vs where.exe disagree; both unrunnable |
| 10 | args-quoting | `$1`/`$100` are variables; regex and money get deleted |
| 11 | exit-codes | `if (nativecmd)` branches on output, not exit code |
| 12 | collections | one-line file makes Get-Content a String |
| 13 | collections | `-ne` against a list is a filter; denylists fail open |
