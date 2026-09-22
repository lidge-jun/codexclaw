/** Strict, read-only subset of the observed flat automation TOML store.
 * Unsupported syntax is an unavailable ownership snapshot, never a guessed owner.
 */
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const MAX_STORE_BYTES = 64 * 1024;
const STRING_KEYS = new Set(["id", "kind", "target_thread_id", "name", "prompt", "rrule", "status"]);
const NUMBER_KEYS = new Set(["created_at", "updated_at", "version"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;

export interface AutomationOwnershipSnapshot {
  id: string;
  kind: string;
  targetThreadId: string;
}

export function isSafeAutomationId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function invalid(): never { throw new Error("unsupported automation store"); }

/** Consume a complete string before looking for another key. Never scan prompt lines as TOML. */
function stringValue(text: string, start: number, key: string): { value: string; end: number } {
  const quote = text[start];
  const multiline = text.slice(start, start + 3) === quote.repeat(3);
  if (multiline && key !== "prompt") invalid();
  let i = start + (multiline ? 3 : 1);
  const contentStart = i;
  while (i < text.length) {
    const ch = text[i];
    if (ch === quote && (!multiline || text.slice(i, i + 3) === quote.repeat(3))) {
      const end = i + (multiline ? 3 : 1);
      // Four/five-quote endings are valid TOML, but outside this supported subset.
      if (multiline && text[end] === quote) invalid();
      const value = multiline ? "" : quote === "'" ? text.slice(contentStart, i) : JSON.parse(text.slice(start, end));
      return { value, end };
    }
    if ((!multiline && (ch === "\n" || ch === "\r")) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(ch)) invalid();
    if (ch === "\\" && quote === '"') {
      const next = text[i + 1];
      if (multiline && (next === "\n" || next === "\r" || next === " " || next === "\t")) {
        const continuation = /^[ \t]*\r?\n[ \t\r\n]*/.exec(text.slice(i + 1));
        if (!continuation) invalid();
        i += 1 + continuation[0].length;
        continue;
      }
      if (next === "u") {
        if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) invalid();
        const code = Number.parseInt(text.slice(i + 2, i + 6), 16);
        if (code >= 0xd800 && code <= 0xdfff) invalid();
        i += 6;
        continue;
      }
      if (!next || !'btnfr"\\'.includes(next)) invalid();
      i += 2;
      continue;
    }
    i++;
  }
  return invalid();
}

function parseStore(text: string): AutomationOwnershipSnapshot {
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|\r(?!\n)/.test(text)) invalid();
  const values = new Map<string, string | number>();
  let offset = 0;
  while (offset < text.length) {
    const whitespace = /^[ \t\r\n]*(?:#[^\r\n]*(?:\r?\n|$)[ \t\r\n]*)*/.exec(text.slice(offset))![0];
    offset += whitespace.length;
    if (offset === text.length) break;
    const assignment = /^([a-z_]+)[ \t]*=[ \t]*/.exec(text.slice(offset));
    if (!assignment) invalid();
    const key = assignment[1];
    if (values.has(key) || (!STRING_KEYS.has(key) && !NUMBER_KEYS.has(key))) invalid();
    offset += assignment[0].length;
    if (STRING_KEYS.has(key)) {
      if (text[offset] !== '"' && text[offset] !== "'") invalid();
      const parsed = stringValue(text, offset, key);
      values.set(key, parsed.value);
      offset = parsed.end;
    } else {
      const integer = /^(?:0|[1-9][0-9]*)/.exec(text.slice(offset));
      if (!integer || !Number.isSafeInteger(Number(integer[0]))) invalid();
      values.set(key, Number(integer[0]));
      offset += integer[0].length;
    }
    const tail = /^[ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/.exec(text.slice(offset));
    if (!tail) invalid();
    offset += tail[0].length;
  }
  const id = values.get("id"), kind = values.get("kind"), owner = values.get("target_thread_id");
  if (!isSafeAutomationId(id) || typeof kind !== "string" || !isSafeAutomationId(owner)) invalid();
  if (values.has("version") && values.get("version") !== 1) invalid();
  return { id, kind, targetThreadId: owner };
}

/** No writes; bounded fd read rejects symlinks, non-regular files and changing snapshots.
 * Path inspection cannot provide atomic host mutation authorization (TOCTOU remains).
 */
export function readAutomationOwnership(codexHome: string, id: string): AutomationOwnershipSnapshot {
  if (!isAbsolute(codexHome) || !isSafeAutomationId(id)) invalid();
  const paths = [codexHome, join(codexHome, "automations"), join(codexHome, "automations", id)];
  for (const path of paths) {
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink()) invalid();
  }
  const path = join(realpathSync(paths[2]), "automation.toml");
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_STORE_BYTES) invalid();
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > MAX_STORE_BYTES) invalid();
    const buffer = Buffer.alloc(MAX_STORE_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    const after = fstatSync(fd);
    if (size > MAX_STORE_BYTES || size !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) invalid();
    const snapshot = parseStore(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size)));
    if (snapshot.id !== id) invalid();
    return snapshot;
  } finally { closeSync(fd); }
}
