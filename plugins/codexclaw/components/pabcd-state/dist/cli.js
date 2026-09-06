#!/usr/bin/env node
/**
 * pabcd-state — SessionStart + UserPromptSubmit + Stop hook entry.
 *
 * Reads the codex hook JSON payload from stdin, dispatches by event kind, and
 * writes any additionalContext envelope to stdout. Fail-safe: unknown events,
 * empty stdin, or unparseable payloads exit 0 with no output (never block codex).
 *
 *  - SessionStart: materialize the bound session's default IDLE state without
 *    resetting resumed state; side-effect only, with no context output.
 *  - UserPromptSubmit: detect IPABCD/interview trigger → inject phase directive
 *    (idempotent per session+turn). See hook.ts/handleUserPromptSubmit.
 *  - Stop: active only under a native goal (mid-cycle continuation, or the
 *    GOAL-IDLE-CONTINUE-01 arming nudge at IDLE); bounded by the no-goal /
 *    phase-I / context-pressure / stagnation guards.
 *
 * State lives in files (no orchestrator server):
 *  - .codexclaw/sessions/<session>.json  (per-session phase + injectedTurns)
 *  - .codexclaw/ledger.jsonl             (transition audit trail)
 *
 * argv: [node, cli.ts, kind, event] e.g. ["...", "...", "hook", "user-prompt-submit"].
 */
import { readSync } from "node:fs";
import {
  handlePostToolUse,
  handleBashFrictionCapture,
  handlePostCompact,
  handleSessionStart,
  handleStop,
  handleUserPromptSubmit,
} from "./hook.js";
import {
  isSubagentHookPayload,
  parsePostCompact,
  parsePostToolUse,
  parseSessionStart,
  parseStop,
  parseSubagentStop,
  parseUserPromptSubmit,
} from "./parse.js";
import { handlePreToolUseFailClosed } from "./goal-gate.js";
import { handleApplyPatchLint } from "./comment-lint.js";
import { handleFrictionPreToolUse } from "./friction-gate.js";
import { handleEditShapeCapture } from "./edit-shape.js";
import { buildRulesContextFromRaw } from "./rules.js";
import { handleRenderObservationCapture, handleRenderArtifactCapture } from "./render-observations.js";
import { handleWorktreeGuard, handleWorktreeGuardPreTool } from "./worktree-guard.js";
import { runSubagentStopGate } from "./subagent-evidence.js";
import { handleIdleEditAdvisory } from "./idle-edit.js";
import { handleReviewObserver } from "./review-observer.js";

// wp10 (090 trim 4c): the ten terminal-only verb modules below are loaded with
// dynamic import() inside their own branch instead of at module scope.
//
// Every hook event pays for every static import, and a --cpu-prof of a
// PreToolUse invocation on win32 attributed 96% of the above-spawn-floor cost to
// ESM module load with no codexclaw function in top self time. No hook event
// reaches freeze/orchestrate/metric/loop/divergence/release/plan/receipt/
// review-round/scan, so a hook was loading them for nothing.
//
// Safe because each of the ten was verified to have zero import-time side
// effects (no process listeners, no retained handles, no files touched on
// import), so deferring them moves no observable behavior - only the cost.

const MAX_STDIN_BYTES = 4 * 1024 * 1024;






function readStdin()            {
  try {
    const chunks           = [];
    let total = 0;
    for (;;) {
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_STDIN_BYTES + 1 - total));
      const read = readSync(0, buffer, 0, buffer.length, null);
      if (read === 0) break;
      total += read;
      if (total > MAX_STDIN_BYTES) return { raw: "", overflow: true };
      chunks.push(buffer.subarray(0, read));
    }
    return { raw: Buffer.concat(chunks, total).toString("utf8"), overflow: false };
  } catch {
    return { raw: "", overflow: false };
  }
}

function oversizedHookOutput(event                    )         {
  const reason = `[codexclaw] hook input exceeded ${MAX_STDIN_BYTES} bytes; refusing to bypass policy enforcement`;
  if (event?.startsWith("pre-tool-use")) {
    return `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
        additionalContext: reason,
      },
    })}\n`;
  }
  if (event === "subagent-stop" || event === "stop") {
    return `${JSON.stringify({ decision: "block", reason })}\n`;
  }
  return "";
}

async function main()                {
  const [, , kind, event] = process.argv;

  if (kind === "session") {
    const { runSessionCli } = await import("./session-cli.js");
    const result = runSessionCli(process.argv.slice(3), process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `freeze` command path (L10.3 runtime wiring): build/preview the freeze
  // manifest + run a stale check. Separate from the hook stdin path.
  if (kind === "freeze") {
    try {
      const { parseFreezeArgs, runFreeze } = await import("./freeze-cli.js");
      const out = runFreeze(parseFreezeArgs(process.argv.slice(3)));
      process.stdout.write(`${out}\n`);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`freeze failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }

  // `orchestrate` command path (L4): drive the FSM from the terminal (agent-gated).
  if (kind === "orchestrate") {
    const { parseOrchestrateCliArgs, renderOrchestrateParseError, runOrchestrateCli } = await import("./orchestrate-cli.js");
    const parsed = parseOrchestrateCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`${renderOrchestrateParseError(parsed)}\n`);
      process.exit(1);
    }
    const result = runOrchestrateCli(parsed, {}, process.env);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `metric` command path (emergence harness): record/show true-objective metrics.
  if (kind === "metric") {
    const stdin = process.argv[3] === "ingest" ? readStdin() : { raw: "", overflow: false };
    if (stdin.overflow) {
      process.stderr.write(`metric: stdin exceeds ${MAX_STDIN_BYTES} bytes\n`);
      process.exit(1);
    }
    const { runMetricCli } = await import("./metric-cli.js");
    const result = runMetricCli(process.argv.slice(3), process.cwd(), stdin.raw);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `loop` command path: project-local loop/goalplan init/show/validate.
  // `goalplan` is a deprecated alias for `loop`.
  if (kind === "loop" || kind === "goalplan") {
    const label = kind === "goalplan" ? "goalplan (deprecated, use 'loop')" : "loop";
    const { parseGoalplanCliArgs, runGoalplanCli } = await import("./goalplan-cli.js");
    const parsed = parseGoalplanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`${label}: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runGoalplanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `divergence` command path (emergence harness): project-local mode + candidate archive.
  if (kind === "divergence") {
    const { runDivergenceCli } = await import("./divergence-cli.js");
    const result = runDivergenceCli(process.argv.slice(3), process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `release` command path (260815 wp3): assemble and verify the release candidate
  // manifest. release-gate.ts shipped the schema but nothing produced a manifest, so
  // the gate could not refuse anything; this is the producer.
  if (kind === "release") {
    const { runReleaseCli } = await import("./release-cli.js");
    const result = runReleaseCli(process.argv.slice(3), process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `plan` command path (260714 wp2): scaffold the devlog/_plan unit the P>A
  // plan-gate verifies. Without this branch the bin's `case "plan"` would
  // fall through to the silent `kind !== "hook"` exit-0 (audit round 2 High #1).
  if (kind === "plan") {
    const { parsePlanCliArgs, runPlanCli } = await import("./plan-cli.js");
    const parsed = parsePlanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`plan: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runPlanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `config interview` (260829 wp5): the interview-entry policy. It lives here, not in
  // config-guard, because interview-policy.ts owns codexclaw.json and hook.ts reads it on
  // every prompt — a writer in another component would drift from the reader.
  if (kind === "config") {
    const { INTERVIEW_POLICIES, isInterviewPolicy, writeInterviewPolicy, readInterviewPolicy } =
      await import("./interview-policy.js");
    const args = process.argv.slice(3);
    const usage = `Usage:\n  cxc config interview [${INTERVIEW_POLICIES.join("|")}]\n\n` +
      "  off       only an explicit 'interview' / '인터뷰' request opens the Interview\n" +
      "  new-unit  also open it on the first plan request of a new unit (default)\n" +
      "  always    open it on every plan request\n\n" +
      "The Interview is advisory: it never changes the PABCD phase, and goal mode always suppresses it.\n";
    if (args[0] !== "interview") {
      process.stderr.write(`config: this component handles 'config interview' only\n${usage}`);
      process.exit(2);
    }
    const value = args[1];
    if (value === undefined || value === "--help" || value === "-h") {
      process.stdout.write(`${usage}current: ${readInterviewPolicy(process.cwd())}\n`);
      process.exit(value === undefined ? 0 : 0);
    }
    if (!isInterviewPolicy(value)) {
      process.stderr.write(`config interview: unknown policy '${value}'\n${usage}`);
      process.exit(2);
    }
    const res = writeInterviewPolicy(process.cwd(), value);
    if (!res.ok) {
      process.stderr.write(`config interview: ${res.reason}\n`);
      process.exit(1);
    }
    process.stdout.write(
      `interview policy: ${value} (${res.path})` +
        (res.replacedMalformed ? " — the previous file was not valid JSON and was replaced" : "") +
        "\n",
    );
    process.exit(0);
  }

  // `scan` command path (260724 WP1): record an interview contradiction-scan
  // round — the previously-phantom `cxc scan evidence` writer. Double write:
  // interview ledger event + tracker scanRounds/lastScanRoundId via writeState.
  // `review-round` command path (060): open and inspect plan-audit rounds. There
  // is no close verb — the SubagentStop observer writes the verdict.
  // `receipt` command path (075): run a command and record what happened, so the
  // C>D gate reads an observation instead of a claim.
  if (kind === "receipt") {
    const { parseReceiptCliArgs, runReceiptCli } = await import("./receipt-cli.js");
    const parsed = parseReceiptCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`receipt: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runReceiptCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `evidence` command path (EVIDENCE-TERMINAL-01): settle an unresolved subagent
  // verification verdict so GOAL-COMPLETE-GATE-01 can certify the goal.
  if (kind === "evidence") {
    const { parseEvidenceCliArgs, runEvidenceCli } = await import("./evidence-cli.js");
    const parsed = parseEvidenceCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`evidence: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runEvidenceCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  if (kind === "review-round") {
    const { parseReviewRoundCliArgs, runReviewRoundCli } = await import("./review-round-cli.js");
    const parsed = parseReviewRoundCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`review-round: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runReviewRoundCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  if (kind === "scan") {
    const { parseScanCliArgs, runScanCli } = await import("./scan-cli.js");
    const parsed = parseScanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`scan: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runScanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  if (kind !== "hook") {
    process.exit(0);
  }

  const stdin = readStdin();
  if (stdin.overflow) {
    const denied = oversizedHookOutput(event);
    if (denied) process.stdout.write(denied);
    process.exit(denied ? 0 : 1);
  }
  const raw = stdin.raw;
  let output = "";

  // Subagent turn guard (260709): codexclaw governs the ROOT session only.
  // codex-rs stamps agent_id/agent_type into turn-level hook stdin for
  // thread-spawned subagents and reuses the parent session id for child hooks,
  // so without this early exit a child turn reads/writes the PARENT's PABCD
  // state and can receive root-only directives (request_user_input is
  // root-thread-only in codex-rs). `subagent-stop` stays exempt — it is the
  // intentional child-scoped surface. Skipping the fail-closed pre-tool-use
  // gate for children is safe: codex-rs itself denies non-root
  // request_user_input (core/src/tools/handlers/request_user_input.rs:59).
  // 260804 worktree-guard (WORKTREE-GUARD-03): PreToolUse deletion enforcement
  // for app-managed worktrees. Deliberately ABOVE the subagent early-exit so
  // child-agent turns are denied too (audit B3: the riskiest caller class must
  // not bypass the guard). Fail-open on handler error: a guard crash must never
  // block an unrelated command.
  if (event === "worktree-guard-pretool") {
    try {
      process.stdout.write(handleWorktreeGuardPreTool(raw));
    } catch {
      // fail-open
    }
    process.exit(0);
  }

  // 060: the review observer is child-scoped for the same reason `subagent-stop` is —
  // it exists to read a subagent's exit, so the root-only early return would silence it.
  if (event !== "subagent-stop" && event !== "subagent-stop-review" && isSubagentHookPayload(raw)) {
    process.exit(0);
  }

  // pre-tool-use is handled by a dedicated FAIL-CLOSED dispatcher: a thrown
  // error on a request_user_input call must DENY (R-9), never fail open. It is
  // outside the generic fail-open try below so the swallow cannot reopen the
  // interview in goal mode.
  if (event === "pre-tool-use") {
    process.stdout.write(handlePreToolUseFailClosed(raw));
    process.exit(0);
  }

  // Fail-safe: any handler/state IO failure for the remaining events must not
  // block codex. Swallow the error, emit nothing, and exit 0.
  try {
    if (event === "session-start") {
      const payload = parseSessionStart(raw);
      if (payload) output = handleSessionStart(payload); // side-effect only; always ""
    } else if (event === "user-prompt-submit") {
      const payload = parseUserPromptSubmit(raw);
      if (payload) output = handleUserPromptSubmit(payload);
    } else if (event === "stop") {
      const payload = parseStop(raw);
      if (payload) output = handleStop(payload);
    } else if (event === "post-tool-use") {
      const payload = parsePostToolUse(raw);
      if (payload) output = handlePostToolUse(payload);
    } else if (event === "subagent-stop-review") {
      // 060 observer: records a reviewer verdict, never blocks. Kept separate from
      // the worker receipt gate so the two cannot contend over the same child.
      // 260818: this assigned to an undeclared `out`, which throws ReferenceError in
      // an ESM module. The observer's write had already landed (the call is evaluated
      // before the assignment) and the catch below swallowed the throw, so the bug was
      // invisible — but it also meant every later statement was skipped.
      output = handleReviewObserver(raw);
    } else if (event === "subagent-stop") {
      const payload = parseSubagentStop(raw);
      if (payload) output = runSubagentStopGate(payload);
    } else if (event === "post-compact") {
      const payload = parsePostCompact(raw);
      if (payload) output = handlePostCompact(payload); // side-effect only; always ""
    } else if (event === "pre-tool-use-lint") {
      // 060.2: FAIL-OPEN apply_patch comment-lint. Distinct from the R-9 fail-closed
      // `pre-tool-use` branch above — a lint crash must ALLOW the edit, never deny.
      output = handleApplyPatchLint(raw);
    } else if (event === "pre-tool-use-edit") {
      // 260714 050: combined edit-path event (one registration, one spawn per edit) —
      // lint (deny-capable) first; a lint deny wins; otherwise the IDLE-edit advisory
      // may inject context. Both legs FAIL-OPEN; a crash must never deny the edit.
      output = handleApplyPatchLint(raw);
      if (output === "") output = handleIdleEditAdvisory(raw);
    } else if (event === "pre-tool-use-idle-edit") {
      // 260714 wp3: FAIL-OPEN IDLE-edit advisory (IDLE-EDIT-ADVISORY-01). Allow +
      // additionalContext only; a crash here must never deny an edit.
      output = handleIdleEditAdvisory(raw);
    } else if (event === "pre-tool-use-friction") {
      // 080.1: FAIL-OPEN friction advisory ("allow" + reason) for a stop-level shell signature.
      // Distinct from the R-9 fail-closed branch; a crash here must never deny a tool.
      output = handleFrictionPreToolUse(raw);
    } else if (event === "worktree-guard") {
      // 260804: SessionStart identity + UserPromptSubmit rename guidance for
      // app-managed worktrees. Context-only; subagent turns already exited above.
      output = handleWorktreeGuard(raw);
    } else if (event === "post-tool-use-friction") {
      // 080.1: heuristic shell-failure friction capture (matcher ^Bash$); side-effect only.
      const payload = parsePostToolUse(raw);
      if (payload) output = handleBashFrictionCapture(payload);
    } else if (event === "post-tool-use-edit-shape") {
      // astgrep_active 00: repeated same-shaped edit advisory (matcher ^apply_patch$).
      // FAIL-OPEN capture + one-time additionalContext nudge toward $cxc-ast-grep.
      // Also records render-artifact file modifications for C-RENDER-GROUNDING-01.
      const payload = parsePostToolUse(raw);
      if (payload) {
        output = handleEditShapeCapture(payload);
        handleRenderArtifactCapture(payload); // side-effect only; no output
      }
    } else if (event === "post-tool-use-render-observation") {
      // C-RENDER-GROUNDING-01: record render-observation tool calls AND
      // render-artifact modifications (apply_patch rides this hook's matcher since
      // the edit-shapes hook moved to _deprecated in the L12 hook diet; both
      // handlers self-filter by tool_name). Side-effect only; FAIL-OPEN.
      const payload = parsePostToolUse(raw);
      if (payload) {
        output = handleRenderObservationCapture(payload);
        handleRenderArtifactCapture(payload);
      }
    } else if (event === "session-start-rules") {
      // 060.1: surface project rules as SessionStart additionalContext ("" when none).
      output = buildRulesContextFromRaw(raw, process.cwd());
    }
  } catch {
    output = "";
  }

  if (output) process.stdout.write(output);
  process.exit(0);
}

// main() became async for the wp10 lazy verb imports, so a rejection would
// otherwise surface as an unhandled-rejection stack on a path that used to be
// fail-safe. Registered as a listener rather than a .catch() chain so the file
// still ends with a bare `main();` call, which hook-e2e's snapshot check uses to
// tell a fully-written dist entrypoint from one caught mid-rebuild.
process.on("unhandledRejection", (err         ) => {
  process.stderr.write(`codexclaw cli failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

void main();
