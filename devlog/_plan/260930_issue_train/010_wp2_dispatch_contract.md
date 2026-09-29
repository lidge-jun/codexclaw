# 010 — wp2: dispatch contract verifier matching (#276) and optional verifier effects (#277)

A dispatch receipt now satisfies its packet only when every required verifier command has a matching successful result. An unrelated result is rejected, and an older receipt that reports one result for a packet with several commands reads as incomplete. Packets can also declare what each verifier writes, and a pure preflight tells the caller which verifiers need an isolated copy under a shared-read packet. Nothing executes a command, and no hook changes.

## Phase contract

- Work phase: `wp2` (goalplan), issues [#276](https://github.com/lidge-jun/codexclaw/issues/276) and [#277](https://github.com/lidge-jun/codexclaw/issues/277). Class C2: one module and its test file, no production consumer (`rg --no-ignore` finds only `test/dispatch-contract.test.ts:6-12`), public exported types change additively.
- Design decisions: D1-D16 in `002_architect_consultation.md`.
- Behavior change to disclose in CHANGELOG (040): a legacy single `verifierResult` whose command differs from the packet's only command, even cosmetically (`npm run test` vs `npm test`), no longer satisfies the packet; extra passing checks belong in `commandsRun`, not in `verifierResults`.

## Field chain (PLAN-FIELD-CHAIN-01)

| Field | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `DispatchReceipt.verifierResults` | N/A: receipts are JSON written by the dispatched agent or its caller; codexclaw has no builder or CLI for them (`rg --no-ignore` finds only the test) | N/A: plain JSON, no custom serializer | `validateReceipt` shape check (1f) | `receiptSatisfiesPacket` (1g); tests |
| `DispatchPacket.verifierEffects` | N/A: packets are hand-authored JSON; no builder | N/A: plain JSON | `validatePacket` (1e, via `validateVerifierEffects`) | `verifierPreflight` (1h); tests |
| return field `missing` | `receiptSatisfiesPacket` (1g) | N/A: in-memory return value | N/A | callers of `receiptSatisfiesPacket`; only the test today |

## File change map

Anchors checked against `codex/issue-train-0930` = `origin/dev` `659de59b` on 2026-09-30.

### 1. MODIFY `plugins/codexclaw/components/subagent-config/src/dispatch-contract.ts`

(a) After `DispatchStatus` (`:14`) add the two shared shapes (D1, D10):

```ts
/** One verifier command's result as reported by the subagent (#276). */
export interface VerifierResult {
  command: string;
  exitCode: number;
  output: string;
}

/**
 * Declared write effects of one verifier command (#277). A declaration is the
 * packet author's claim, not proof: codexclaw never runs the command and does
 * not check paths against a filesystem.
 */
export interface VerifierEffect {
  /** Must equal (after trim) one entry of `verifierCommands`. */
  command: string;
  /** Paths or globs the command may write; `[]` declares it read-only. */
  expectedWrites: string[];
  /** Run this verifier in an isolated copy even when the packet is shared-read. */
  runInIsolation?: boolean;
}
```

(b) In `DispatchPacket`, after `verifierCommands` (`:31-32`):

```diff
   /** Verifier commands the main agent will run to check the result. */
   verifierCommands: string[];
+  /** Optional write-effect declarations, at most one per verifier command (#277). */
+  verifierEffects?: VerifierEffect[];
```

(c) In `DispatchReceipt` (`:60-61`):

```diff
-  /** Verifier result from the subagent's perspective. */
-  verifierResult?: { command: string; exitCode: number; output: string };
+  /** Legacy single verifier result; still read, merged with `verifierResults`. */
+  verifierResult?: VerifierResult;
+  /** One result per packet verifier command (#276). Extra checks go in `commandsRun`. */
+  verifierResults?: VerifierResult[];
```

(d) Helpers, placed before `validatePacket` (`:66`):

```ts
function isVerifierResult(value: unknown): value is VerifierResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.command === "string" && Number.isInteger(v.exitCode) && typeof v.output === "string";
}

/** Distinct trimmed commands; exact string equality after trim, no other normalization (D3). */
function distinctCommands(commands: readonly string[]): string[] {
  return [...new Set(commands.map((command) => command.trim()))];
}

function validateVerifierEffects(value: unknown, commands: unknown): string[] {
  if (!Array.isArray(value)) return ["verifierEffects must be an array"];
  const required = new Set(Array.isArray(commands)
    ? commands.filter((command): command is string => typeof command === "string").map((command) => command.trim())
    : []);
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("verifierEffects entries must be objects");
      continue;
    }
    const effect = item as Record<string, unknown>;
    if (typeof effect.command !== "string" || !effect.command.trim()) {
      errors.push("verifierEffects command must be a non-empty string");
      continue;
    }
    const command = effect.command.trim();
    if (!required.has(command)) errors.push("verifierEffects command `" + command + "` is not in verifierCommands");
    if (seen.has(command)) errors.push("verifierEffects declares `" + command + "` more than once");
    seen.add(command);
    if (!Array.isArray(effect.expectedWrites)
      || effect.expectedWrites.some((path) => typeof path !== "string" || !path.trim())) {
      errors.push("verifierEffects expectedWrites for `" + command + "` must be an array of non-empty strings");
    }
    if (effect.runInIsolation !== undefined && typeof effect.runInIsolation !== "boolean") {
      errors.push("verifierEffects runInIsolation for `" + command + "` must be a boolean");
    }
  }
  return errors;
}
```

(e) `validatePacket`, after `:78` (D9, D11):

```diff
   if (!Array.isArray(p.verifierCommands)) errors.push("verifierCommands must be an array");
+  else if (p.verifierCommands.some((command) => typeof command !== "string" || !command.trim())) {
+    errors.push("verifierCommands entries must be non-empty strings");
+  }
+  if (p.verifierEffects !== undefined) errors.push(...validateVerifierEffects(p.verifierEffects, p.verifierCommands));
```

(f) `validateReceipt`, after `:108` (D8):

```diff
   if (!Array.isArray(r.unresolvedAssumptions)) errors.push("unresolvedAssumptions must be an array");
+  if (r.verifierResult !== undefined && !isVerifierResult(r.verifierResult)) {
+    errors.push("verifierResult must be {command: string, exitCode: integer, output: string}");
+  }
+  if (r.verifierResults !== undefined
+    && (!Array.isArray(r.verifierResults) || !r.verifierResults.every(isVerifierResult))) {
+    errors.push("verifierResults must be an array of {command: string, exitCode: integer, output: string}");
+  }
```

(g) Replace `receiptSatisfiesPacket` (`:112-131`) (D2-D7):

```ts
/**
 * Check that a receipt satisfies its packet's verifier requirements (#276).
 * Every distinct required command needs a matching result, every result must
 * exit 0, and a result for a command the packet did not require is rejected.
 */
export function receiptSatisfiesPacket(packet: DispatchPacket, receipt: DispatchReceipt): {
  satisfied: boolean;
  reasons: string[];
  /** Required verifier commands (trimmed) with no matching result. */
  missing: string[];
} {
  const reasons: string[] = [];
  if (receipt.packetId !== packet.id) {
    reasons.push("packetId mismatch: expected " + packet.id + " got " + receipt.packetId);
  }
  if (receipt.status !== "complete") {
    reasons.push("receipt status is " + receipt.status + ", not complete");
  }
  const required = distinctCommands(packet.verifierCommands);
  const reportedResults: unknown[] = [
    ...(Array.isArray(receipt.verifierResults) ? receipt.verifierResults : []),
    ...(receipt.verifierResult ? [receipt.verifierResult] : []),
  ];
  // Unvalidated input must not throw here; malformed entries fail the receipt.
  const results = reportedResults.filter(isVerifierResult);
  const nonArrayResults = receipt.verifierResults !== undefined && !Array.isArray(receipt.verifierResults);
  if (nonArrayResults || results.length !== reportedResults.length) {
    reasons.push("receipt has malformed verifier results (see validateReceipt)");
  }
  if (required.length > 0 && results.length === 0) {
    reasons.push("packet has verifier commands but receipt has no verifier result");
  }
  for (const result of results) {
    if (result.exitCode !== 0) {
      reasons.push("verifier exit code " + result.exitCode + " (expected 0) for `" + result.command.trim() + "`");
    }
  }
  const reported = new Set(results.map((result) => result.command.trim()));
  const missing = required.filter((command) => !reported.has(command));
  if (results.length > 0) {
    for (const command of missing) reasons.push("missing verifier result for `" + command + "`");
  }
  if (required.length > 1 && receipt.verifierResults === undefined && receipt.verifierResult) {
    reasons.push("receipt reports one legacy verifierResult; packet requires "
      + required.length + " verifier commands (incomplete)");
  }
  if (required.length > 0) {
    const requiredSet = new Set(required);
    for (const command of reported) {
      if (!requiredSet.has(command)) reasons.push("verifier result for unrelated command `" + command + "`");
    }
  }
  return { satisfied: reasons.length === 0, reasons, missing };
}
```

(h) Append the preflight (D12-D14):

```ts
/** One preflight row per distinct verifier command (#277). */
export interface VerifierPreflightEntry {
  command: string;
  declared: boolean;
  needsIsolation: boolean;
  reason: string;
}

/**
 * Pure preflight over declared verifier effects (#277). It never runs a command
 * or reads the filesystem; it only tells the caller which verifiers must not run
 * on a shared checkout without isolation or main's confirmation.
 */
export function verifierPreflight(packet: DispatchPacket): VerifierPreflightEntry[] {
  const effects = new Map((packet.verifierEffects ?? []).map((effect) => [effect.command.trim(), effect]));
  return distinctCommands(packet.verifierCommands).map((command) => {
    const effect = effects.get(command);
    const declared = effect !== undefined;
    if (packet.worktreePolicy === "isolated-write") {
      return { command, declared, needsIsolation: false, reason: "packet is isolated-write" };
    }
    if (!effect) {
      return { command, declared, needsIsolation: true,
        reason: "no declared write boundary on a shared-read packet; run it in an isolated copy or confirm with main" };
    }
    if (effect.runInIsolation === true) {
      return { command, declared, needsIsolation: true, reason: "declared runInIsolation" };
    }
    if (effect.expectedWrites.length > 0) {
      return { command, declared, needsIsolation: true,
        reason: "declares writes (" + effect.expectedWrites.join(", ") + ") on a shared-read packet" };
    }
    return { command, declared, needsIsolation: false, reason: "declared read-only (expectedWrites: [])" };
  });
}
```

### 2. REGENERATE `plugins/codexclaw/components/subagent-config/dist/dispatch-contract.js`

`npm run build` (`package.json` `"build": "node plugins/codexclaw/scripts/build.mjs"`). The file is tracked and `plugins/codexclaw/test/dist-freshness.test.mjs:28` compares it byte for byte with the compiled source.

### 3. MODIFY `plugins/codexclaw/components/subagent-config/test/dispatch-contract.test.ts`

Import `verifierPreflight` beside the existing imports (`:6-12`). Existing tests stay; `:94` additionally asserts `result.missing` deep-equals `[]`. New tests (each names the conditional path it drives):

| Test name | Trigger | Observable effect |
|---|---|---|
| `receiptSatisfiesPacket: #276 repro — unrelated single result for two required commands` | packet `["first-check","second-check"]`, receipt `verifierResult: {command:"unrelated-check",exitCode:0}` | `satisfied:false`; reasons include `unrelated command`, `incomplete`; `missing` = both |
| `receiptSatisfiesPacket: single mismatched command is rejected` | packet `["npm test"]`, result `npm run test` | `satisfied:false`, `missing:["npm test"]` |
| `receiptSatisfiesPacket: two required commands with one matching verifierResults entry` | `verifierResults:[{first-check,0}]` | `satisfied:false`, `missing:["second-check"]`, reason `missing verifier result` |
| `receiptSatisfiesPacket: legacy single matching result with two required commands is incomplete` | `verifierResult:{first-check,0}`, no `verifierResults` | reason includes `legacy verifierResult` and `incomplete` |
| `receiptSatisfiesPacket: verifierResults covering every command is satisfied` | both commands exit 0 | `satisfied:true`, `reasons:[]`, `missing:[]` |
| `receiptSatisfiesPacket: unrelated extra result fails even with full coverage` | both required plus `extra-check` exit 0 | `satisfied:false`, reason naming `extra-check` as unrelated |
| `receiptSatisfiesPacket: duplicate and padded packet commands match trimmed results` | packet `[" npm test ","npm test"]`, result `npm test` | `satisfied:true` |
| `receiptSatisfiesPacket: nonzero matching result in verifierResults fails` | second-check exit 2 | reason includes `exit code 2` |
| `validateReceipt: rejects malformed verifier results` | `verifierResult.exitCode:"0"`; `verifierResults:{}`; `verifierResults:[{command:1}]` | each returns the matching error |
| `validatePacket: rejects blank verifier command entries` | `verifierCommands:["npm test","  "]` | error `entries must be non-empty strings` |
| `validatePacket: verifierEffects shape` | unknown command; duplicate command; `expectedWrites:"x"`; `runInIsolation:"yes"`; valid `[{command:"npm test",expectedWrites:[]}]` | four errors, then `[]` |
| `validatePacket: verifierEffects container and entry guards` | `verifierEffects:{}`; `verifierEffects:[null]`; `verifierEffects:[{command:"  ",expectedWrites:[]}]` | errors `must be an array`, `entries must be objects`, `command must be a non-empty string` |
| `receiptSatisfiesPacket: malformed unvalidated result does not throw` | `verifierResults:[{command:1}]` and `verifierResults:{}`, each cast past the type | both return `satisfied:false` with the `malformed verifier results` reason (the second drives the non-array branch) |
| `verifierPreflight: shared-read flags undeclared and writing verifiers` | shared-read with undeclared, `[]`, writes, `runInIsolation` | `needsIsolation` true/false/true/true, `declared` false/true/true/true |
| `verifierPreflight: isolated-write accepts declared writes` | isolated-write with writes | `needsIsolation:false`, `declared:true` |

Fifteen new tests planned; C added six more (see "wp2 C record"). The README test badges and `inventory.json` move by the measured delta in this phase (`000_plan.md` file map: badges each phase).

### 4. MODIFY `plugins/codexclaw/skills/pabcd/references/delegation.md`

Insert after `:23` (`(DISPATCH-ECONOMY-01).`), before `### Optional worker progress checkpoint (#265)` (D15):

```markdown

**DISPATCH-VERIFIER-01 (DEFAULT).** When a packet names verifier commands, the
receipt reports one result per command; extra checks belong in the commands-run
list, not in the verifier results. A typed receipt satisfies its packet only when
every required command has a matching result with exit 0 and no result names a
command the packet did not require. Under a shared-read packet, declare each
verifier's writes (`expectedWrites: []` for read-only) or run it in an isolated
copy; an undeclared verifier goes back to main before it runs in a shared tree.
A declaration is the author's claim, not proof: codexclaw never executes it.
```

### 5. SoT sync `structure/INDEX.md:138-140` and `structure/20_pabcd_dispatch_doctrine.md`

- `structure/INDEX.md`: the `components/subagent-config` section (`:138-140`) is one prose paragraph; append the sentence "`src/dispatch-contract.ts` holds the typed DispatchPacket/DispatchReceipt contract (#17): verifier coverage for receipts (#276) and a pure verifier-effects preflight (#277); no runtime path calls it yet."
- `structure/20_pabcd_dispatch_doctrine.md`: after the DISPATCH-ECONOMY-01 bullet's last clause (`:253`, "from mechanics to economy."), before the `---` closing section 3 (`:255`), add a **DISPATCH-VERIFIER-01** bullet: E2 library contract (`receiptSatisfiesPacket`, `verifierPreflight` in `components/subagent-config/src/dispatch-contract.ts`) plus E7 guidance in `skills/pabcd/references/delegation.md`; no hook calls it.

These are this phase's SOT-SYNC-01 targets.

## Scope boundary

IN: the six files above (including `structure/20_pabcd_dispatch_doctrine.md`), plus the test badges in `README.md`, `README.ko.md`, `README.zh.md` and `inventory.json` via `inventory.mjs --write --tests <total>`. OUT: `commandsRun` semantics, `sourceIdentity`, release-gate's `dispatch-contracts` receipt (`pabcd-state/src/release-gate.ts:393`, stays missing), #256/#273 receipt fields, any hook.

## Verification (PLAN-VERIFIER-REAL-01)

| Command | Exit on `659de59b` | Reads the change target |
|---|---|---|
| `node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/components/subagent-config/test/dispatch-contract.test.ts` | 0 (17 pass) | yes: the file is the direct argument and imports `../src/dispatch-contract.ts` |
| `npm run build` | 0 | yes: `build.mjs` recompiles every component `src` into `dist` |
| `node --test plugins/codexclaw/test/dist-freshness.test.mjs` | 0 | yes: compares tracked `dist/dispatch-contract.js` with the compiled source |
| `npm test` (after `npm ci`) then `node plugins/codexclaw/scripts/inventory.mjs --check --tests <total>` | 0 | yes: root glob includes `subagent-config/test/*.test.ts`; inventory checks the README badge total |
| `node plugins/codexclaw/scripts/gate.mjs`, `node plugins/codexclaw/scripts/platform-smoke.mjs` | 0 | gate: inventory and skill checks; smoke: packaging. Neither observes the new logic; they guard regressions only |
| delegation.md prose | — | this command does not observe this change; human review in A and C |

Red-green: the #276 repro test and the mismatched-command test must fail against the old `receiptSatisfiesPacket` (run them before replacing (g)), then pass.

## Enforcement naming (PLAN-BYPASS-NAMED-01)

- Tier: E2 (pure library check), executing surface: whichever caller invokes `receiptSatisfiesPacket`/`verifierPreflight`; no codexclaw runtime calls them today.
- Known bypass: a caller that never calls the functions, or a receipt author who puts an unrelated command's output under a required command's name.
- Residual risk: command strings are self-reported; the check proves coverage of names, not that the command ran.
- Wording: described as a contract check and preflight, never as enforcement. Final enforcement layer: none.

## wp2 P revalidation (2026-09-30)

Continuity (LOOP-CONTINUITY-01), quoting the wp1 D summary in 000: "the roadmap is locked and wp2 builds 010 as written"; its negative side (context-only review independence, no stated resource bound for wp4, the c-10 correction) is carried forward. This P keeps that direction. Re-checked on `codex/issue-train-0930-wp2`: `git diff --stat 659de59b..HEAD -- plugins structure` is empty, so every anchor above still holds. One amendment: the `structure/INDEX.md` subagent-config section (`:138-140`) is a prose paragraph, so §5 appends one sentence to it: "`src/dispatch-contract.ts` holds the typed DispatchPacket/DispatchReceipt contract (#17): verifier coverage for receipts (#276) and a pure verifier-effects preflight (#277); no runtime path calls it yet." The `structure/20` bullet goes after the DISPATCH-ECONOMY-01 bullet's last clause (`:253`, "from mechanics to economy."), before the `---` that closes §3. Architect consultation: after the reflection at `048a521c`, A folds added a fail-closed malformed-result branch to (1g), including the non-array case; it implements D4 (every result must be a passing, matching result) and D8 (both result fields are shape-checked), so it changes no design decision. This amendment changes placement only, so the phase-audit architect-recheck trigger is not met.


## wp2 C record (2026-09-30)

C review round 1 (fresh implementation reviewer `01a0ee2f-7b70`, initiative verifier `01a0ee2f-7cbd`, in parallel) on `b852eb24`: GO-WITH-FIXES (1) and GO-WITH-FIXES (4). Accepted and fixed:

- The §4 prose said "declare writes or isolate", but under shared-read the code (correctly, D13) isolates any verifier that declares writes. DISPATCH-VERIFIER-01 in `delegation.md` and `structure/20` now say only a verifier declared read-only runs in the shared tree; the unrelated-result clause and the function docstring carry D5's "when the packet requires commands".
- A present but falsy legacy `verifierResult` (`null`) slipped past the malformed check; presence now tests `!== undefined`.
- An unvalidated packet with a non-string command made both functions throw; both now fail closed (`packet has malformed verifier commands`; preflight emits a `needsIsolation: true` row for it).
- Untriggered paths got six tests: legacy plus array merge (D2), zero required commands with a stray passing result (D5), no results suppressing per-command reasons, falsy legacy result, non-string packet commands, element-level `expectedWrites` guard. Total new tests: 21, plus one in C round 2 for malformed `verifierEffects` in preflight (22; badges 3730).
- Badges move in this phase (000's file map), so 010's IN list gained the READMEs and `inventory.json`.
- Red record. Method: `/tmp/it0930/wp2-red.sh` copies the component, restores `src/dispatch-contract.ts` from `659de59b`, stubs `verifierPreflight` as absent, and runs the committed test file with `node --test`. Result: 38 tests, 18 pass, 20 fail, including the #276 repro and the mismatched-command test. On the new source the same file passes 38/38. The earlier "14 failing" in the B->C attest came from an intermediate test file (30 tests, preflight tests removed) and is superseded by this record.

Disclosure for the 040 CHANGELOG: besides the command-match change, `validateReceipt` now rejects a legacy `verifierResult` without a string `output` or an integer `exitCode`, and `validatePacket` rejects blank or non-string `verifierCommands` entries; #277's "existing packets remain readable" holds for well-formed packets.

## wp2 D summary (2026-09-30)

Conclusion: #276 and #277 are fixed and merged into `dev` through PR #278 (head `ef1ce80d`, 14/14 checks, merge `069a7d0e`). Evidence: the red check (20/38 failing on the `659de59b` source, including the #276 repro), 39/39 on the new source, and the C gate under `cxc receipt test` (3730 tests, 0 failures, inventory, gate, smoke, empty hook diff). Next: wp3 builds 020.

What did not go well: the first build shipped prose that contradicted the preflight rule (declared writes still need isolation), and three conditional paths plus two malformed-input paths were untested until the C reviewers probed them; C took two review rounds and three gate runs. One full-suite run failed on an unrelated timing assertion (`spawn-attach-hook.test.ts:920`, 0.5 ms to 6.6 ms under concurrent load) that passed 3/3 in isolation; it is a latent flake worth watching in CI. Evidence that this direction is wrong: a caller appears that legitimately reports extra passing checks in `verifierResults` and is broken by D5.
