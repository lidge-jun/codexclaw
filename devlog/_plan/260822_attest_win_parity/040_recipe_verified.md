# 040 - the win32 recipe, executed rather than assumed

The attest fix tells Windows users to do this:

```powershell
'<json>' | Set-Content -Encoding utf8 .codexclaw/attest.json
cxc orchestrate <phase> --session <id> --attest-file .codexclaw/attest.json
```

That recommendation was executed before it was written down, because the
archive already contains a case where the obvious encoding advice is wrong
(`fuck-powershell#7`: `Out-File -Encoding utf8` writes a BOM on 5.1, and
`utf8NoBOM` does not exist there at all).

## Measured

```
bytes=48 head=efbbbf7b2266726f bom=UTF-8 BOM
utf8 matches=1
```

So `Set-Content -Encoding utf8` does prepend a BOM here too. The recipe is still
safe, because `orchestrate-cli.test.ts` already carries an explicit case:

> `#31: --attest-file tolerates a UTF-8 BOM (PowerShell 5.1 Set-Content -Encoding utf8)`

The CLI accepted the file; the only refusal was the phase gate (`IDLE -> D`),
which is correct.

## Why this is worth a page

Two of the three recommendations in the wider archive turned out to be wrong on
this host. A workaround that has not been run on the platform it targets is a
guess, and shipping a guess inside an error message is worse than shipping no
message — the agent trusts it and loses a turn.

The recipe is now exercised continuously rather than tested once: every attest in
this loop since the fix has gone through `--attest-file`, including the ones
closing these cycles.
