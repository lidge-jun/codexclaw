/**
 * edit-shape.ts — PostToolUse advisory for repeated same-shaped edits (astgrep_active 00).
 *
 * Watches successful `apply_patch` calls, fingerprints each touched file's changed
 * lines into a normalized "edit shape" signature, and when the SAME shape has landed
 * in >= EDIT_SHAPE_ADVICE_THRESHOLD distinct files, injects a one-time additionalContext
 * nudge to switch to a deterministic ast-grep codemod ($cxc-ast-grep) instead of
 * hand-repeating the edit. ADVISORY ONLY: no decision:"block", never denies anything.
 *
 * Honest limits (same class as comment-lint 060.2 / friction 080.1):
 *  - Coverage: only structured `apply_patch` edits are seen; shell/exec writes are not.
 *  - HEURISTIC signature: strings -> S, numbers -> N, identifiers -> I, whitespace
 *    squeezed. Deliberately aggressive — a collision only risks a single gentle
 *    advisory, and the advice ("use ast-grep for repeated shapes") is right either way.
 *    Whole-file-hunk matching + the distinct-file threshold + advise-once dedupe keep
 *    the nag risk down.
 *  - FAIL-OPEN: any parse/IO error -> "" (no output, never blocks codex).
 *
 * Ledger: `.codexclaw/edit-shapes.jsonl` (append-only, project-local, no server).
 * PostToolUse additionalContext envelope parity: omo lsp/src/codex-hook.ts:36-42.
 */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";


export const STATE_DIR = ".codexclaw";
export const EDIT_SHAPE_FILE = "edit-shapes.jsonl";

/** Distinct-file count at which the one-time advisory fires (mirrors friction "stop"). */
export const EDIT_SHAPE_ADVICE_THRESHOLD = 3;















/**
 * Normalize one changed line to its shape: quoted strings -> S, numeric literals -> N,
 * identifier-ish tokens (keywords included) -> I, whitespace squeezed. SINGLE-PASS
 * tokenizer replace: sequential passes would re-consume the S/N placeholders as
 * identifiers (S is itself identifier-shaped), so all three token classes are matched
 * in one alternation and classified per match.
 */
const SHAPE_TOKEN = /(["'`])(?:\\.|(?!\1).)*?\1|\d[\w.]*|[A-Za-z_$][\w$]*/g;

export function normalizeEditLine(line        )         {
  const tokenized = line.trim().replace(SHAPE_TOKEN, (m, quote                    ) => {
    if (quote) return "S";
    return /^\d/.test(m) ? "N" : "I";
  });
  return tokenized.replace(/\s+/g, " ");
}

const FILE_DIRECTIVE = /^\*\*\* (Add|Update|Delete) File: (.+)$/;

/**
 * Split an apply_patch envelope into per-file shape signatures. A file's signature
 * covers ALL its changed (+/-) body lines in order — whole-hunk matching, not
 * per-line. Delete-file sections and sections with no changed lines yield nothing.
 */
export function fileEditShapes(patchText        )                  {
  const out                  = [];
  let file                = null;
  let deleting = false;
  let changed           = [];
  const flush = ()       => {
    if (file && !deleting && changed.length > 0) {
      const key = createHash("sha256").update(changed.join("\n"), "utf8").digest("hex");
      out.push({ file, key });
    }
    changed = [];
  };
  for (const raw of patchText.split("\n")) {
    const dir = FILE_DIRECTIVE.exec(raw);
    if (dir) {
      flush();
      deleting = dir[1] === "Delete";
      file = dir[2].trim();
      continue;
    }
    if (raw.startsWith("*** ")) {
      // Begin/End Patch, Move to, etc. — End Patch closes the current section.
      if (raw.startsWith("*** End Patch")) {
        flush();
        file = null;
      }
      continue;
    }
    if (file === null || deleting) continue;
    if (raw.startsWith("+++") || raw.startsWith("---")) continue; // diff headers
    if (raw.startsWith("+") || raw.startsWith("-")) {
      changed.push(`${raw[0]}${normalizeEditLine(raw.slice(1))}`);
    }
  }
  flush();
  return out;
}

function ledgerPath(cwd        )         {
  return join(cwd, STATE_DIR, EDIT_SHAPE_FILE);
}

/** Read all well-formed ledger rows (missing file / parse error -> []). FAIL-OPEN. */
export function readEditShapeRows(cwd        )                 {
  let raw        ;
  try {
    raw = readFileSync(ledgerPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out                 = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.length === 0) continue;
    try {
      const o = JSON.parse(t)                         ;
      if (o && typeof o.key === "string" && typeof o.file === "string") {
        out.push({
          ts: typeof o.ts === "string" ? o.ts : "",
          key: o.key,
          file: o.file,
          advised: o.advised === true,
        });
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}






function keyStates(rows                )                        {
  const map = new Map                  ();
  for (const r of rows) {
    let s = map.get(r.key);
    if (!s) {
      s = { files: new Set        (), advised: false };
      map.set(r.key, s);
    }
    if (r.advised) s.advised = true;
    else if (r.file.length > 0) s.files.add(r.file);
  }
  return map;
}

function appendRow(cwd        , row              )       {
  try {
    mkdirSync(join(cwd, STATE_DIR), { recursive: true });
    appendFileSync(ledgerPath(cwd), `${JSON.stringify(row)}\n`);
  } catch {
    // best-effort; advisory logic already ran on the in-memory state
  }
}

function adviceText(count        , files          )         {
  const sample = files.slice(0, 5).join(", ");
  return (
    `[codexclaw edit-shape] The same-shaped edit has now landed in ${count} distinct files ` +
    `(${sample}). If more call sites remain, stop hand-editing: load the $cxc-ast-grep skill and run ` +
    `a deterministic codemod (ast_grep_helper.py replace PATTERN REWRITE --lang <lang>; preview first, then --apply). ` +
    `See skills/ast-grep/references/patterns.md for verified patterns.`
  );
}

/**
 * PostToolUse capture for `apply_patch` (matcher ^apply_patch$). Records each touched
 * file's shape; when a shape reaches EDIT_SHAPE_ADVICE_THRESHOLD distinct files and
 * has not advised before, appends an advised-marker row and returns the one-time
 * additionalContext envelope. Otherwise returns "". FAIL-OPEN on any error.
 */
export function handleEditShapeCapture(payload                    )         {
  try {
    if (payload.hook_event_name !== "PostToolUse") return "";
    if (payload.tool_name !== "apply_patch") return "";
    const input = payload.tool_input;
    const command =
      input && typeof input === "object" ? (input                           ).command : undefined;
    if (typeof command !== "string" || command.length === 0) return "";

    const shapes = fileEditShapes(command);
    if (shapes.length === 0) return "";

    const states = keyStates(readEditShapeRows(payload.cwd));
    let advice                = null;
    for (const shape of shapes) {
      appendRow(payload.cwd, { ts: new Date().toISOString(), key: shape.key, file: shape.file });
      let s = states.get(shape.key);
      if (!s) {
        s = { files: new Set        (), advised: false };
        states.set(shape.key, s);
      }
      s.files.add(shape.file);
      if (!s.advised && s.files.size >= EDIT_SHAPE_ADVICE_THRESHOLD) {
        s.advised = true;
        appendRow(payload.cwd, { ts: new Date().toISOString(), key: shape.key, file: "", advised: true });
        if (!advice) advice = adviceText(s.files.size, [...s.files]);
      }
    }
    if (!advice) return "";
    return `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: advice,
      },
    })}\n`;
  } catch {
    return ""; // FAIL-OPEN
  }
}
