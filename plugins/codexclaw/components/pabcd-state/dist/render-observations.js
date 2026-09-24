/**
 * render-observations.ts — L2 render-observation ledger (C-RENDER-GROUNDING-01).
 *
 * Records two kinds of events to `.codexclaw/render-observations.jsonl`:
 *
 *  1. **Observation tool calls** (PostToolUse matcher): when the agent invokes
 *     view_image, browser:control-in-app-browser, chrome:control-chrome, or
 *     computer-use:computer-use, a row is appended proving the tool was called.
 *     HONEST LIMIT: codex-rs PostToolUse carries only a TRUNCATED tool_response,
 *     so we can confirm "tool was invoked" but not "the output was semantically
 *     read and evaluated." That gap is an accepted L2 limitation (L1 trust).
 *
 *  2. **Render-artifact file modifications** (extend of edit-shape apply_patch
 *     path): when apply_patch touches a file whose extension is in the
 *     render-artifact set, a row is appended. This feeds the Stop advisory
 *     ("render artifacts modified but no observation recorded").
 *
 * All IO is project-local under `cwd`. Every reader FAILS-OPEN (missing file or
 * parse error yields []).
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

import { fileEditShapes } from "./edit-shape.js";
import { splitLines } from "./text-lines.js";

export const STATE_DIR = ".codexclaw";
export const RENDER_OBS_FILE = "render-observations.jsonl";

/**
 * Starting render-artifact extension set (per-project configurable where a
 * config surface exists). Matches the sibling doc section 6 Q3 decision.
 */
export const RENDER_ARTIFACT_EXTENSIONS                      = new Set([
  ".html",
  ".svg",
  ".css",
  ".jsx",
  ".tsx",
]);

/**
 * Render-observation tool name set. These are the Codex-native tool names that
 * indicate the agent rendered and observed an artifact.
 */
export const RENDER_OBSERVATION_TOOLS                      = new Set([
  "view_image",
  "browser:control-in-app-browser",
  "chrome:control-chrome",
  "computer-use:computer-use",
]);














function ledgerPath(cwd        )         {
  return join(cwd, STATE_DIR, RENDER_OBS_FILE);
}

function appendRow(cwd        , row              )       {
  try {
    mkdirSync(join(cwd, STATE_DIR), { recursive: true });
    appendFileSync(ledgerPath(cwd), `${JSON.stringify(row)}\n`);
  } catch {
    // best-effort; advisory logic runs on in-memory state
  }
}

/** Read all well-formed ledger rows (missing file / parse error -> []). FAIL-OPEN. */
export function readRenderObsRows(cwd        )                 {
  let raw        ;
  try {
    raw = readFileSync(ledgerPath(cwd), "utf8");
  } catch {
    return [];
  }
  const out                 = [];
  for (const line of splitLines(raw)) {
    const t = line.trim();
    if (t.length === 0) continue;
    try {
      const o = JSON.parse(t)                         ;
      if (
        o &&
        typeof o.kind === "string" &&
        (o.kind === "observation" || o.kind === "artifact-modified" || o.kind === "native-observation") &&
        typeof o.detail === "string"
      ) {
        if (o.kind === "native-observation"
          && !(typeof o.nativeApp === "string" && o.nativeApp.trim())
          && !(typeof o.screenshotPath === "string" && o.screenshotPath.trim())) continue;
        out.push({
          ts: typeof o.ts === "string" ? o.ts : "",
          kind: o.kind,
          detail: o.detail,
          sessionId: typeof o.sessionId === "string" ? o.sessionId : "",
          ...(typeof o.nativeApp === "string" && o.nativeApp.trim() ? { nativeApp: o.nativeApp } : {}),
          ...(typeof o.screenshotPath === "string" && o.screenshotPath.trim() ? { screenshotPath: o.screenshotPath } : {}),
          ...(typeof o.criterionId === "string" && o.criterionId.trim() ? { criterionId: o.criterionId } : {}),
        });
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

/**
 * Reset the ledger at cycle start (transition into P). Without this, rows are
 * append-only forever: one historical observation row suppresses the Stop advisory
 * for the rest of the project's life, and stale artifact-modified rows from past
 * cycles keep triggering it. The advisory window is one PABCD cycle. FAIL-OPEN.
 */
export function resetRenderLedger(cwd        )       {
  try {
    mkdirSync(join(cwd, STATE_DIR), { recursive: true });
    writeFileSync(ledgerPath(cwd), "");
  } catch {
    // best-effort
  }
}

/** Check whether any observation rows exist in the ledger, optionally for one session. */
export function hasRenderObservation(cwd        , sessionId         )          {
  return readRenderObsRows(cwd).some(
    (r) => r.kind === "observation" && (sessionId === undefined || r.sessionId === sessionId),
  );
}

/** Check whether any artifact-modified rows exist in the ledger, optionally for one session. */
export function hasRenderArtifactModified(cwd        , sessionId         )          {
  return readRenderObsRows(cwd).some(
    (r) => r.kind === "artifact-modified" && (sessionId === undefined || r.sessionId === sessionId),
  );
}

/** Native observation signals are session-scoped, just like ordinary render rows. */
export function nativeObservationRows(cwd        , sessionId         )                 {
  return readRenderObsRows(cwd).filter(
    (r) => r.kind === "native-observation" && (sessionId === undefined || r.sessionId === sessionId),
  );
}

export function hasNativeObservation(cwd        , sessionId         )          {
  return nativeObservationRows(cwd, sessionId).length > 0;
}

/** Malformed ledger bytes cannot establish whether a native observation was recorded. */
export function nativeObservationLedgerMalformed(cwd        )          {
  let raw        ;
  try {
    raw = readFileSync(ledgerPath(cwd), "utf8");
  } catch (error) {
    return (error                         ).code !== "ENOENT";
  }
  for (const line of splitLines(raw)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line)           ;
      if (typeof row !== "object" || row === null || Array.isArray(row)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

function structuredField(value         , names          )                {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const fields = value                           ;
  for (const name of names) {
    const field = fields[name];
    if (typeof field === "string" && field.trim()) return field.trim();
  }
  return null;
}

/** A viewed screenshot counts only when a verdict in this session declared its exact path. */
function declaredScreenshot(cwd        , sessionId        , path        )                {
  if (!/^[A-Za-z0-9._-]+$/.test(sessionId) || sessionId === "." || sessionId === "..") return null;
  const qaRoot = join(cwd, STATE_DIR, "evidence", sessionId, "qa");
  const viewed = resolve(cwd, path);
  const visit = (dir        )          => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (visit(file)) return true;
      } else if (entry.isFile() && entry.name === "verdict.json") {
        const verdict = JSON.parse(readFileSync(file, "utf8"))                           ;
        if (Array.isArray(verdict.artifactRefs) && verdict.artifactRefs.some(
          (ref) => typeof ref === "string" && resolve(dirname(file), ref) === viewed,
        )) return true;
      }
    }
    return false;
  };
  return visit(qaRoot) ? viewed : null;
}

/**
 * Check whether a file path has a render-artifact extension.
 */
export function isRenderArtifact(filePath        )          {
  const ext = extname(filePath).toLowerCase();
  return RENDER_ARTIFACT_EXTENSIONS.has(ext);
}

/**
 * PostToolUse handler for render-observation tools (matcher
 * ^(view_image|browser:control-in-app-browser|chrome:control-chrome|computer-use:computer-use)$).
 *
 * Records that the observation tool was called. Side-effect only; always returns "".
 * FAIL-OPEN: any error returns "".
 */
export function handleRenderObservationCapture(payload                    )         {
  try {
    if (payload.hook_event_name !== "PostToolUse") return "";
    if (!RENDER_OBSERVATION_TOOLS.has(payload.tool_name)) return "";
    appendRow(payload.cwd, {
      ts: new Date().toISOString(),
      kind: "observation",
      detail: payload.tool_name,
      sessionId: payload.session_id,
    });
    const criterionId = structuredField(payload.tool_input, ["criterionId"])
      ?? structuredField(payload.tool_response, ["criterionId"]);
    if (payload.tool_name === "computer-use:computer-use") {
      const nativeApp = structuredField(payload.tool_input, ["appName", "application", "app"])
        ?? structuredField(payload.tool_response, ["appName", "application", "app"]);
      if (nativeApp) appendRow(payload.cwd, {
        ts: new Date().toISOString(), kind: "native-observation", detail: payload.tool_name,
        sessionId: payload.session_id, nativeApp,
        ...(criterionId ? { criterionId } : {}),
      });
    } else if (payload.tool_name === "view_image") {
      const path = structuredField(payload.tool_input, ["path"]);
      const screenshotPath = path ? declaredScreenshot(payload.cwd, payload.session_id, path) : null;
      if (screenshotPath) appendRow(payload.cwd, {
        ts: new Date().toISOString(), kind: "native-observation", detail: payload.tool_name,
        sessionId: payload.session_id, screenshotPath,
        ...(criterionId ? { criterionId } : {}),
      });
    }
  } catch {
    // FAIL-OPEN
  }
  return "";
}

/**
 * PostToolUse handler extension for apply_patch: detect when modified files have
 * render-artifact extensions and record them in the render-observations ledger.
 *
 * This is called from the SAME apply_patch PostToolUse path as edit-shape capture.
 * It only records; no advisory output. Returns "". FAIL-OPEN.
 */
export function handleRenderArtifactCapture(payload                    )         {
  try {
    if (payload.hook_event_name !== "PostToolUse") return "";
    if (payload.tool_name !== "apply_patch") return "";
    const input = payload.tool_input;
    const command =
      input && typeof input === "object" ? (input                           ).command : undefined;
    if (typeof command !== "string" || command.length === 0) return "";

    const shapes = fileEditShapes(command);
    for (const shape of shapes) {
      if (isRenderArtifact(shape.file)) {
        appendRow(payload.cwd, {
          ts: new Date().toISOString(),
          kind: "artifact-modified",
          detail: shape.file,
          sessionId: payload.session_id,
        });
      }
    }
  } catch {
    // FAIL-OPEN
  }
  return "";
}

/**
 * Build the render-grounding advisory text for the Stop handler. This is appended
 * to the stop output as additionalContext (NOT a decision:"block").
 */
export function renderGroundingAdvisory()         {
  return [
    "[codexclaw advisory — C-RENDER-GROUNDING-01] Render-artifact files were modified",
    "during this cycle, but no render-observation tool call (view_image,",
    "browser:control-in-app-browser, chrome:control-chrome, computer-use:computer-use)",
    "was recorded. Before C->D, RUN the artifact in its execution environment, OBSERVE",
    "the output (read the screenshot back), and FIX any defect. Well-formed (tsc/lint)",
    "is not correct -- a static parse does not confirm the artifact renders correctly.",
    "Defaults: 1280x720 viewport; drive stateful artifacts until first interactive",
    "state change. One clean observation suffices.",
  ].join(" ");
}
