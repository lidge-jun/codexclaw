/**
 * friction.ts — project-local friction ledger (lazygap_impl 080.1).
 *
 * Ports cli-jaw's normalize + sha256 + retry/escalate/stop verdict into a daemon-free
 * `.codexclaw/friction.jsonl` ledger. A repeated (tool, normalized-error) signature
 * escalates: 1st occurrence -> retry, 2nd -> escalate, 3rd+ -> stop.
 *
 * HONEST OBSERVABILITY LIMIT (verified against codex-rs):
 *   codex-rs `PostToolUseCommandInput` carries NO error/success/exit_code — only
 *   tool_name/tool_input/tool_response. So CAPTURE is HEURISTIC: it scans the shell
 *   `tool_response` text for failure markers. It CANNOT see apply_patch correctness
 *   failures (they return a model error and never reach PostToolUse) nor true exit codes
 *   (exec_command reports success-for-logging even on nonzero exit). This is a real
 *   limitation, stated here and at the capture site — not complete failure observability.
 *
 * All IO is project-local under `cwd`; no goal-DB, no server. Every reader FAILS-OPEN
 * (a read/parse error yields no verdict, so callers allow).
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const STATE_DIR = ".codexclaw";
export const FRICTION_FILE = "friction.jsonl";












/**
 * Normalize an error string for stable signature hashing (cli-jaw parity): lowercase,
 * strip line:col coordinates, collapse absolute/relative paths and hex addresses to
 * placeholders, squeeze whitespace, cap length. The goal is that the "same" failure
 * recurring produces the SAME key even when line numbers or temp paths differ.
 */
export function normalizeError(s        )         {
  let out = (s ?? "").toLowerCase();
  out = out.replace(/0x[0-9a-f]+/g, "0xADDR"); // hex addresses
  out = out.replace(/:\d+:\d+/g, ":L:C"); // line:col
  out = out.replace(/:\d+\b/g, ":L"); // bare :line
  out = out.replace(/(\/[^\s:]+)+/g, "/PATH"); // posix-ish paths
  out = out.replace(/\s+/g, " ").trim();
  return out.slice(0, 500);
}

/** Stable signature for a (tool, normalized-error) pair. */
export function frictionKey(tool        , normalized        )         {
  return createHash("sha256").update(`${tool}:${normalized}`, "utf8").digest("hex");
}

/** Map an occurrence count to a verdict (cli-jaw thresholds). */
export function verdictForCount(count        )                  {
  if (count >= 3) return "stop";
  if (count >= 2) return "escalate";
  return "retry";
}

function frictionPath(cwd        )         {
  return join(cwd, STATE_DIR, FRICTION_FILE);
}

/** Read all well-formed ledger entries (best-effort; missing/parse error -> []). */
export function readFrictionEntries(cwd        )                  {
  let raw        ;
  try {
    raw = readFileSync(frictionPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out                  = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.length === 0) continue;
    try {
      const o = JSON.parse(t)                          ;
      if (o && typeof o.key === "string" && typeof o.count === "number") {
        out.push({
          ts: typeof o.ts === "string" ? o.ts : "",
          key: o.key,
          tool: typeof o.tool === "string" ? o.tool : "",
          normalized: typeof o.normalized === "string" ? o.normalized : "",
          count: o.count,
          verdict: verdictForCount(o.count),
        });
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

/** The current occurrence count for a signature (0 when never seen). */
export function currentCount(cwd        , key        )         {
  let max = 0;
  for (const e of readFrictionEntries(cwd)) {
    if (e.key === key && e.count > max) max = e.count;
  }
  return max;
}

/**
 * Record one occurrence of (tool, errorText): increments the running count for the
 * signature and appends a ledger row. Returns the resulting verdict. Never throws
 * (a write failure is swallowed and the computed verdict is still returned).
 */
export function recordFriction(cwd        , tool        , errorText        )                  {
  const normalized = normalizeError(errorText);
  const key = frictionKey(tool, normalized);
  const count = currentCount(cwd, key) + 1;
  const verdict = verdictForCount(count);
  const entry                = { ts: new Date().toISOString(), key, tool, normalized, count, verdict };
  try {
    mkdirSync(join(cwd, STATE_DIR), { recursive: true });
    appendFileSync(frictionPath(cwd), `${JSON.stringify(entry)}\n`);
  } catch {
    // best-effort; the verdict is still meaningful to the caller
  }
  return verdict;
}

/**
 * READ-ONLY verdict for a (tool, errorText) signature, or null when never recorded.
 * Used by the PreToolUse/Stop read gates; does NOT mutate the ledger and FAILS-OPEN.
 */
export function readFrictionVerdict(cwd        , tool        , errorText        )                         {
  try {
    const key = frictionKey(tool, normalizeError(errorText));
    const count = currentCount(cwd, key);
    return count > 0 ? verdictForCount(count) : null;
  } catch {
    return null;
  }
}

/**
 * The highest verdict currently on the ledger (for a coarse Stop escalate signal),
 * or null when the ledger is empty/unreadable. FAILS-OPEN.
 */
export function peakFrictionVerdict(cwd        )                         {
  try {
    let peak = 0;
    for (const e of readFrictionEntries(cwd)) {
      if (e.count > peak) peak = e.count;
    }
    return peak > 0 ? verdictForCount(peak) : null;
  } catch {
    return null;
  }
}

/** Common shell failure markers in a tool_response text (heuristic capture only). */
const FAILURE_MARKERS = [
  /\berror\b/i,
  /\btraceback\b/i,
  /\bexception\b/i,
  /\bcommand not found\b/i,
  /\bno such file or directory\b/i,
  /\bpermission denied\b/i,
  /\bsegmentation fault\b/i,
  /\bfatal:/i,
  /\bnpm err!/i,
  /\bexit code [1-9]/i,
];

/** Heuristic: does this shell tool_response text look like a failure? */
export function looksLikeFailure(text        )          {
  const t = (text ?? "").trim();
  if (t.length === 0) return false;
  return FAILURE_MARKERS.some((re) => re.test(t));
}
