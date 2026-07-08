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
import { spawn,                   } from "node:child_process";
import { createInterface } from "node:readline";


































const DEFAULT_TIMEOUT_MS = 600_000;
const SIGKILL_GRACE_MS = 3_000;
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
      if (text?.trim()) return { kind: "thinking", text };
      return null;
    }
    if (itemType === "tool_call" || itemType === "mcp_tool_call") {
      const name = firstString(item, ["name", "tool_name", "server_tool_name", "command"]) ?? itemType;
      const input = stringifyCompact(item.input ?? item.arguments ?? item.args ?? item.params ?? "");
      return { kind: "tool_call", name, input };
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
      const cmd = String(item?.command ?? "").slice(0, 80);
      if (cmd) return { kind: "status", label: `$ ${cmd}` };
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
    return { kind: "fail", message: msg };
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

function fileChangeAction(raw        )                                 {
  const normalized = raw.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("create") || normalized.includes("add")) return "create";
  return "modify";
}

export function terminateChild(child              )       {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, SIGKILL_GRACE_MS);
  timer.unref?.();
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
    });
    const unregister = opts.register?.(child);

    let threadId                = null;
    let text = "";
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

    const rl = createInterface({ input: child.stdout  });
    rl.on("line", (line) => {
      const event = parseExecEvent(line);
      if (!event) return;
      switch (event.kind) {
        case "thread":
          threadId = event.threadId;
          break;
        case "message":
          text += (text ? "\n" : "") + event.text;
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
      opts.onEvent?.(event);
    });
    rl.on("error", () => {});

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
