# 070 - wp08 CRLF and encoding hygiene

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp08.

Defects closed from 002 section D:

| # | Sev | Location | Problem |
|---|-----|----------|---------|
| 14 | P2 | `scripts/hook-bench.mjs:64,85` | hard-coded `/tmp` |
| 15 | P2 | 29 sites (002 B9/B10) | `split("\n")` on TOML / stdout / patch text |

Patterns adopted from 001: section 4.5 (`/\r?\n/` for tool output, bare `"\n"` wherever
byte offsets are recorded), 4.6 (detect the dominant EOL, edit normalized, restore on
write), and 4.1/4.4 (Windows tools emit UTF-16LE).

The scoping rule for this sweep comes straight from 002 B9. Not all 29 sites are equal:

- **Foreign input** - user-authored TOML, subprocess stdout, `apply_patch` payloads. These
  can arrive CRLF today and are fixed.
- **Self-written JSONL** - ledgers this repo writes with `\n`. Safe today; they break only
  if an editor or `core.autocrlf=true` rewrites them. Fixed in the same pass for one
  idiom, with the byte-accounting exception below respected.
- **Deliberately-correct** - `memory-search.ts:202` already strips CR by hand, and 002 B17
  lists forward-slash splits that must NOT be touched.

## MODIFY / NEW / DELETE map

### 1. NEW plugins/codexclaw/components/cxc-ops/src/text-lines.ts

```ts
/**
 * text-lines.ts - one newline idiom for the whole repo.
 *
 * `split(/\r?\n/)` is right for display and tool output and wrong wherever byte
 * offsets or lengths are recorded: it consumes two bytes and leaves no way to
 * tell that it did, so a CRLF ledger's recorded lengths come out short by one
 * byte per line (opencodex usage/log.ts:782-786). Both idioms are named here so
 * a call site has to choose on purpose.
 */

/** Split for reading. Tolerates CRLF, LF, and a CR-only final line. */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Split preserving exact byte lengths. Use where offsets are recorded. */
export function splitLinesByteExact(text: string): string[] {
  return text.split("\n");
}

/** The EOL this text predominantly uses. */
export function dominantEol(text: string): "\r\n" | "\n" {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  return crlf > lf ? "\r\n" : "\n";
}

/**
 * Rewrite `text` with `eol`, preserving whether it ended with a newline.
 *
 * Editing a user's `config.toml` and handing it back with flipped line endings turns
 * a one-line change into a whole-file diff (opencodex grok/inject.ts:388-389).
 */
export function withEol(text: string, eol: "\r\n" | "\n"): string {
  const normalized = text.replace(/\r\n/g, "\n");
  return eol === "\n" ? normalized : normalized.replace(/\n/g, "\r\n");
}
```

### 2. MODIFY the foreign-input sites (the real fixes)

#### 2a. TOML parsers - the two duplicated copies

`plugins/codexclaw/components/config-guard/src/multi-agent-v2.ts:56` parses the user's
`~/.codex/config.toml`.

BEFORE
```ts
  const lines = text.split("\n");
```

AFTER
```ts
  // The user's config.toml is foreign input; a Windows editor writes CRLF.
  const lines = splitLines(text);
```

002 B9 notes this is fragile rather than broken - `\s` in the table-header regex happens
to eat the `\r`. The real smell is that the same package's `activate.ts:63` already
handles `\r?\n` deliberately, so the file disagrees with its neighbor.

`plugins/codexclaw/components/pabcd-state/src/review-round-cli.ts:30` is the same parser,
duplicated. Same substitution. (Deduplicating the two parsers is a separate refactor -
not in scope, and worth filing.)

#### 2b. `where` / subprocess stdout

`plugins/codexclaw/components/messenger-bridge/src/api-compat.ts:38` and
`plugins/codexclaw/gui/src/server/middleware.ts:61`:

BEFORE
```ts
  const first = res.stdout.split("\n")[0].trim();
```

AFTER
```ts
  // where.exe emits CRLF; the trailing .trim() saved this by accident.
  const first = splitLines(res.stdout)[0]?.trim() ?? "";
```

The `?? ""` is not incidental: on empty stdout the old code indexed `[0]` of a
single-element array and got `""`, but any future `filter` would make it `undefined.trim()`.

#### 2c. apply_patch payload parsing (the highest-impact instance)

`plugins/codexclaw/components/pabcd-state/src/comment-lint.ts:54` and
`plugins/codexclaw/components/pabcd-state/src/edit-shape.ts:83` split a `patchText` that
arrives from a tool payload, not from disk.

BEFORE (`edit-shape.ts:83`)
```ts
  const lines = patchText.split("\n");
```

AFTER
```ts
  // A CRLF patch leaves \r on every line, which breaks the FILE-directive match
  // on the next line and corrupts the linted line content (002 B9).
  const lines = splitLines(patchText);
```

Same at `comment-lint.ts:54`. This pair is the one place where CRLF causes a wrong
answer rather than a near-miss, so its tests are the load-bearing ones.

### 3. MODIFY the self-written JSONL readers (consistency pass)

Seven sites, all reading files this repo wrote with `\n`. Each becomes `splitLines`:

| File | Line |
|------|------|
| `pabcd-state/src/state.ts` | 381 |
| `pabcd-state/src/metrics.ts` | 74 |
| `pabcd-state/src/friction.ts` | 79 |
| `pabcd-state/src/interview-ledger.ts` | 126 |
| `pabcd-state/src/divergence.ts` | 205 |
| `pabcd-state/src/render-observations.ts` | 84 |
| `recall/src/rollout.ts` | 215 |

These are safe today and break only under `core.autocrlf=true` or an editor rewrite. They
are included so there is ONE idiom in the repo rather than two that differ by accident.

**Byte-accounting exception:** before converting any of these, check whether the reader
records an offset or a length. If it does, it keeps `splitLinesByteExact` with a comment
naming why (001 4.5). `rollout.ts` is the one to inspect closely - it reads codex rollout
files it did not write.

### 4. MODIFY plugins/codexclaw/components/recall/src/memory-search.ts

BEFORE (:202)
```ts
  const lines = content.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
```

AFTER
```ts
  const lines = splitLines(content);
```

Correct before and after; folding it in leaves one idiom instead of a hand-rolled
workaround in exactly one file (002 B10).

### 5. MODIFY plugins/codexclaw/scripts/hook-bench.mjs - defect #14

BEFORE (:60-65, :77-88)
```js
function fixturePayload(event) {
  const base = {
    hook_event_name: event,
    session_id: "bench-session-" + Math.random().toString(36).slice(2, 8),
    cwd: "/tmp/bench-cwd",
  };
...
  const result = spawnSync("node", cleanParts, {
    input: payload,
    timeout: 15000,
    env: { ...process.env, HOME: tmpHome, CODEX_HOME: join(tmpHome, ".codex"), CODEX_SQLITE_HOME: join(tmpHome, ".codex") },
    cwd: "/tmp",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
```

AFTER
```js
function fixturePayload(event, benchCwd) {
  const base = {
    hook_event_name: event,
    session_id: "bench-session-" + Math.random().toString(36).slice(2, 8),
    cwd: benchCwd,
  };
...
function invokeHook(command, payload, tmpHome, benchCwd) {
...
  const result = spawnSync("node", cleanParts, {
    input: payload,
    timeout: 15000,
    env: {
      ...process.env,
      HOME: tmpHome,
      // Windows resolves the home from USERPROFILE, so HOME alone left the hook
      // reading the REAL user home during a benchmark meant to be hermetic.
      USERPROFILE: tmpHome,
      CODEX_HOME: join(tmpHome, ".codex"),
      CODEX_SQLITE_HOME: join(tmpHome, ".codex"),
    },
    // /tmp does not exist on Windows, and spawnSync throws ENOENT on a missing
    // cwd, so the bench failed outright there (002 B8). Line 114 of this same
    // file already had the right idiom: mkdtempSync(join(tmpdir(), ...)).
    cwd: benchCwd,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
```

And beside the existing `tmpHome` creation at :114:
```js
const tmpHome = mkdtempSync(join(tmpdir(), "cxc-bench-"));
mkdirSync(join(tmpHome, ".codex"), { recursive: true });
const benchCwd = mkdtempSync(join(tmpdir(), "cxc-bench-cwd-"));
```

Both call sites at :126-128 thread `benchCwd` through. This unblocks 090_hook_perf.md,
which cannot measure anything until the bench runs on Windows at all.

### 6. MODIFY .gitattributes

BEFORE
```text
* text=auto eol=lf
```

AFTER
```text
* text=auto eol=lf

# Generated Windows assets. cmd.exe parses .cmd files in the console's OEM code
# page and a CRLF-less .cmd can misparse, so these are checked out with CRLF and
# never normalized (opencodex service.ts:245 writes them CRLF for this reason).
*.cmd text eol=crlf
*.bat text eol=crlf
*.ps1 text eol=crlf

# Fixtures whose bytes are the test subject. Normalizing a CRLF fixture to LF
# would make the CRLF tests pass vacuously.
plugins/codexclaw/**/test/fixtures/**/*.crlf.* -text
```

002 B9's closing note is the reason this matters and also the reason it is not
sufficient: `.gitattributes` protects checked-in files but does nothing for runtime state
under `.codexclaw/` or for the user's `config.toml`. The parser fixes above are the
actual protection; this is defense in depth.

### 7. Package wiring (SHARED-HELPER-01)

This is the widest fan-out of the four shared helpers, so settle it explicitly before
writing any of the call-site diffs above. `text-lines.ts` is placed in `cxc-ops`, but
`splitLines` is called from FIVE other workspace packages: `config-guard` (2a),
`pabcd-state` (2a, 3), `recall` (3, 4), `messenger-bridge` (2b), and `gui` (2b).
A `from "../../cxc-ops/src/text-lines.ts"` import would not resolve at build time:
`rg` for `from "../../` across all component sources returns zero hits, because this
repo keeps components dependency-free of each other.

Same rule as 040 section 6, 050 section 6, and 060 section 4, applied uniformly: **each
consuming package gets its own copy or two-line re-export module at the same relative
path** (`src/text-lines.ts`), never a cross-package import.

| Package | File | Content |
|---------|------|---------|
| `cxc-ops` | `src/text-lines.ts` | the implementation (section 1) |
| `config-guard` | `src/text-lines.ts` | same body, copied |
| `pabcd-state` | `src/text-lines.ts` | same body, copied |
| `recall` | `src/text-lines.ts` | same body, copied |
| `messenger-bridge` | `src/text-lines.ts` | same body, copied |
| `gui` | `src/server/text-lines.ts` | same body, copied (gui nests its server sources) |

Every call site above then imports `from "./text-lines.ts"` (or the correct relative path
within its own package), and section 1's file is written six times rather than imported
across a boundary. Both exports (`splitLines` AND `splitLinesByteExact`) go in every copy,
so the byte-accounting exception in section 3 stays available wherever a reader needs it.

Six copies of a two-function module is the largest duplication this campaign asks for,
and it is the single strongest argument for the SHARED-HELPER-01 follow-up filed in 100
section 5. It is still the right call for THIS phase: introducing a shared package is a
workspace-topology change that would touch every `package.json` and belongs in its own
reviewed cycle, not smuggled in under a CRLF fix. Raise it once for all four helpers.

The A-phase reviewer should reject any diff in this phase that adds a `../../` import.

### 8. Deliberately NOT in this slice

- A full `decodeWindowsTextBytes` ordered decoder (001 4.1). Nothing in codexclaw reads
  UTF-16LE tool output today, because wp07 established that codexclaw does not shell out
  to `wsl.exe` at all. Build it when a caller needs it, not before. File it as a
  documented pattern debt.
- Base64/UTF-16LE PowerShell transport (001 4.2). Same reasoning: no PowerShell helper
  currently returns a non-ASCII string.
- `%USERPROFILE%` indirection for generated batch files (001 4.3). `service.ts:228-288`
  already writes a CRLF `.cmd` with quoted paths and is listed in 002 section C as
  solid; the indirection matters for non-ASCII profile directories, which is a real but
  separate hardening. File it.
- The forward-slash splits in 002 B17. They are correct as written. Any diff that
  "fixes" `skill-search/src/cli.ts:96-98`, `sources.ts:73`, `manifest-targets.ts:100`,
  `scouting-bundle.ts:32`, or `memory-search.ts:282` to `path.sep` is a REGRESSION and the
  A-phase reviewer should reject it.

## TESTS

NEW `plugins/codexclaw/components/cxc-ops/test/text-lines.test.ts`

1. "splitLines handles LF, CRLF, and mixed" - `"a\r\nb\nc"` -> `["a","b","c"]`.
2. "splitLines leaves a lone CR alone" - `"a\rb"` is one line. Old-Mac line endings are
   not a case this repo supports, and pretending otherwise would split real content.
3. "splitLinesByteExact keeps the CR" - `"a\r\nb"` -> `["a\r","b"]`, with the offset
   rationale in the test name.
4. "dominantEol picks CRLF only when it leads" - `"a\r\nb\r\nc\nd"` -> `"\r\n"`;
   `"a\nb\r\n"` -> `"\n"`; `""` -> `"\n"`.
5. "withEol round-trips" - `withEol(withEol(t, "\r\n"), "\n") === withEol(t, "\n")`.
6. "withEol does not double a CR" - CRLF input to `withEol(t, "\r\n")` has no `\r\r\n`.

NEW fixture-driven cases

7. `config-guard/test/`: "a CRLF config.toml parses identically to LF" - the same TOML
   twice, once with `\r\n`, asserting equal parse results for both
   `multi-agent-v2.ts` and `review-round-cli.ts`'s copy.
8. `pabcd-state/test/edit-shape.test.ts`: "a CRLF patch payload yields the same FILE
   directives as LF" - take an existing LF fixture, `replace(/\n/g, "\r\n")`, and assert
   deep-equal results. This is the case where CRLF currently produces a WRONG answer.
9. `pabcd-state/test/comment-lint.test.ts`: same shape - a CRLF patch must not report
   phantom findings from trailing `\r`.
10. `messenger-bridge` + `gui`: "CRLF where output yields a clean first path" -
    stub stdout as `"C:\\Program Files\\nodejs\\node.exe\r\nC:\\other\\node.exe\r\n"` and
    assert the first path has no `\r`.
11. "empty stdout does not throw" - the `?? ""` guard.
12. `recall/test/`: "memory-search CRLF content" - unchanged behavior after the idiom
    swap, proving the fold-in was not a regression.
13. Ledger readers: for each of the seven, "a CRLF-rewritten ledger reads identically" -
    one parameterized test over the list, so the sweep is provably complete.

NEW cases in `plugins/codexclaw/test/`

14. "hook-bench builds no path under /tmp on win32" - import `fixturePayload` and assert
    the payload `cwd` starts with `tmpdir()`.
15. "the bench env sets USERPROFILE alongside HOME" - guards the hermeticity fix.

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/cxc-ops/test/text-lines.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/config-guard/test/*.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/edit-shape.test.ts" "plugins/codexclaw/components/pabcd-state/test/comment-lint.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/recall/test/*.test.ts" "plugins/codexclaw/gui/test/*.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

The bench must now RUN on Windows - this is the defect #14 acceptance and the
precondition for wp10:

```powershell
node plugins/codexclaw/scripts/hook-bench.mjs --iterations 3 --json
```

Expected: JSON with per-hook timings and no ENOENT on `/tmp`.

Sweep completeness check. Every remaining bare `split("\n")` must be either
`splitLinesByteExact` or on the 002 B17 do-not-touch list:

```powershell
rg -n 'split\("' plugins/codexclaw/components --glob "!**/dist/**" --glob "!**/test/**" | rg '\\n'
```

Review each remaining hit by hand against section 3's byte-accounting exception; the
A-phase reviewer should be shown this output.

The gitattributes change needs a re-checkout to take effect, so verify it directly:

```powershell
git check-attr text eol -- plugins/codexclaw/components/messenger-bridge/src/runner.ts
git check-attr text eol -- some-generated.cmd
```

Expected: `eol: lf` for the `.ts` file, `eol: crlf` for the `.cmd`.

WSL parity, expected exit 0 - and specifically proving the LF branch did not regress:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/codexclaw-wsl-checkout && npm test && node plugins/codexclaw/scripts/hook-bench.mjs --iterations 3 --json > /dev/null"
```

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01.
