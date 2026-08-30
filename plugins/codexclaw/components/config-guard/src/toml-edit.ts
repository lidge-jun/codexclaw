/**
 * toml-edit.ts — the component's single TOML table/key grammar, plus a scoped setter
 * for keys the official `codex features` CLI cannot reach.
 *
 * Why this exists: `codex features enable <flag>` only writes booleans inside
 * [features]. Keys that live in another table — `memories.dedicated_tools` is the
 * first — have no persisted CLI setter at all (`-c` is per-invocation only). The
 * same wall made opencodex hand-roll setMaxConcurrentThreads (src/codex/features.ts:415).
 *
 * Scope discipline: every function here is a PURE string -> string transform. File
 * IO, backups and the manifest live in activate.ts/cli.ts, so the whole grammar is
 * testable from fixture strings and can never reach the real ~/.codex on its own.
 *
 * Ownership: this module owns `tomlTableBody`/`findKeyLine` for the component.
 * multi-agent-v2.ts imports them rather than keeping a second copy of the same
 * regexes (audit blocker 1) — one grammar, one place to fix it.
 */
import { dominantEol, splitLines, withEol } from "./text-lines.ts";

/**
 * Values this module is allowed to write. Deliberately narrowed to boolean: the
 * whitelist holds one boolean key, and a generic string writer would have to solve
 * TOML quoting/comment splitting for value forms nothing needs yet (audit blocker 3).
 */
export type TomlScalar = boolean;

/** What the transform did. Tests assert on this so each branch proves it activated. */
export type TomlEditAction =
  | "updated"
  | "inserted-into-table"
  | "created-table"
  | "removed"
  | "noop"
  | "unsupported-value";

export interface TomlEditResult {
  /** Full new content. Identical to the input when nothing changed. */
  content: string;
  /** The value found before the edit, verbatim minus any comment tail. Null when absent. */
  priorValue: string | null;
  changed: boolean;
  action: TomlEditAction;
}

/** Escape a header for use inside a RegExp — dotted tables like `features.multi_agent_v2`
 *  otherwise match by accident. */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Index of the `[header]` line, or -1. A trailing comment on the header is allowed. */
export function findTableHeader(lines: readonly string[], header: string): number {
  const re = new RegExp(`^\\s*\\[${escapeForRegExp(header)}\\]\\s*(?:#.*)?$`);
  return lines.findIndex((line) => re.test(line));
}

/**
 * Body lines of a TOML table `[header]` up to (not including) the next table header.
 * Returns null when the table is absent.
 *
 * Moved here from multi-agent-v2.ts so the component has one implementation.
 */
export function tomlTableBody(content: string, header: string): string | null {
  const lines = splitLines(content);
  const start = findTableHeader(lines, header);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*\[/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/** Exclusive end index of a table body that starts after `headerIdx`. */
function tableBodyEnd(lines: readonly string[], headerIdx: number): number {
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) return i;
  }
  return lines.length;
}

export interface KeyLine {
  /** Absolute line index within the file. */
  index: number;
  /** Leading whitespace, preserved on rewrite. */
  indent: string;
  /** Raw value text with the comment tail removed, trimmed. */
  value: string;
  /** The comment tail including its leading spaces, or "" when there is none. */
  comment: string;
}

/**
 * Split `= <value> # <comment>` conservatively.
 *
 * Returns null for value forms this module refuses to rewrite: multi-line strings,
 * literal-string quoting, arrays and inline tables (audit blocker 3). A `#` inside a
 * quoted scalar is handled by scanning past the closing quote first; anything whose
 * quote does not close on the same line is refused rather than guessed at.
 */
function splitValueAndComment(raw: string): { value: string; comment: string } | null {
  const text = raw.trimStart();
  const lead = raw.slice(0, raw.length - text.length);
  if (text.startsWith('"""') || text.startsWith("'''") || text.startsWith("[") || text.startsWith("{")) {
    return null;
  }
  const quote = text.startsWith('"') ? '"' : text.startsWith("'") ? "'" : null;
  if (quote) {
    // Basic strings honor backslash escapes; literal strings ('...') do not.
    let i = 1;
    let closed = -1;
    while (i < text.length) {
      const ch = text[i];
      if (quote === '"' && ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) {
        closed = i;
        break;
      }
      i += 1;
    }
    if (closed === -1) return null; // unterminated on this line -> refuse
    const value = text.slice(0, closed + 1);
    const tail = text.slice(closed + 1);
    const hash = tail.indexOf("#");
    return hash === -1
      ? { value: lead + value + tail.trimEnd(), comment: "" }
      : { value: lead + value, comment: tail.slice(hash - countTrailingSpaces(tail.slice(0, hash))) };
  }
  // Bare value: the first '#' starts the comment, with or without a preceding space.
  const hash = text.indexOf("#");
  if (hash === -1) return { value: lead + text.trimEnd(), comment: "" };
  const before = text.slice(0, hash);
  const spaces = countTrailingSpaces(before);
  return { value: lead + before.trimEnd(), comment: before.slice(before.length - spaces) + text.slice(hash) };
}

function countTrailingSpaces(text: string): number {
  const m = /[ \t]*$/.exec(text);
  return m ? m[0].length : 0;
}

/**
 * Locate `key = value` inside the table that starts at `headerIdx`.
 * Returns null when the key is absent, and `"unsupported"` when the key exists but
 * carries a value form this module refuses to rewrite.
 */
export function findKeyLine(
  lines: readonly string[],
  headerIdx: number,
  key: string,
): KeyLine | "unsupported" | null {
  const end = tableBodyEnd(lines, headerIdx);
  const re = new RegExp(`^(\\s*)${escapeForRegExp(key)}\\s*=(.*)$`);
  for (let i = headerIdx + 1; i < end; i++) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const split = splitValueAndComment(m[2]);
    if (!split) return "unsupported";
    return { index: i, indent: m[1], value: split.value.trim(), comment: split.comment };
  }
  return null;
}

function serialize(value: TomlScalar): string {
  return value ? "true" : "false";
}

/** Last index of a non-blank line within [from, to), or from-1 when all blank. */
function lastNonBlank(lines: readonly string[], from: number, to: number): number {
  let idx = from - 1;
  for (let i = from; i < to; i++) {
    if (lines[i].trim().length > 0) idx = i;
  }
  return idx;
}

/**
 * Set `[table] key = value`, preserving line endings, comment tails, neighboring
 * tables and final-newline presence.
 */
export function setTableKey(
  content: string,
  table: string,
  key: string,
  value: TomlScalar,
): TomlEditResult {
  const eol = dominantEol(content);
  const lines = splitLines(content);
  const serialized = serialize(value);
  const headerIdx = findTableHeader(lines, table);

  if (headerIdx === -1) {
    const out = [...lines];
    // Keep exactly one blank line before a table we append, and never leave the
    // previous content glued to our header.
    while (out.length > 0 && out[out.length - 1].trim().length === 0) out.pop();
    if (out.length > 0) out.push("");
    out.push(`[${table}]`, `${key} = ${serialized}`, "");
    return {
      content: withEol(out.join("\n"), eol),
      priorValue: null,
      changed: true,
      action: "created-table",
    };
  }

  const found = findKeyLine(lines, headerIdx, key);
  if (found === "unsupported") {
    return { content, priorValue: null, changed: false, action: "unsupported-value" };
  }

  if (found) {
    if (found.value === serialized) {
      return { content, priorValue: found.value, changed: false, action: "noop" };
    }
    const out = [...lines];
    out[found.index] = `${found.indent}${key} = ${serialized}${found.comment}`;
    return {
      content: withEol(out.join("\n"), eol),
      priorValue: found.value,
      changed: true,
      action: "updated",
    };
  }

  const end = tableBodyEnd(lines, headerIdx);
  const insertAfter = lastNonBlank(lines, headerIdx + 1, end);
  const out = [...lines];
  out.splice(insertAfter + 1, 0, `${key} = ${serialized}`);
  return {
    content: withEol(out.join("\n"), eol),
    priorValue: null,
    changed: true,
    action: "inserted-into-table",
  };
}

/**
 * Restore `[table] key` to `priorValue`, or remove the key line when it is null.
 *
 * The `[table]` header is ALWAYS left in place, even when removing the last key
 * (audit blocker 4): the table belongs to codex, "empty" is not decidable from our
 * narrow view, and silently dropping a user's header plus its comments is a write
 * outside the key we own.
 */
export function restoreTableKey(
  content: string,
  table: string,
  key: string,
  priorValue: string | null,
): TomlEditResult {
  const eol = dominantEol(content);
  const lines = splitLines(content);
  const headerIdx = findTableHeader(lines, table);
  if (headerIdx === -1) return { content, priorValue: null, changed: false, action: "noop" };

  const found = findKeyLine(lines, headerIdx, key);
  if (found === "unsupported") {
    return { content, priorValue: null, changed: false, action: "unsupported-value" };
  }
  if (!found) return { content, priorValue: null, changed: false, action: "noop" };

  const out = [...lines];
  if (priorValue === null) {
    out.splice(found.index, 1);
    return {
      content: withEol(out.join("\n"), eol),
      priorValue: found.value,
      changed: true,
      action: "removed",
    };
  }
  if (found.value === priorValue) {
    return { content, priorValue: found.value, changed: false, action: "noop" };
  }
  out[found.index] = `${found.indent}${key} = ${priorValue}${found.comment}`;
  return {
    content: withEol(out.join("\n"), eol),
    priorValue: found.value,
    changed: true,
    action: "updated",
  };
}

/** Read the current raw value of `[table] key`, or null. Used by the wp3 drift guard. */
export function readTableKey(content: string, table: string, key: string): string | null {
  const lines = splitLines(content);
  const headerIdx = findTableHeader(lines, table);
  if (headerIdx === -1) return null;
  const found = findKeyLine(lines, headerIdx, key);
  if (found === "unsupported" || found === null) return null;
  return found.value;
}

