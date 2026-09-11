# 060 — wp7 / L6: memory write gate Windows honesty (#135, #136, #141)

Date: 2026-09-11. Checkout: `C:/Users/super/.codex/worktrees/b74b/codexclaw`, branch `codex/memory-recall-roadmap`, based on `dev` at `6aae1c97`. This file is the copy-paste-executable implementation unit for L6. Docs only: do not patch production code while authoring this file.

Layer: L6. Branch: `codex/fix-memory-write-gate`. Base: L5 `codex/fix-recall-intent-regex` (detach onto `dev` is allowed; L6 shares no file with L1–L5). Issues: #135, #136, #141. Component: `pabcd-state`. Goalplan: `c-9`, `c-10`, `c-11`.

Class: C2 slice with C4-care on the permission boundary (DEV-ESCALATE-01). Fail-open, consume-once, and cwd+session keying stay. Honesty and classification change.

## 1. Thesis

The memory write gate must be honest on Windows.

1. A `cxc memory allow-write` grant is stored per `(cwd, sessionId)`. Success output must name the cwd it wrote. A deny must say the grant is cwd-scoped. Do not rekey grants to session-only and do not add `--cwd`.
2. Korean write triggers must match `메모리` forms, including `메모리도 기록`.
3. `absolutize` must expand `~\`, `%USERPROFILE%`, `$env:USERPROFILE`, and `$HOME` before `isMemoryPath`.
4. `shellWriteDestinations` must classify `Set-Content` / `Out-File` / `New-Item` / `Copy-Item` (and alias `copy`) / `Tee-Object` and `python`/`node` one-line writes. Copy-Item is destination-only, matching POSIX `cp`. PowerShell switch parameters must not consume the next token.
5. `memory allow-write --help`/`-h` prints usage, exits 0, records no grant, even when `--session` is also present. `--session <id>` and `--session=<id>` both work. Unknown flags are rejected.

## 2. Issue-body vs this tree

Line numbers below were read in this checkout, not copied from the 0.2.24 issue bodies.

| Claim in the issue | This tree | Action |
|---|---|---|
| #135: Korean patterns are only L79–80, and `메모리에 기록해줘` / `메모리에 남겨둬` / `메모리에 저장해` all miss | `MEMORY_WRITE_PATTERNS` is `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts:78`. L79 is the `기억해*` verb phrase. L80 is `(기억\|메모)` + write verb. **L81 already exists:** `/메모리\s*(에\|에다)?\s*(남겨\|기록\|추가\|저장\|적어\|넣어\|써)/`. Live `detectMemoryWriteRequest` on this tree: `메모리에 기록해줘` true, `메모리에 남겨둬` true, `메모리에 저장해` true, `메모에 기록` true, **`메모리도 기록` false**, `메모리에서 찾` false | Do not re-add L81. Change L80 so `도` is a legal particle. Pin both `c-9` utterances. Pin `메모리에서 찾` as a non-write so L5 recall (#137) does not collide |
| #135: deny names only the session id; success output is identical from the wrong cwd | Confirmed. Success: `memory-cli.ts:66`. Deny: `memory-write-gate.ts:219`. Keying: `memory-write-gate.ts:244` `consumeAuthorization(cwd, sessionId, turnId)` → `readState(cwd, sessionId)`. Layout: `state.ts:316` `sessionsDir(cwd)` = `join(cwd, ".codexclaw", "sessions")`; `state.ts:324` already documents that the same `--session` id resolves to different files by process cwd (#48) | Print cwd on grant. Mention cwd on deny. Do not change the key |
| #135 optional `--cwd` / session-id reverse lookup | Not present. `parseMemoryCliArgs` takes process cwd and stores it (`memory-cli.ts:46`) | Out of scope. Reveal, do not rekey |
| #135 side: `cxc memory --help` omits `allow-write` | Payload HELP lists only `memory search` (`plugins/codexclaw/bin/cxc.mjs:90`). Root HELP the same (`bin/codexclaw.mjs:293`). `cxc memory --help` is dispatched to **recall** because the allow-write split is `process.argv[3] === "allow-write"` (`cxc.mjs:166`, `codexclaw.mjs:584`). `MEMORY_USAGE` already documents allow-write (`memory-cli.ts:25`) | Add allow-write to both top-level HELPs. Do not steal `memory --help` from recall (L3/L4 own that file) |
| #136: `absolutize` only expands `~` / `~/` at L128–138 | Function is `memory-write-gate.ts:133`. Tilde check is L136: `value === "~" \|\| value.startsWith("~/")`. Comment starts at L128. Issue line numbers are stale by a few lines; the bug is real | Expand `~\`, `%USERPROFILE%`, `$env:USERPROFILE`, `$HOME`. Normalize `\` to `/` after expansion so Linux CI can pin the same fixtures |
| #136: `verbDestinations` is POSIX-only at L286–294 | Exact match: `shell-write-destinations.ts:286`. `tee` / `sed` / `cp`/`mv` / `perl`/`ruby`; else `[]` | Add PowerShell cmdlets and `python`/`node` script writes. 260910 `010_wp1_memory-write-gate.md` listed `python -c` / `node -e` as residual; this layer closes that leftover |
| #136: `echo hi > ~\.codex\memories\n.md` extracts a dest but allows | Redirect parser already returns the token (`shell-write-destinations.ts:184`). Classification fails in `absolutize` + `isMemoryPath` | Home-expansion test, not a parser test |
| #141: dispatcher `argv[3] === "allow-write"` at L166–169 | Exact match `cxc.mjs:166`. Root twin `codexclaw.mjs:584` | Leave the split. Help is dead because of `cli.ts`, not because of this condition |
| #141: cli.ts help is dead at L284–286 | Exact match `cli.ts:284-286`: `argv.length === 0 || argv[0] === "--help" || argv[0] === "-h"`. Delegated argv is `["allow-write", "--help"]`, so `argv[0] === "--help"` never fires. `cli.ts:281` is only `if (kind === "memory")`; `cli.ts:283` is `process.argv.slice(3)` | Detect `--help`/`-h` anywhere after the verb inside `parseMemoryCliArgs` |
| #141: `--session=` dropped at L41–46 | Exact match `memory-cli.ts:41`: `argv.indexOf("--session")` then `argv[i+1]` | Parse `--session=<id>` in the same function. There is no shared `--flag=value` helper in pabcd-state; do not invent one |
| #141 (c): `parseMemoryCliArgs(['allow-write','--session','<id>','--help'])` returns a grant object | Confirmed: `--help` is ignored, `--session` is taken, `runMemoryCli` would write state | `--help` wins, no grant |

Live regex evidence (this checkout, `detectMemoryWriteRequest`):

- `메모리도 기록` → false (still the #135 hole)
- `메모리에 기록해줘` → true (issue body is stale)
- `메모리에서 찾` → false (must stay false)

## 3. Current code to keep

Do not change these.

- Fail-open catch: `memory-write-gate.ts:299`.
- Consume-once grant/marker: `memory-write-gate.ts:244`.
- cwd+session state key: `state.ts:320` `statePath(cwd, sessionId)` is private. Do not export it just to print a path. Print `args.cwd`.
- Canonical session id: `state.ts:249` `isCanonicalSessionId` = `sanitizeKey(value) === value`. Keep that check.
- Hook matcher: `plugins/codexclaw/hooks/pre-tool-use-guarding-memory-write.json:13` `^(memories[._]?add_ad_hoc_note|apply_patch|Write|Edit|Bash)$`. Changing JSON bytes invalidates `trusted_hash`. `SHELL_TOOLS` already includes `exec_command` / `shell` / `local_shell` (`memory-write-gate.ts:71`) as defense in depth; production still fires on `Bash`. PowerShell one-liners arrive as `tool_name: "Bash"`.
- `MEMORY_WRITE_TOOL_NAMES`, `EDIT_TOOLS`, `patchTargets`, deny envelope shape.
- `cxc memory search` remains recall's. The allow-write split in both bins stays.

## 4. File map

| Path | NEW/MODIFY/DELETE | Why |
|---|---|---|
| `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts` | MODIFY | L80 Korean particle; `expandHomePrefix` + `absolutize`; `denyReason` names cwd |
| `plugins/codexclaw/components/pabcd-state/src/shell-write-destinations.ts` | MODIFY | PowerShell cmdlets; python/node `-c`/`-e` write operands; `.exe` verb strip; skip leading `&` |
| `plugins/codexclaw/components/pabcd-state/src/memory-cli.ts` | MODIFY | `--help` anywhere; `--session=`; unknown flags; grant output names cwd; USAGE |
| `plugins/codexclaw/components/pabcd-state/src/cli.ts` | MODIFY | Branch on `{ help: true }` before `runMemoryCli` |
| `plugins/codexclaw/bin/cxc.mjs` | MODIFY | HELP lists `memory allow-write`. Dispatch at L166–169 stays |
| `bin/codexclaw.mjs` | MODIFY | Same HELP line. Dispatch at L584 stays. Required companion so user-facing HELP does not diverge |
| `plugins/codexclaw/components/pabcd-state/test/memory-write-gate.test.ts` | MODIFY | Korean, cwd reveal, deny cwd, `--session=`, unknown flags, help-does-not-grant, home expansion, apply_patch `~\` |
| `plugins/codexclaw/components/pabcd-state/test/shell-write-destinations.test.ts` | MODIFY | PowerShell + python/node + `.exe` |
| `plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts` | MODIFY | `allow-write --help`/`-h` contract |
| `docs-site/src/content/docs/reference/commands.md` | MODIFY | Public CLI contract: cwd-scoped grant, `--session=`, `--help` |
| `docs-site/src/content/docs/reference/hooks.md` | MODIFY | Matcher at :90 stays. Destination prose at :91-92. Drop `python -c` from the residual-bypass sentence at :95 |
| `plugins/codexclaw/components/pabcd-state/dist/memory-write-gate.js` | MODIFY | `npm run build` output, same commit, `git add -f` |
| `plugins/codexclaw/components/pabcd-state/dist/shell-write-destinations.js` | MODIFY | same |
| `plugins/codexclaw/components/pabcd-state/dist/memory-cli.js` | MODIFY | same |
| `plugins/codexclaw/components/pabcd-state/dist/cli.js` | MODIFY | same |

No new source file. Helpers below are internal to the existing files. `expandHomePrefix` is not exported; pin it through `classifyMemoryWrite`. `statePath` stays private.

If the implementer's write scope is only the five primary source files, still patch the two test files in this component (required) and **report** `bin/codexclaw.mjs`, `docs-site/...`, and `dist/*` as required expansion. Do not skip tests.

## 5. Changes

### 5.1 `memory-write-gate.ts` — Korean trigger

MODIFY `plugins/codexclaw/components/pabcd-state/src/memory-write-gate.ts:80` only. Keep L79 and L81.

before (L80):

```ts
  /(기억|메모)\s*(에|해서)?\s*(남겨|남겨둬|적어|적어둬|저장|기록)/,
```

after:

```ts
  /(기억|메모리?)\s*(에도?|도|를|을|에|해서)?\s*(남겨|남겨둬|적어|적어둬|저장|기록)/,
```

Why L81 stays: it still covers `에다` / `추가` / `넣어` / `써`. Why `메모리에서 찾` stays a non-write: write verbs are required, so even if `에` eats the first syllable of `에서`, `서 찾` is not a write verb.

### 5.2 `memory-write-gate.ts` — `absolutize`

MODIFY `memory-write-gate.ts:128`.

before (L128–139):

```ts
/**
 * Expand a possibly `~`-prefixed, possibly relative path against cwd. Shell text and
 * patch headers both carry these forms, and a tilde path that stayed literal would
 * read as relative and escape the check.
 */
function absolutize(raw: string, cwd: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, "");
  if (value === "") return "";
  if (value === "~" || value.startsWith("~/")) value = join(homedir(), value.slice(1));
  if (isAbsolute(value)) return resolve(value);
  return cwd === "" ? "" : resolve(cwd, value);
}
```

after — create internal `expandHomePrefix` in this file (not exported, not a new module):

```ts
/**
 * Expand a possibly home-prefixed, possibly relative path against cwd. Shell text
 * and patch headers both carry these forms, and a tilde / USERPROFILE path that
 * stayed literal would read as relative and escape the check.
 *
 * Home prefixes, case-insensitive except for the exact `~` forms: `~`, `~/`, `~\`,
 * `%USERPROFILE%`, `$env:USERPROFILE`, `$HOME`. Expansion uses `homedir()`, the
 * same target `~` already uses. It does not consult `CODEX_HOME`; `memoriesRoot`
 * still decides the protected root. After expansion, backslashes become `/` so
 * `~\.codex\memories\n.md` classifies on win32 and on POSIX CI.
 */
function expandHomePrefix(raw: string): string {
  const home = homedir();
  if (raw === "~") return home;
  if (raw.startsWith("~/") || raw.startsWith("~\\")) return join(home, raw.slice(2));
  const lower = raw.toLowerCase();
  const prefixes = ["%userprofile%", "$env:userprofile", "$home"];
  for (const prefix of prefixes) {
    if (lower === prefix) return home;
    if (lower.startsWith(prefix + "/") || lower.startsWith(prefix + "\\")) {
      return join(home, raw.slice(prefix.length + 1));
    }
  }
  return raw;
}

function absolutize(raw: string, cwd: string): string {
  let value = raw.trim().replace(/^["']|["']$/g, "");
  if (value === "") return "";
  value = expandHomePrefix(value).replace(/\\/g, "/");
  if (isAbsolute(value)) return resolve(value);
  return cwd === "" ? "" : resolve(cwd, value);
}
```

Do not expand `$env:CODEX_HOME`, `` `${env:USERPROFILE}` ``, `%HOMEDRIVE%%HOMEPATH%`, or `$env:HOMEPATH`. Residual, listed in §9.

`~` expansion continues to mean `homedir()`, not `CODEX_HOME`. Tests for home forms must pass `root = resolve(join(homedir(), ".codex", "memories"))`, not `memoriesRoot({ CODEX_HOME: "/h" })`. Existing `/h/memories` parser tests stay on the fake root.

In the `startsWith("~\\")` source, that is the two-character prefix tilde + backslash. In the `replace(/\\/g, "/")` source, that is a regex matching one backslash.

### 5.3 `memory-write-gate.ts` — deny names cwd

MODIFY `denyReason` at `memory-write-gate.ts:210` and its call at L298.

before (L210–221):

```ts
export function denyReason(attempt: MemoryWriteAttempt, sessionId: string): string {
  const what =
    attempt.surface === "tool"
      ? `a memory note (${attempt.target})`
      : `a file under the Codex memories directory (${attempt.target})`;
  return [
    `[codexclaw MEMORY-WRITE-GATE] Blocked a write of ${what}: this session has no explicit user request to remember anything.`,
    "Memory notes outlive codexclaw and reach every later session, so they are written only when the user asks.",
    "Two ways forward: ask the user to confirm they want this remembered (a prompt such as \"기억해둬\" or \"remember this\" authorizes the next write),",
    `or record an explicit grant with \`cxc memory allow-write --session ${sessionId || "<id>"}\`.`,
    "If the user did ask, say so and retry — the request must appear in their own message, not in yours.",
  ].join(" ");
}
```

after:

```ts
export function denyReason(attempt: MemoryWriteAttempt, sessionId: string, cwd = ""): string {
  const what =
    attempt.surface === "tool"
      ? `a memory note (${attempt.target})`
      : `a file under the Codex memories directory (${attempt.target})`;
  const cwdHint = cwd === "" ? "the session working directory" : cwd;
  return [
    `[codexclaw MEMORY-WRITE-GATE] Blocked a write of ${what}: this session has no explicit user request to remember anything.`,
    "Memory notes outlive codexclaw and reach every later session, so they are written only when the user asks.",
    "Two ways forward: ask the user to confirm they want this remembered (a prompt such as \"기억해둬\" or \"remember this\" authorizes the next write),",
    `or record an explicit grant with \`cxc memory allow-write --session ${sessionId || "<id>"}\` from ${cwdHint}.`,
    "The grant is stored per cwd; issuing it from a different working directory will print success and never be seen by this hook.",
    "If the user did ask, say so and retry — the request must appear in their own message, not in yours.",
  ].join(" ");
}
```

Call site L298 becomes `return denyEnvelope(denyReason(attempt, sessionId, cwd));`.

Existing test `BLOCK: an unauthorized memory-tool write is denied with both remedies` still matches `/allow-write/` and `/remember this/`; extend it with `/stored per cwd/` and the scratch `cwd`.

### 5.4 `shell-write-destinations.ts` — PowerShell + python/node

MODIFY the file header at `shell-write-destinations.ts:17` so the counted-write list names the new verbs.

MODIFY `basename` / `verbDestinations` at L263–294. Create three internal helpers in this file: `normalizeVerb`, `powershellWriteDestinations`, `pythonNodeWriteDestinations`. Do not add a new module. Do not export them.

before `verbDestinations` (L286–295):

```ts
function verbDestinations(segment: string): string[] {
  const rest = stripPrefixes(tokenize(segment));
  const verb = rest[0] ? basename(rest[0]) : "";
  const args = rest.slice(1);
  if (verb === "tee") return teeDestinations(args);
  if (verb === "sed") return sedInPlaceDestinations(args);
  if (verb === "cp" || verb === "mv") return cpMvDestinations(args);
  if (verb === "perl" || verb === "ruby") return interpInPlaceDestinations(args);
  return [];
}
```

after — keep `basename` as-is (`shell-write-destinations.ts:263`). Insert `normalizeVerb` next to it. Replace `verbDestinations` and append the helpers at the bottom of the file:

```ts
function normalizeVerb(verb: string): string {
  return verb.replace(/\.(exe|cmd|bat)$/i, "").toLowerCase();
}

function verbDestinations(segment: string): string[] {
  let rest = stripPrefixes(tokenize(segment));
  while (rest[0] === "&") rest = rest.slice(1);
  const verb = rest[0] ? normalizeVerb(basename(rest[0])) : "";
  const args = rest.slice(1);
  if (verb === "tee") return teeDestinations(args);
  if (verb === "sed") return sedInPlaceDestinations(args);
  if (verb === "cp" || verb === "mv") return cpMvDestinations(args);
  if (verb === "perl" || verb === "ruby") return interpInPlaceDestinations(args);
  if (verb === "python" || verb === "python3" || verb === "node" || verb === "nodejs") {
    return pythonNodeWriteDestinations(args);
  }
  if (
    verb === "set-content" ||
    verb === "out-file" ||
    verb === "new-item" ||
    verb === "copy-item" ||
    verb === "copy" ||
    verb === "tee-object"
  ) {
    return powershellWriteDestinations(verb, args);
  }
  return [];
}

const PS_PATH_FLAGS = new Set(["-literalpath", "-path", "-filepath", "-destination"]);
// Valueless switches from the in-scope cmdlets. MUST NOT consume the next token.
// -Force / -Confirm / -WhatIf: Set-Content, Out-File, New-Item, Copy-Item
// -Append / -NoClobber / -NoNewline: Out-File (Set-Content also has -NoNewline)
// -PassThru: Set-Content, Copy-Item
// -Recurse / -Container: Copy-Item
// -Verbose / -Debug: common parameters (switch)
const PS_SWITCH_FLAGS = new Set([
  "-force",
  "-append",
  "-nonewline",
  "-confirm",
  "-whatif",
  "-passthru",
  "-noclobber",
  "-recurse",
  "-container",
  "-verbose",
  "-debug",
]);

function splitPsFlag(token: string): { flag: string; inline: string | undefined } {
  const colon = token.indexOf(":");
  if (colon > 1) return { flag: token.slice(0, colon), inline: token.slice(colon + 1) };
  return { flag: token, inline: undefined };
}

function powershellWriteDestinations(verb: string, args: string[]): string[] {
  const named: string[] = [];
  const positional: string[] = [];
  const copyLike = verb === "copy-item" || verb === "copy";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      const { flag, inline } = splitPsFlag(a);
      const f = flag.toLowerCase();
      if (PS_SWITCH_FLAGS.has(f)) {
        continue; // valueless: do not consume args[i+1]
      }
      if (copyLike) {
        // Destination-only, matching POSIX cp. -Path / -LiteralPath are sources.
        if (f === "-destination") {
          const val = inline !== undefined ? inline : args[++i];
          if (val) named.push(val);
          continue;
        }
        if (inline === undefined && args[i + 1] !== undefined && !args[i + 1].startsWith("-")) i++;
        continue;
      }
      if (PS_PATH_FLAGS.has(f)) {
        const val = inline !== undefined ? inline : args[++i];
        if (val) named.push(val);
        continue;
      }
      if (inline === undefined && args[i + 1] !== undefined && !args[i + 1].startsWith("-")) i++;
      continue;
    }
    positional.push(a);
  }
  if (named.length) return named;
  if (copyLike) return positional.length >= 2 ? [positional[positional.length - 1]] : [];
  return positional.length ? [positional[0]] : [];
}

function pythonNodeWriteDestinations(args: string[]): string[] {
  let script = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-c" || a === "-e" || a === "--command") {
      script = args[i + 1] ?? "";
      break;
    }
    if (a.startsWith("-c") && a.length > 2) {
      script = a.slice(2);
      break;
    }
  }
  if (script === "") return [];
  return scriptWriteDestinations(script);
}

function scriptWriteDestinations(script: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\bopen\s*\(\s*(?:[rRuUbBfF]*)(['"])(.*?)\1\s*,\s*(?:[rRuUbBfF]*)(['"])([wax][^'"]*)\3/g,
    /\bPath\s*\(\s*(?:[rRuUbBfF]*)(['"])(.*?)\1\s*\)\s*\.write_(?:text|bytes)\s*\(/g,
    /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\s*\(\s*(['"])(.*?)\1/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    for (let m = re.exec(script); m !== null; m = re.exec(script)) {
      if (m[2]) out.push(m[2]);
    }
  }
  return out;
}
```

Switch parameters are valueless and MUST NOT consume the following token. The set is `-Force`, `-Append`, `-NoNewline`, `-Confirm`, `-WhatIf`, `-PassThru`, `-NoClobber` (from Set-Content / Out-File / New-Item / Copy-Item / Tee-Object) plus `-Recurse` / `-Container` (Copy-Item) and `-Verbose` / `-Debug` (common switch parameters). Treating an unknown `-*` as always consuming the next non-flag token is the security hole: `Set-Content -Force <path>`, `Out-File -Append <path>`, and `New-Item -ItemType File -Force <path>` all return `[]` and a real memory write is allowed through. Value-taking unknown flags (`-Value`, `-ItemType`, `-Name`, `-Encoding`, `-Filter`, and any other non-switch `-*`) still skip the flag plus its following non-flag token so those values are never destinations.

Copy-Item (and alias `copy`) is destination-only, matching POSIX `cp` (`cpMvDestinations` at `shell-write-destinations.ts:338` returns only `-t`/`--target-directory` or the last positional). Named `-Path`/`-LiteralPath` on Copy-Item are sources. `Copy-Item -Path ${mem}/a.md -Destination /w/out.md` must return `["/w/out.md"]`, never the memories source. Returning sources would deny copying a file OUT of the memories directory, which POSIX `cp` does not do.

Keep POSIX `tee`/`cp` as they are. `Tee-Object` is a different verb. `cp src dest` already classifies on Windows because `verb === "cp"`; do not regress that control from #136. Cover `copy` as Copy-Item destination-only (the PowerShell spelling of POSIX `cp`).

Do not add `Move-Item`, `Add-Content`, aliases `sc`/`ni`, or a PowerShell AST. Residuals in §9 with reasons.

Preserve existing cases (they must stay green):

- `python3 -c "from pathlib import Path; print(Path('${mem}/MEMORY.md').read_text()); print('x -> y')"` → no dest (`memory-write-gate.test.ts:250`).
- `sed -n`, `2>/dev/null`, heredoc body, quoted `a > b`.

### 5.5 `memory-cli.ts` — help, `--session=`, unknown flags, cwd in output

MODIFY the parse/run surface of `memory-cli.ts`.

before USAGE (L25-34) is the current `MEMORY_USAGE` array. after: add two usage lines `--session=<id>` and `--help`, plus two sentences that the grant is stored at `<cwd>/.codexclaw/sessions/<id>.json` and that the success line names that cwd.

before parse (L36-47): `indexOf("--session")` plus `argv[i+1]`. Replace the function entirely with the block below. Keep `MemoryAllowWriteArgs`. Add `export type MemoryCliParse = MemoryAllowWriteArgs | { help: true } | { error: string }`.

after parse — extend the existing return union; do not add a new public CLI verb. Copy this over `parseMemoryCliArgs` and keep `MemoryAllowWriteArgs`:

```ts
export interface MemoryAllowWriteArgs {
  verb: "allow-write";
  sessionId: string;
  cwd: string;
}

export type MemoryCliParse = MemoryAllowWriteArgs | { help: true } | { error: string };

export function parseMemoryCliArgs(argv: string[], cwd: string): MemoryCliParse {
  const verb = argv[0];
  if (verb !== "allow-write") {
    return { error: `unknown memory verb '${verb ?? ""}' (expected allow-write)` };
  }
  const rest = argv.slice(1);
  if (rest.some((a) => a === "--help" || a === "-h")) return { help: true };

  let sessionId: string | undefined;
  const unknown: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--session") {
      const next = rest[i + 1];
      if (!next || next.startsWith("-")) {
        return { error: "missing required argument: --session <id> (must be a canonical session id)" };
      }
      sessionId = next;
      i++;
      continue;
    }
    if (a.startsWith("--session=")) {
      sessionId = a.slice("--session=".length);
      continue;
    }
    unknown.push(a);
  }
  if (unknown.length > 0) return { error: `unknown argument: ${unknown[0]}` };
  if (!sessionId || !isCanonicalSessionId(sessionId)) {
    return { error: "missing required argument: --session <id> (must be a canonical session id)" };
  }
  return { verb: "allow-write", sessionId, cwd };
}
```

before success output (`memory-cli.ts:66`):

```ts
    output: `memory allow-write: session ${args.sessionId} may perform ONE memory write; the next write consumes this grant.`,
```

after:

```ts
    output: `memory allow-write: session ${args.sessionId} may perform ONE memory write; grant recorded for cwd ${args.cwd}; the next write from that cwd consumes this grant.`,
```

Existing test `CLI grant: allow-write authorizes one write and is consumed by it` matches `/ONE memory write/` and still passes. Extend it with `assert.ok(res.output.includes(cwd))`.

`--help` is decided in parse, so `runMemoryCli` is never called. That is the no-side-effect guarantee. Do not make `runMemoryCli` itself understand `--help`.

before USAGE (L25-34): current four-line usage. after USAGE:

```ts
export const MEMORY_USAGE = [
  "Usage:",
  "  cxc memory allow-write --session <id>",
  "  cxc memory allow-write --session=<id>",
  "  cxc memory allow-write --help",
  "",
  "Authorizes exactly ONE memory write (memories.add_ad_hoc_note, or an edit under",
  "~/.codex/memories) for that session. The grant is consumed by the next write.",
  "It is stored on the process cwd: <cwd>/.codexclaw/sessions/<id>.json. The success",
  "line names that cwd. Re-run from the session working directory if they differ.",
  "",
  "The ordinary path needs no command: when the user asks in their own words to",
  "remember something, the session records that request and the next write passes.",
].join("\n");
```

### 5.6 `cli.ts` — help is not dead

MODIFY the `kind === "memory"` block starting at `cli.ts:281`. The dead help branch is `cli.ts:284-286` (`argv.length === 0 || argv[0] === "--help" || argv[0] === "-h"`); keep it. After `parseMemoryCliArgs` (`cli.ts:288`), before the error branch (`cli.ts:289`), insert:

```ts
    if ("help" in parsed) {
      process.stdout.write(`${MEMORY_USAGE}\n`);
      process.exit(0);
    }
```

Do not change `cli.ts:367` `pre-tool-use-memory-write`.

### 5.7 Dispatchers — HELP only

`plugins/codexclaw/bin/cxc.mjs:166-169` stays. MODIFY HELP at `cxc.mjs:90` from only `memory search` to also list `memory allow-write --session <id>` as a one-shot cwd-scoped grant.

`bin/codexclaw.mjs:584` stays. MODIFY HELP at `codexclaw.mjs:293` the same way. Header comment at L24 may mention `memory allow-write`.

### 5.8 docs-site (public contract)

MODIFY `docs-site/src/content/docs/reference/commands.md:44` so the table cell says the grant is cwd-scoped and that `--session=<id>` and `--help` work.

MODIFY the grammar fence at `commands.md:171` to three lines:

```
cxc memory allow-write --session <id>
cxc memory allow-write --session=<id>
cxc memory allow-write --help
```

Add one sentence after `commands.md:178`: the success line names the cwd the grant was recorded for; a grant issued from another cwd will not be found.

Do not change the matcher at `hooks.md:90` (`memories[._]?add_ad_hoc_note|apply_patch|Write|Edit|Bash`). MODIFY the destination prose at `hooks.md:91-92` to include `Set-Content` / `Out-File` / `New-Item` / `Copy-Item` (destination-only, including alias `copy`) / `Tee-Object` and `python`/`node` `-c`/`-e` write operands (`open(..., 'w'|'a'|'x')`, `Path.write_text` / `write_bytes`, `writeFileSync` / `writeFile` / `appendFileSync` / `appendFile` / `createWriteStream`). Replace `hooks.md:95` `python -c` writers are residual bypasses with the residual list in §9.

## 6. Tests

Runner: `*.test.ts` via `plugins/codexclaw/scripts/test.mjs` (`node --test`). Follow the existing files; do not create `memory-cli.test.ts`.

SESSION fixture already in `memory-write-gate.test.ts:29`: `019f9d73-4c28-7723-ab52-346aca1d9bcb`.

### 6.1 `plugins/codexclaw/components/pabcd-state/test/memory-write-gate.test.ts`

| test name | input | expected | why it fails today |
|---|---|---|---|
| `Korean memory write: 메모리 forms; 메모리에서 찾 is not a write` | `detectMemoryWriteRequest` on `메모리도 기록`, `메모리에 기록해줘`, `메모리에 남겨둬`, `메모리에 저장해`, and negative `메모리에서 찾` | first four true, last false | `메모리도 기록` is false at L80/L81 because `도` is not a particle. `메모리에 기록해줘` already true — pin it so L81 is not deleted |
| `CLI grant success output names the cwd it recorded` | `parseMemoryCliArgs(["allow-write","--session", SESSION], cwd)` then `runMemoryCli` | `code === 0`, `output` includes cwd, `readState(cwd, SESSION).memoryWriteGrant === true` | output is the L66 sentence with session id only |
| `deny reason names the session cwd` | `handleMemoryWriteGate(ptu({ cwd }))` with no grant | reason matches `/stored per cwd/` and includes `cwd` | `denyReason` at `memory-write-gate.ts:219` has no cwd |
| `allow-write --help anywhere does not grant` | `parseMemoryCliArgs(["allow-write","--help"], cwd)`, `(["allow-write","-h"], cwd)`, and `(["allow-write","--session", SESSION, "--help"], cwd)` | each result has `help: true`; after those parses `readState(cwd, SESSION).memoryWriteGrant === false`; `runMemoryCli` is not called | today the third call returns a grant object (#141c). `--help` as argv[1] is ignored |
| `allow-write accepts --session=<id>` | `parseMemoryCliArgs(["allow-write", "--session=" + SESSION], cwd)` | no `error`, `sessionId === SESSION` | `indexOf("--session")` misses the `=` form (`memory-cli.ts:41`) |
| `allow-write rejects unknown flags` | `parseMemoryCliArgs(["allow-write","--session", SESSION, "--force"], cwd)` | `error` matches `/unknown argument/` | extra flags are silently ignored |
| `home prefixes classify as memory writes` | `root = resolve(join(homedir(), ".codex", "memories"))`. `classifyMemoryWrite("Bash", { command }, "/w", root)` for `echo hi > ~/.codex/memories/n.md` (control), `echo hi > ~\\.codex\\memories\\n.md`, `echo hi > %USERPROFILE%\\.codex\\memories\\n.md`, `echo hi > $env:USERPROFILE\\.codex\\memories\\n.md`, `echo hi > $HOME/.codex/memories/n.md` | each `surface === "shell"` | only `~/` expands (`memory-write-gate.ts:136`); the other four return `surface === ""` |
| `apply_patch Add File with backslash-tilde memories path is gated` | `classifyMemoryWrite("apply_patch", { command: "*** Add File: ~\\.codex\\memories\\x.md\n+hi\n" }, "/w", resolve(join(homedir(), ".codex", "memories")))` | `surface === "edit"` | `patchTargets` extracts the path (`memory-write-gate.ts:148`) but `absolutize` leaves `~\` literal |

In the home-prefix commands, `$env:USERPROFILE` and `$HOME` are the literal prefixes the gate must expand — the strings `$env:USERPROFILE` and `$HOME` themselves, not values interpolated by the test runner. Do not implement a character-count or length check; match the prefix strings `~`, `~/`, `~\`, `%USERPROFILE%`, `$env:USERPROFILE`, and `$HOME` exactly as listed in §5.2. Keep every existing test, including `python3 -c read_text` as a non-write.

### 6.2 `plugins/codexclaw/components/pabcd-state/test/shell-write-destinations.test.ts`

Add one test file-section. Do not replace the POSIX cases. Use POSIX `const mem = "/h/memories"` here; these tests pin the parser, not home expansion.

| test name | input | expected | why it fails today |
|---|---|---|---|
| `PowerShell write cmdlets name their destination` | `Set-Content -LiteralPath '${mem}/n.md' -Value x`; `Out-File -FilePath ${mem}/n.md`; `New-Item -Path ${mem}/n.md -ItemType File`; `Copy-Item /w/a.md ${mem}/b.md`; `Tee-Object -FilePath ${mem}/out.md`; plus case-folded `set-content -path ${mem}/n.md` | dest arrays equal the memories paths (`Copy-Item` dest is `${mem}/b.md`) | `verbDestinations` returns `[]` at L294 for every non-POSIX verb |
| `Set-Content -Force does not swallow the destination` | `Set-Content -Force ${mem}/n.md` | `[${mem}/n.md]` | today's unknown-flag rule treats `-Force` as value-taking and consumes the path, so the dest array is `[]` and a real memory write is allowed through |
| `Out-File -Append does not swallow the destination` | `Out-File -Append ${mem}/n.md` | `[${mem}/n.md]` | today's unknown-flag rule treats `-Append` as value-taking and consumes the path, so the dest array is `[]` and a real memory write is allowed through |
| `New-Item -ItemType File -Force does not swallow the destination` | `New-Item -ItemType File -Force ${mem}/n.md` | `[${mem}/n.md]` | `-ItemType` correctly consumes `File`, but `-Force` then consumes the path, so the dest array is `[]` and a real memory write is allowed through |
| `Copy-Item is destination-only like POSIX cp` | `Copy-Item -Path ${mem}/a.md -Destination /w/out.md`; `Copy-Item ${mem}/a.md /w/out.md`; `Copy-Item /w/a.md ${mem}/b.md` | first two return `["/w/out.md"]` (the memories source is not returned); third returns `[${mem}/b.md]` | `verbDestinations` returns `[]` at L294 today. A named `-Path`/`-Destination` collector that returned both would deny copying a file OUT of memories; POSIX `cp` is destination-only |
| `copy is Copy-Item destination-only` | `copy /w/a.md ${mem}/b.md`; `copy -Path ${mem}/a.md -Destination /w/out.md` | `[${mem}/b.md]`; `["/w/out.md"]` | alias `copy` falls through to `return []` at L294 |
| `python and node one-line writes; reads stay empty` | `python -c "open(r'${mem}/n.md','w').write('x')"`; `python3 -c "from pathlib import Path; Path('${mem}/n.md').write_text('x')"`; `node -e "require('fs').writeFileSync('${mem}/n.md','x')"`; `python.exe -c "open('${mem}/n.md','w').write('x')"`; negative: the existing `read_text` + `'x -> y'` shape | write cases return `[${mem}/n.md]`; read returns `[]` | python/node fall through to `return []`. `.exe` would also miss without `normalizeVerb` |
| `Get-Content is not a write` | `Get-Content -LiteralPath ${mem}/n.md` | `[]` | would already pass; pin so the new PS parser cannot classify reads |

### 6.3 `plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts`

Follow the existing `--help`/`-h` loop style in that file. Import `parseMemoryCliArgs` from `../src/memory-cli.ts`. Do not spawn in this file; spawn is a verification command in §7.

| test name | input | expected | why it fails today |
|---|---|---|---|
| `memory allow-write ${token} prints usage and does not require --session` for `token` in `--help`, `-h` | `parseMemoryCliArgs(["allow-write", token], CWD)` | `help` in result; do not call `runMemoryCli` | parse returns `missing required argument: --session` |
| `memory allow-write --session <id> --help is help, not a grant` | `parseMemoryCliArgs(["allow-write","--session", SESSION, "--help"], CWD)` | `help` in result | returns `MemoryAllowWriteArgs` (#141c) |

## 7. Verification

From the repo root, after the patch, with pasted output:

1. `npm run build` — exit 0. `dist/memory-write-gate.js`, `dist/shell-write-destinations.js`, `dist/memory-cli.js`, `dist/cli.js` newer than their `src`. Stage with `git add -f` those four paths (`.gitignore:2` ignores `dist/`).
2. Focused: `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/memory-write-gate.test.ts" "plugins/codexclaw/components/pabcd-state/test/shell-write-destinations.test.ts" "plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts"` — exit 0, new names visible.
3. `npm test` — exit 0.
4. Red-green: on the parent tip the new tests named in section 6 fail (at least `메모리도 기록`, `--session=`, `~\`, `Set-Content -Force`, `Out-File -Append`, `New-Item -ItemType File -Force`, `allow-write --help`). At this layer's tip they pass. A green build whose new tests never ran red is not proven (`000_plan.md` verification contract).
5. Spawn, after build, from a scratch cwd that is **not** the session worktree:

```powershell
node plugins/codexclaw/components/pabcd-state/dist/cli.js memory allow-write --help
node plugins/codexclaw/components/pabcd-state/dist/cli.js memory allow-write --session=019f9d73-4c28-7723-ab52-346aca1d9bcb
```

- `--help`: stdout contains `Usage:`, exit 0, no `.codexclaw/sessions/*.json` created under the scratch cwd.
- `--session=`: stdout contains `grant recorded for cwd` and the scratch path, exit 0.

Windows live forms from #136 (optional on a win32 agent, required for c-10 evidence): classify `echo hi > ~\.codex\memories\n.md` and a `Set-Content -LiteralPath` of a `$HOME\.codex\memories\n.md` token through `classifyMemoryWrite("Bash", ...)` against `memoriesRoot()` with `CODEX_HOME` unset. Follow `powershell-landmines` for any real shell spawn; function-level classification is sufficient CI proof.

`cxc receipt test` is wp8's C-to-D concern, not this layer's unit test.

## 8. Must not touch

- Peer session files: `provider-bridge/`, `session-binding.ts`, `config-guard/`, `source-identity.ts`, `session-source.ts`, Windows landmine corpus.
- Recall (L1-L5): `memory-search.ts`, `index-search.ts`, `recall/.../cli.ts`, `recall/.../hook.ts`. `cxc memory --help` stays recall's. `메모리에서 찾` is L5's recall trigger; this layer only promises it is not a write.
- Hook JSON matcher / `trusted_hash`.
- Grant keying (no session-only store, no `--cwd` flag).
- Fail-open, consume-once, tool/edit surfaces, POSIX dest cases already tested.
- `runMemoryCli` locking via `withSessionLock` (`memory-cli.ts:55`).

Layer interactions:

- Below (L1-L5): no shared files. Chain is delivery-shaped only (`000_plan.md`). Detaching onto `dev` is allowed if the user prefers.
- Above (wp8): branch name `codex/fix-memory-write-gate`, PR title already drafted in `070_wp8_integration_stack_publish.md`. This layer must be green on its own tip (DEV-STACK-03).
- 260910 leftover: `python -c` was an explicit residual; closing it is this layer, not a drive-by.

## 9. Residuals (still bypasses after this layer)

Document these in `hooks.md`; do not try to parse them here.

- `powershell -Command` / `pwsh -NoProfile -Command` wrapping a write (nested script).
- `Move-Item`: a real move-write cmdlet left out of this layer's verb set (Set-Content / Out-File / New-Item / Copy-Item + `copy` / Tee-Object) so the parser stays bounded. Documented bypass.
- `Add-Content`: a real append-write cmdlet, same bounding choice as `Move-Item`. Not an alias. Documented bypass until a follow-up widens the verb table; the switch / destination-only rules above still apply if it is added later.
- Aliases `sc` / `ni`: this parser matches canonical cmdlet names plus `copy` (the Copy-Item spelling parallel to POSIX `cp`). It does not load the PowerShell alias table. `sc` additionally collides with `sc.exe` (Service Control Manager); classifying `sc` as Set-Content would false-positive `sc query` / `sc.exe start` as memory writes. `ni` is New-Item's alias and is residual for the same no-alias-table reason.
- `open(path, mode='w')` keyword form; `fs.promises.writeFile`; writes whose path is built (`path.join(process.env.USERPROFILE, ...)`).
- PowerShell `${env:USERPROFILE}`; `%HOMEDRIVE%%HOMEPATH%`; `$env:CODEX_HOME`.
- Subshells, unexpanded variables, `cmd.exe` redirects of an already-expanded token (those only classify if the expanded token is a memory path).
- `exec_command` in production unless the matcher is widened (out of scope).

Issue #136's fallback ("document and narrow the matcher to tools only") is **not** this layer's choice. Implement the parser.

## 10. Done when

- `c-9`: grant stdout contains cwd; `메모리도 기록` and `메모리에 기록해줘` are true; deny text says the grant is per cwd.
- `c-10`: the four home forms and the five PowerShell cmdlets (plus alias `copy`) plus python/node writes classify as memory writes; `read_text` does not. The three switch-parameter regressions (`Set-Content -Force`, `Out-File -Append`, `New-Item -ItemType File -Force`) and Copy-Item destination-only (named `-Path` is not a dest) pass.
- `c-11`: `allow-write --help` exits 0 with no grant; `--session=<id>` accepted; unknown flags rejected.
- `npm run build` and `npm test` green, new test names in the log, dist staged with `-f`.

## Amendment A — wp7 P revalidation and the dev cascade (2026-09-11)

Re-verified by an independent `xai/grok-4.6` explorer, which confirmed **every BEFORE
fence in this PRD is an exact quote of the current files** and that L1-L5 touched only
the recall component, leaving this layer's sources untouched. **This amendment
governs.**

### A.1 The base moved: the whole chain was rebased

While this layer was at P, the peer session merged its entire Windows sweep into
`dev`. `origin/dev` went from `a267b398` to `d4bef1f2`, seven commits:

```text
d4bef1f2  fix(pabcd-state): non-git session binds a nested git source (#109) (#152)
8e73e205  fix(sweep): GUI and serve provider probes through win-exec (#151)
ed225aec  fix(pabcd-state): refuse a bound cycle with no resolvable source identity (#150)
34cd7879  fix(config-guard): answer --help before the action and forward full argv (#149)
8013b625  fix(pabcd-state): canonicalise the native session cwd (#134) (#148)
291f81d6  fix(provider-bridge): reuse win-exec for PATHEXT and ComSpec (#131) (#153)
ee03d5bc  docs(plan): diff-level roadmap for the Windows issue sweep stack (#146)
```

Three of those land in `pabcd-state` and one in `config-guard`, and **`#149` moves
`bin/cxc.mjs`** — a file this layer edits. Rebasing after implementing L6 would have
meant resolving that collision inside the largest layer in the stack. It was done
first instead, at P, with a clean tree:

```text
git rebase --update-refs --onto origin/dev a267b398 codex/fix-memory-write-gate
  -> 31 commits replayed, no conflicts, all six layer branches updated
npm run build   exit 0
npm test        exit 1, tests 3110, pass 3022, fail 2   (the same two env failures, no third)
git merge-base --is-ancestor, each layer against the one below -> all 0
git push --force-with-lease, all six pushed branches
```

The chain now sits on `d4bef1f2`. **`002_host_verification_baseline.md` still holds:
exactly `hook-bench` and `cxc map --help`, and nothing else.** The peer's seven
commits and this chain's twenty-four compose without a third failure.

### A.2 Consequence for this layer

`bin/cxc.mjs`'s `memory allow-write` branch **moved from `:166` to `:171`** because
`#149` inserted config-guard argv handling above it. The condition text and the
`HELP` constant at `:90` are unchanged, and every write-gate `.ts` file is byte
identical to what this PRD quotes. **Re-read `bin/cxc.mjs` and `bin/codexclaw.mjs`
before editing; every other BEFORE block in this document is still exact.**

`#149` is also prior art worth reading rather than copying: it solved the same
"`--help` reaches the action" defect for `config-guard`, on the same dispatcher this
layer must fix for `memory allow-write`. Read how it forwards argv, then decide
independently — L3 in this stack already rejected the older `isHelpToken` prior art
for good reasons.

### A.3 Remaining staleness

Only one: §2 paraphrases `sessionsDir` as `join(cwd, ".codexclaw", "sessions")`. The
actual code is `join(cwd, STATE_DIR, SESSIONS_SUBDIR)` at `state.ts:317`, with
`STATE_DIR = ".codexclaw"` at `:233`. The behaviour is what the PRD says; the literal
is not. Do not introduce a hard-coded string.

### A.4 The grant binding, confirmed

`consumeAuthorization(cwd, sessionId, turnId)` -> `readState(cwd, sessionId)`
(`memory-write-gate.ts:244`, called at `:297`) -> `statePath(cwd, sessionId)`
(`:320-321`) -> `sessionsDir(cwd)`. The CLI stores the **process** cwd
(`memory-cli.ts:46`) and writes the grant there (`:56-57`). That is #135 exactly: the
grant is keyed by a cwd the success message never mentions.

### A.5 The risk, restated because it is the security boundary

POSIX habit says an unknown `-*` flag may consume the next token. **PowerShell switch
parameters take no value.** If the new verb parser copies the POSIX habit,
`Set-Content -Force <memory path>`, `Out-File -Append <memory path>` and
`New-Item -ItemType File -Force <memory path>` all return `[]` and a real memory write
passes the gate. The existing POSIX helpers already get this right — `tee`, `sed`,
`cp` skip an unknown flag **without** consuming the next token. Match that behaviour.

### A.6 Existing pins that must not break

`memory-write-gate.test.ts` `:49`, `:64`, `:81`, `:101`, `:121`, `:136`, `:150`,
`:162`, `:175`, `:186`, `:199`, `:209`, `:250` (python3 `read_text` is a READ and must
stay allowed), `:263`; `shell-write-destinations.test.ts` `:13`, `:30`, `:40`, `:57`.
A widening that turns an existing allow into a deny is as much a regression as a
missed write.

