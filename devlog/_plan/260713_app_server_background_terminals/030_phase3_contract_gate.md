# Phase 3 — contract gate and live probe

## Loop-spec header

- Inherits: `000_plan.md` loop specification.
- Depends on: phases 1 and 2 completed; the test must assert their final text, not draft wording.
- Trigger: capability and skill prose can drift independently after implementation.
- Goal: add a semantic text-contract gate and capture one fresh, redacted, bounded runtime probe.
- Non-goals: no production app-server controller, listener exposure, arbitrary process termination, or indefinite probe.
- Verifier: focused Node test, full build/test, diff check, and create/list/terminate/re-list artifact.
- Stop condition: static gates pass, negative branches fire, happy-path teardown is observed, and no probe remains.
- Memory artifact: test file, exact redacted probe artifact `003_live_probe_evidence.md`, and `000_plan.md` audit/check ledger.
- Expected outcomes: `DONE`, `BLOCKED` on upstream contract drift, or `NEEDS_HUMAN` when current-host access is unavailable.
- Previous-cycle continuity: phase 2's lifecycle wording is the test oracle.

## Outcome

Make the doctrine mechanically drift-resistant and close the implementation with one safe, observable runtime lifecycle.

## Files

### NEW `devlog/_plan/260713_app_server_background_terminals/003_live_probe_evidence.md`

Write this file only when the fresh Phase 3 probe runs. It is not scaffolded during the research-only turn. Required content:

```md
# Live background-terminal probe evidence

- Date/time and timezone
- Codex binary absolute path and `--version`
- Transport owned by the probe: stdio or loopback WebSocket
- Redaction statement
- Experimental-gate negative request/response from a fresh connection
- Same-instance negative request/response
- Happy-path thread ID suffix only, bounded command, list response, terminate response, final empty-list response
- `command/exec` separation observation
- `turn/interrupt` separation observation
- Teardown receipt: no probe process/listener remains
- Secret scan command and result
```

Redact full thread IDs to a stable suffix, remove auth/capability tokens, omit environment dumps, and record only the probe command/process. The file moves with the unit to `_fin/` after all work phases close.

### NEW `plugins/codexclaw/test/background-terminal-doc-sync.test.mjs`

Use the existing Node text-contract test style. Read:

- `structure/60_native_capabilities.md`
- `plugins/codexclaw/skills/dev/SKILL.md`
- `plugins/codexclaw/skills/dev/references/background-terminals.md`

Assertions:

```js
assert.match(nativeCapabilities, /thread\/backgroundTerminals\/list/);
assert.match(nativeCapabilities, /thread\/backgroundTerminals\/terminate/);
assert.match(nativeCapabilities, /thread\/backgroundTerminals\/clean/);
assert.match(reference, /thread\/backgroundTerminals\/list/);
assert.match(reference, /thread\/backgroundTerminals\/terminate/);
assert.match(reference, /thread\/backgroundTerminals\/clean/);
assert.match(reference, /experimentalApi/);
assert.match(reference, /loaded thread/);
assert.match(reference, /same app-server/i);
assert.match(reference, /CommandExecManager/);
assert.match(reference, /UnifiedExecProcessManager/);
assert.match(reference, /unified_exec_manager/);
assert.match(reference, /exec_command/);
assert.match(reference, /write_stdin/);
assert.match(reference, /processId/);
assert.match(reference, /do not (guess|use blind)[\s\S]+(PID|kill)/i);
assert.match(reference, /turn\/interrupt[\s\S]+does not|does not[\s\S]+turn\/interrupt/i);
assert.match(devSkill, /references\/background-terminals\.md/);
assert.doesNotMatch(reference, /durable background task/i);
```

Prefer semantic assertions over exact paragraph snapshots so normal prose edits remain possible.

## Manual live probe

Run with the exact app-owned binary when testing Desktop:

```bash
CODEX_BIN="/Applications/ChatGPT.app/Contents/Resources/codex"
"$CODEX_BIN" --version
"$CODEX_BIN" app-server generate-json-schema --experimental --out "$(mktemp -d /tmp/codex-app-schema.XXXXXX)"
```

Then verify one of two supported paths:

### Host-client path

1. In the current Desktop thread, start the harmless heartbeat loop with `exec_command`.
2. Use the host's existing background-terminal surface to confirm the command, cwd, and app-server process ID.
3. Terminate through that surface.
4. Re-list and capture an empty result.

### Owned app-server path

1. Start one app-server over stdio or loopback WebSocket.
2. Initialize with `experimentalApi:true`.
3. Start/resume the thread on that same server.
4. Start a turn that creates a live unified-exec process.
5. Call list → terminate → list.

The check fails if it starts a second server and only proves `thread not found`; that is a useful negative test but not the happy-path lifecycle.

## Conditional-path evidence

- Experimental gate: start a fresh app-server connection, initialize it without `capabilities.experimentalApi`, call `list`, capture the invalid-request rejection, then close that connection. Initialization is one-shot, so do not try to remove the capability from the happy-path connection.
- Same-instance guard: separate-process request returns `thread not found`.
- `command/exec` separation: start a streaming `command/exec` process and confirm it does not appear in the thread list; terminate it through `command/exec/terminate`.
- Turn/process separation: interrupt a turn with a surviving unified-exec process, confirm the process remains, then clean it explicitly.

Use the bounded one-minute heartbeat from `001_codex_rs_runtime_guide.md`, always tear it down early, and save the redacted request/response transcript at `devlog/_plan/260713_app_server_background_terminals/003_live_probe_evidence.md`. Never leave a listener or infinite loop running after C.

## Verification

```bash
node --test plugins/codexclaw/test/background-terminal-doc-sync.test.mjs
npm run build
npm test
git diff --check
EVIDENCE=devlog/_plan/260713_app_server_background_terminals/003_live_probe_evidence.md
test -s "$EVIDENCE"
rg -n "Experimental-gate|Same-instance|final empty-list|command/exec|turn/interrupt|Teardown receipt" "$EVIDENCE"
if rg -n '(Authorization:|Bearer |sk-[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|/Users/[^/]+/\.codex)' "$EVIDENCE"; then exit 1; fi
if rg -n '[ \t]+$' "$EVIDENCE"; then exit 1; fi
if ps ax -o command= | rg '[b]ackground-probe'; then exit 1; fi
# Run only for the WebSocket probe path; substitute its actual configured port for 8765.
if lsof -nP -iTCP:8765 -sTCP:LISTEN | rg .; then exit 1; fi
git status --short
```

The final empty-list JSON in `003_live_probe_evidence.md`, the negative process/listener commands above, and their exit codes are mandatory manual C-gate evidence. The static Node test does not substitute for runtime teardown.

## Done criteria

- All static gates pass.
- The live happy path has create/list/terminate/re-list evidence.
- `003_live_probe_evidence.md` contains the redacted negative and happy-path transcript plus teardown receipt.
- Every probe process is terminated.
- `000_plan.md` receives the command/output summary.
- The completed unit moves from `_plan/` to `_fin/` only after all three work phases finish.
