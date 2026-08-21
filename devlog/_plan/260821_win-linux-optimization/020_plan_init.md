# 020 - wp03 plan init (issue #30)

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp03.

Defect closed from 002 section D: **#4 (P1)** plan-cli.ts:54,110 doubles the YYMMDD_ date
prefix and rewrites underscores to hyphens. Latent secondary from 002 A (#30 secondary,
P3): the `0${n}0_phase${n}.md` template at :118 breaks past 9 phases - in scope here because it
is the same three lines of the same function.

Reproduced (002 section A):

```text
input:  260821_win-linux-optimization
slug:   260821-win-linux-optimization
unit:   devlog/_plan/260821_260821-win-linux-optimization
```

Two distinct bugs stack in that one line. `deriveSlug` (`freeze.ts:60`) lowercases and maps
`[^a-z0-9]+` to `-`, so it does not strip a leading date - it only rewrites the separator.
Then `runPlanCli` prepends `yymmdd()` unconditionally. The underscore mangling also fires on
the bare-slug path, so `my_slug` silently becomes `my-slug` even with no date involved.

## MODIFY / NEW / DELETE map

### 1. MODIFY plugins/codexclaw/components/pabcd-state/src/plan-cli.ts

#### 1a. PlanCliArgs carries the caller's date

BEFORE (:15-20)
```ts
export interface PlanCliArgs {
  verb: "init";
  slug: string;
  phases: number;
  cwd: string;
}
```

AFTER
```ts
export interface PlanCliArgs {
  verb: "init";
  slug: string;
  phases: number;
  cwd: string;
  /** YYMMDD parsed off the positional, when the caller already supplied one.
   *  Null means "stamp today". Never re-derived, so the unit dir a user typed
   *  is the unit dir they get (issue #30). */
  date: string | null;
}
```

#### 1b. NEW helper: splitDatePrefix + underscore-preserving slug

Insert after `yymmdd()` (:33), before `parsePlanCliArgs`.

```ts
/**
 * Split a leading YYMMDD date prefix off a positional slug.
 *
 * Users copy the directory convention (`260821_win-linux-optimization`) straight
 * off disk and pass it back. Prepending today's date to that produced
 * `260821_260821-win-linux-optimization` (issue #30), so the prefix is parsed out
 * and reused rather than stacked.
 *
 * Both separators are accepted because both appear in the wild: `_` is the unit
 * convention and `-` is what `deriveSlug` turns it into on a prior mangled run.
 */
export function splitDatePrefix(raw: string): { date: string | null; rest: string } {
  const m = /^(\d{6})[_-](.+)$/.exec(raw.trim());
  if (!m) return { date: null, rest: raw.trim() };
  return { date: m[1], rest: m[2] };
}

/**
 * Slug for a plan unit. Unlike `deriveSlug` (freeze.ts:60), the underscore is a
 * legal slug character here: `my_slug` is a name the user chose, and silently
 * returning `my-slug` creates a directory they did not ask for (issue #30).
 */
export function derivePlanSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
```

Note the deliberate divergence from `deriveSlug`. `freeze.ts`'s version stays untouched -
it feeds goalplan slugs, which are used as state keys and validated by
`validateGoalplanSlug`; widening that charset is a different blast radius. This helper is
local to plan-unit directory names.

#### 1c. parsePlanCliArgs uses both

BEFORE (:41-55)
```ts
  let slug = "";
  let phases = 1;
  let outCwd = cwd;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--phases") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 9) return { error: "--phases expects an integer 1-9" };
      phases = n;
    } else if (a === "--cwd") outCwd = argv[++i] ?? cwd;
    else if (!a.startsWith("--") && slug === "") slug = a;
  }
  if (slug === "") return { error: "plan init requires a <slug> argument" };
  return { verb: "init", slug: deriveSlug(slug), phases, cwd: outCwd };
```

AFTER
```ts
  let slug = "";
  let phases = 1;
  let outCwd = cwd;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--phases") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 9) return { error: "--phases expects an integer 1-9" };
      phases = n;
    } else if (a === "--cwd") outCwd = argv[++i] ?? cwd;
    else if (!a.startsWith("--") && slug === "") slug = a;
  }
  if (slug === "") return { error: "plan init requires a <slug> argument" };
  const { date, rest } = splitDatePrefix(slug);
  const derived = derivePlanSlug(rest);
  if (derived === "") {
    return { error: `plan init: '${slug}' has no usable slug once its date prefix is removed` };
  }
  return { verb: "init", slug: derived, phases, cwd: outCwd, date };
```

The `deriveSlug` import from `./freeze.ts` (:13) becomes unused in this file and is removed.

#### 1d. runPlanCli honors the parsed date and the 3-digit convention

BEFORE (:109-129)
```ts
export function runPlanCli(args: PlanCliArgs): PlanCliResult {
  const unitDir = resolve(args.cwd, "devlog", "_plan", `${yymmdd()}_${args.slug}`);
  if (existsSync(unitDir)) {
    return { output: `plan init: ${unitDir} already exists - refusing to overwrite. Write your docs there.`, code: 1 };
  }
  try {
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(join(unitDir, "000_plan.md"), planDoc(args.slug), "utf8");
    for (let n = 1; n <= args.phases; n++) {
      writeFileSync(join(unitDir, `0${n}0_phase${n}.md`), phaseDoc(n, args.slug), "utf8");
    }
  } catch (err) {
    return { output: `plan init failed: ${err instanceof Error ? err.message : String(err)}`, code: 1 };
  }
  const rel = unitDir;
  return {
    output:
      `plan init: scaffolded ${rel} (000_plan.md + ${args.phases} phase doc(s)).\n` +
      `Write every doc to diff-level BEFORE P -> A; the P>A gate requires planUnit to carry numbered docs.`,
    code: 0,
  };
}
```

AFTER
```ts
export function runPlanCli(args: PlanCliArgs): PlanCliResult {
  // args.date is the caller's own prefix when they passed one; only stamp today
  // when they did not (issue #30 - the doubled prefix came from stamping always).
  const unitName = `${args.date ?? yymmdd()}_${args.slug}`;
  const unitDir = resolve(args.cwd, "devlog", "_plan", unitName);
  if (existsSync(unitDir)) {
    return { output: `plan init: ${unitDir} already exists - refusing to overwrite. Write your docs there.`, code: 1 };
  }
  try {
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(join(unitDir, "000_plan.md"), planDoc(args.slug), "utf8");
    for (let n = 1; n <= args.phases; n++) {
      // 3-digit decade convention: 010, 020, ... 100. padStart keeps that true
      // past 9 phases even though the parser caps at 9 today.
      const decade = String(n * 10).padStart(3, "0");
      writeFileSync(join(unitDir, `${decade}_phase${n}.md`), phaseDoc(n, args.slug), "utf8");
    }
  } catch (err) {
    return { output: `plan init failed: ${err instanceof Error ? err.message : String(err)}`, code: 1 };
  }
  // 002 B18: the old local was named `rel` while holding an absolute path, which on
  // Windows printed a full C:\Users\... line under a variable promising otherwise.
  const shown = relative(args.cwd, unitDir) || unitDir;
  return {
    output:
      `plan init: scaffolded ${shown} (000_plan.md + ${args.phases} phase doc(s)).\n` +
      `Write every doc to diff-level BEFORE P -> A; the P>A gate requires planUnit to carry numbered docs.`,
    code: 0,
  };
}
```

`relative` joins the existing `node:path` import at :11 (`join, resolve` are already there).
This closes the naming half of 002 B18; the other half (the `cxc gui` dependency-probe
message) belongs to wp06 and is handled in 050_spawn_quoting.md.

### 2. MODIFY plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts

The existing file has two tests. The first asserts `ok.slug === "my-big-feature"` for
input `"My Big Feature!"` - still true under `derivePlanSlug` (spaces and `!` are not in
`[a-z0-9_-]`), so it stays. The second asserts the scaffolded filenames
`["000_plan.md", "010_phase1.md", "020_phase2.md"]` - still true under `padStart(3, "0")`.
Both survive unchanged; the new cases are additive.

## TESTS

MODIFY `plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts`

1. "splitDatePrefix parses both separators and passes through bare slugs":
   `splitDatePrefix("260821_win-linux-optimization")` -> `{ date: "260821", rest: "win-linux-optimization" }`;
   `splitDatePrefix("260821-win-linux")` -> `{ date: "260821", rest: "win-linux" }`;
   `splitDatePrefix("win-linux")` -> `{ date: null, rest: "win-linux" }`.
2. "splitDatePrefix does not eat a non-date numeric prefix":
   `splitDatePrefix("12345_thing")` (5 digits) and `splitDatePrefix("1234567_thing")`
   (7 digits) both return `date: null` with `rest` intact. This is the guard against
   over-stripping.
3. "derivePlanSlug preserves underscores": `derivePlanSlug("my_slug")` === `"my_slug"`,
   and `derivePlanSlug("My Big Feature!")` === `"my-big-feature"`.
4. "a prefixed positional does not double the date" (the issue #30 regression):
   parse `["init", "260821_win-linux-optimization", "--cwd", tmp]`, run it, and assert
   `existsSync(join(tmp, "devlog", "_plan", "260821_win-linux-optimization"))` and that
   NO directory matching `/^\d{6}_\d{6}/` exists under `devlog/_plan`.
5. "a hyphen-prefixed positional normalizes to the underscore convention":
   `["init", "260821-win-linux", "--cwd", tmp]` creates `260821_win-linux` (the unit
   separator is always `_`, regardless of what the caller typed).
6. "a bare slug still gets today's date": `["init", "fresh_unit", "--cwd", tmp]` creates
   `${yymmdd()}_fresh_unit` - proving the underscore survived AND the date was stamped.
7. "a positional that is only a date is rejected": `["init", "260821_", "--cwd", tmp]` ->
   error matching `/no usable slug/`.
8. "the success line is relative, not absolute": the output of a run with `--cwd tmp`
   matches `/devlog/` and does NOT contain `tmp` itself.
9. "phase docs keep the 3-digit decade convention": `--phases 9` produces
   `090_phase9.md` as the last file, and every filename matches `/^\d{3}_/`.

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/plan-gate.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/freeze.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

`freeze.test.ts` is in that list on purpose: this slice removes `plan-cli`'s only
`deriveSlug` caller, and the run proves `freeze.ts` itself was not touched.

Manual acceptance - the exact input from issue #30. Expected: a single-dated directory.

```powershell
cd $env:TEMP; mkdir cxc-plan-check -Force | Out-Null; cd cxc-plan-check
node C:\Users\super\Downloads\codexclaw\bin\codexclaw.mjs plan init 260821_win-linux-optimization
Get-ChildItem devlog\_plan
```

Expected output contains exactly `260821_win-linux-optimization`, and NOT
`260821_260821-win-linux-optimization`.

Underscore acceptance, expected `<today>_my_slug`:

```powershell
node C:\Users\super\Downloads\codexclaw\bin\codexclaw.mjs plan init my_slug
Get-ChildItem devlog\_plan
```

WSL parity (path semantics differ, slug logic must not), expected exit 0:

```bash
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/super/Downloads/codexclaw && node --test 'plugins/codexclaw/components/pabcd-state/test/plan-cli.test.ts'"
```

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01.

