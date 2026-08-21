# 100 - wp11 closeout

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp11.

Defects closed from 002 section D - the three P3 stragglers the audit grouped into its
final cycle:

| # | Sev | Location | Problem |
|---|-----|----------|---------|
| 16 | P3 | `cxc-ops/src/doctor.ts:73` | version regex missing backslashes |
| 17 | P3 | `pabcd-state/src/worktree-guard.ts:310-342` | guard misses `Remove-Item` and its PowerShell aliases |
| 18 | P3 | `pabcd-state/src/friction.ts:48` | UNC paths survive normalization |

Plus the campaign-level obligations: final dual-platform gates, the issue-filing sweep for
everything deliberately deferred, and the closing docs.

## MODIFY / NEW / DELETE map

### 1. MODIFY plugins/codexclaw/components/cxc-ops/src/doctor.ts - defect #16

BEFORE (:73)
```ts
  const m = res.stdout.match(/(d+.d+.d+)/);
```

AFTER
```ts
  // The backslashes were missing, so this matched a literal "d", any char, "d",
  // any char, "d" - which "codex 1.2.3" does not contain. Every call fell through
  // to res.stdout.trim() and the version was never actually parsed. The correct
  // sibling is at :411 (/ast-grep\s+(\d+\.\d+\.\d+)/).
  const m = res.stdout.match(/(\d+\.\d+\.\d+)/);
```

Broken on every platform, not just Windows, but it sits in the doctor path Windows users
lean on hardest.

### 2. MODIFY plugins/codexclaw/components/pabcd-state/src/worktree-guard.ts - defect #17

The guard tokenizes POSIX shell syntax and recognizes `rm`, `rmdir`, and
`git worktree remove`. On Windows the destructive verbs are `Remove-Item` and its aliases
(`ri`, `del`, `erase`, `rd`), and the flags are `-Recurse` / `-Force` / `-LiteralPath` /
`-Path`.

**Read the real dispatch before writing the diff.** `evaluateSegment` dispatches on
`const exe = basename(tokens[0])` (:303) with exact string equality, in two SEPARATE
branches:

```ts
  if (exe === "rm") {          // :310 - collects flags + targets, then :329
    ...
    if (!recursive) return null; // plain file removal cannot delete the worktree
    for (const target of targets) {
      if (isProtectedTarget(target, cwd, id)) return deny(`rm -r ${target}`);
    }
    return null;
  }

  if (exe === "rmdir") {       // :336 - NO recursive requirement
    for (const tok of tokens.slice(1)) {
      if (tok.startsWith("-")) continue;
      if (isProtectedTarget(tok, cwd, id)) return deny(`rmdir ${tok}`);
    }
    return null;
  }
```

Two premises an earlier draft of this doc carried (both inherited from 002 B16, both
corrected there now) are FALSE and must not steer the fix:

- **"PowerShell aliases already reach the POSIX table."** They do not. `exe === "rm"` is
  exact equality, so only the literal tokens `rm` and `rmdir` dispatch. `del`, `erase`,
  `ri`, `rd`, and `Remove-Item` have ZERO coverage today. The gap is wider than
  "spelled-out cmdlet only", which makes the fix more valuable, not less.
- **"`-LiteralPath` drops the target."** It does not. Trace
  `rm -LiteralPath C:\proj -Recurse`: `-LiteralPath` reaches :323, matches `/[rR]/`
  (the "r" in "Literal") and sets `recursive`, then `continue`s. The NEXT token
  `C:\proj` does not start with `-`, so :327 pushes it to `targets`. The target IS
  extracted. A value is only lost when it itself starts with `-`. So value-parameter
  parsing is a correctness improvement (it also stops `-Recurse` from setting recursive
  by coincidence), not a rescue of a swallowed target.

The genuine defect: the Windows verbs never reach a branch at all.

#### 2a. Recognize the PowerShell verbs in a SEPARATE branch

BEFORE (:310-342, verbatim from source - two separate branches)
```ts
  if (exe === "rm") {
    let recursive = false;
    let flagsDone = false;
    const targets: string[] = [];
    for (const tok of tokens.slice(1)) {
      if (!flagsDone && tok === "--") {
        flagsDone = true;
        continue;
      }
      if (!flagsDone && tok.startsWith("--")) {
        if (tok === "--recursive") recursive = true;
        continue; // --force and other long flags carry no targets
      }
      if (!flagsDone && tok.startsWith("-") && tok.length > 1) {
        if (/[rR]/.test(tok)) recursive = true;
        continue;
      }
      targets.push(tok);
    }
    if (!recursive) return null; // plain file removal cannot delete the worktree
    for (const target of targets) {
      if (isProtectedTarget(target, cwd, id)) return deny(`rm -r ${target}`);
    }
    return null;
  }

  if (exe === "rmdir") {
    for (const tok of tokens.slice(1)) {
      if (tok.startsWith("-")) continue;
      if (isProtectedTarget(tok, cwd, id)) return deny(`rmdir ${tok}`);
    }
    return null;
  }
```

Note the `--` sentinel (`flagsDone`) and the two DIFFERENT deny semantics: the `rm`
branch requires `recursive`, the `rmdir` branch does not. That asymmetry is deliberate -
`rmdir <dir>` is inherently a directory removal - and it is the reason the two branches
must NOT be merged into one `REMOVE_VERBS` set. Merging them would route `rmdir` through
`if (!recursive) return null` and silently stop denying `rmdir <protected-worktree>` on
every platform. That is a safety control weakening, not an additive fix.

AFTER - both existing branches untouched, one NEW branch appended after `rmdir`
```ts
  // ... the `rm` branch at :310 stays byte-for-byte identical ...
  // ... the `rmdir` branch at :336 stays byte-for-byte identical ...

  // NEW. Windows removal verbs get their own branch so the POSIX deny semantics
  // above are untouched. `rm`/`rmdir` are deliberately NOT in this set: they
  // already dispatch earlier, and re-listing them here would be dead code that
  // invites a future merge of the two semantics.
  if (PS_REMOVE_VERBS.has(exe.toLowerCase())) {
    const { recursive, targets } = parseWindowsRemoval(tokens.slice(1));
    for (const target of targets) {
      if (!isProtectedTarget(target, cwd, id)) continue;
      // `rd` is a directory-removal verb: deny with no recursive requirement,
      // mirroring the existing `rmdir` branch. The file-oriented verbs mirror
      // the `rm` branch and require a recursive flag.
      if (recursive || DIR_REMOVE_VERBS.has(exe.toLowerCase())) {
        return deny(`${exe} ${target}`);
      }
    }
    return null;
  }
```

#### 2b. NEW module-level constants and the PowerShell argv parser

There is no BEFORE for this part: none of these symbols exist. Add them beside the
existing module-level helpers (near `stripPrefixes` at :262), NOT inside the `rm` loop.

AFTER (new code)
```ts
// Windows removal verbs. `rm` and `rmdir` are excluded on purpose: they dispatch in
// their own branches above with POSIX semantics that must not change. PowerShell
// aliases `rm`/`rmdir` therefore keep hitting the POSIX branches, which is correct -
// their argv shape is compatible.
const PS_REMOVE_VERBS = new Set(["remove-item", "ri", "del", "erase", "rd"]);

// Verbs that mean "remove a directory" outright. Like the existing `rmdir` branch,
// these deny a protected target with NO recursive requirement.
const DIR_REMOVE_VERBS = new Set(["rd"]);

// PowerShell parameters that take a VALUE as the next token.
const PS_VALUE_PARAMS = new Set([
  "-literalpath",
  "-path",
  "-include",
  "-exclude",
  "-filter",
]);

/** Parse PowerShell removal argv. Positional tokens and value-parameter values are
 *  both targets; `-Recurse` is matched exactly rather than by an `r` substring. */
function parseWindowsRemoval(rest: string[]): { recursive: boolean; targets: string[] } {
  let recursive = false;
  const targets: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    const lower = tok.toLowerCase();
    if (PS_VALUE_PARAMS.has(lower)) {
      const value = rest[i + 1];
      // A trailing `-LiteralPath` with nothing after it must not throw.
      if (value !== undefined && !value.startsWith("-")) {
        targets.push(value);
        i++;
      }
      continue;
    }
    // Exact match: unlike the POSIX /[rR]/ substring test, `-Registry` or
    // `-Recurse:$false` must not set recursive by accident.
    if (lower === "-recurse" || lower === "/s") {
      recursive = true;
      continue;
    }
    // `-Confirm:$false`, `-Recurse:$false`, `-ErrorAction:Stop` carry no target.
    if (tok.startsWith("-") && tok.includes(":")) continue;
    if (tok.startsWith("-") || tok.startsWith("/")) continue; // -Force, /q, ...
    targets.push(tok);
  }
  return { recursive, targets };
}
```

Strictly additive in the real sense: not one token of the `rm` or `rmdir` branch is
edited, so every existing POSIX verdict is reachable by the same path it was before. The
new branch is only entered for verbs that reached `return null` at :371 today. 002 B16
confirms `basename()` at :256 already handles backslashes, so path recognition itself
needs no change.

One more real gap the earlier draft missed: `DESTRUCTIVE_HINT` at :375 is
`/(^|[\s/])(rm|rmdir)\b|git\s+.../`, so the conservative fallback at :402 (destructive
verb seen + the command literally mentions the slot) never fires for `Remove-Item` or
`del` either. Extend the alternation to the new verbs in the same commit, or the
variable/glob indirection case stays uncovered on Windows:

```ts
const DESTRUCTIVE_HINT =
  /(^|[\s/])(rm|rmdir|rd|del|erase|ri|remove-item)\b|git\s+(-C\s+\S+\s+)?worktree\s+remove/i;
```

The `i` flag is new and load-bearing: `Remove-Item` is conventionally capitalized.

### 3. MODIFY plugins/codexclaw/components/pabcd-state/src/friction.ts - defect #18

BEFORE (:43-52)
```ts
export function normalizeError(s: string): string {
  let out = (s ?? "").toLowerCase();
  out = out.replace(/0x[0-9a-f]+/g, "0xADDR"); // hex addresses
  out = out.replace(/:\d+:\d+/g, ":L:C"); // line:col
  out = out.replace(/:\d+\b/g, ":L"); // bare :line
  out = out.replace(/[a-z]:\\[^\s:]+/g, "/PATH"); // windows paths
  out = out.replace(/(\/[^\s:]+)+/g, "/PATH"); // posix-ish paths
  out = out.replace(/\s+/g, " ").trim();
  return out.slice(0, 500);
}
```

AFTER
```ts
export function normalizeError(s: string): string {
  let out = (s ?? "").toLowerCase();
  out = out.replace(/0x[0-9a-f]+/g, "0xADDR"); // hex addresses
  out = out.replace(/:\d+:\d+/g, ":L:C"); // line:col
  out = out.replace(/:\d+\b/g, ":L"); // bare :line
  // UNC first: \\server\share\... matches neither the drive-letter rule (no
  // "c:") nor the posix rule (backslashes), so it survived into the signature
  // and made every machine's UNC failure a different key (002 B15). Corporate
  // Windows runs on UNC paths, so this is not exotic.
  out = out.replace(/\\\\[^\s]+/g, "/PATH");
  out = out.replace(/[a-z]:\\[^\s:]+/g, "/PATH"); // windows paths
  out = out.replace(/(\/[^\s:]+)+/g, "/PATH"); // posix-ish paths
  out = out.replace(/\s+/g, " ").trim();
  return out.slice(0, 500);
}
```

Order matters. The UNC rule runs BEFORE the drive-letter and POSIX rules, because 002 B15
notes the POSIX rule at the old :49 will chew forward-slash fragments inside an
already-substituted `/PATH`. Placing UNC first keeps each rule operating on
un-substituted text.

### 4. Defect allocation ledger (all 18, each exactly once)

The A-phase reviewer should verify this table against 002 section D before approving the
campaign as complete.

| # | Sev | Doc | WP |
|---|-----|-----|-----|
| 1 | P0 | 040_win_paths.md | wp05 |
| 2 | P0 | 010_attest_ux.md | wp02 |
| 3 | P0 | 040_win_paths.md | wp05 |
| 4 | P1 | 020_plan_init.md | wp03 |
| 5 | P1 | 030_loop_criteria.md | wp04 |
| 6 | P1 | 010_attest_ux.md | wp02 |
| 7 | P1 | 050_spawn_quoting.md | wp06 |
| 8 | P1 | 050_spawn_quoting.md | wp06 |
| 9 | P1 | 050_spawn_quoting.md | wp06 |
| 10 | P2 | 050_spawn_quoting.md | wp06 |
| 11 | P2 | 050_spawn_quoting.md | wp06 |
| 12 | P2 | 040_win_paths.md | wp05 |
| 13 | P2 | 040_win_paths.md | wp05 |
| 14 | P2 | 070_crlf_encoding.md | wp08 |
| 15 | P2 | 070_crlf_encoding.md | wp08 |
| 16 | P3 | 100_closeout.md | wp11 |
| 17 | P3 | 100_closeout.md | wp11 |
| 18 | P3 | 100_closeout.md | wp11 |

Also carried, from 002 sections A and B but outside the ranked table: the `final-gate`
phantom command (030), the `0${n}0_phase` 3-digit latent break and the misnamed `rel`
variable (020), the `cxc gui` POSIX-looking hint (050), and the A>B reviewer `agent_type`
wording from issue #31 (010). 060, 080, and 090 close no 002 defects by design and say so
in their own headers.

### 5. Issue-filing sweep

Every item any phase deferred, filed with a reference to the doc that deferred it. The
campaign's scope rule (000_plan.md) is that new defects out of a cycle's scope become
issues rather than scope creep, so this sweep is the rule's settlement.

| Source | Item |
|--------|------|
| 010 s6 | `cxc orchestrate schema` verb enumerating each edge's attest contract |
| 010 s6 | SOURCE-DELTA-01 accepting a commit SHA recorded in the A attest |
| 030 s5 | A real `cxc loop final-gate open` verb (the phantom is removed, not implemented) |
| 030 s5 | `remove-criterion` / `supersede-work-phase` steering ops + the weakening rule |
| 040 s6 / 050 s6 / 060 s4 / 070 s7 | SHARED-HELPER-01: one shared package for `atomic-write`, `win-exec`, `wsl`, and `text-lines` instead of the per-package copies all four phases ship. Raise once, for all four (070 alone needs six copies). |
| 050 s7 | `cxc receipt test` Windows wrapper for `.cmd` commands, without `shell: true` |
| 060 s5 | Windows-side "does a WSL distro exist" detection, if ever needed |
| 070 s8 | `decodeWindowsTextBytes` ordered decoder (pattern debt, no caller yet) |
| 070 s8 | `%USERPROFILE%` indirection for generated `.cmd` assets |
| 070 s2a | Deduplicate the TOML parser copied across `multi-agent-v2.ts` and `review-round-cli.ts` |
| 090 s4 | Any trim whose measurement did not justify shipping it |

Each filed with `gh issue create`, labeled, and cross-referenced from the phase doc that
deferred it.

### 6. MODIFY devlog/_plan/260821_win-linux-optimization/000_plan.md

Append a Results section: which criteria were met with what evidence, which defects were
closed, which were deferred with issue numbers, and the final bench delta from 090.

### 7. Close issues #29, #30, #31

Each closed with a comment naming the commit and the test that proves it, not just
"fixed". Issue #31 has four distinct complaints and only three are closed here (batching,
`--attest-file`, the `agent_type` wording); the SOURCE-DELTA-01 request moves to its own
issue per section 5, and the close comment must say so rather than implying full closure.

## TESTS

Additions for the three defects:

1. `cxc-ops/test/cxc-ops.test.ts`: "detectCodexVersion parses a real version string" -
   `"codex 1.2.3"` -> `"1.2.3"`, and `"codex-cli 0.10.0-alpha"` -> `"0.10.0"`.
2. Same file: "unparseable output falls back to trim" - the existing behavior for
   `"weird"` must be preserved, so the fix does not turn a soft fallback into a throw.
3. NEW `pabcd-state/test/worktree-guard-win.test.ts`: "Remove-Item -Recurse -Force <slot>
   denies" - the headline case, unguarded today because `exe === "rm"` never matches
   `remove-item`.
4. "`del <slot>` and `erase <slot>` are recognized" - zero coverage today, and the proof
   that the gap was never "spelled-out cmdlet only".
5. "`Remove-Item -LiteralPath <slot> -Recurse` denies" - the value parameter is consumed
   as a target rather than as a positional.
6. "`ri -Path <slot> -Force` via the alias, with -Recurse absent, does NOT deny" - a
   non-recursive file removal mirrors the `rm` branch and cannot destroy the worktree.
   Then the same argv WITH `-Recurse` denies.
7. "`rd <slot>` denies with no -Recurse" - `rd` is in DIR_REMOVE_VERBS and must match the
   existing `rmdir` semantics, not the `rm` ones.
8. "`-Confirm:$false` does not become a target", and "`-Recurse:$false` does not set
   recursive" - the exact-match rule, which the POSIX `/[rR]/` substring test would fail.
9. "a value parameter at the end of argv does not throw" - `Remove-Item -LiteralPath`
   with nothing after it.
10. REGRESSION GUARD, the most important test in this doc: "`rmdir <slot>` still denies
    with no recursive flag". This is the exact verdict a merged `REMOVE_VERBS` set would
    silently drop. Pair it with "`rm <slot>` without -r still returns no opinion" so the
    two POSIX semantics are pinned in opposite directions.
11. "the POSIX branch is byte-identical" - re-run the existing `rm -rf`, `rm -- <slot>`
    (the `--` sentinel), and `git worktree remove` cases from the existing
    `worktree-guard.test.ts` and assert unchanged verdicts.
12. "DESTRUCTIVE_HINT matches the Windows verbs" - the fallback at :402 fires for
    `Remove-Item $env:SLOT` where the slot is mentioned but no concrete target resolves.
13. `pabcd-state/test/friction.test.ts`: "UNC paths normalize to /PATH" -
   `\\\\server\\share\\proj\\file.ts` collapses, and two different UNC paths in the same
   error shape produce the SAME `frictionKey`.
14. "drive-letter and POSIX normalization are unchanged" - the existing cases still pass,
    proving rule order did not regress them.
15. "a UNC path and its drive-mapped equivalent produce the same key" - `\\\\srv\\s\\x` and
    `Z:\\x` both become `/PATH`.

## Verification (C)

The full campaign gate. Every command must exit 0 on BOTH platforms.

Windows:
```powershell
npm test
npm run smoke
node plugins/codexclaw/scripts/gate.mjs
node plugins/codexclaw/scripts/inventory.mjs --check
node plugins/codexclaw/scripts/hook-bench.mjs --iterations 15 --json > bench-final.json
node plugins/codexclaw/scripts/hook-bench-compare.mjs devlog/_plan/260821_win-linux-optimization/bench-baseline.json bench-final.json --max-regression-pct 10
```

WSL, both tiers:
```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && npm test && npm run smoke && node plugins/codexclaw/scripts/gate.mjs"
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/super/Downloads/codexclaw && npm test"
```

The three manual reproductions from the original issues, which must now all succeed:

```powershell
'{"from":"P","to":"A","did":"campaign closeout","planUnit":"devlog/_plan/260821_win-linux-optimization","workPhaseId":"wp11-closeout"}' | Set-Content -Encoding utf8 .codexclaw/attest.json
node bin/codexclaw.mjs orchestrate A --session cli --attest-file .codexclaw/attest.json
node bin/codexclaw.mjs plan init 260821_win-linux-optimization
node bin/codexclaw.mjs loop add-criterion --session cli --criterion "dual-platform gates green" --surface logic
```

Expected in order: the attest is accepted from a file; `plan init` refuses because the
correctly-named directory ALREADY exists (which is itself the proof that the prefix was
not doubled - a doubled prefix would have created a new directory); the criterion
registers.

CI across all cells:
```powershell
gh run list --branch dev --limit 10
gh workflow view CI
gh workflow view WSL
```

The issue sweep is verifiable, not assertable:
```powershell
gh issue list --state open --search "win32 OR windows OR wsl"
gh issue view 29
gh issue view 30
gh issue view 31
```

Expected: #29/#30/#31 closed with commit-referencing comments, and one open issue per row
of section 5's table.

Finally, the allocation audit - every 002 defect appears in exactly one doc:
```powershell
Select-String -Path devlog/_plan/260821_win-linux-optimization/0*.md,devlog/_plan/260821_win-linux-optimization/100_closeout.md -Pattern "002 section D"
```

Record the C>D receipt with `node bin/codexclaw.mjs receipt test -- npm.cmd test` on
Windows AND `cxc receipt test -- npm test` in WSL. This is the campaign's final gate:
both receipts, both green, or the goal does not close.
