# 061 — wp7 receipt (L6 / #135 + #136 + #141, memory write gate)

Branch `codex/fix-memory-write-gate`, the top of the chain, based on
`codex/fix-recall-intent-regex`. Implementation commit `e388b0ba`.

## Conclusion

The memory write gate now recognises what an agent on Windows would actually type.
Before this layer it was attached to `Bash` and `apply_patch` as well as the memory
tool, but it understood only POSIX verbs and only `~/` — so the first thing an agent
reaches for after a denial went straight through.

## The finding that changed the design

The PRD parsed PowerShell the way the existing code parses POSIX: find THE
destination operand and return it. An independent security audit hunted bypasses
against that design and found twelve:

```text
Set-Content -LP <mem>        -LP is an unambiguous prefix of -LiteralPath
Set-Content -Fo <mem>        -Fo is a prefix of -Force
Out-File -Fi <mem>           -Fi is a prefix of -FilePath
Set-Content -AsByteStream    an unlisted switch swallows the path
Set-Content /Force <mem>     a slash switch becomes the "destination"
Copy-Item ... -Dest <mem>    -Dest is a prefix of -Destination
sc / ni / Add-Content        never parsed at all
py -c / node --eval / node -e<glued> / [IO.File]::WriteAllText
```

PowerShell accepts **any unambiguous prefix of any parameter name**, so the flag
surface is unbounded and a per-flag fix list can never close. The design changed
instead: **the gate does not need to know which operand is the destination, only
whether any operand lands inside the memories directory.** A write cmdlet now
over-collects every non-flag operand and `isMemoryPath` narrows. A flag never
consumes the next token unless it is on a short allowlist of genuinely value-taking
parameters, matched by prefix.

`Copy-Item`/`copy`/`cp`/`mv`/`Move-Item` are the one exception and stay
destination-only, because copying a file **out** of the memories directory must stay
allowed and `memory-write-gate.test.ts` pins exactly that.

## Evidence

A direct probe against the built module, over the twelve audited bypasses plus four
must-allow controls, run on the parent source and again after the fix:

```text
parent source   failures=16     every deny case missed
this layer      failures=0      20 of 20 correct
```

Controls that must stay allowed and do: `Get-Content`, `cat`,
`cp <mem>\a.md C:\w\b.md`, and `sc query winrm` — the last one matters, because
binding the `sc` alias naively would have turned the Windows service tool into a
memory write.

RED on the parent, re-proved independently by the main session:

```text
git stash push -- pabcd-state/src pabcd-state/dist plugins/codexclaw/bin bin
test.mjs memory-write-gate.test.ts shell-write-destinations.test.ts help-verbs.test.ts
  -> 16 failures, including:
     memory allow-write --help prints usage and does not require --session
     memory allow-write --session <id> --help is help, not a grant
     memory allow-write --help on both real entrypoints writes no grant
     root --help lists memory allow-write on both entrypoints
     Korean memory write: 메모리 forms; 메모리에서 찾 is not a write
     CLI grant success output names the cwd it recorded
     deny reason names the session cwd
     allow-write accepts --session=<id> / rejects unknown flags
     home prefixes classify as memory writes
     apply_patch Add File with backslash-tilde memories path is gated
     Windows write abbreviations, aliases, and interpreters are gated
git stash pop -> tree restored
```

GREEN: `npm run build` exit 0; `pabcd-state` suite `tests 1257, pass 1255, fail 0`.

## The three issues

- **#135** — the grant is keyed by `cwd + sessionId` and nothing said so, so an agent
  who ran `allow-write` from the wrong directory got a success message and a denial.
  The success now names where it wrote and the deny names the cwd the grant must come
  from, which makes the mistake diagnosable in one step. The Korean trigger accepts
  `메모리도 기록` and `메모리에 기록해줘`.
- **#136** — home expansion covers `~\`, `%USERPROFILE%`, `$env:USERPROFILE` and
  `$HOME`; destination parsing covers the PowerShell write cmdlets, their aliases and
  the interpreter one-liners.
- **#141** — `--help` is answered anywhere with no side effect on **both real
  entrypoints**, `--session=<id>` is accepted, unknown flags are rejected, and
  `['allow-write','--session','<id>','--help']` no longer records a grant while
  pretending to show help.

## What did not improve

- `cxc memory --help` still belongs to recall and still does not list `allow-write`.
  Adding it there would break `recall-skill-synopsis.test.mjs`, which compares that
  usage against the skill document. The root `cxc --help` lists it and the deny
  message names the full command, which is the discovery path that actually matters.
- `메모리에 저장하는 코드` is a pre-existing false positive in an older pattern; it is
  outside this layer and was left alone rather than quietly rewritten.
- The interpreter coverage is pattern matching on a code string, not evaluation. An
  agent that builds the path by concatenation or encodes it will still slip through.
  The gate raises the cost of an accidental write and of the obvious deliberate one;
  it is not a sandbox and this receipt does not claim it is.

## Next

wp8 — integration: open the seven pull requests and verify CI per layer.

