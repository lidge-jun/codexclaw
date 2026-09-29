import { closeSync, lstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const MAX_META_LINE_BYTES = 64 * 1024;
const MAX_CONFIG_BYTES = 1024 * 1024;
const ALLOW = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}';
const MODEL_ADVICE = "This Codex Desktop agent-created thread may show approval prompts even though the user Codex config requests full access. Request escalation explicitly for network or git operations when needed. If the user enabled permissions.agentCreatedThreadAutoAllow, codexclaw answers pending approvals, including one-time network requests, without prompting; it never changes this thread's sandbox.";
const USER_ADVICE = "This agent-created thread started in the default approval mode despite your full-access Codex config, so approval prompts may appear. You can switch this thread to Full Access in the composer, or set permissions.agentCreatedThreadAutoAllow to true in ~/.codexclaw/config.json so codexclaw answers these approvals for you, including one-time network requests.";



function object(value         )                    {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value               : null;
}

function readFirstRecord(path        )                    {
  if (!isAbsolute(path)) return null;
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(MAX_META_LINE_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const count = readSync(fd, buffer, used, buffer.length - used, used);
      if (count === 0) break;
      used += count;
      const end = buffer.subarray(0, used).indexOf(10);
      if (end >= 0) return end > MAX_META_LINE_BYTES ? null :
        object(JSON.parse(buffer.subarray(0, end).toString("utf8")));
    }
    if (used === 0 || used > MAX_META_LINE_BYTES) return null;
    return object(JSON.parse(buffer.subarray(0, used).toString("utf8")));
  } finally {
    closeSync(fd);
  }
}

function agentCreatedRoot(input            )          {
  if (input.permission_mode !== "default" ||
      typeof input.session_id !== "string" || input.session_id.length === 0 ||
      typeof input.transcript_path !== "string" ||
      Object.hasOwn(input, "agent_id") || Object.hasOwn(input, "agent_type")) return false;
  const record = readFirstRecord(input.transcript_path);
  const payload = object(record?.payload);
  return record?.type === "session_meta" && payload?.id === input.session_id &&
    payload.thread_source === "agent_created_thread" && payload.forked_from_id == null;
}

function boundedText(path        )                {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) return null;
  return readFileSync(path, "utf8");
}

/** Dates and times must name a real calendar day and clock time. */
/** A decimal float or integer must be representable; `1e9999` overflows in Codex's parser. */
function finiteNumber(token        )          {
  if (!/^[+-]?(?:\d|\.)/.test(token) || /^[+-]?(?:inf|nan)$/.test(token) || /^\d{4}-|^\d\d:/.test(token)) return true;
  const clean = token.replace(/_/g, "");
  const radix = /^0[xob]/i.exec(clean);
  if (radix || !/[.eE]/.test(clean)) {
    // Integers of every radix must fit a signed 64-bit value, as in Codex's parser.
    const negative = clean.startsWith("-");
    const digits = clean.replace(/^[+-]/, "");
    const value = BigInt(radix ? `0${digits[1].toLowerCase()}${digits.slice(2)}` : digits);
    return negative ? value <= 9223372036854775808n : value <= 9223372036854775807n;
  }
  return Number.isFinite(Number(clean));
}

function validDateTime(token        )          {
  const date = /^(\d{4})-(\d\d)-(\d\d)/.exec(token);
  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  }
  const time = /(?:^|[Tt ])(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:[Zz]|[+-](\d\d):(\d\d))?$/.exec(token);
  if (time) {
    if (Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3]) > 60) return false;
    if (time[4] !== undefined && (Number(time[4]) > 23 || Number(time[5]) > 59)) return false;
  }
  return true;
}

function trustedConfigText(
  overrideValue                    , defaultDirectory        , filename        , cwd        ,
)                {
  const override = overrideValue?.trim();
  if (override && !isAbsolute(override)) return null;
  const home = override || join(homedir(), defaultDirectory);
  const configPath = join(home, filename);
  const realCwd = realpathSync(cwd);
  const realConfig = realpathSync(configPath);
  const rel = relative(realCwd, realConfig);
  const withinCwd = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  // The home-cwd exception covers only the literal default file: if the default
  // directory or file is a symlink anywhere, its real path differs and it is judged
  // like any other file inside cwd.
  const realHome = realpathSync(homedir());
  const defaultAtHome = !override && realCwd === realHome &&
    realConfig === join(realHome, defaultDirectory, filename) &&
    !lstatSync(configPath).isSymbolicLink() && lstatSync(configPath).isFile();
  if (withinCwd && !defaultAtHome) return null;
  return boundedText(realConfig);
}

function globalOptIn(env                   , cwd        )          {
  const config = object(JSON.parse(trustedConfigText(env.CODEXCLAW_HOME, ".codexclaw", "config.json", cwd) ?? "null"));
  const permissions = object(config?.permissions);
  return permissions?.agentCreatedThreadAutoAllow === true;
}



function table()            {
  return { kind: "table", children: new Map() };
}

function keyPath(source        , start = 0)                                          {
  let index = start;
  const parts           = [];
  const spaces = ()       => { while (source[index] === " " || source[index] === "\t") index += 1; };
  spaces();
  while (index < source.length) {
    let part = "";
    const quote = source[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      let closed = false;
      while (index < source.length) {
        const char = source[index++];
        if (char === quote) { closed = true; break; }
        if (/[\x00-\x1f\x7f]/.test(char)) return null;
        if (quote === '"' && char === "\\") {
          const escape = source[index++];
          const simple                         = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
          if (Object.hasOwn(simple, escape)) part += simple[escape];
          else if (escape === "u" || escape === "U") {
            const length = escape === "u" ? 4 : 8;
            const hex = source.slice(index, index + length);
            if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) return null;
            const code = Number.parseInt(hex, 16);
            if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
            part += String.fromCodePoint(code);
            index += length;
          } else return null;
        } else part += char;
      }
      if (!closed) return null;
    } else {
      const match = /^[A-Za-z0-9_-]+/.exec(source.slice(index));
      if (!match) return null;
      part = match[0];
      index += part.length;
    }
    parts.push(part);
    spaces();
    if (source[index] !== ".") break;
    index += 1;
    spaces();
    if (index >= source.length) return null;
  }
  return parts.length ? { parts, end: index } : null;
}

function assignKey(scope           , parts          )          {
  let current = scope;
  for (let index = 0; index < parts.length; index += 1) {
    const children = current.children;
    if (!children) return false;
    const name = parts[index];
    const existing = children.get(name);
    if (index === parts.length - 1) {
      if (existing) return false;
      children.set(name, { kind: "scalar" });
      return true;
    }
    if (!existing) {
      const nested = table();
      children.set(name, nested);
      current = nested;
    } else {
      if (existing.kind !== "table") return false;
      current = existing;
    }
  }
  return false;
}

function enterTable(root           , parts          , array         )                   {
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    const children = current.children;
    if (!children) return null;
    const name = parts[index];
    let entry = children.get(name);
    const last = index === parts.length - 1;
    if (last && array) {
      if (!entry) { entry = { kind: "array" }; children.set(name, entry); }
      if (entry.kind !== "array") return null;
      entry.latest = table();
      return entry.latest;
    }
    if (!entry) { entry = table(); children.set(name, entry); }
    if (entry.kind === "array") {
      if (!entry.latest) return null;
      current = entry.latest;
    } else if (entry.kind === "table") {
      if (last) {
        if (entry.declared) return null;
        entry.declared = true;
      }
      current = entry;
    } else return null;
  }
  return current;
}

/** A bounded structural scanner: unknown TOML is never permission evidence. */
function validValue(source        )          {
  let index = 0;
  const digits = "[0-9](?:_?[0-9])*";
  const scalar = new RegExp(`^(?:true|false|[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\\.${digits})?(?:[eE][+-]?${digits})?|[+-]?(?:inf|nan)|\\d{4}-\\d\\d-\\d\\d(?:[Tt ]\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?(?:[Zz]|[+-]\\d\\d:\\d\\d)?)?|\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?|0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[oO][0-7](?:_?[0-7])*|0[bB][01](?:_?[01])*)$`);
  const skip = ()       => {
    while (index < source.length) {
      if (/\s/.test(source[index])) { index += 1; continue; }
      if (source[index] === "#") {
        const end = source.indexOf("\n", index);
        index = end < 0 ? source.length : end;
        continue;
      }
      break;
    }
  };
  const quoted = ()          => {
    const quote = source[index];
    const triple = source.startsWith(quote.repeat(3), index);
    const mark = triple ? quote.repeat(3) : quote;
    index += mark.length;
    while (index < source.length) {
      if (source.startsWith(mark, index)) { index += mark.length; return true; }
      if (!triple && /[\r\n]/.test(source[index])) return false;
      if (/[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(source[index])) return false;
      if (quote === '"' && source[index] === "\\") {
        index += 1;
        const escape = source[index];
        if ("btnfr\"\\".includes(escape ?? "\0")) { index += 1; continue; }
        if (escape === "u" || escape === "U") {
          const length = escape === "u" ? 4 : 8;
          const hex = source.slice(index + 1, index + 1 + length);
          if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) return false;
          const code = Number.parseInt(hex, 16);
          if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return false;
          index += length + 1;
          continue;
        }
        if (triple) {
          const continuation = /^[ \t]*(?:\r?\n)/.exec(source.slice(index));
          if (continuation) { index += continuation[0].length; continue; }
        }
        return false;
      }
      index += 1;
    }
    return false;
  };
  // TOML 1.0 inline tables stay on one line (newlines only inside string values).
  const singleLineInline = (start        )          => {
    const body = source.slice(start, index)
      .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/g, "");
    return !/[\r\n]/.test(body);
  };
  const value = (depth        )          => {
    if (depth > 64) return false;
    skip();
    const opener = source[index];
    if (opener === '"' || opener === "'") return quoted();
    if (opener === "[" || opener === "{") {
      const start = index;
      index += 1;
      const closer = opener === "[" ? "]" : "}";
      const inline = opener === "{" ? table() : null;
      skip();
      if (source[index] === closer) { index += 1; return opener === "[" || singleLineInline(start); }
      while (index < source.length) {
        if (opener === "{") {
          const parsed = keyPath(source, index);
          if (!parsed || !assignKey(inline , parsed.parts)) return false;
          index = parsed.end;
          skip();
          if (source[index++] !== "=") return false;
        }
        if (!value(depth + 1)) return false;
        skip();
        if (source[index] === closer) { index += 1; return opener === "[" || singleLineInline(start); }
        if (source[index++] !== ",") return false;
        skip();
        if (opener === "[" && source[index] === closer) { index += 1; return true; }
      }
      return false;
    }
    const bare = /^[^\s,\]\}#]+/.exec(source.slice(index));
    if (!bare || !scalar.test(bare[0]) || !validDateTime(bare[0]) || !finiteNumber(bare[0])) return false;
    index += bare[0].length;
    return true;
  };
  if (!value(0)) return false;
  skip();
  return index === source.length;
}

function validTomlAndTopLevel(content        )          {
  const seen = new Map                ();
  const root = table();
  let current = root;
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      const array = line.startsWith("[[");
      const header = array ? /^\[\[(.*)\]\]\s*(?:#.*)?$/.exec(line) : /^\[(.*)\]\s*(?:#.*)?$/.exec(line);
      if (!header) return false;
      const parsed = keyPath(header[1]);
      if (!parsed || parsed.end !== header[1].length) return false;
      const next = enterTable(root, parsed.parts, array);
      if (!next) return false;
      current = next;
      continue;
    }
    const parsed = keyPath(line);
    if (!parsed || line[parsed.end] !== "=" || !assignKey(current, parsed.parts)) return false;
    const key = parsed.parts.length === 1 ? parsed.parts[0] : "";
    if (current === root && key === "profile") return false;
    let value = line.slice(parsed.end + 1).trimStart();
    while (!validValue(value)) {
      // Only arrays, inline tables and triple strings may continue onto another line.
      if (!/^(?:\[|\{|"""|''')/.test(value) || index + 1 >= lines.length) return false;
      value += `\n${lines[++index]}`;
    }
    if (current === root && (key === "approval_policy" || key === "sandbox_mode")) {
      const exact = /^"([^"\r\n]*)"\s*(?:#.*)?$/.exec(value);
      if (!exact) return false;
      seen.set(key, exact[1]);
    }
  }
  return seen.get("approval_policy") === "never" &&
    seen.get("sandbox_mode") === "danger-full-access";
}

function codexConfigFullAccess(env                   , cwd        )          {
  const content = trustedConfigText(env.CODEX_HOME, ".codex", "config.toml", cwd);
  if (content === null) return false;
  return validTomlAndTopLevel(content);
}

function coveredTool(name         )          {
  return typeof name === "string" &&
    (["Bash", "write_stdin", "apply_patch"].includes(name) ||
      isMcpToolName(name));
}

/** `mcp__<server>__<tool>` with both segments present. */
function isMcpToolName(name        )          {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return !!match && match[1].replace(/_/g, "") !== "" && match[2].replace(/_/g, "") !== "";
}

function parseHook(raw        , event        )                    {
  const input = object(JSON.parse(raw));
  return input?.hook_event_name === event ? input : null;
}

export function handleAgentThreadPermissionRequest(
  raw        , env                    = process.env,
)         {
  try {
    const input = parseHook(raw, "PermissionRequest");
    return input && typeof input.cwd === "string" && input.cwd !== "" &&
      coveredTool(input.tool_name) && globalOptIn(env, input.cwd) &&
      agentCreatedRoot(input) && codexConfigFullAccess(env, input.cwd) ? ALLOW : "";
  } catch {
    return "";
  }
}

export function handleAgentThreadSessionStartAdvisory(
  raw        , env                    = process.env,
)         {
  try {
    const input = parseHook(raw, "SessionStart");
    if (!input || typeof input.cwd !== "string" || input.cwd === "" ||
        !agentCreatedRoot(input) || !codexConfigFullAccess(env, input.cwd)) return "";
    return `${JSON.stringify({
      systemMessage: USER_ADVICE,
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: MODEL_ADVICE },
    })}\n`;
  } catch {
    return "";
  }
}
