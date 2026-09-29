# 030 — wp5: goalplan decision options (#262 follow-up)

A recorded goalplan decision can now carry the options that were offered, and when it does, its recommendation must be one of them. This closes the part of #262 that #271 left out: "`recommended` must be one of `options`; otherwise the verb refuses." Answers stay free text, because the host's question tool always adds a free-form choice. `withdrawn` remains out of scope, so #262 stays open.

## Phase contract

- Work phase: `wp5` (goalplan id; runs third, before delivery `wp4`), issue [#262](https://github.com/lidge-jun/codexclaw/issues/262). Class C2 with C4 care for the reviver (a malformed optional field must fail closed, as every existing field does). Design decisions D22-D28 in `002_architect_consultation.md`.
- No schema-version bump: `options` is optional and absent on old plans, which round-trip unchanged (`durable-goalplan.md:60`).
- `durable-goalplan.md` is also edited by 020 (three lines added at `:40`); this phase's P re-anchors the `:60` and `:98` edits on the `dev` that contains 020.
- Answers stay free text (architect D25): an answer-in-options rule would reject the host's free-form "Other" reply and strand linked phases. Criterion c-10 was corrected at P to match; see 002, "Criterion c-10 correction".

## Field chain (PLAN-FIELD-CHAIN-01) for `GoalplanDecision.options`

| Stage | Path |
|---|---|
| Creation | CLI `--option` (`goalplan-cli.ts` parser) -> `runDecision` -> `askGoalplanDecision` input (`goalplan.ts:1225-1256`) |
| Serialization | `writeGoalplan` JSON.stringify of the plan object; no custom serializer (field order follows the object literal in `askGoalplanDecision`) |
| Deserialization | `reviveDecisions` (`goalplan.ts:526-550`), also reached by `firstInvalidField` (`:857`, the `decisions` check at `:893`) |
| Consumers | `ready --json` open-decision projection (`goalplan-cli.ts:465-466`), `show` render (`:688-692`), `decideGoalplanDecision` (`goalplan.ts:1259-1275`: copies the decision with spread, so `options` survives; no membership check per D25), steering/other writers spread the plan and keep `decisions` untouched. Text `ready` (`:499-504`) prints id and question only; unchanged |

## File change map

### 1. MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

(a) Interface (`:141-149`):

```diff
 export interface GoalplanDecision {
   id: string;
   question: string;
   recommendation?: string;
+  /** Options offered with the question; when present, recommendation is one of them. */
+  options?: string[];
   status: "open" | "decided";
```

(b) Before `reviveDecisions` (`:526`) add:

```ts
/** Absent stays absent; a present list must be non-empty, non-blank and distinct after trim. */
function reviveDecisionOptions(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) return "invalid";
  if (value.some((option) => typeof option !== "string" || !option.trim())) return "invalid";
  const trimmed = (value as string[]).map((option) => option.trim());
  if (new Set(trimmed).size !== trimmed.length) return "invalid";
  return [...(value as string[])];
}
```

(c) In `reviveDecisions`, after the shared field check (`:533-536`) and before `if (d.status === "open")`:

```diff
+    const options = reviveDecisionOptions(d.options);
+    if (options === "invalid") return "invalid";
+    if (options !== undefined && d.recommendation !== undefined
+      && !options.some((option) => option.trim() === (d.recommendation as string).trim())) return "invalid";
```

and in both `decisions.push` calls (`:539-540`, `:543-545`) append `...(options === undefined ? {} : { options })` after the recommendation spread. Exact stored strings are kept (trim is only for comparison), matching the existing reviver's rule.

(d) `askGoalplanDecision` (`:1225-1256`):

```diff
-  input: { id: string; question: string; recommendation?: string; workPhaseIds: string[]; askedAt: string },
+  input: { id: string; question: string; recommendation?: string; options?: string[]; workPhaseIds: string[]; askedAt: string },
 ...
   if (input.recommendation !== undefined && !recommendation) return { kind: "rejected", reason: "decision recommendation must not be empty" };
+  const options = input.options?.map((option) => option.trim());
+  if (options !== undefined) {
+    if (options.length === 0) return { kind: "rejected", reason: "decision options must not be empty" };
+    if (options.some((option) => !option)) return { kind: "rejected", reason: "decision options must be non-empty text" };
+    const repeated = options.find((option, index) => options.indexOf(option) !== index);
+    if (repeated !== undefined) return { kind: "rejected", reason: `duplicate decision option '${repeated}'` };
+    if (recommendation !== undefined && !options.includes(recommendation)) {
+      return { kind: "rejected", reason: "decision recommendation must be one of the options" };
+    }
+  }
 ...
   const decision: GoalplanDecision = { id, question, status: "open", askedAt: input.askedAt,
-    ...(recommendation === undefined ? {} : { recommendation }) };
+    ...(recommendation === undefined ? {} : { recommendation }),
+    ...(options === undefined ? {} : { options }) };
```

### 2. MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

(a) Args type near `:106-108`: add `options?: string[];` after `recommendation?: string;`.

(b) `GoalplanFlag` (`:140-144`): add `| "--option"`.

(c) `ask` rule (`:163`): add `"--option"` to `allowed` and `repeatable`; usage becomes `ask --session <id> --id <id> --question <text> [--recommendation <text>] [--option <text>]... [--work-phase <id>]... [--cwd <path>]`.

(d) Parser switch, after `case "--recommendation"` (`:239`); the default object at `:185` is NOT changed, so an `ask` without `--option` stores no `options` key (D26):

```ts
      case "--option": {
        const option = value.trim();
        if (!option) return reject("--option requires one non-empty value");
        const options = out.options ?? (out.options = []);
        if (options.includes(option)) return reject(`--option must not repeat '${option}'`);
        options.push(option);
        break;
      }
```

(e) `runDecision` (`:530-533`): pass `...(args.options === undefined ? {} : { options: args.options })` into `askGoalplanDecision`.

(f) `ready --json` (`:465-466`): project `options` additively:

```diff
-    .map(({ id, question, recommendation, askedAt }) => ({ id, question, ...(recommendation === undefined ? {} : { recommendation }), askedAt }));
+    .map(({ id, question, recommendation, options, askedAt }) => ({ id, question,
+      ...(recommendation === undefined ? {} : { recommendation }),
+      ...(options === undefined ? {} : { options }), askedAt }));
```

(g) `show` render (`:688-692`), after the question line:

```diff
     lines.push(`  - ${decision.id} [open] ${decision.question}`);
+    if (decision.options !== undefined) {
+      lines.push(`    options: ${decision.options.join(" | ")}${decision.recommendation === undefined ? "" : ` (recommended: ${decision.recommendation})`}`);
+    }
```

(h) Help Notes line after the `decide` note (`:724`): "Repeat --option once per offered option; the recommendation must be one of them, and the answer stays free text." (A round nit: moved into the file map from the revalidation.)

### 3. REGENERATE `pabcd-state/dist/goalplan.js`, `pabcd-state/dist/goalplan-cli.js` (`npm run build`; tracked, checked by `dist-freshness.test.mjs`).

### 4. MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts`

Beside the existing decision tests (`:684-764`), using the same temp-dir CLI helpers:

| Test | Trigger | Observable effect |
|---|---|---|
| `ask records options and ready/show expose them` | `ask --option A --option B --recommendation A` | goalplan decision has `options:["A","B"]`; `ready --json` open decision has `options`; `show` prints `options: A \| B (recommended: A)` |
| `ask rejects a recommendation outside the options without a write` | `--option A --option B --recommendation C` | exit 1, reason `must be one of the options`, plan bytes unchanged |
| `ask rejects blank and repeated options at parse time` | `--option " "`; `--option A --option A`; `--option` on `decide` | `parseGoalplanCliArgs` returns the parser error (the `cli()` helper asserts a successful parse), plan bytes unchanged |
| `ask without --option stores no options key` | plain ask | decision JSON has no `options` property |
| `decide keeps options and accepts a free-form answer` | ask with options, `decide --answer "something else"` | exit 0, decision decided, `options` unchanged |
| `reviver fails closed on malformed options` | hand-written plans with `options: {}`, `options: []`, `[" "]`, `["A","A "]`, `[1]`, and a recommendation outside valid options | each read fails naming the field: `field 'decisions' did not satisfy the schema` (`goalplan.ts:719` via `firstInvalidField`), before `validateGoalplan` runs |
| `askGoalplanDecision rejects empty, blank and repeated options (library)` | direct calls with `options: []`, `[" "]`, `["A"," A"]` (import `askGoalplanDecision` from `../src/goalplan.ts`) | `kind:"rejected"` with `must not be empty`, `non-empty text`, `duplicate decision option 'A'`; these branches are library-caller defenses the CLI parser never reaches, so they are driven directly |

### 5. MODIFY docs

- `plugins/codexclaw/skills/loop/references/durable-goalplan.md:60`: `{ id, question, recommendation?, options?, status: open|decided, answer?, askedAt, decidedAt? }` and one sentence: "When `options` is present it is a non-empty list of distinct entries and `recommendation` must be one of them; the answer stays free text because the host always offers a free-form reply."
- `durable-goalplan.md:101` (was `:98`): add `[--option <text>]...` to the `ask` synopsis.
- `plugins/codexclaw/skills/dev/references/async-questions.md:56`: add `[--option <text>]...` to the `ask` synopsis and "(the offered options, recommended first)".

## Verification (PLAN-VERIFIER-REAL-01)

| Command | Exit on `659de59b` | Reads the change target |
|---|---|---|
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts` | 0 | yes: drives the CLI and imports `../src/goalplan*.ts` |
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts plugins/codexclaw/components/pabcd-state/test/goalplan-integrity.test.ts plugins/codexclaw/components/pabcd-state/test/hook-continuation.test.ts` | 0 | yes: round-trip, integrity and Stop decision-wait paths read the reviver |
| `npm run build`, `dist-freshness.test.mjs`, `npm test` (after `npm ci`), `inventory.mjs --check`, `gate.mjs`, `platform-smoke.mjs` | 0 | as in 010 |
| docs prose | — | not observed by a command; human review |

Activation scenarios (C-ACTIVATION-GROUNDING-01): (2d)'s blank and repeated `--option` rejections and (1d)'s recommendation-membership rejection are driven through the CLI; (1d)'s empty, blank and duplicate checks are reached only by library callers and are driven by the direct `askGoalplanDecision` test; every (1c) reviver branch is driven by hand-written plan files; the free-form `decide` path proves D25.

## Enforcement naming (PLAN-BYPASS-NAMED-01)

Tier E2 (CLI and reviver validation). Executing surface: `cxc loop ask` and every goalplan read. Known bypass: a library caller writing through `writeGoalplan` directly skips `ask`'s checks, but the next read still fails closed on invalid options; nothing proves the question was actually sent with those options. Residual risk: an invalid hand edit makes the whole plan unreadable until repaired, as for every existing field. Wording: validation, not enforcement of what the host displayed. Final enforcement layer: none.

## wp5 P revalidation (2026-09-30)

Continuity (LOOP-CONTINUITY-01), quoting the wp3 D summary in 020: "#275 is addressed at the rule level and merged ... Next: wp5 builds 030." This P keeps that direction, and carries forward wp2's known timing flake (`spawn-attach-hook.test.ts:920`) and wp3's lesson that prose written into docs must be re-read in its final form at C.

Re-checked on `codex/issue-train-0930-wp5` from `origin/dev` `58a8a174`: `git diff --stat 659de59b..HEAD -- plugins/codexclaw/components/pabcd-state plugins/codexclaw/skills/dev/references/async-questions.md` is empty, so every `goalplan.ts` and `goalplan-cli.ts` anchor above holds. As planned, wp3's three-line edit moved the `durable-goalplan.md` anchors: the `decisions[]` schema line is now `:63` (was `:60`) and the `ask` synopsis is `:101` (was `:98`). `async-questions.md:56` is unchanged. `renderGoalplanHelp` (`goalplan-cli.ts:702`) prints the verb usage strings, so it picks up the new `ask` usage without a separate edit. No design decision changes, so no architect recheck.

Amendment (architect's optional D26 note): add one Notes line to `renderGoalplanHelp` after the `decide` note (`goalplan-cli.ts:724`): `"  Repeat --option once per offered option; the recommendation must be one of them, and the answer stays free text."` No test pins the help Notes text (checked with `rg 'Record the user' plugins/codexclaw/components/pabcd-state/test`).

## wp5 B record (2026-09-30)

Built at `355afde3` per the file map (1a-1d, 2a-2h, docs 5), plus seven tests (six planned rows and the library test). Red check: with `goalplan.ts` and `goalplan-cli.ts` restored from `58a8a174` in place (`git show 58a8a174:<path> > <path>`, then `git checkout HEAD -- <paths>`), the committed test file runs 41 tests, 35 pass, 6 fail: every new behavior test; the seventh ("ask without --option stores no options key") is a compatibility test that passes on both sources by design. New source: 41/41. Badges move to 3737.
