# 010 - wp02 attest UX (issue #31)

> DIFFLEVEL-ROADMAP-01: this doc is the copy-paste-executable PRD for wp02.

Defects closed from 002 section D: **#2 (P0)** orchestrate-cli --attest JSON unquotable
from PowerShell, **#6 (P1)** attest.ts early-return chain drip-feeds required fields.
Plus the issue #31 reviewer-wording defect: A>B tells the agent to dispatch a "reviewer
subagent" while spawn_agent rejects agent_type 'reviewer' (ROLE_AGENT_TYPE in
subagent-config/src/spawn-wrapper.ts:24-28 maps the reviewer ROLE to the explorer TYPE).

Evidence: gh issue #31 records ~8 failed round-trips for one P>A>B>C>D cycle, and states
the single-field errors were only reachable at all after wrapping the CLI in a Node
spawnSync helper, because PowerShell cannot pass the inline JSON.

## MODIFY / NEW / DELETE map

### 1. MODIFY plugins/codexclaw/components/pabcd-state/src/attest.ts

#### 1a. AttestResult carries every reason

BEFORE (:68-71)
```ts
export interface AttestResult {
  ok: boolean;
  reason?: string;
}
```

AFTER
```ts
export interface AttestResult {
  ok: boolean;
  /** Human-facing text. Single-reason failures render byte-identically to the
   *  pre-batch gate, so every existing substring assertion still matches. */
  reason?: string;
  /** Every failing requirement for this edge, in stable declaration order. */
  reasons?: string[];
}

/** One rejection names the whole contract for this edge (issue #31). */
function failAttest(reasons: string[]): AttestResult {
  const reason =
    reasons.length === 1
      ? reasons[0]
      : reasons.map((r, i) => `(${i + 1}/${reasons.length}) ${r}`).join("\n");
  return { ok: false, reason, reasons };
}
```

#### 1b. validateAttest accumulates instead of early-returning

BEFORE (:152-218) - a chain of eleven `return { ok: false, ... }` statements at
:156, :162, :168, :175, :181, :184, :187, :190, :195, :204, :210. Each one hides the next.

AFTER - full replacement of the body from :152 to :218
```ts
export function validateAttest(from: Phase, to: Phase, att: Attestation | null): AttestResult {
  const key = `${from}>${to}`;
  if (!GATED_TRANSITIONS.has(key)) return { ok: true };

  // Two hard stops keep their single-reason shape: with no attestation, or with a
  // mismatched from/to, every other field check would be about the wrong edge.
  if (!att) {
    return failAttest([
      `${from} -> ${to} requires an attestation with a non-empty "did". Pass --attest-file <path> (required on Windows) or --attest '{"from":"${from}","to":"${to}","did":"..."}'.`,
    ]);
  }
  if (att.from !== from || att.to !== to) {
    return failAttest([
      `Attestation from/to (${att.from}->${att.to}) does not match the requested transition ${from}->${to}.`,
    ]);
  }

  const reasons: string[] = [];
  if (!att.did || PLACEHOLDER_DID.test(att.did)) {
    reasons.push(`${from} -> ${to} needs a specific "did" narrative (not empty or a placeholder).`);
  }
  if (key === "A>B") {
    if (!att.auditOutput) {
      reasons.push(`A -> B additionally requires "auditOutput": paste the tail of the independent reviewer verdict you actually received. Dispatch a reviewer subagent with agent_type "explorer" (there is no "reviewer" agent_type; the reviewer ROLE maps to the explorer TYPE per DISPATCH-AGENT-TYPE-01) at the A gate; a self-written sentence is not an audit.`);
    }
    if (!att.auditVerdict || !AUDIT_VERDICTS.has(att.auditVerdict)) {
      reasons.push(`A -> B additionally requires "auditVerdict": "pass" | "near-pass" | "fail" - YOUR OWN judgment of this audit round (AUDIT-LOOP-01). "fail" never advances; "near-pass" means every blocking finding was folded into the plan or explicitly rebutted (also supply "auditResidual").`);
    }
    if (att.auditVerdict === "near-pass" && !att.auditResidual) {
      reasons.push(`A -> B with "near-pass" additionally requires "auditResidual": name each residual blocker and its disposition (folded into plan / rebutted with rationale), e.g. "GO-WITH-FIXES; 2 blockers folded back: (1) ..., (2) ...".`);
    }
    // Contradiction checks run only once every required field is present, so the
    // batched message can never both demand a field and reason about its value.
    if (reasons.length === 0) {
      if (att.auditVerdict === "fail") {
        reasons.push(`A -> B is blocked: you judged this audit round "fail". Synthesize the blockers (REVIEW-SYNTHESIS-01), amend the plan, and re-audit with the SAME reviewer (v2 surface: followup_task to its task_name; v1 surface: send_input to its agent_id). Re-attest with "pass" or "near-pass" once only folded/rebutted residuals remain; after 3 failed rounds return to P with a changed plan (LOOP-REPAIR-01).`);
      } else if (hasFailVerdictTail(att.auditOutput ?? "")) {
        reasons.push(`The pasted auditOutput tail ends with a FAIL verdict line, contradicting auditVerdict="${att.auditVerdict}". Run another audit round (same reviewer) and paste the round that actually reached PASS / GO-WITH-FIXES - or attest "fail" and keep looping (AUDIT-LOOP-01).`);
      }
    }
  }
  if (key === "C>D") {
    if (!att.checkOutput) {
      reasons.push(`C -> D additionally requires "checkOutput": paste the tail of the test/tsc command you actually ran.`);
    }
    if (typeof att.exitCode !== "number") {
      reasons.push(`C -> D additionally requires "exitCode": the exit status of the command whose output you pasted. Report the real number - a check with no outcome is not a check.`);
    }
    // Count MISSING-FIELD reasons only. The nonzero-exit reason below is not a missing
    // field - it is a complete attest whose check failed - and must not also draw a
    // receipt nag (test 5). Snapshot the count before that push.
    const missingFields = reasons.length;
    if (typeof att.exitCode === "number" && att.exitCode !== 0) {
      reasons.push(`C -> D requires a passing check, but the attestation reports exitCode ${att.exitCode}. Fix the failure (orchestrate B) before advancing.`);
    }
    // CHECK-BINDING-01 is enforced in check-gate.ts (attest.ts stays IO-free), so name
    // it here rather than letting a goalplan-bound session discover it one edge later.
    // The nag rides along only when the executor is already going back to fill in a
    // missing field, so it never turns a one-reason failure into two.
    if (missingFields > 0 && !att.testReceiptPath) {
      reasons.push(`C -> D on a goalplan-bound session ALSO requires "testReceiptPath" (CHECK-BINDING-01), produced by \`cxc receipt test -- <command>\`. Supplying it now avoids another round trip.`);
    }
  }
  return reasons.length === 0 ? { ok: true } : failAttest(reasons);
}
```

The ordering rule is load-bearing: missing-field reasons are gathered first, and the two
contradiction checks (the `auditVerdict === "fail"` refusal and `hasFailVerdictTail`) run
only while `reasons` is still empty. Reversing that order produces a message that demands
`auditOutput` and simultaneously reasons about its contents.

C>D applies the same principle with an explicit `missingFields` snapshot instead of a live
`reasons.length` test, because its third check is a VALUE judgment (nonzero exit), not a
missing field. Keying the receipt nag on `reasons.length > 0` would append it to a complete
attest that merely reported a failing check - two reasons where test 5 requires one.

Reason strings are preserved verbatim from the current file, with one deliberate
exception: the `auditOutput` reason is rewritten for the `agent_type` clause this doc
requires (issue #31). The existing substring assertions at `attest.test.ts:33` (`/auditOutput/`)
and `:64` (`/SAME reviewer/`) still match after that rewrite, so no existing test breaks.

### 2. MODIFY plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts

#### 2a. --attest-file <path> (the P0 fix)

BEFORE (:196-223)
```ts
  let attest: Attestation | null = null;
  let attestError: string | undefined;
  let session: string | undefined;
  let cwdOut = cwd;
  let json = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--attest") {
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest requires a JSON argument"; continue; }
      try {
        const parsed = JSON.parse(raw) as unknown;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = "attest JSON missing valid from/to";
        else attest = coerced;
      } catch {
        attestError = "attest JSON is not valid JSON";
      }
    } else if (a === "--session") {
      session = argv[++i];
    } else if (a === "--cwd") {
      cwdOut = argv[++i] ?? cwd;
    } else if (a === "--json") {
      json = true;
    }
  }
  return { verb, attest, attestError, session, cwd: cwdOut, json };
```

AFTER
```ts
  let attest: Attestation | null = null;
  let attestError: string | undefined;
  let attestFile: string | undefined;
  let sawInlineAttest = false;
  let session: string | undefined;
  let cwdOut = cwd;
  let json = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--attest") {
      sawInlineAttest = true;
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest requires a JSON argument"; continue; }
      try {
        const parsed = JSON.parse(raw) as unknown;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = "attest JSON missing valid from/to";
        else attest = coerced;
      } catch {
        attestError = "attest JSON is not valid JSON";
      }
    } else if (a === "--attest-file") {
      const raw = argv[++i];
      if (raw === undefined) { attestError = "--attest-file requires a path argument"; continue; }
      // Resolved AFTER the loop: --cwd may still be ahead of us in argv order.
      attestFile = raw;
    } else if (a === "--session") {
      session = argv[++i];
    } else if (a === "--cwd") {
      cwdOut = argv[++i] ?? cwd;
    } else if (a === "--json") {
      json = true;
    }
  }
  if (attestFile !== undefined) {
    if (sawInlineAttest) {
      attestError = "pass --attest OR --attest-file, not both";
    } else {
      const path = resolve(cwdOut, attestFile);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
        const coerced = coerceAttest(parsed);
        if (!coerced) attestError = `attest file ${path} is missing valid from/to`;
        else attest = coerced;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attestError = `could not read the attest file at ${path} (${msg})`;
      }
    }
  }
  return { verb, attest, attestError, session, cwd: cwdOut, json };
```

Imports: add `readFileSync` to the existing `node:fs` clause and `resolve` to the existing
`node:path` clause (`join` is already imported there).

The precedent is `goalplan-cli.ts:111-121`, which discriminates a path from inline JSON for
`--batch-json`. A separate flag name is used here rather than that overload, because
`--attest` shipped with a JSON-only contract and a path that happens to start with `{`
must not silently change meaning.

#### 2b. Platform-aware help text

BEFORE (:152-179, the relevant lines)
```ts
export function renderOrchestrateHelp(): string {
  return [
    "cxc orchestrate - agent-gated IPABCD phase control",
    ...
    "  cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--attest <json>] [--cwd <path>] [--json]",
    ...
    "Attestation examples:",
    "  cxc orchestrate A --session <id> --attest '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}'",
    ...
  ].join("\n");
}
```

AFTER
```ts
export function renderOrchestrateHelp(platform: NodeJS.Platform = process.platform): string {
  const attestExamples = platform === "win32"
    ? [
        "Attestation examples (PowerShell single quotes do NOT protect embedded double",
        "quotes and cmd.exe ignores them entirely, so write the JSON to a file):",
        "  '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}' | Set-Content -Encoding utf8 .codexclaw/attest.json",
        "  cxc orchestrate A --session <id> --attest-file .codexclaw/attest.json",
      ]
    : [
        "Attestation examples:",
        "  cxc orchestrate A --session <id> --attest '{\"from\":\"P\",\"to\":\"A\",\"did\":\"wrote and audited the plan\",\"planUnit\":\"devlog/_plan/260714_slug\",\"workPhaseId\":\"wp1\"}'",
        "  cxc orchestrate B --session <id> --attest '{\"from\":\"A\",\"to\":\"B\",\"did\":\"audit passed\",\"auditOutput\":\"VERDICT: PASS\",\"auditVerdict\":\"pass\",\"workPhaseId\":\"wp1\"}'",
        "  cxc orchestrate D --session <id> --attest '{\"from\":\"C\",\"to\":\"D\",\"did\":\"verified\",\"checkOutput\":\"tests passed\",\"exitCode\":0,\"workPhaseId\":\"wp1\"}'",
      ];
  return [
    "cxc orchestrate - agent-gated IPABCD phase control",
    "",
    "Usage:",
    "  cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--attest <json> | --attest-file <path>] [--cwd <path>] [--json]",
    "  cxc orchestrate --help",
    ...
    ...attestExamples,
    "  (workPhaseId is required on gated edges whenever a goalplan is bound to the session)",
    ...
  ].join("\n");
}
```

The defaulted parameter keeps every existing caller and test working, and lets a Linux CI
run assert the win32 branch by passing "win32" explicitly (001 cross-cutting lesson:
platform as a parameter).

### 3. MODIFY plugins/codexclaw/components/pabcd-state/src/hook.ts

#### 3a. STOP_NEXT_COMMAND emits the file form on win32

BEFORE (:1007-1014) - the table hard-codes POSIX single-quoted JSON, e.g.
```ts
const STOP_NEXT_COMMAND: Partial<Record<Phase, string>> = {
  I: '`cxc orchestrate P --attest \'{"from":"I","to":"P","did":"interview complete with recorded requirements"}\'`',
  ...
};
```

AFTER - keep the table as the canonical POSIX form and rewrite at the read site
```ts
/** win32 cannot pass this JSON inline (002 B1), so point at the file flag there. */
export function stopNextCommand(phase: Phase, platform: NodeJS.Platform = process.platform): string | undefined {
  const posix = STOP_NEXT_COMMAND[phase];
  if (posix === undefined || platform !== "win32") return posix;
  const json = /--attest '(\{.*\})'/.exec(posix)?.[1];
  const verb = /cxc orchestrate (\S+)/.exec(posix)?.[1];
  if (!json || !verb) return posix;
  // Backtick-quoted for the Stop reason renderer, same as the POSIX table entries.
  const q = String.fromCharCode(96);
  const write = q + "'" + json + "' | Set-Content -Encoding utf8 .codexclaw/attest.json" + q;
  const run = q + "cxc orchestrate " + verb + " --attest-file .codexclaw/attest.json" + q;
  return write + " then " + run;
}
```

Every `STOP_NEXT_COMMAND[<phase>]` lookup in this file becomes `stopNextCommand(<phase>)`.

#### 3b. The A-phase mandate names an agent_type that exists

BEFORE (:291-292)
```ts
    "Audit the plan adversarially before building. Dispatch an independent reviewer",
    "(sub-agent) to challenge assumptions, find blockers, and verify references. If",
```

AFTER
```ts
    "Audit the plan adversarially before building. Dispatch an independent reviewer",
    "as a sub-agent with agent_type \"explorer\" (DISPATCH-AGENT-TYPE-01: there is no",
    "\"reviewer\" agent_type - the reviewer ROLE maps to the explorer TYPE) to challenge",
    "assumptions, find blockers, and verify references. If",
```

`review-round-cli.ts:213` already says "(agent_type explorer)" on the v2 surface, so this
change makes the two dispatch mandates agree.

### 4. NEW plugins/codexclaw/components/pabcd-state/test/attest-batch.test.ts

A new file rather than an append, so the existing single-reason assertions in the
8988-byte `attest.test.ts` stay untouched and the batching contract has one obvious home.

### 5. MODIFY plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts

Add the `--attest-file` cases listed below.

### 6. Deliberately NOT in this slice (file as issues per the campaign scope rule)

- `cxc orchestrate schema` (issue #31 "Expected" bullet 2). Batched reasons already
  enumerate the contract on first rejection; a standalone schema verb is a new surface.
- SOURCE-DELTA-01 accepting an A-attest commit SHA (issue #31 bullet 4). That is
  source-identity semantics, not attest UX.

## TESTS

NEW `plugins/codexclaw/components/pabcd-state/test/attest-batch.test.ts`

1. "A>B with only did returns every A>B field in one rejection":
   `validateAttest("A", "B", coerceAttest({ from: "A", to: "B", did: "x" }))` -
   `ok === false`, `reasons.length === 2`, `reason` matches both `/auditOutput/` and
   `/auditVerdict/`.
2. "near-pass without residual batches the residual demand": `{ from, to, did,
   auditVerdict: "near-pass" }` yields reasons matching `/auditOutput/` and
   `/auditResidual/`, and NOT `/requires "auditVerdict"/`.
3. "contradiction checks stay silent while fields are missing":
   `{ from, to, did, auditVerdict: "fail" }` must NOT match `/is blocked/` (the missing
   auditOutput reason wins); adding `auditOutput: "VERDICT: PASS"` makes it match.
4. "single-reason failures render exactly as before": a P>A with `did: "tbd"` has
   `reason === reasons[0]` and does not start with `"(1/"`.
5. "C>D batches checkOutput + exitCode + testReceiptPath": `{ from: "C", to: "D", did: "x" }`
   returns 3 reasons; `{ ..., checkOutput: "ok", exitCode: 1 }` returns the nonzero-exit
   reason alone (no receipt nag on an otherwise-complete attest).
6. "ungated transitions still pass": `validateAttest("C", "B", null).ok === true`.
7. "the A>B reviewer wording names a real agent_type": the auditOutput reason matches
   `/agent_type "explorer"/` and does NOT match `/agent_type "reviewer"/`.

MODIFY `test/orchestrate-cli.test.ts`

8. "--attest-file reads JSON from disk": write `att.json` into a `mkdtempSync` cwd, parse
   `["A", "--session", "s1", "--attest-file", "att.json", "--cwd", tmp]`, assert
   `parsed.attest.did` round-tripped and `attestError === undefined`.
9. "--attest-file resolves against --cwd even when --cwd comes later in argv":
   `["A", "--attest-file", "att.json", "--cwd", tmp]` must succeed. This is the regression
   guard for the deferred-resolution rule.
10. "--attest-file on a missing path sets attestError": matches
    `/could not read the attest file/`.
11. "--attest and --attest-file together are rejected": matches `/not both/`.
12. "--attest-file with no argument": matches `/requires a path argument/`.
13. "win32 help shows the file form": `renderOrchestrateHelp("win32")` matches
    `/--attest-file/` and contains no `--attest '{` example; `renderOrchestrateHelp("linux")`
    keeps the inline examples.
14. "the CRLF case": an attest file written with `\r\n` line endings still parses
    (`JSON.parse` tolerates `\r` as whitespace - this test pins that so a later CRLF sweep
    cannot regress it).

## Verification (C)

Run from the repo root; each command must exit 0.

```powershell
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/attest.test.ts" "plugins/codexclaw/components/pabcd-state/test/attest-batch.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts"
node --test --test-concurrency=1 "plugins/codexclaw/components/pabcd-state/test/hook.test.ts"
npm test
node plugins/codexclaw/scripts/gate.mjs
```

Manual win32 acceptance - the exact failure that produced issue #31. Expected exit 0:

```powershell
'{"from":"P","to":"A","did":"wp02 diff-level doc set written","planUnit":"devlog/_plan/260821_win-linux-optimization","workPhaseId":"wp02-attest-ux"}' | Set-Content -Encoding utf8 .codexclaw/attest.json
node bin/codexclaw.mjs orchestrate A --session cli --attest-file .codexclaw/attest.json
```

Manual batching acceptance. Expected exit 1, with BOTH missing field names in ONE message:

```powershell
'{"from":"A","to":"B","did":"audit ran"}' | Set-Content -Encoding utf8 .codexclaw/attest.json
node bin/codexclaw.mjs orchestrate B --session cli --attest-file .codexclaw/attest.json
```

WSL parity check (the POSIX branch must be unchanged), expected exit 0:

```bash
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/super/Downloads/codexclaw && node --test --test-concurrency=1 'plugins/codexclaw/components/pabcd-state/test/attest*.test.ts'"
```

Record the C>D receipt with `cxc receipt test -- npm test` per CHECK-BINDING-01.
