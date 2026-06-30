/**
 * comment-lint.ts — PreToolUse static lint over apply_patch added lines (lazygap_impl 060.2).
 *
 * The first real edit-time E1 gate codexclaw owns: it inspects the patch text of an
 * `apply_patch` PreToolUse call (exposed as `tool_input.command`) and DENIES before the
 * write lands if an ADDED line matches a fixed, explicit forbidden-pattern set.
 *
 * Hard rules:
 *  - FAIL-OPEN: any parse error / unexpected shape -> ALLOW (""), never deny on a crash.
 *    This is the ONE PreToolUse branch that is fail-open; it must NOT inherit the R-9
 *    fail-closed `request_user_input` deny default.
 *  - STATIC only: a small deterministic regex set; no semantic/AI judgement, no binary.
 *  - Coverage limit: only structured `apply_patch` edits are seen. Shell/exec file writes
 *    (exec_command/shell_command) do NOT surface here and are NOT linted.
 */






/**
 * The fixed forbidden-pattern set. Each pattern targets a specific, mechanically
 * detectable anti-pattern on an ADDED line, with an inline-escape so an author can
 * consciously opt out (`// justified:` / `# justified:`). Keep this list small + explicit.
 */
export const FORBIDDEN_PATTERNS                     = [
  {
    re: /\bas any\b/,
    msg: "`as any` cast — use a precise type or add a trailing `// justified: <reason>` to opt out",
  },
  {
    re: /\b(eval)\s*\(/,
    msg: "`eval(` — dynamic eval is forbidden; refactor or add `// justified: <reason>`",
  },
  {
    re: /\bdebugger\b/,
    msg: "`debugger` statement — remove before committing or add `// justified: <reason>`",
  },
];

/** A line carrying an explicit justification escape is exempt from the lint. */
function isJustified(line        )          {
  return /\/\/\s*justified:|#\s*justified:/i.test(line);
}

/**
 * Extract ADDED content lines from apply_patch text. The apply_patch envelope uses
 * `+`-prefixed lines for additions; we ignore the `+++ ` file header and the
 * `*** Add/Update/Delete File:` directives. Returns the added line bodies (without `+`).
 */
export function addedLines(patchText        )           {
  const out           = [];
  for (const raw of patchText.split("\n")) {
    if (raw.startsWith("+++") || raw.startsWith("+ +")) continue; // diff file header
    if (raw.startsWith("+")) out.push(raw.slice(1));
  }
  return out;
}



/** Scan the added lines of an apply_patch command for the first forbidden match. */
export function lintApplyPatch(toolInputCommand         )             {
  if (typeof toolInputCommand !== "string" || toolInputCommand.length === 0) return { ok: true };
  for (const line of addedLines(toolInputCommand)) {
    if (isJustified(line)) continue;
    for (const p of FORBIDDEN_PATTERNS) {
      if (p.re.test(line)) {
        return { ok: false, reason: `${p.msg} (line: ${line.trim().slice(0, 120)})` };
      }
    }
  }
  return { ok: true };
}

const LINTABLE_TOOLS = new Set(["apply_patch", "Write", "Edit"]);







/**
 * FAIL-OPEN PreToolUse dispatch for the apply_patch lint. Returns a deny envelope ONLY
 * on a confirmed static match; any parse miss / wrong tool / error -> "" (allow). This is
 * intentionally NOT routed through the R-9 fail-closed dispatcher.
 */
export function handleApplyPatchLint(raw        )         {
  try {
    const parsed = JSON.parse((raw ?? "").trim())                    ;
    if (!parsed || typeof parsed !== "object") return "";
    if (parsed.hook_event_name !== "PreToolUse") return "";
    if (typeof parsed.tool_name !== "string" || !LINTABLE_TOOLS.has(parsed.tool_name)) return "";
    const input = parsed.tool_input;
    const command = input && typeof input === "object" ? (input                           ).command : undefined;
    const result = lintApplyPatch(command);
    if (result.ok) return "";
    return `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `[codexclaw comment-lint] ${result.reason}`,
      },
    })}\n`;
  } catch {
    return ""; // FAIL-OPEN: never deny on a hook crash
  }
}
