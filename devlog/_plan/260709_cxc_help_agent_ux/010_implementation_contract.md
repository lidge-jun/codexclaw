# 010 — Implementation Contract

## Baseline

- `bin/codexclaw.mjs` owns top-level dispatch. It currently defaults `cmd` to `help`, but `help` is not a real case; the default branch prints one terse command list and exits 0 for unknown commands.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts` owns terminal `cxc orchestrate`. Its parser validates `argv[0]` before reading flags, so `--help` is treated as an unknown verb.
- `plugins/codexclaw/components/pabcd-state/src/cli.ts` exits 1 on orchestrate parse errors before `runOrchestrateCli` can enrich the error.
- Existing tests cover top-level one-line usage and orchestrate status/reset/attestation safety, but not help paths or current-phase context.

## Necessity Gate

- Do nothing: rejected because the observed `cxc orchestrate --help` failure remains.
- Delete behavior: rejected because this is additive CLI recovery UX, not dead code.
- Configure: rejected because the behavior is hard-coded in CLI parsers.
- Reuse: partially accepted. Reuse the existing local owner files and the `subagent-config` `help|--help|-h` parse pattern; do not introduce a shared help framework in this pass.

## Diff-Level Plan

### MODIFY `bin/codexclaw.mjs`

Add local constants/functions:

```js
const TOP_LEVEL_COMMANDS = [...]
function renderTopLevelHelp() { ... }
function renderUnknownTopLevelCommand(cmd) { ... }
```

Change dispatcher:

```diff
-const cmd = process.argv[2] ?? "help";
+const cmd = process.argv[2] ?? "help";
 if (isMain) switch (cmd) {
+  case "help":
+  case "--help":
+  case "-h":
+    console.log(renderTopLevelHelp());
+    process.exit(0);
+    break;
 ...
   default:
-    console.log("codexclaw <enable|disable|...>");
+    console.error(renderUnknownTopLevelCommand(cmd));
+    process.exit(1);
 }
```

Acceptance:

- `node bin/codexclaw.mjs help|--help|-h` exits 0.
- Unknown top-level commands exit 1 and mention `cxc --help`.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

Extend result types:

```ts
export interface OrchestrateCliHelpArgs { help: true; cwd: string; }
export interface CliParseError { error: string; session?: string; cwd: string; }
```

Add helpers:

```ts
function hasHelpToken(argv: string[]): boolean;
function readFlagValue(argv: string[], name: string): string | undefined;
export function renderOrchestrateHelp(): string;
function renderPhaseContext(state: State, sessionId: string): string;
function resolveReadableExplicitSession(cwd: string, session?: string): { sessionId: string; state: State } | null;
export function renderOrchestrateParseError(error: CliParseError): string;
```

Parser changes:

```diff
+ if (argv[0] === "help" || hasHelpToken(argv)) return { help: true, cwd };
  const verbTok = (argv[0] ?? "").toLowerCase();
  const verb = VERBS[verbTok];
- if (!verb) return { error: `unknown orchestrate verb ...` };
+ if (!verb) return { error: `unknown orchestrate verb ...; run cxc orchestrate --help`, session: readFlagValue(argv, "--session"), cwd: readFlagValue(argv, "--cwd") ?? cwd };
```

Runtime changes:

- `runOrchestrateCli(helpArgs)` returns `{ code: 0, output: renderOrchestrateHelp() }`.
- Text `status` adds `session=<id>` while JSON status stays compatible.
- Refused transitions and malformed attest errors prefix `orchestrate <verb>: current=<phase> session=<id>; ...` after state is safely read.
- Reset output includes `current=<phase> -> IDLE`; no-op reset includes `current=IDLE`.
- Successful phase transitions include `current=<from> -> <to>` while preserving the old before/after words enough for existing tests.
- Unknown explicit session still refuses without creating a session.

Acceptance:

- Help performs no state IO.
- No implicit fallback is used for mutating verbs.
- Unknown verb with `--session s1` can print current phase if `s1` exists.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

Change orchestrate branch:

```diff
 const parsed = parseOrchestrateCliArgs(...);
 if ("error" in parsed) {
-  process.stderr.write(`orchestrate: ${parsed.error}\n`);
+  process.stderr.write(`${renderOrchestrateParseError(parsed)}\n`);
   process.exit(1);
 }
```

Import `renderOrchestrateParseError` from `orchestrate-cli.ts`.

### MODIFY `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts`

Add tests:

- parser recognizes help tokens.
- `runOrchestrateCli` help exits 0 and does not create `.codexclaw/sessions`, change existing session JSON, append `.codexclaw/ledger.jsonl`, or touch render-observation state.
- status text includes `session=s5 phase=C`.
- refused transition with explicit session includes `current=P`.
- reset text includes `current=<phase> -> IDLE` and no-op reset includes `current=IDLE`.
- malformed attest with explicit session includes `current=P` using `attest: null` plus an `attestError`.
- parse error renderer includes phase for `wat --session s1 --cwd <tmp>`.
- dist CLI help exits 0.
- dist CLI unknown verb with a seeded session exits 1 and reports the current phase.

### MODIFY `plugins/codexclaw/test/cli-usage.test.mjs`

Add tests:

- `help`, `--help`, `-h` render multi-section help.
- unknown top-level command exits 1 and points to `cxc --help`.
- `orchestrate --help` through top-level delegator exits 0 after build.

### MODIFY `structure/INDEX.md`

Update CLI surface notes:

- top-level help is explicit and agent-oriented.
- `cxc orchestrate` supports `--help|-h|help`.
- explicit-session orchestrate text output includes current phase context.

## Activation Scenarios

- Help branch: run `node bin/codexclaw.mjs --help` and `node plugins/codexclaw/components/pabcd-state/dist/cli.js orchestrate --help`.
- Unknown top-level branch: run `node bin/codexclaw.mjs nope` and observe exit 1 + `cxc --help`.
- Orchestrate unknown verb branch: run dist CLI against a seeded temp session with `wat --session binsess --cwd <tmp>` and observe current phase.
- Refused transition branch: call `runOrchestrateCli({ verb: "A", session: "s1", cwd, attest: null })` from phase `P` and observe current phase without mutation.
- Malformed attest branch: call `runOrchestrateCli({ verb: "A", session: "s1", cwd, attest: null, json: false, attestError: "..." })` from phase `P`.
- Dist parse-error branch: run `node plugins/codexclaw/components/pabcd-state/dist/cli.js orchestrate wat --session binsess --cwd <tmp>` after seeding `binsess` at phase `P`.

## Verification Commands

```bash
npm run build
node --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts plugins/codexclaw/test/cli-usage.test.mjs
npm test
node bin/codexclaw.mjs --help
node bin/codexclaw.mjs orchestrate --help
cxc orchestrate status --session 019f4757-93cd-7e91-979c-80f687a91fc1
cxc orchestrate A --session 019f4757-93cd-7e91-979c-80f687a91fc1
```
