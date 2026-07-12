import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const EVENT_LABELS = {
  PreToolUse: "pre_tool_use",
  PostToolUse: "post_tool_use",
  SessionStart: "session_start",
  UserPromptSubmit: "user_prompt_submit",
  Stop: "stop",
  SubagentStart: "subagent_start",
  SubagentStop: "subagent_stop",
  PreCompact: "pre_compact",
  PostCompact: "post_compact",
  PermissionRequest: "permission_request",
}         ;

// Upstream matcher_pattern_for_event (hooks/src/events/common.rs:105): the matcher
// is dropped from the identity ONLY for UserPromptSubmit and Stop; every other
// event (incl. SessionStart/SubagentStart/SubagentStop/PreCompact/PostCompact)
// keeps it as written. Live-verified 260710: subagent-stop hook with `^worker$`
// matcher hashes WITH the matcher (a narrower set here mis-reported it drifted).
const MATCHER_DROPPED_EVENTS = new Set               (["UserPromptSubmit", "Stop"]);





















































function assertSupportedPlatform()       {}

function sorted(value         )          {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    const record = value                           ;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sorted(record[key])]));
  }
  return value;
}

export function identityHash(eventName               , matcher                    , handler             )         {
  assertSupportedPlatform();
  const eventLabel = EVENT_LABELS[eventName];
  if (!eventLabel) throw new Error(`unsupported hook event: ${String(eventName)}`);
  if (handler.type !== undefined && handler.type !== "command") {
    throw new Error(`unsupported hook handler type: ${handler.type}`);
  }
  if (typeof handler.command !== "string") throw new Error("hook command must be a string");
  if (handler.timeout != null && (typeof handler.timeout !== "number" || !Number.isFinite(handler.timeout))) {
    throw new Error("hook timeout must be a finite number");
  }
  if (handler.async != null && typeof handler.async !== "boolean") throw new Error("hook async must be a boolean");
  if (handler.statusMessage != null && typeof handler.statusMessage !== "string") {
    throw new Error("hook statusMessage must be a string");
  }

  const normalizedHandler                          = {
    type: "command",
    command: handler.command,
    timeout: Math.max(handler.timeout ?? 600, 1),
    async: handler.async ?? false,
  };
  if (handler.statusMessage != null) normalizedHandler.statusMessage = handler.statusMessage;

  const identity                          = {
    event_name: eventLabel,
    hooks: [normalizedHandler],
  };
  if (!MATCHER_DROPPED_EVENTS.has(eventName) && matcher !== undefined) identity.matcher = matcher;
  const canonical = JSON.stringify(sorted(identity));
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function normalizeHookPath(path        )         {
  return path.replace(/^\.\//, "");
}

function assertSafeHeaderValue(value        , label        )       {
  if (!value || /["\\\r\n]/.test(value)) throw new Error(`${label} contains characters unsafe for a TOML quoted key`);
}

export function listHookEntries(pluginRoot        , pluginKey        )              {
  assertSupportedPlatform();
  assertSafeHeaderValue(pluginKey, "plugin key");
  const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"))

   ;
  if (!Array.isArray(manifest.hooks)) return [];

  const entries              = [];
  for (const hookRef of manifest.hooks) {
    if (typeof hookRef !== "string") throw new Error("plugin manifest hook references must be strings");
    const relativePath = normalizeHookPath(hookRef);
    assertSafeHeaderValue(relativePath, "hook path");
    const document = JSON.parse(readFileSync(join(pluginRoot, relativePath), "utf8"))

     ;
    for (const [rawEventName, rawGroups] of Object.entries(document.hooks ?? {})) {
      if (!(rawEventName in EVENT_LABELS)) throw new Error(`unsupported hook event: ${rawEventName}`);
      if (!Array.isArray(rawGroups)) throw new Error(`${relativePath}:${rawEventName} must contain an array`);
      const eventName = rawEventName                 ;
      for (const [groupIdx, rawGroup] of rawGroups.entries()) {
        if (!rawGroup || typeof rawGroup !== "object") throw new Error(`${relativePath}:${rawEventName}[${groupIdx}] is invalid`);
        const group = rawGroup                                          ;
        if (group.matcher !== undefined && typeof group.matcher !== "string") {
          throw new Error(`${relativePath}:${rawEventName}[${groupIdx}].matcher must be a string`);
        }
        if (!Array.isArray(group.hooks)) throw new Error(`${relativePath}:${rawEventName}[${groupIdx}].hooks must be an array`);
        if (typeof group.matcher === "string" && group.matcher !== "" && group.matcher !== "*") {
          try {
            new RegExp(group.matcher);
          } catch {
            continue;
          }
        }
        for (const [handlerIdx, rawHandler] of group.hooks.entries()) {
          if (!rawHandler || typeof rawHandler !== "object") {
            throw new Error(`${relativePath}:${rawEventName}[${groupIdx}].hooks[${handlerIdx}] is invalid`);
          }
          const handler = rawHandler               ;
          if (handler.type !== "command" || typeof handler.command !== "string" || handler.command.trim() === "") continue;
          if (handler.async === true) continue;
          entries.push({
            key: `${pluginKey}:${relativePath}:${EVENT_LABELS[eventName]}:${groupIdx}:${handlerIdx}`,
            hash: identityHash(eventName, group.matcher                      , handler),
          });
        }
      }
    }
  }
  return entries;
}

function updateMultilineState(line        , initial                            )                             {
  let multiline = initial;
  let inline                             = null;
  for (let index = 0; index < line.length; index += 1) {
    if (multiline === "basic") {
      if (line.startsWith('"""', index) && !isEscaped(line, index)) {
        multiline = null;
        index += 2;
      }
      continue;
    }
    if (multiline === "literal") {
      if (line.startsWith("'''", index)) {
        multiline = null;
        index += 2;
      }
      continue;
    }
    if (inline === "basic") {
      if (line[index] === "\\") index += 1;
      else if (line[index] === '"') inline = null;
      continue;
    }
    if (inline === "literal") {
      if (line[index] === "'") inline = null;
      continue;
    }
    if (line[index] === "#") break;
    if (line.startsWith('"""', index)) {
      multiline = "basic";
      index += 2;
    } else if (line.startsWith("'''", index)) {
      multiline = "literal";
      index += 2;
    } else if (line[index] === '"') {
      inline = "basic";
    } else if (line[index] === "'") {
      inline = "literal";
    }
  }
  return multiline;
}

function isEscaped(line        , index        )          {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function tomlLines(content        )             {
  const lines             = [];
  let multiline                             = null;
  let start = 0;
  while (start < content.length) {
    const newline = content.indexOf("\n", start);
    const end = newline === -1 ? content.length : newline + 1;
    const rawEnd = newline === -1 ? content.length : newline > start && content[newline - 1] === "\r" ? newline - 1 : newline;
    const text = content.slice(start, rawEnd);
    const structural = multiline === null;
    lines.push({ text, start, end, structural });
    multiline = updateMultilineState(text, multiline);
    start = end;
  }
  return lines;
}

function sections(content        )                {
  const headers = tomlLines(content).flatMap((line) => {
    if (!line.structural) return [];
    const match = line.text.match(/^[ \t]*(\[[^\r\n]+\])[ \t]*(?:#.*)?$/);
    return match ? [{ header: match[1], start: line.start, bodyStart: line.end }] : [];
  });
  return headers.map((header, index) => ({
    ...header,
    end: index + 1 < headers.length ? headers[index + 1].start : content.length,
  }));
}

function escapeRegExp(value        )         {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readInstalledPluginKeys(codexHome        , pluginName        )           {
  const configPath = join(codexHome, "config.toml");
  if (!existsSync(configPath)) return [];
  const content = readFileSync(configPath, "utf8");
  const headerPattern = new RegExp(`^\\[plugins\\."(${escapeRegExp(pluginName)}@[^"\\r\\n]+)"\\]$`);
  const found           = [];
  for (const section of sections(content)) {
    const match = section.header.match(headerPattern);
    if (!match) continue;
    const body = content.slice(section.bodyStart, section.end);
    const disabled = tomlLines(body).some(
      (line) => line.structural && /^[ \t]*enabled[ \t]*=[ \t]*false[ \t]*(?:#.*)?$/.test(line.text),
    );
    if (!disabled) found.push(match[1]);
  }
  return found;
}

function trustedHashLines(body        )                    {
  return tomlLines(body).flatMap((line) => {
    if (!line.structural) return [];
    const match = line.text.match(/^[ \t]*trusted_hash[ \t]*=[ \t]*"([^"]*)"[ \t]*(?:#.*)?$/);
    return match ? [{ value: match[1], start: line.start, text: line.text }] : [];
  });
}

function exactHookSections(content        , key        )                {
  const header = `[hooks.state."${key}"]`;
  return sections(content).filter((section) => section.header === header);
}

export function diagnoseHookTrust(codexHome        , pluginRoot        , pluginKey        )                    {
  const configPath = join(codexHome, "config.toml");
  const content = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  return listHookEntries(pluginRoot, pluginKey).map((entry) => {
    const matchingSections = exactHookSections(content, entry.key);
    const hashes = matchingSections.flatMap((section) => trustedHashLines(content.slice(section.bodyStart, section.end)));
    const actual = matchingSections.length === 1 && hashes.length === 1 ? hashes[0].value : null;
    return {
      ...entry,
      actual,
      status: actual === null ? "untrusted" : actual === entry.hash ? "trusted" : "drifted",
    };
  });
}

function insertMissingSections(content        , entries             )         {
  if (entries.length === 0) return content;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const block = entries
    .map((entry) => `[hooks.state."${entry.key}"]${newline}trusted_hash = "${entry.hash}"${newline}`)
    .join(newline);
  const firstHookState = sections(content).find((section) => section.header.startsWith("[hooks.state."));
  if (firstHookState) {
    const before = content.slice(0, firstHookState.start);
    const separator = before.length > 0 && !before.endsWith(newline) ? newline : "";
    return `${before}${separator}${block}${newline}${content.slice(firstHookState.start)}`;
  }
  const separator = content.length > 0 && !content.endsWith(newline) ? newline : "";
  const leading = content.length > 0 ? newline : "";
  return `${content}${separator}${leading}${block}`;
}

function writeAtomic(path        , content        )       {
  const tmpPath = join(dirname(path), `.config.toml.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmpPath, content, { encoding: "utf8", flag: "wx", mode: statSync(path).mode });
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // The temp file may not have been created or may already have been renamed.
    }
    throw error;
  }
}

function resolvedConfigPath(configPath        )         {
  return lstatSync(configPath).isSymbolicLink() ? realpathSync(configPath) : configPath;
}

function verifyCodexConfig(codexHome        , runner                 )       {
  const result = runner("codex", ["features", "list"], {
    encoding: "utf8",
    env: { ...process.env, CODEX_HOME: codexHome },
  });
  if (result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? `exit ${String(result.status)}`;
    throw new Error(`codex features list verification failed: ${detail}`);
  }
}

export function retrustHooks(
  codexHome        ,
  pluginRoot        ,
  pluginKey        ,
  bootstrapOk = false,
  runner                  = spawnSync,
)                {
  assertSupportedPlatform();
  const configPath = join(codexHome, "config.toml");
  if (!existsSync(configPath)) throw new Error(`missing ${configPath}`);
  const targetPath = resolvedConfigPath(configPath);
  const original = readFileSync(targetPath, "utf8");
  const expected = listHookEntries(pluginRoot, pluginKey);
  if (expected.length === 0) throw new Error("plugin declares no synchronous command hooks to trust");

  const replacements                                                       = [];
  const missing              = [];
  let existingCount = 0;
  let matchingCount = 0;

  for (const entry of expected) {
    const matchingSections = exactHookSections(original, entry.key);
    if (matchingSections.length > 1) throw new Error(`duplicate section header: [hooks.state."${entry.key}"]`);
    if (matchingSections.length === 0) {
      missing.push(entry);
      continue;
    }
    existingCount += 1;
    const section = matchingSections[0];
    const body = original.slice(section.bodyStart, section.end);
    const hashes = trustedHashLines(body);
    if (hashes.length > 1) throw new Error(`multiple trusted_hash lines in [hooks.state."${entry.key}"]`);
    if (hashes.length === 0) throw new Error(`missing trusted_hash in [hooks.state."${entry.key}"]`);
    if (hashes[0].value === entry.hash) matchingCount += 1;
    const lineStart = section.bodyStart + hashes[0].start;
    const fullLine = hashes[0].text;
    const valueStart = lineStart + fullLine.indexOf('"') + 1;
    const valueEnd = valueStart + hashes[0].value.length;
    replacements.push({ start: valueStart, end: valueEnd, value: entry.hash });
  }

  if (existingCount === 0 && !bootstrapOk) {
    throw new Error("no existing hook trust entries match this plugin key; pass --bootstrap-ok to initialize trust");
  }
  if (existingCount > 0 && matchingCount === 0) {
    throw new Error("safety pin failed: no existing hook trust entry matches its recomputed hash");
  }

  let next = original;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    next = `${next.slice(0, replacement.start)}${replacement.value}${next.slice(replacement.end)}`;
  }
  next = insertMissingSections(next, missing);

  const backupPath = `${targetPath}.bak-${new Date().toISOString()}`;
  copyFileSync(targetPath, backupPath, fsConstants.COPYFILE_EXCL);
  try {
    writeAtomic(targetPath, next);
    verifyCodexConfig(codexHome, runner);
    const verification = diagnoseHookTrust(codexHome, pluginRoot, pluginKey);
    const failed = verification.filter((result) => result.status !== "trusted");
    if (failed.length > 0) throw new Error(`post-write verification failed for ${failed.map((item) => item.key).join(", ")}`);
  } catch (error) {
    writeAtomic(targetPath, readFileSync(backupPath, "utf8"));
    throw error;
  }

  return { updated: replacements.length, appended: missing.length, backupPath };
}
