/**
 * orchestrate-grammar.ts — pure parser for the explicit `$cxc-orchestrate` command
 * (L3a / 030). Distinct from the loose `detectTrigger()` heuristic in hook.ts: this
 * recognizes a line-anchored command `orchestrate <verb> [--attest <json>]` and is
 * the AUTHORITATIVE parse surface that L3b wires to `transition()`.
 *
 * Grammar (mirrors `jaw orchestrate <phase>`):
 *   [<prefix>] orchestrate <I|P|A|B|C|D|status|reset> [--attest <json>]
 * where <prefix> is one of: `$codexclaw:cxc-`, `$cxc-`, `cxc `, `/`, or empty.
 *
 * Line-anchored: the command must be its own (trimmed) line, so a phase word buried
 * in prose ("please orchestrate proper testing") does NOT parse — that stays the job
 * of the loose detector. Pure: no IO, never throws.
 */

import {                   coerceAttest } from "./attest.js";

/** Work-phase verbs (IDLE excluded — you cannot `orchestrate idle`) + control verbs. */












const VERB_TOKENS                                            = {
  i: "I",
  p: "P",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  status: "status",
  reset: "reset",
};

// Optional leading prefix the composer / shorthand may insert before `orchestrate`.
const PREFIX = /^(?:\$codexclaw:cxc-|\$cxc-|cxc\s+|\/)?/;
// `orchestrate <verb>` at line start, capturing the verb token and the rest.
const COMMAND = /^orchestrate\s+([A-Za-z]+)\s*(.*)$/i;

/**
 * Extract a brace-balanced JSON object beginning at the first `{` in `s`.
 * String literals are respected so a `}` inside a quoted value does not close early.
 * Returns the JSON substring, or null when no balanced object is found.
 */
export function extractBalancedJson(s        )                {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null; // unbalanced
}

/** Parse the `--attest <json>` tail of a command's argument string. */
function parseAttestTail(rest        )                                                                   {
  const idx = rest.search(/--attest\b/);
  if (idx < 0) return { rawAttest: null, attest: null };
  const after = rest.slice(idx + "--attest".length);
  const json = extractBalancedJson(after);
  if (json === null) {
    return { rawAttest: null, attest: null, attestError: "no balanced JSON object after --attest" };
  }
  try {
    const parsed = JSON.parse(json)           ;
    const att = coerceAttest(parsed);
    if (!att) return { rawAttest: json, attest: null, attestError: "attest JSON missing valid from/to" };
    return { rawAttest: json, attest: att };
  } catch {
    return { rawAttest: json, attest: null, attestError: "attest JSON is not valid JSON" };
  }
}

/**
 * Parse a submitted prompt for a line-anchored orchestrate command. Returns the
 * first matching command, or null when none is present. Pure, never throws.
 */
export function parseOrchestrateCommand(prompt        )                            {
  const lines = (prompt ?? "").split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.trim().replace(PREFIX, "");
    const m = COMMAND.exec(stripped);
    if (!m) continue;
    const verb = VERB_TOKENS[m[1].toLowerCase()];
    if (!verb) continue; // unknown verb token (e.g. "idle", "proper") -> not a command
    const { rawAttest, attest, attestError } = parseAttestTail(m[2] ?? "");
    return attestError ? { verb, rawAttest, attest, attestError } : { verb, rawAttest, attest };
  }
  return null;
}
