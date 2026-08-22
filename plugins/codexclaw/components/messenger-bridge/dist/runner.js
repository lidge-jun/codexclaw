/**
 * runner.ts — the one place that talks to Codex (messenger-bridge Phase 2).
 *
 * Spawns stock `codex exec` (new thread) or `codex exec resume <SESSION_ID>
 * <prompt>` (continuation), full-permission, `--json`, and streams parsed
 * JSONL events to the caller. Captures the thread id from `thread.started`.
 * When a resume fails because the rollout is gone, re-seeds a fresh thread once
 * from a summarized history block and carries on.
 *
 * Arg shapes + event names verified against codex-cli 0.142.5 (A-audit Phase 2,
 * 2026-07-03): `codex exec [OPTIONS] [PROMPT]` (prompt via stdin for new runs),
 * `codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]`; flags -m/--model, --json,
 * -c/--config KEY=VALUE (used for model_reasoning_effort; accepted by both exec
 * and exec resume — re-verified 2026-07-03), --dangerously-bypass-approvals-and-
 * sandbox, --skip-git-repo-check. Missing rollout emits: "thread/resume failed:
 * no rollout found for thread id <id>".
 */
import { spawn, spawnSync,                   } from "node:child_process";
import { commandInvocation } from "./win-exec.js";










































const DEFAULT_TIMEOUT_MS = 600_000;
export const SIGKILL_GRACE_MS = 3_000;
export const MAX_RUNNER_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MAX_EXEC_EVENT_LINE_BYTES = 8 * 1024 * 1024;
const OUTPUT_TRUNCATED = "\n\n[codexclaw: output truncated at 8 MiB to protect bridge memory]";
// Missing-rollout / bad-session-id signatures for the resume re-seed fallback.
const RESUME_LOST_RE = /no rollout found|thread\/resume failed|no such (thread|session)|not found/i;









/** Pure: build codex exec argv. New run reads prompt from stdin; resume passes it positionally. */
export function buildExecArgs(input                )           {
  const { threadId, model, effort, prompt, fullAccess = true } = input;
  const perm = fullAccess ? ["--dangerously-bypass-approvals-and-sandbox"] : [];
  const modelArgs = model && model !== "default" ? ["-m", model] : [];
  // Reasoning effort rides the config-override channel (no dedicated flag).
  const effortArgs = effort && effort !== "default" ? ["-c", `model_reasoning_effort=${effort}`] : [];
  if (threadId) {
    // `--` forces SESSION_ID + PROMPT to be parsed as positionals, so a chat
    // message that starts with `-` (e.g. "-c model=…") can't be misparsed as a
    // codex flag — a real flag-injection otherwise, verified against codex-cli
    // 0.142.5 (a "-c …" prompt was consumed as a config override). --json must
    // precede `--`; everything after `--` is positional.
    return [
      "exec",
      "resume",
      ...modelArgs,
      ...effortArgs,
      ...perm,
      "--skip-git-repo-check",
      "--json",
      "--",
      threadId,
      prompt,
    ];
  }
  // New runs read the prompt from stdin (no positional prompt → no injection).
  return ["exec", ...modelArgs, ...effortArgs, ...perm, "--skip-git-repo-check", "--json"];
}

/** Pure: parse one JSONL line into a RunnerEvent, or null for lines we ignore. */
export function parseExecEvent(line        )                     {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let evt                         ;
  try {
    evt = JSON.parse(trimmed)                           ;
  } catch {
    return null;
  }
  const type = evt.type                      ;
  if (type === "thread.started" && typeof evt.thread_id === "string") {
    return { kind: "thread", threadId: evt.thread_id };
  }
  if (type === "item.completed" || type === "item.started") {
    const item = evt.item                                       ;
    const itemType = item?.type                      ;
    if (itemType === "reasoning" || itemType === "reasoning_summary" || itemType === "thinking") {
      const text = firstString(item, ["text", "summary", "content", "reasoning"]);
      if (text?.trim()) return { kind: "thinking", text: singleLine(text, 4_000) };
      return null;
    }
    if (itemType === "tool_call" || itemType === "mcp_tool_call") {
      const phase = type === "item.started" ? "started" : "completed";
      const server = firstString(item, ["server"]);
      const tool = firstString(item, ["name", "tool_name", "server_tool_name", "tool", "command"]);
      const name = server && tool ? `${server}.${tool}` : (tool ?? itemType);
      const input = singleLine(stringifyCompact(item.input ?? item.arguments ?? item.args ?? item.params ?? ""), 4_000);
      const callId = firstString(item, ["id", "call_id", "callId"]);
      if (!callId) return null;
      const completion = phase === "completed" ? completionDetails(item) : {};
      return { kind: "tool_call", phase, callId, name, input, ...completion };
    }
    if (itemType === "file_change" || itemType === "patch" || itemType === "apply_patch") {
      const path = firstString(item, ["path", "file", "file_path", "target"]);
      const action = fileChangeAction(firstString(item, ["action", "operation", "kind"]) ?? itemType);
      if (path) return { kind: "file_change", path, action };
      const changes = item.changes;
      if (Array.isArray(changes)) {
        const first = changes.find((change)                                    =>
          Boolean(change && typeof change === "object"),
        );
        const changePath = firstString(first, ["path", "file", "file_path", "target"]);
        if (changePath) {
          return {
            kind: "file_change",
            path: changePath,
            action: fileChangeAction(firstString(first, ["action", "operation", "kind"]) ?? itemType),
          };
        }
      }
      return null;
    }
    if (itemType === "agent_message" && type === "item.completed") {
      const text = String(item?.text ?? "");
      if (text.trim()) return { kind: "message", text };
      return null;
    }
    if (itemType === "command_execution") {
      const command = firstString(item, ["command"]);
      const callId = firstString(item, ["id", "call_id", "callId"]);
      if (!command || !callId) return null;
      const phase = type === "item.started" ? "started" : "completed";
      const completion = phase === "completed" ? completionDetails(item) : {};
      return {
        kind: "tool_call",
        phase,
        callId,
        name: `$ ${singleLine(command, 80)}`,
        input: "",
        ...completion,
      };
    }
    return null;
  }
  if (type === "turn.completed") {
    const usage = (evt.usage                                      ) ?? null;
    return { kind: "done", usage };
  }
  if (type === "turn.failed" || type === "error") {
    const errObj = evt.error                                       ;
    let msg = String(errObj?.message ?? evt.message ?? "codex error");
    try {
      const parsed = JSON.parse(msg)                           ;
      const nested = (parsed.error                                       )?.message;
      msg = String(nested ?? parsed.message ?? msg);
    } catch {
      /* raw string is fine */
    }
    return { kind: "fail", message: singleLine(msg, 2_000) };
  }
  return null;
}

function firstString(obj                                     , keys          )                {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => typeof item === "string" ? item : "")
        .filter(Boolean)
        .join("\n");
      if (joined.trim()) return joined;
    }
  }
  return null;
}

function stringifyCompact(value         )         {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function completionDetails(item                         )


  {
  let outcome                                 ;
  if (typeof item.exit_code === "number") {
    outcome = item.exit_code === 0 ? "success" : "error";
  } else if (item.error !== null && item.error !== undefined && stringifyCompact(item.error).trim()) {
    outcome = "error";
  } else {
    const status = firstString(item, ["status", "outcome"])?.toLowerCase();
    if (status && ["completed", "success", "succeeded"].includes(status)) outcome = "success";
    if (status && ["error", "failed", "failure"].includes(status)) outcome = "error";
  }

  const result = item.error ?? item.aggregated_output ?? item.result ?? item.output;
  const summary = result === null || result === undefined ? "" : singleLine(stringifyCompact(result), 300);
  return {
    ...(outcome ? { outcome } : {}),
    ...(summary ? { resultSummary: summary } : {}),
  };
}

function singleLine(value        , maxLength        )         {
  const sanitized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function fileChangeAction(raw        )                                 {
  const normalized = raw.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("create") || normalized.includes("add")) return "create";
  return "modify";
}

/**
 * Injection points for terminateChild. Production passes nothing; the tests
 * drive both platforms and both escalation paths from one OS without ever
 * signalling a real process.
 */







export function terminateChild(child              , deps                = {})       {
  // `exit` does not imply the process group is gone: a grandchild can retain an
  // inherited stdout/stderr descriptor and prevent Node's `close` event. Always
  // signal the detached group while the runner still owns this ChildProcess.
  const platform = deps.platform ?? process.platform;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  signalProcessTree(child, "SIGTERM", platform, deps.kill);
  // The escalation used to be POSIX-only, so on Windows a codex process that
  // spawned MCP helpers left them holding the pipe: the turn timeout fired,
  // terminateChild ran, and the promise never settled (002 B13).
  const timer = schedule(() => {
    if (platform === "win32") killWindowsTree(child, deps.spawnFn ?? spawnSync);
    else signalProcessTree(child, "SIGKILL", platform, deps.kill);
  }, SIGKILL_GRACE_MS);
  timer.unref?.();
}

/**
 * Windows has no process groups and no real signals, so `child.kill()` reaches only
 * the direct child. `taskkill /T` walks the tree by parent pid.
 *
 * argv array with no shell: the pid is a number we produced, but routing it
 * through a shell would be a quoting hazard for no benefit.
 */
function killWindowsTree(child              , spawnFn                  )       {
  if (!child.pid) return;
  try {
    const inv = commandInvocation("taskkill", ["/pid", String(child.pid), "/T", "/F"], "win32");
    spawnFn(inv.file, inv.args, {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5_000,
      ...inv.options,
    });
  } catch {
    // Fall back to the direct child; the process may already be gone.
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // Already exited.
  }
}

/** Bound the durable reply string while preserving all ordinary-size output. */
export function appendBoundedOutput(current        , next        )                                       {
  const separator = current ? "\n" : "";
  const candidate = `${current}${separator}${next}`;
  const candidateBytes = Buffer.byteLength(candidate);
  if (candidateBytes <= MAX_RUNNER_OUTPUT_BYTES) {
    return { text: candidate, truncated: false };
  }
  return { text: withTruncationMarker(candidate), truncated: true };
}

function withTruncationMarker(candidate        )         {
  // Reserve the marker before clipping the combined payload. TextDecoder's
  // fatal mode backs off at most three bytes so a split multi-byte code point
  // never introduces a replacement character.
  const budget = Math.max(0, MAX_RUNNER_OUTPUT_BYTES - Buffer.byteLength(OUTPUT_TRUNCATED));
  const bytes = Buffer.from(candidate);
  let end = Math.min(bytes.length, budget);
  let clipped = "";
  while (end >= 0) {
    try {
      clipped = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
      break;
    } catch {
      end -= 1;
    }
  }
  return `${clipped}${OUTPUT_TRUNCATED}`;
}

function signalProcessTree(
  child              ,
  signal                ,
  platform                  = process.platform,
  kill                                                = (pid, sig) => {
    process.kill(pid, sig);
  },
)       {
  if (platform !== "win32" && child.pid) {
    try {
      // POSIX children are spawned into their own process group below, so a
      // negative PID reaches grandchildren such as shell/MCP helpers too.
      kill(-child.pid, signal);
      return;
    } catch {
      // Race with process exit or a platform without group signalling.
    }
  }
  child.kill(signal);
}









function spawnOnce(argv          , opts                , stdinPrompt               )                           {
  const bin = opts.codexBin ?? "codex";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise                 ((resolvePromise) => {
    // Script bins (test fixtures) run through the node executable instead of a
    // shebang exec: macOS syspolicyd can SIGKILL unsigned script exec under
    // Gatekeeper assessment pressure, which made spawn-based tests flake.
    const isScript = /\.(mjs|cjs|js)$/.test(bin);
    const child = spawn(isScript ? process.execPath : bin, isScript ? [bin, ...argv] : argv, {
      cwd: opts.workdir,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const unregister = opts.register?.(child);

    let threadId                = null;
    let text = "";
    let outputTruncated = false;
    let sawOversizedEvent = false;
    let usage                                = null;
    let failMsg                = null;
    let sawDone = false;
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      terminateChild(child);
    }, timeoutMs);
    timer.unref?.();

    // Write the prompt only after the child actually spawned (avoids a write race).
    if (stdinPrompt !== null) {
      child.once("spawn", () => {
        if (child.stdin) {
          child.stdin.end(stdinPrompt);
        }
      });
    } else if (child.stdin) {
      child.once("spawn", () => child.stdin?.end());
    }

    const handleLine = (line        ) => {
      const event = parseExecEvent(line);
      if (!event) return;
      let streamedEvent                     = event;
      switch (event.kind) {
        case "thread":
          threadId = event.threadId;
          break;
        case "message":
          if (!outputTruncated) {
            const appended = appendBoundedOutput(text, event.text);
            text = appended.text;
            outputTruncated = appended.truncated;
            if (appended.truncated) {
              streamedEvent = { kind: "message", text: "[codexclaw: output truncated at 8 MiB]" };
            }
          } else {
            streamedEvent = null;
          }
          break;
        case "done":
          usage = event.usage;
          sawDone = true;
          break;
        case "fail":
          failMsg = event.message;
          break;
        case "status":
        case "thinking":
        case "tool_call":
        case "file_change":
          break;
      }
      if (streamedEvent) opts.onEvent?.(streamedEvent);
    };

    // readline materializes an entire line before emitting it. Codex JSONL can
    // contain a whole model response in one line, so frame bytes ourselves and
    // discard an oversized record without ever retaining more than the cap.
    let lineParts           = [];
    let lineBytes = 0;
    let discardingLine = false;
    const markOversizedLine = () => {
      sawOversizedEvent = true;
      opts.onEvent?.({ kind: "status", label: "oversized Codex event discarded" });
    };
    const finishLine = () => {
      if (!discardingLine && lineBytes > 0) handleLine(Buffer.concat(lineParts, lineBytes).toString("utf8"));
      lineParts = [];
      lineBytes = 0;
      discardingLine = false;
    };
    child.stdout?.on("data", (chunk        ) => {
      let offset = 0;
      for (;;) {
        const newline = chunk.indexOf(0x0a, offset);
        const end = newline === -1 ? chunk.length : newline;
        const segment = chunk.subarray(offset, end);
        if (!discardingLine && lineBytes + segment.length <= MAX_EXEC_EVENT_LINE_BYTES) {
          if (segment.length > 0) lineParts.push(Buffer.from(segment));
          lineBytes += segment.length;
        } else if (!discardingLine) {
          lineParts = [];
          lineBytes = 0;
          discardingLine = true;
          markOversizedLine();
        }
        if (newline === -1) break;
        finishLine();
        offset = newline + 1;
      }
    });
    child.stdout?.on("end", finishLine);
    child.stdout?.on("error", () => {});

    child.stderr?.on("data", (chunk        ) => {
      stderr += chunk.toString();
      if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
    });

    const finish = (result                 ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unregister?.();
      resolvePromise(result);
    };

    child.on("error", (err) => {
      finish({ ok: false, threadId, text, usage, error: err.message });
    });
    child.on("close", (code) => {
      if (sawOversizedEvent) {
        const noted = appendBoundedOutput(text, "[codexclaw: oversized Codex event discarded]");
        text = noted.text;
        outputTruncated ||= noted.truncated;
      }
      if (timedOut) {
        finish({ ok: false, threadId, text, usage, error: `timed out after ${timeoutMs}ms` });
        return;
      }
      // codex prints resume failures (missing rollout) to stderr and still
      // exits 0, so exit-0-without-a-completed-turn is a failure too.
      let error               ;
      if (failMsg) {
        error = failMsg;
      } else if (code !== 0) {
        error = stderr.trim() || `codex exited with code ${code}`;
      } else if (!sawDone) {
        error = stderr.trim() || "codex produced no completed turn";
      } else {
        error = null;
      }
      finish({ ok: error === null, threadId, text, usage, error });
    });
  });
}

/**
 * Run one Codex turn. On a resume whose rollout is gone, retries once as a new
 * thread whose prompt is prefixed by the caller-provided re-seed block.
 */
export async function runTurn(opts                                           )                      {
  const resuming = Boolean(opts.threadId);
  const argv = buildExecArgs({
    threadId: opts.threadId,
    model: opts.model,
    effort: opts.effort,
    prompt: opts.prompt,
    fullAccess: opts.fullAccess,
  });
  // New run: prompt via stdin. Resume: prompt is positional in argv → close stdin.
  const first = await spawnOnce(argv, opts, resuming ? null : opts.prompt);

  const rolloutLost = resuming && !first.ok && !!first.error && RESUME_LOST_RE.test(first.error);
  if (!rolloutLost) {
    return { ...first };
  }

  // Re-seed: fresh thread, summarized history prefixed to the prompt.
  opts.onEvent?.({ kind: "status", label: "re-seeding session" });
  const seededPrompt = (opts.reseedBlock ? `${opts.reseedBlock}\n\n` : "") + opts.prompt;
  const reseedArgs = buildExecArgs({
    threadId: null,
    model: opts.model,
    effort: opts.effort,
    prompt: seededPrompt,
    fullAccess: opts.fullAccess,
  });
  const second = await spawnOnce(reseedArgs, opts, seededPrompt);
  return { ...second };
}
