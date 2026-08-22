# _audit_r1 - independent plan audit (r1-20260821124445)

Auditor: independent PLAN AUDITOR subagent, read-only except this file.
Unit: devlog/_plan/260821_win-linux-optimization/ (000-100, 13 docs).
Method: full read of all 13 docs, then direct verification of cited line numbers and
fix premises against the working tree on branch dev.

**VERDICT: NEAR-PASS.** The doc set genuinely meets DIFFLEVEL-ROADMAP-01 - these are
copy-paste-executable PRDs, not outlines - and the 18-defect allocation is exact. Six
source spot-checks confirmed the cited line numbers land on the described code. But
100_closeout.md contains a fabricated BEFORE snippet, a false central premise, and a
proposed change that would REGRESS an existing safety control, and 080's new script has
a Windows-breaking path bug. Those are foldable, not fatal.

---

## Q1. Diff-level precision - PASS

Every decade doc 010-100 carries the DIFFLEVEL-ROADMAP-01 header, a MODIFY/NEW/DELETE
map with exact paths, BEFORE/AFTER code blocks, a numbered TESTS section, and a
Verification (C) block with runnable commands and expected exit codes. No doc is
outline-only. Notably, the docs also do the harder thing: 060, 080, and 090 declare
"defects closed: none" and justify it rather than padding.

Verified accurate against source (exact or +/-2 lines):

| Citation | Claim | Reality |
|---|---|---|
| attest.ts:174-215 | 11-return early-exit chain | Confirmed: returns at 156,162,168,175,181,184,187,190,195,204,210 |
| plan-cli.ts:54,110 | deriveSlug + unconditional yymmdd() | Confirmed verbatim |
| goalplan-cli.ts:56,69,181-184 | VERBS lacks add-criterion; --criterion init-only | Confirmed verbatim |
| steering.ts:45 | SUPPORTED_OPS = Set(["annotate"]) | Confirmed at :45 |
| scouting-bundle.ts:75 | process.env.HOME ?? "" | Confirmed verbatim |
| scouting-bundle.ts:30-42 | triple split/join, third pass dead | Confirmed verbatim |
| bin/codexclaw.mjs:253,259,274,400 | python3 rung, bin/python3, spawnSync("npm") | All four confirmed verbatim |
| state.ts:200-209, :305 | linkSync publish, renameSync | Confirmed at :202 and :305 |
| doctor.ts:73 | /(d+.d+.d+)/ missing backslashes | Confirmed verbatim |
| friction.ts:43-51 | normalizeError rule order | Confirmed verbatim |
| hook-bench.mjs:64,85,114 | "/tmp/bench-cwd", "/tmp", mkdtempSync | Confirmed verbatim |
| goalplan.ts:542,707,801-802,807 | rename, empty-plan, surface, final-gate phantom | All confirmed |
| .gitattributes | `* text=auto eol=lf` only | Confirmed |
| ci.yml | 3-OS matrix, no WSL lane, no receipts | Confirmed; 080's BEFORE is faithful |

All eight renameSync sites in 040's table exist at the exact cited lines. All 001
section numbers referenced by 040/050/060/070 resolve to real headings.

## Q2. Defect coverage - PASS on allocation, one premise is false

The 100_closeout allocation table places all 18 ranked defects in exactly one doc each,
and each doc's own header agrees with the table. Counted by doc: 010={2,6}, 020={4},
030={5}, 040={1,3,12,13}, 050={7,8,9,10,11}, 070={14,15}, 100={16,17,18}, with 060/080/090
declaring none. Sum = 18, no overlap, no gap. The docs substantively address what they
claim; this is not table-only bookkeeping.

Spot-checks beyond the five requested all confirmed the fix sketches are real and would
work: attest batching, plan-init date splitting, criteria registration via
applySteeringBatch, scouting-bundle homedir(), and the npm.cmd / py -3 ladder fixes are
all correctly targeted. 002 B2's subtle claim (on win32 the second and third passes are
dead, and case-sensitivity is the live defect) is logically correct.

### F1 [P1] The defect #17 premise is false, and the BEFORE snippet is fabricated

100_closeout section 2 is the weakest doc in the set. Three separate problems:

**(a) The BEFORE snippets do not exist in source.** The doc shows:

```ts
  if (verb === "rm" || verb === "rmdir") {
```

worktree-guard.ts:309 actually reads `if (exe === "rm") {`, with a SEPARATE
`if (exe === "rmdir") {` branch at :335. Likewise the claimed ":319-330 flag branch"
with `for (const tok of rest)` and a `startsWith("--")` long-flag comment does not
match :313-327, which iterates `tokens.slice(1)` and carries a `flagsDone` `--`
sentinel the doc never mentions. A BEFORE block that cannot be found in the file is the
one thing DIFFLEVEL-ROADMAP-01 exists to prevent.

**(b) "-LiteralPath drops the target" is wrong.** The doc calls this "the dangerous
case" and its test 4 "the most important test in this doc". Trace the real code with
`rm -LiteralPath C:\proj -Recurse`: `-LiteralPath` hits :322, matches `/[rR]/`
(the "r" in "Literal"), sets recursive and continues. The NEXT token `C:\proj` does
not start with "-", so :326 pushes it to `targets`. The target is extracted, not
swallowed. The value is only lost if it itself starts with "-". 002 B16 states the same
falsehood, so this propagated from the audit rather than originating in the closeout.

**(c) "PowerShell aliases already reach the POSIX table" is wrong.** Both 002 B16 and
closeout 2a assert that `ri`, `del`, and `erase` land on the existing verb table by
luck. The dispatch is `exe === "rm"` / `exe === "rmdir"` - exact string equality, so
only `rm` and `rmdir` reach it. `del`, `erase`, and `ri` have zero coverage
today. The real gap is wider than the doc claims, which makes the fix MORE valuable but
its stated rationale unreliable.

The underlying defect is real: `Remove-Item` spelled out is genuinely unguarded. Only
the reasoning and the diff need rewriting.

## Q3. Consistency - mostly coherent, one architectural contradiction

The wp02..wp11 slicing is coherent: one PABCD cycle per doc, dependencies declared in
000's map, and the 001 lessons each doc claims to adopt all resolve to real sections.
Write sets are not strictly disjoint (steering.ts, goalplan.ts, state.ts, hook.ts,
doctor.ts, hook-bench.mjs, and ci.yml are each touched by two phases), but the phases run
sequentially with correct dependency ordering, so this is coordination rather than
conflict.

### F2 [P2] 050, 060, and 070 import across component packages; the repo never does

`rg` for `from "../../` across all component sources returns ZERO hits. Components are
dependency-free of each other, and 040 section 6 explicitly honors this: it puts
`atomic-write.ts` in pabcd-state and gives subagent-config and cxc-ops their own
re-export copies, calling a shared dep "a scope expansion to raise, not assume".

The other three docs then quietly violate the rule they just established:

- 050 puts `win-exec.ts` in cxc-ops, then calls `commandInvocation` from
  skill-search/src/cli.ts and messenger-bridge/src/runner.ts.
- 060 puts `wsl.ts` in cxc-ops, then calls `filesystemTier` from
  pabcd-state/src/steering.ts.
- 070 puts `text-lines.ts` in cxc-ops, then calls `splitLines` from config-guard,
  pabcd-state, recall, messenger-bridge, and gui - five packages.

Each will fail to resolve at build time. The fix is mechanical (apply 040's per-package
copy pattern, or raise the shared-package decision once for all four helpers), but it
should be settled before wp05 rather than discovered in wp08.

### F3 [P2] 010's C>D receipt rule contradicts its own test 5

The sketch gates the receipt reason on `reasons.length > 0`:

```ts
if (reasons.length > 0 && !att.testReceiptPath) { reasons.push("... testReceiptPath ..."); }
```

Test 5 then requires that `{from:"C",to:"D",did:"x",checkOutput:"ok",exitCode:1}`
returns "the nonzero-exit reason alone (no receipt nag on an otherwise-complete attest)".
But that attest produces one reason (nonzero exit), so `reasons.length > 0` holds and
the nag IS appended - two reasons, failing the test as written. The intent is presumably
"only nag when required fields are missing"; the condition needs to key on the
missing-field reasons specifically.

### F4 [P3] 010's attest.ts sketch has a JS syntax error

The testReceiptPath reason embeds `\`cxc receipt test -- <command>\`` inside a
backtick-delimited template literal without escaping. Copy-pasted, it does not parse.

### F5 [P3] "Every reason string is preserved verbatim" is false

010 claims all reason strings are byte-preserved so existing substring assertions keep
matching. The auditOutput reason is in fact rewritten (drops "even a small/mini-model
one", adds the agent_type explorer clause) - which the doc itself requires elsewhere.
The existing assertions at attest.test.ts:33 (`/auditOutput/`) and :64
(`/SAME reviewer/`) still match, so no test breaks; only the blanket claim is wrong.

### F6 [P3] 040 mislocates a file, and line citations will drift

040's rename table lists `plugins/codexclaw/components/recall/src/store.ts:132`. No
such file exists; the real site is
`plugins/codexclaw/components/subagent-config/src/store.ts:132` (line correct, package
wrong). Section 6's package-wiring paragraph inherits the error. Inherited from 002 B11.

Separately, sequential phases will invalidate later citations: 030 inserts ~60 lines into
goalplan.ts around :518 before 040 edits goalplan.ts:542, and 040 adds ~20 lines to
state.ts around :200 before 070 edits state.ts:381. Executors should re-anchor by
content, not line number.

### F7 [P3] 000's dependency map understates two edges

000 lists wp07 as depending on 001 only, but 060's test 24 appends to
`steering-ops.test.ts`, a file wp04 creates. 060 also edits steering.ts, which wp04
rewrites. The ordering already works; the map should say so.

## Q4. Risk - one safety regression, one Windows-broken script

### F8 [P1] The defect #17 fix would REGRESS the worktree guard on POSIX

Closeout 2a folds `rm` and `rmdir` into one `REMOVE_VERBS` set. In real source the
two branches have deliberately different semantics: the `rm` branch at :328 does
`if (!recursive) return null` (a non-recursive file delete cannot destroy a worktree),
while the `rmdir` branch at :335-341 denies a protected target with NO recursive
requirement, because `rmdir <dir>` is inherently a directory removal.

Merging them routes `rmdir` through the recursive check, so `rmdir <protected-worktree>`
would stop denying. That is a safety control silently weakening on every platform - the
exact opposite of the doc's "strictly additive" and "the POSIX branch is byte-identical"
claims, and its own test 7 would catch it only if written against real fixtures. The
PowerShell verbs must be added as a separate branch, not merged into the `rm` path.

### F9 [P1] platform-smoke.mjs resolves a broken path on Windows

080 section 3 builds the CLI path as:

```js
const CLI = new URL("../../../bin/codexclaw.mjs", import.meta.url).pathname;
```

On Windows, `URL.pathname` yields `/C:/Users/super/...` with a leading slash, which
`spawnSync` cannot resolve. The same bug applies to the `hook-bench.mjs` URL below it.
This is the campaign's flagship Windows-verification script failing on Windows. Use
`fileURLToPath(new URL(...))`. The relative depth (scripts/ -> repo root) is correct.

### Risks assessed and cleared

- **POSIX behavior:** 040's linkSync fallback keeps the EEXIST fast path byte-identical;
  the rename retry is win32-gated with an explicit "POSIX never retries" test; 050 leaves
  `signalProcessTree` intact and only adds win32 escalation behind the existing grace
  timer. 060 deliberately declines to refuse locks on drvfs, with a sound rationale
  (the lock is advisory; its own comment at steering.ts:63-64 says D-close bypasses it).
- **Existing tests:** plan-cli.test.ts's two cases survive 020 as claimed - "My Big
  Feature!" still yields `my-big-feature` under the widened charset, and
  `["000_plan.md","010_phase1.md","020_phase2.md"]` survives `padStart(3,"0")`.
  Verified by reading the test file.
- **Payload contract:** no doc touches hook manifest shapes, `DoctorCheck`'s
  name/status/detail shape, or the packaged inventory. 080 adds `npm run smoke` as a
  separate script and leaves `test` unchanged, which is right - smoke spawns real
  subprocesses.
- **002 section B17 regression trap:** 050 and 070 both explicitly re-state that the
  forward-slash splits must NOT be "fixed" to `path.sep`, and 070 instructs the
  A-phase reviewer to reject such a diff. Good defensive design.
- **070's byte-accounting exception** (splitLinesByteExact where offsets are recorded,
  with rollout.ts flagged for inspection) is exactly the right nuance and is rare to see
  called out.

## Required before B

1. Rewrite 100 section 2 against real worktree-guard.ts source: correct BEFORE blocks,
   drop the false "-LiteralPath drops the target" and "aliases already covered" premises,
   and keep `rmdir` as its own branch (F1, F8).
2. Fix `new URL(...).pathname` to `fileURLToPath` in 080's platform-smoke.mjs (F9).
3. Settle the shared-helper placement question once for win-exec, wsl, text-lines, and
   atomic-write, applying 040's per-package pattern or an explicit scope expansion (F2).
4. Correct 010's receipt-nag condition to match its test 5, and escape the nested
   backticks (F3, F4).
5. Fix the `recall/src/store.ts` -> `subagent-config/src/store.ts` path (F6).

Items 1 and 8 are blocking because they would ship a weakened safety control. The rest
are foldable during their own phases.

## Residual

Line-number drift across sequential phases (F6) has no clean fix inside a
write-it-all-upfront plan; executors should re-anchor by content. 002's own B16 errors
should be corrected at the source so the closeout rewrite does not re-inherit them.

---

LAUNCH: r1-20260821124445
VERDICT: NEAR-PASS
