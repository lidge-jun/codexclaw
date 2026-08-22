# 050 - round 4: serialization

## 10. `ConvertTo-Json` destroys data at depth 3 (filed #15)

The highest-stakes find of the loop: it loses production data and stays green.

```powershell
$config = @{ name="svc"; deploy=@{ staging=@{ env=@{ DB_URL="..."; API_KEY="..." } } } }
$config | ConvertTo-Json -Compress
# {"deploy":{"staging":{"env":"System.Collections.Hashtable"}},"name":"svc"}
```

The DB URL and API key are gone. Default `-Depth` is 2, and anything deeper is
not truncated but rendered with `.ToString()` - which for a hashtable is its
type name.

Three properties make this worse than ordinary truncation:

- the output is still VALID JSON, so schema-less consumers accept it
- the replacement is a plausible-looking string, so a spot check misreads it
- stderr is empty (measured: 0 ErrorRecords), so CI stays green

`config -> environment -> variables` is three levels. This is not an exotic
shape.

`-Depth 10` fixes it and was verified. A CI assertion that greps the output for
`System\.Collections` is cheap insurance.

## Adjacent findings, same probe

**Hashtable key order is not insertion order.** `@{b=2;a=1;c=3}.Keys` returns
`c,a,b`, so serialized output is not byte-stable across runs and content hashing
or diffing on it is unreliable. `[ordered]@{}` when it matters.

**`ConvertFrom-Json` returns `PSCustomObject`, not a hashtable**, so
`.ContainsKey()` does not exist and a serialize/parse round trip does not give
back the type you started with.

Negative result: `+=` on an array works correctly (count=2, `Object[]`). It is a
performance footgun, not a correctness one, so it was not filed.

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
| 14 | collections | `return` does not suppress other output |
| 15 | serialization | ConvertTo-Json -Depth 2 default destroys nested data silently |
