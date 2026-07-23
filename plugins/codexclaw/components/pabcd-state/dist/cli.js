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
import { readFileSync } from "node:fs";
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
import { runSubagentStopGate } from "./subagent-evidence.js";
import { runDivergenceCli } from "./divergence-cli.js";
import { parseFreezeArgs, runFreeze } from "./freeze-cli.js";
import { parsePlanCliArgs, runPlanCli } from "./plan-cli.js";
import { handleIdleEditAdvisory } from "./idle-edit.js";
import { runMetricCli } from "./metric-cli.js";
import { parseOrchestrateCliArgs, renderOrchestrateParseError, runOrchestrateCli } from "./orchestrate-cli.js";
import { parseGoalplanCliArgs, runGoalplanCli } from "./goalplan-cli.js";
import { parseScanCliArgs, runScanCli } from "./scan-cli.js";

function readStdin()         {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main()       {
  const [, , kind, event] = process.argv;

  // `freeze` command path (L10.3 runtime wiring): build/preview the freeze
  // manifest + run a stale check. Separate from the hook stdin path.
  if (kind === "freeze") {
    try {
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
    const parsed = parseOrchestrateCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`${renderOrchestrateParseError(parsed)}\n`);
      process.exit(1);
    }
    const result = runOrchestrateCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `metric` command path (emergence harness): record/show true-objective metrics.
  if (kind === "metric") {
    const stdin = process.argv[3] === "ingest" ? readStdin() : "";
    const result = runMetricCli(process.argv.slice(3), process.cwd(), stdin);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `loop` command path: project-local loop/goalplan init/show/validate.
  // `goalplan` is a deprecated alias for `loop`.
  if (kind === "loop" || kind === "goalplan") {
    const label = kind === "goalplan" ? "goalplan (deprecated, use 'loop')" : "loop";
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
    const result = runDivergenceCli(process.argv.slice(3), process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `plan` command path (260714 wp2): scaffold the devlog/_plan unit the P>A
  // plan-gate verifies. Without this branch the bin's `case "plan"` would
  // fall through to the silent `kind !== "hook"` exit-0 (audit round 2 High #1).
  if (kind === "plan") {
    const parsed = parsePlanCliArgs(process.argv.slice(3), process.cwd());
    if ("error" in parsed) {
      process.stderr.write(`plan: ${parsed.error}\n`);
      process.exit(1);
    }
    const result = runPlanCli(parsed);
    process.stdout.write(`${result.output}\n`);
    process.exit(result.code);
  }

  // `scan` command path (260724 WP1): record an interview contradiction-scan
  // round — the previously-phantom `cxc scan evidence` writer. Double write:
  // interview ledger event + tracker scanRounds/lastScanRoundId via writeState.
  if (kind === "scan") {
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

  const raw = readStdin();
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
  if (event !== "subagent-stop" && isSubagentHookPayload(raw)) {
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

main();
