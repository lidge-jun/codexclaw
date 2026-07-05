/**
 * friction-gate.ts — FAIL-OPEN PreToolUse advisory gate for repeated tool friction (080.1).
 *
 * When a shell tool ("Bash") has accumulated a `stop`-level friction signature on the
 * project-local ledger, this advises the model (permissionDecision "allow" with a reason)
 * to change approach before re-running the same class of command. It is INTENTIONALLY
 * advisory (allow, not deny):
 * PreToolUse cannot see the new call's error, only the tool name, so a hard deny would be
 * too blunt and could trap a legitimate retry. Codex does not accept an "ask" decision here,
 * so this must stay schema-safe. FAIL-OPEN: any parse/read error -> "" (allow).
 *
 * This is a SEPARATE event arg from the R-9 fail-closed `pre-tool-use` dispatcher; a crash
 * here must never deny a tool.
 */
import { peakFrictionVerdict } from "./friction.js";

function str(v         )                     {
  return typeof v === "string" ? v : undefined;
}

/** Tools this gate watches (the shell class that friction capture records). */
const WATCHED_TOOLS = new Set(["Bash", "exec_command", "shell_command"]);

export function handleFrictionPreToolUse(raw        )         {
  try {
    const parsed = JSON.parse((raw ?? "").trim())                           ;
    if (!parsed || typeof parsed !== "object") return "";
    if (parsed.hook_event_name !== "PreToolUse") return "";
    const tool = str(parsed.tool_name);
    const cwd = str(parsed.cwd);
    if (!tool || !cwd || !WATCHED_TOOLS.has(tool)) return "";
    if (peakFrictionVerdict(cwd) !== "stop") return ""; // only the strongest signal advises
    return `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason:
          "[codexclaw friction] A shell failure has recurred to the stop threshold. Review .codexclaw/friction.jsonl and change approach before re-running the same command.",
      },
    })}\n`;
  } catch {
    return ""; // FAIL-OPEN
  }
}
