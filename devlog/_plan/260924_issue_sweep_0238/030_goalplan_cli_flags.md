# 030_goalplan_cli_flags

## DIFFLEVEL-ROADMAP-01

The goalplan command currently parses one global union of flags for every verb. Unknown tokens, stray positionals, misplaced flags, and some missing values can therefore be silently ignored or accepted by a verb that does not consume them. This phase makes the project-local loop CLI validate the selected verb before dispatch, so an operator can see exactly which flags are legal and a rejected command cannot reach a goalplan write. It covers the `cxc loop` surface and its deprecated `cxc goalplan` alias, the tests that exercise the public parser, and the user-facing command references. The later wp5 phase owns `--presented`; this phase must leave it rejected.

The implementation is for maintainers and agents invoking `cxc` against a project-local `.codexclaw/goalplans/<slug>/` plan. It preserves existing supported calls, including repeated `--criterion`, repeated `--depends-on`, `--surface=desktop`, `--session` binding, and `ready --json`, while making unsupported combinations fail before `runGoalplanCli` can write state or a ledger.

### Current behavior and dispatch

`plugins/codexclaw/components/pabcd-state/src/cli.ts:161-174` is the component router. For `kind === "loop"` or `kind === "goalplan"`, it imports `parseGoalplanCliArgs` and `runGoalplanCli`, passes `process.argv.slice(3)` and `process.cwd()`, writes parser errors to stderr with exit 1, and otherwise writes the result to stdout with the result code. The alias differs only in the error label `goalplan (deprecated, use 'loop')`; both kinds execute the same parser and runner. `plugins/codexclaw/bin/cxc.mjs:34-66` and `bin/codexclaw.mjs:511-515` route both top-level verbs to the pabcd-state component. No new router is needed.

The current parser is `parseGoalplanCliArgs` at `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:128-194`. It recognizes the global branches at lines 144-190 and returns the accumulated object at line 193 without an unknown-token branch. The current runner dispatches `init` at `:619-666`, the `ready` canonical-session guard at `:668-676`, `steer` at `:678`, the add operations at `:680`, lifecycle operations at `:682-684`, and read-only `show`/`ready`/`validate` after slug resolution at `:686-729`. The existing help table is `renderGoalplanHelp` at `:576-614`.

### Exact per-verb flag contract

The parser will define this table beside `parseGoalplanCliArgs`. A flag in the **allowed** column may be repeated only where the table says `repeat`; every other flag is singleton. All value flags require the next argv token to exist and not begin with `--`. `--surface=<value>` remains the one supported equals form. `--json` is boolean and takes no value. `--cwd` is accepted on every executable verb so a caller can select the project root; it is not persisted as plan data.

| Verb | Allowed flags and cardinality | Rejected or semantic conditions |
|---|---|---|
| `init` | `--objective` (singleton), `--session` (singleton), `--criterion` (repeat), `--schema-version` (singleton), `--cwd` (singleton) | `--surface` is refused before dispatch with the existing “not applied at init” guidance; all other flags are unknown. `--objective` remains required by the runner. |
| `show` | `--slug` (singleton), `--objective` (singleton), `--session` (singleton), `--cwd` (singleton) | The runner still requires one slug source. `--session` resolves the bound slug through `resolveSlug`; it does not mutate state. |
| `validate` | `--slug` (singleton), `--objective` (singleton), `--session` (singleton), `--cwd` (singleton) | The runner still requires one slug source. `--session` remains the source-binding context used by validation. |
| `steer` | `--session` (singleton), `--batch-json` (singleton), `--cwd` (singleton) | `--slug`, `--surface`, lifecycle flags, and `--json` are rejected. The runner still requires a canonical session and a batch. |
| `add-criterion` | `--session` (singleton), `--criterion` (singleton), `--surface` or `--surface=<value>` (singleton), `--cwd` (singleton) | Only `logic|web|tui|desktop` are accepted by the existing `SURFACES` check. `--presented` is deliberately not allowed; wp5 adds it. |
| `add-work-phase` | `--session` (singleton), `--id` (singleton), `--title` (singleton), `--depends-on` (repeat), `--cwd` (singleton) | `--depends-on` remains one id per occurrence; commas remain part of one id. Existing blank and duplicate dependency rejection remains. |
| `ready` | `--slug` (singleton), `--objective` (singleton), `--session` (singleton), `--json` (singleton boolean), `--cwd` (singleton) | No write flags or `--surface`. The existing canonical-session guard runs before plan lookup. |
| `add-task` | `--session` (singleton), `--work-phase` (singleton), `--id` (singleton), `--title` (singleton), `--depends-on` (repeat), `--cwd` (singleton) | No `--surface` or `--json`; lifecycle validation remains in `runLifecycle`. |
| `complete-task` | `--session` (singleton), `--work-phase` (singleton), `--id` (singleton), `--outcome` (singleton), `--cwd` (singleton) | No `--depends-on`, `--surface`, or `--json`; non-empty outcome validation remains in `runLifecycle`. |
| `meet-criterion` | `--session` (singleton), `--id` (singleton), `--evidence` (singleton), `--cwd` (singleton) | No `--surface`, `--criterion`, or `--json`; non-empty evidence validation remains in `runLifecycle`. |
| `help` / `--help` / `-h` | No trailing flags; these tokens return the existing help object. | A trailing flag or positional token is a parse error and writes nothing. The top-level `cxc loop --help` path remains supported. |

The `init --surface` row is an explicit compatibility decision: the parser recognizes that spelling only to return the existing explanatory refusal before any write, rather than allowing it to become an ignored token. It is not an allowed init flag and must not be included in the positive allowed set. The canonical `--surface` producer remains `add-criterion`.

### File change map

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

Current anchors: `GoalplanCliParseError` at `:110-112`; `VERBS` at `:114-125`; `parseGoalplanCliArgs` at `:128-194`; `renderGoalplanHelp` at `:576-614`. `SURFACES` and `runAddOp` at `:305-371` remain the consumer for the existing surface value. `runGoalplanCli` at `:617-729` remains the write and read dispatcher.

Add a typed per-verb rule map immediately after `VERBS` and a small parser error helper. The map is the single source of truth for the parser and the help text, with these conceptual entries (the implementation may use a readonly object or readonly sets, but must preserve the exact table above):

```ts
type GoalplanFlag =
  | "--objective" | "--slug" | "--criterion" | "--cwd" | "--session"
  | "--batch-json" | "--surface" | "--id" | "--title" | "--work-phase"
  | "--outcome" | "--schema-version" | "--evidence" | "--json" | "--depends-on";

const ALLOWED_FLAGS: Readonly<Record<GoalplanVerb, ReadonlySet<GoalplanFlag>>> = {
  init: new Set(["--objective", "--session", "--criterion", "--schema-version", "--cwd"]),
  show: new Set(["--slug", "--objective", "--session", "--cwd"]),
  validate: new Set(["--slug", "--objective", "--session", "--cwd"]),
  steer: new Set(["--session", "--batch-json", "--cwd"]),
  "add-criterion": new Set(["--session", "--criterion", "--surface", "--cwd"]),
  "add-work-phase": new Set(["--session", "--id", "--title", "--depends-on", "--cwd"]),
  ready: new Set(["--slug", "--objective", "--session", "--json", "--cwd"]),
  "add-task": new Set(["--session", "--work-phase", "--id", "--title", "--depends-on", "--cwd"]),
  "complete-task": new Set(["--session", "--work-phase", "--id", "--outcome", "--cwd"]),
  "meet-criterion": new Set(["--session", "--id", "--evidence", "--cwd"]),
  help: new Set(),
};

const REPEATABLE_FLAGS: ReadonlySet<GoalplanFlag> = new Set([
  "--criterion", "--depends-on",
]);
```

Replace the current `parseGoalplanCliArgs` body at `:128-194` with a strict scan that performs the following in order:

```ts
export function parseGoalplanCliArgs(argv: string[], cwd: string): GoalplanCliArgs | GoalplanCliParseError {
  const rawVerb = argv[0] ?? "";
  const verb = rawVerb.toLowerCase();
  if (verb === "help" || verb === "--help" || verb === "-h") {
    if (argv.length > 1) return { error: "help: unexpected argument '" + argv[1] + "'" };
    return { verb: "help", cwd, criteria: [] };
  }
  if (!VERBS.has(verb)) {
    return {
      error: `unknown loop verb '${argv[0] ?? ""}' (expected init|show|validate|steer|add-criterion|add-work-phase|ready|add-task|complete-task|meet-criterion); run cxc loop --help`,
    };
  }

  const selected = verb as GoalplanVerb;
  const out: GoalplanCliArgs = { verb: selected, cwd, criteria: [], dependsOn: [] };
  const seen = new Set<GoalplanFlag>();
  const reject = (message: string): GoalplanCliParseError => ({ error: `${selected}: ${message}` });

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) return reject(`unexpected positional argument '${token}'`);

    const isSurfaceEquals = token.startsWith("--surface=");
    const flag = (isSurfaceEquals ? "--surface" : token) as GoalplanFlag;
    if (!ALLOWED_FLAGS[selected].has(flag)) {
      if (selected === "init" && (token === "--surface" || isSurfaceEquals)) {
        return reject("--surface is not applied at init; use add-criterion --surface <logic|web|tui|desktop>. Nothing was written.");
      }
      return reject(`unknown flag '${token}'`);
    }
    if (seen.has(flag) && !REPEATABLE_FLAGS.has(flag)) return reject(`${flag} may be provided only once`);
    seen.add(flag);

    if (flag === "--json") {
      out.json = true;
      continue;
    }
    if (isSurfaceEquals) {
      const value = token.slice("--surface=".length);
      if (value.length === 0) return reject("--surface needs a value (logic|web|tui|desktop)");
      out.surfaceGiven = true;
      out.surface = value;
      continue;
    }

    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) return reject(`${flag} requires a value`);
    switch (flag) {
      case "--objective": out.objective = value; break;
      case "--slug": out.slug = value; break;
      case "--criterion": out.criteria.push(value); break;
      case "--cwd": out.cwd = value; break;
      case "--session": out.session = value; break;
      case "--batch-json": out.batchJson = value; break;
      case "--surface": out.surfaceGiven = true; out.surface = value; break;
      case "--id": out.id = value; break;
      case "--title": out.title = value; break;
      case "--work-phase": out.workPhaseId = value; break;
      case "--outcome": out.outcome = value; break;
      case "--schema-version": {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return reject("--schema-version requires a finite number");
        out.schemaVersion = parsed;
        break;
      }
      case "--evidence": out.evidence = value; break;
      case "--depends-on": {
        const dependency = value.trim();
        if (dependency.length === 0) return reject("--depends-on requires one non-empty prerequisite id");
        if (out.dependsOn!.includes(dependency)) return reject(`--depends-on must not repeat prerequisite id '${dependency}'`);
        out.dependsOn!.push(dependency);
        break;
      }
      default: return reject(`unknown flag '${flag}'`);
    }
  }
  return out;
}
```

The final implementation must retain the current `--surface` value validation in `runAddOp` (`:330-336`) and the current lifecycle requirements. The parser-level `init --surface` diagnostic may be factored through a helper, but it must be emitted before `readGoalplan`, `writeGoalplan`, `appendGoalplanLedger`, `writeState`, `applySteeringBatch`, or lifecycle mutation is called. Keep `surfaceGiven` only if the direct runner compatibility guard at `:624-628` remains; if the strict parser makes that guard unreachable from the public path, remove the dead field and update the associated comments and tests in the same change.

Update `renderGoalplanHelp` at `:581-594` to show the exact per-verb positive grammar, including `--session` on `show` and `validate`, `--json` only on `ready`, and the repeatable dependency syntax. Add a note that unknown flags, positionals, missing values, and flags on the wrong verb are rejected before dispatch. Keep the existing deprecated alias note and the existing `--presented` omission; do not advertise wp5 behavior early.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

Current router: `:161-174`. Keep the `kind === "loop" || kind === "goalplan"` branch and the shared parser/runner import. Update only the adjacent comment from “init/show/validate” to “the full goalplan verb set” so the source comment does not become stale. Preserve the alias label and exit behavior. If the implementation returns a structured `verb` on parse errors to format `loop <verb>: ...`, update the error write at `:167-169` and its tests together; otherwise the parser error text must still identify the selected verb. No behavior may diverge between `loop` and `goalplan`.

#### MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts`

Current public parser helper is at `:66-70`; dependency parser assertions are `:81-97`; help and existing surface coverage are `:382-457`. Add table-driven tests in this file:

1. `per-verb flag table accepts every documented combination` parses one positive argv row for each verb in the table and asserts the resulting property values, including `show --session`, `validate --session --slug`, `ready --json`, `--surface=desktop`, repeated init criteria, and repeated phase/task dependencies.
2. `unknown flags are rejected for the selected verb before dispatch` tries `--surface` on `steer`, `add-work-phase`, `add-task`, `complete-task`, and `meet-criterion`, `--json` on `show`, and `--presented native` on `add-criterion`; it asserts a parse error naming the verb and no plan or ledger mutation for each mutating case.
3. `positionals, missing values, and singleton repeats are rejected before writes` covers a stray token, a terminal value flag, a value flag followed by another flag, `--surface=`, duplicate `--session`, and nonnumeric `--schema-version`; it asserts the error and byte-identical `goalplan.json`/`ledger.jsonl` where a plan exists.
4. `init surface refusal remains explicit and writes nothing` moves the existing `:415-457` init cases to the strict parser boundary if needed, preserving the explanatory refusal text and the assertion that `.codexclaw/goalplans` is absent.
5. `help exposes the same per-verb flag contract as the parser` extends the existing help test at `:382-413` with `show --session`, `validate --session`, the lifecycle rows, the rejection rule, and the explicit absence of `--presented`.

The existing tests for repeated dependencies, surface validation, lifecycle evidence, and lock-safe no-write behavior remain and must be adjusted only where parser errors move earlier. No fixture schema or serialized goalplan field changes are planned. The new tests are source tests; they must not hand-edit generated dist.

#### MODIFY `plugins/codexclaw/skills/loop/references/durable-goalplan.md`

Current CLI list: `:77-99`. Replace the abbreviated list with the exact positive grammar from the table, adding `--cwd` to every row, `--session` to `show` and `validate`, and the mutating verbs already implemented in `goalplan-cli.ts`. Add one sentence after the list: “The parser rejects unknown flags, stray positionals, missing values, and flags belonging to another verb before dispatch; `--presented` is reserved for the follow-up wp5 change.” Keep lines `:60-71` describing `surface`, `capturedEvidence`, and the existing `init` refusal, because those statements remain true.

#### MODIFY `docs-site/src/content/docs/reference/commands.md`

Current live command summary at `:31-32` says loop is only “Init, show, or validate”; current sub-grammar is `:131-140` and lists only three rows. Replace the summary with “Manage the project-local durable goalplan: init, show, validate, steer, ready, add-criterion, add-work-phase, add-task, complete-task, and meet-criterion.” Replace the three-row code block with the exact rows from the per-verb table and add the deprecated alias sentence stating that `cxc goalplan <verb>` dispatches to the same component and parser. This is a docs-site reference correction, not a new command.

#### MODIFY `README.md`, `README.ko.md`, and `README.zh.md`

Each current CLI snippet has the same English line (`README.md:239`, `README.ko.md:229`, `README.zh.md:228`):

```text
cxc loop init|show|validate               # durable goalplan management
```

Replace it in all three files with:

```text
cxc loop <verb>                            # durable goalplan: init/show/validate/steer/ready and lifecycle verbs
```

Keep the detailed flag grammar in the loop reference and docs-site command reference so the translated README snippets do not become three separate flag tables.

#### MODIFY `plugins/codexclaw/bin/cxc.mjs` and `bin/codexclaw.mjs`

These are user-facing help surfaces, not alternate routers. Update the top-level help lines at `plugins/codexclaw/bin/cxc.mjs:78` and `bin/codexclaw.mjs:280-281` from `loop init|show|validate` / `goalplan init|show|validate` to `loop <verb>` / `goalplan <verb>`, and update the source comments at `bin/codexclaw.mjs:15-16` and `:514` from the three-verb list to “full project-local goalplan verb set.” Leave `COMMAND_TABLE` and delegation unchanged. The payload parity test remains the proof that both dispatchers retain the same command routing.

#### MODIFY generated dist through the build only

`plugins/codexclaw/components/pabcd-state/dist/goalplan-cli.js` and the component `dist/cli.js` are generated outputs. Do not hand-edit them. `npm run build` must regenerate them after the source change, and the dist freshness gate must observe the generated result. The plan contains no direct dist patch.

#### DELETE

None.

### PLAN-FIELD-CHAIN-01

No new persisted goalplan field, enum, or user flag is introduced. Existing fields continue on their current paths:

| Existing value | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `surface` (`logic|web|tui|desktop`) | `add-criterion --surface` parses in `parseGoalplanCliArgs` and is assembled in `runAddOp` (`goalplan-cli.ts:325-337`) | existing steering/goalplan write path in `steering.ts` and `goalplan.ts` | existing `readGoalplan` schema path | `runAddOp`, `validateGoalplan`, desktop acceptance guidance, and goal-gate consumers; no change in this phase |
| `json` boolean | `ready --json` parses at `goalplan-cli.ts:178` | N/A; output-only | N/A | `runReady` at `:396-415` chooses JSON output; no plan write |
| repeated `dependsOn` array | parser at `goalplan-cli.ts:179-190` | existing goalplan write | existing goalplan read | `add-work-phase`, `add-task`, dependency integrity, ready selection, and lifecycle gates; no schema change |
| parser error `verb` (if added to `GoalplanCliParseError`) | strict parser creates it for diagnostics | N/A; not serialized | N/A | `components/pabcd-state/src/cli.ts` formats stderr only |

The new per-verb rule map and `REPEATABLE_FLAGS` are in-memory parser metadata. They have no creation-to-storage chain. `--presented` is explicitly `N/A + deferred to wp5`; no parser, schema, serialization, deserialization, or consumer work for it belongs here.

### C-ACTIVATION-GROUNDING-01

Every new conditional path must be exercised or named as follows:

| Conditional path | Activation scenario C will use | Observable effect |
|---|---|---|
| Unknown flag | `cxc loop show --slug x --surface desktop` and `cxc loop steer --session s --json` | Parser returns an error naming `show` or `steer`; dispatcher exits 1 before plan lookup or write. |
| Stray positional | `cxc loop ready plan-name` | Parser returns `ready: unexpected positional argument 'plan-name'`; no JSON or text readiness output is produced. |
| Missing value at end | `cxc loop init --objective` | Parser returns `init: --objective requires a value`; no goalplan directory is created. |
| Flag used as a value | `cxc loop add-criterion --session s --criterion x --surface --cwd /tmp` | Parser reports the missing surface value rather than consuming `--cwd`; no criterion write occurs. |
| Empty equals value | `cxc loop add-criterion --session s --criterion x --surface=` | Parser reports the surface value error; no write occurs. |
| Wrong-verb surface | `cxc loop add-work-phase --session s --id p --title t --surface desktop` | Parser rejects `--surface` before `runAddOp`; the existing plan and ledger bytes remain unchanged. |
| Deprecated init surface | `cxc goalplan init --objective x --surface desktop` | The shared parser returns the init refusal; the alias does not bypass the canonical rule and no plan is written. |
| Singleton repeat | `cxc loop validate --slug x --session s --session t` | Parser rejects the second `--session`; it does not silently choose the last value. |
| Invalid numeric value | `cxc loop init --objective x --schema-version nope` | Parser rejects the non-finite schema version before `buildGoalplan` or any write. |
| Valid repeatable flag | `cxc loop add-work-phase --session s --id p --title t --depends-on a --depends-on b` | Parser preserves `dependsOn: ["a", "b"]`; existing dependency validation decides whether the operation can commit. |
| `ready --json` | `cxc loop ready --session s --json` | Existing `runReady` emits JSON; `--json` on another verb is rejected before dispatch. |
| Alias dispatch | Invoke the same argv through `cxc loop ...` and `cxc goalplan ...` after build | Both reach the same `goalplan-cli` runner; only the deprecated alias label differs in router error text. |

### PLAN-BYPASS-NAMED-01

| Check | Tier | Executing surface | Known bypass | Residual risk | Wording |
|---|---|---|---|---|---|
| Per-verb allowed flag validation | E8 for the regression tests; runtime parser is an ordinary CLI boundary outside the hook ladder | `parseGoalplanCliArgs` in `pabcd-state`, reached by `cxc loop` and `cxc goalplan` | Importing `runGoalplanCli` directly with a hand-built args object bypasses argv parsing | Internal callers could construct invalid args; public CLI callers are covered, and runner-level required-field checks remain | Keep “the CLI rejects”; do not call this hook-enforced. |
| Unknown/positional/missing-value rejection | E8 | Same parser before `runGoalplanCli` | Direct module calls or stale generated dist | A caller using stale dist can retain old behavior until `npm run build`; dist freshness and build are the release boundary | Keep “rejected before dispatch” for the built CLI. |
| No-write behavior on parser rejection | E8 | Test fixtures snapshot `goalplan.json` and `ledger.jsonl`; mutation verbs are parsed before runner entry | A separate process or hand edit can write files outside the command | The test proves this command path only; it does not protect hand edits, which are documented workflow | Keep “this command writes nothing,” not “the plan cannot change.” |
| `--surface` restricted to `add-criterion` | E8 | Parser table plus existing `SURFACES` runtime validation | A hand-edited plan can carry a surface; wp5 may later add another flag | Schema readers and existing validation still govern stored values; wp5 owns `--presented` expansion | Keep “only this CLI verb accepts `--surface`”; do not generalize to all plan mutation. |

`structure/40_enforcement_methods.md:103-107` classifies tests and CI scripts as E8 and says they catch drift after the fact. The phase must use that wording. The parser is a runtime command check, but it is not E1/E2 hook enforcement.

### In-repo caller audit

The current tree was searched for every goalplan flag and verb. Supported combinations are present in:

- `plugins/codexclaw/skills/loop/references/durable-goalplan.md:79-99` for the documented public grammar.
- `plugins/codexclaw/skills/pabcd/references/phase-control.md:135-140` for `validate --session <id> --slug <slug>`.
- `plugins/codexclaw/skills/dev-devops/references/native-desktop-acceptance.md:25-32` for session-bound `add-criterion --surface desktop`.
- `plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts:590-607,626-635` for init/show/validate and session binding.
- `plugins/codexclaw/components/pabcd-state/test/split-cwd-cycle.test.ts:75-83` for init and add-work-phase with `--session`.
- `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts:81-97,102-110,382-457` for dependencies, ready JSON, help, and surface.
- `plugins/codexclaw/components/pabcd-state/test/steering.test.ts:260-266,274-319` for steer flags.

The current search found no in-repo caller using `--presented`, no caller passing `--surface` to a verb other than init’s intentional refusal test and add-criterion, and no caller using `--json` outside ready. The docs-site command reference and the three README snippets are stale because they list only init/show/validate; they are included in the change map above. Historical devlogs are evidence of prior commands, not the current contract and are not modified by this phase.

### Verifier commands: PLAN-VERIFIER-REAL-01

Commands below were run fresh on the current tree before this document was written. The first four test commands read the source test files through `plugins/codexclaw/scripts/test.mjs`, which creates a scratch Codex home and invokes Node’s test runner; they do not read the target document. The build reads TypeScript component sources and regenerates dist. The gate reads repository status/contract/inventory inputs. The `rg` command reads all current loop/goalplan documentation listed in its arguments.

| Command | Current-tree result | How it reads the target/change surface |
|---|---:|---|
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts'` | exit 0; 19 pass, 0 fail | Reads the existing public-surface parser/runner tests; new strict-table tests do not exist yet. |
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/pabcd-state/test/help-verbs.test.ts'` | exit 0; 30 pass, 0 fail | Reads help dispatch tests; it does not yet assert the new per-verb table. |
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts'` | exit 0; 41 pass, 0 fail | Reads core goalplan/parser/runner tests, including current init/show/validate behavior. |
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/pabcd-state/test/steering.test.ts'` | exit 0; 27 pass, 0 fail | Reads steer and add-operation callers and existing mutation behavior. |
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/payload-bin.test.mjs'` | exit 0; 3 pass, 0 fail | Reads root/payload dispatcher parity; it does not assert individual goalplan flags. |
| `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/dist-freshness.test.mjs'` | exit 0; 1 pass, 0 fail | Reads every generated component file and compares dist against source; it proves the current generated tree is fresh. |
| `npm run build` | exit 0; 185 files compiled | Reads component sources and regenerates generated dist; implementation must not hand-edit dist. |
| `npm run gate` | exit 0; no drift/count/inventory failures | Reads repository contract and inventory checks; it is the E8 repository gate. |
| `rg -n -C 2 "cxc loop (init|show|validate)|cxc goalplan|loop / goalplan sub-grammar" plugins/codexclaw/skills docs-site README* --glob '*.md' --glob '*.mdx' --glob 'README*'` | exit 0; returned the stale docs locations recorded above | Reads skill, docs-site, and README references to prove the sync scope. |

After implementation, run these same commands again. The focused public-surface command is **NOT RUN for the new tests** until the code and test additions exist; its baseline run above is not evidence for those new cases. The expected new test command is the same public-surface command, with the added test names reported individually. Also run the focused payload-bin test after help text changes, `node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/dist-freshness.test.mjs'`, `npm run build`, and `npm run gate`. A failed command blocks Done; do not convert a skipped or absent test into a pass claim.

### Docs/SoT sync

The source-of-truth changes are limited to the existing loop reference, command reference, README command summaries, top-level CLI help, and the structure index’s command map. Exact planned replacements:

| Path and current lines | Before | After |
|---|---|---|
| `plugins/codexclaw/skills/loop/references/durable-goalplan.md:79-96` | Three early rows plus later mutating rows, with no `--cwd` on most rows and no strict rejection rule | The exact ten-verb grammar from the table, `--cwd` on each row, `--session` on show/validate, explicit repeat markers, and “unknown flags, stray positionals, missing values, and wrong-verb flags are rejected before dispatch; `--presented` is reserved for wp5.” |
| `docs-site/src/content/docs/reference/commands.md:31-32` | `Init, show, or validate the project-local loop/goalplan substrate.` | `Manage the project-local durable goalplan: init, show, validate, steer, ready, add-criterion, add-work-phase, add-task, complete-task, and meet-criterion.` |
| `docs-site/src/content/docs/reference/commands.md:134-140` | Three code rows and a generic alias sentence | Ten exact code rows from the table, followed by the sentence that `cxc goalplan <verb>` dispatches to the same parser/runner as the deprecated alias. |
| `README.md:239`, `README.ko.md:229`, `README.zh.md:228` | `cxc loop init|show|validate               # durable goalplan management` | `cxc loop <verb>                            # durable goalplan: init/show/validate/steer/ready and lifecycle verbs` |
| `plugins/codexclaw/bin/cxc.mjs:78` | `loop init|show|validate        manage the project-local goalplan substrate` | `loop <verb>                    manage the project-local goalplan; run loop --help for the exact flag table` |
| `bin/codexclaw.mjs:280-281` | `loop init|show|validate` and `goalplan init|show|validate` | `loop <verb>` and `goalplan <verb>` with the same full-verb/deprecated-alias wording. |
| `structure/INDEX.md:271-272` | `initializes, shows, or validates the project-local goalplan substrate` / `deprecated alias for cxc loop` | `dispatches the full project-local goalplan verb set` / `deprecated alias dispatching the same full verb set as cxc loop`. |

`structure/INDEX.md:28` already points to `structure/40_enforcement_methods.md`; no index topology change is required. `structure/40_enforcement_methods.md:103-107` requires no text change because E8 already covers the new test gate. No other structure or skill index line is changed. `plugins/codexclaw/skills/goalplan/SKILL.md:14-15` remains accurate and is not modified.

### Scope and risks

**IN:** strict per-verb argv validation; clear pre-dispatch errors; existing valid flag combinations; exact help output; public-surface tests for acceptance/rejection/no-write behavior; router/help/reference synchronization; generated dist refresh through `npm run build`.

**OUT:** wp5’s `--presented` criterion attribute; schema or serialized goalplan changes; host goal database writes; router redesign; automatic migration of hand-edited plans; changes to historical devlogs; changes to `goalplan.ts` validation semantics; changes to `cxc orchestrate` flags.

Risks are limited to rejecting an undocumented combination that previously happened to be ignored, changing parser error wording, and stale generated dist if the build is skipped. The in-repo caller audit above is the compatibility check. Direct imports that bypass argv validation remain possible, and hand edits to `goalplan.json` remain documented workflow; neither is claimed to be blocked. The `init --surface` compatibility diagnostic is the one deliberate parser special case and must remain a rejection with no write.

### Open decisions

No unresolved implementation decision remains from D4.1. The only deferred decision is outside this phase: the exact `--presented` value set and persistence path belong to wp5, which must extend the `add-criterion` allowed set after this phase lands. Do not invent or preview that flag here.

## wp4 P revalidation (2026-09-24)

Continuity: wp3 D (2242de88) closed the visualizer work and named wp4 from this document. The direction is unchanged.

Stale check: `git diff --stat d66dfcf2..HEAD` over plugins/codexclaw/components, skills/loop and docs-site is empty, so every anchor in this document still holds. Builder write scope: components/pabcd-state/src/goalplan-cli.ts, the regenerated components/pabcd-state/dist (via `npm run build` only), components/pabcd-state/test/goalplan-public-surface.test.ts plus any test file this document names, skills/loop/references/durable-goalplan.md, and docs-site/src/content/docs/reference/commands.md:131-140 (the flag grammar that 050 assigned; moved here because it describes this phase's behavior). wp5 later adds `--presented` to add-criterion's allowed set.

Scope amendment after architect reflection: the builder scope also covers every file this document already maps: components/pabcd-state/src/cli.ts, README.md, README.ko.md, README.zh.md (the CLI snippet line only), plugins/codexclaw/bin/cxc.mjs, bin/codexclaw.mjs (help lines and comments only), structure/INDEX.md:271-272, and docs-site/src/content/docs/reference/commands.md:31-32 as well as :131-140.

wp4 A round 1 fold: test 3 also covers an extra token after each help form (`help extra`, `--help extra`, `-h extra`, and `show --help extra` if the parser treats per-verb help the same way), asserting a parse error and no goalplan or ledger write.
