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

function globalOptIn(env                   , cwd        )          {
  const override = env.CODEXCLAW_HOME?.trim();
  if (override && !isAbsolute(override)) return false;
  const home = override || join(homedir(), ".codexclaw");
  const configPath = join(home, "config.json");
  const realCwd = realpathSync(cwd);
  const realConfig = realpathSync(configPath);
  const rel = relative(realCwd, realConfig);
  const withinCwd = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  const defaultAtHome = !override && realCwd === realpathSync(homedir()) &&
    !lstatSync(configPath).isSymbolicLink() && lstatSync(configPath).isFile();
  if (withinCwd && !defaultAtHome) return false;
  const config = object(JSON.parse(boundedText(realConfig) ?? "null"));
  const permissions = object(config?.permissions);
  return permissions?.agentCreatedThreadAutoAllow === true;
}

/** A bounded structural scanner: unknown TOML is never permission evidence. */
function validValue(source        )          {
  let index = 0;
  const scalar = /^(?:true|false|[+-]?(?:0|[1-9](?:[0-9_]*[0-9])?)(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?|[+-]?(?:inf|nan)|\d{4}-\d\d-\d\d(?:[Tt ]\d\d:\d\d:\d\d(?:\.\d+)?(?:[Zz]|[+-]\d\d:\d\d)?)?|\d\d:\d\d:\d\d(?:\.\d+)?|0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)$/;
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
      if (quote === '"' && source[index] === "\\") index += 1;
      index += 1;
    }
    return false;
  };
  const key = ()          => {
    if (source[index] === '"' || source[index] === "'") return quoted();
    const match = /^[A-Za-z0-9_-]+/.exec(source.slice(index));
    if (!match) return false;
    index += match[0].length;
    return true;
  };
  const value = (depth        )          => {
    if (depth > 64) return false;
    skip();
    const opener = source[index];
    if (opener === '"' || opener === "'") return quoted();
    if (opener === "[" || opener === "{") {
      index += 1;
      const closer = opener === "[" ? "]" : "}";
      skip();
      if (source[index] === closer) { index += 1; return true; }
      while (index < source.length) {
        if (opener === "{") {
          if (!key()) return false;
          skip();
          if (source[index++] !== "=") return false;
        }
        if (!value(depth + 1)) return false;
        skip();
        if (source[index] === closer) { index += 1; return true; }
        if (source[index++] !== ",") return false;
        skip();
        if (opener === "[" && source[index] === closer) { index += 1; return true; }
      }
      return false;
    }
    const bare = /^[^\s,\]\}#]+/.exec(source.slice(index));
    if (!bare || !scalar.test(bare[0])) return false;
    index += bare[0].length;
    return true;
  };
  if (!value(0)) return false;
  skip();
  return index === source.length;
}

function validTomlAndTopLevel(content        )          {
  const seen = new Map                ();
  let inTopLevel = true;
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      if (!/^(?:\[\[[^[\]\r\n]+\]\]|\[[^[\]\r\n]+\])\s*(?:#.*)?$/.test(line)) return false;
      inTopLevel = false;
      continue;
    }
    const assignment = /^([A-Za-z0-9_-]+|"[^"\r\n]+"|'[^'\r\n]+')\s*=\s*(.*)$/.exec(line);
    if (!assignment) return false;
    const key = assignment[1].replace(/^["']|["']$/g, "");
    if (inTopLevel && key === "profile") return false;
    let value = assignment[2];
    while (!validValue(value)) {
      // Only arrays, inline tables and triple strings may continue onto another line.
      if (!/^(?:\[|\{|"""|''')/.test(value) || index + 1 >= lines.length) return false;
      value += `\n${lines[++index]}`;
    }
    if (inTopLevel && (key === "approval_policy" || key === "sandbox_mode")) {
      if (seen.has(key)) return false;
      const exact = /^"([^"\r\n]*)"\s*(?:#.*)?$/.exec(value);
      if (!exact) return false;
      seen.set(key, exact[1]);
    }
  }
  return seen.get("approval_policy") === "never" &&
    seen.get("sandbox_mode") === "danger-full-access";
}

function codexConfigFullAccess(env                   )          {
  const override = env.CODEX_HOME?.trim();
  if (override && !isAbsolute(override)) return false;
  const home = override || join(homedir(), ".codex");
  const content = boundedText(join(home, "config.toml"));
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
      agentCreatedRoot(input) && codexConfigFullAccess(env) ? ALLOW : "";
  } catch {
    return "";
  }
}

export function handleAgentThreadSessionStartAdvisory(
  raw        , env                    = process.env,
)         {
  try {
    const input = parseHook(raw, "SessionStart");
    if (!input || !agentCreatedRoot(input) || !codexConfigFullAccess(env)) return "";
    return `${JSON.stringify({
      systemMessage: USER_ADVICE,
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: MODEL_ADVICE },
    })}\n`;
  } catch {
    return "";
  }
}
