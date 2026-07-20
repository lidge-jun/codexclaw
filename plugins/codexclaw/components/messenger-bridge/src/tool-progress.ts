import type { RunnerEvent } from "./runner.ts";

export const TOOL_PROGRESS_MODES = ["off", "new", "all", "verbose"] as const;
export type ToolProgressMode = (typeof TOOL_PROGRESS_MODES)[number];
export const DEFAULT_TOOL_PROGRESS: ToolProgressMode = "new";

export interface ToolProgressLine {
  callId: string;
  phase: "started" | "completed";
  text: string;
}

export interface ToolProgressPolicy {
  render: (event: RunnerEvent) => ToolProgressLine | null;
  reset: () => void;
}

export interface ToolProgressFilter {
  (event: RunnerEvent): ToolProgressLine | null;
  reset: () => void;
}

const NAME_MAX = 100;
const INPUT_MAX = 160;
const RESULT_MAX = 300;

export function createToolProgressPolicy(mode: ToolProgressMode): ToolProgressPolicy {
  const seen = new Set<string>();

  const render = (event: RunnerEvent): ToolProgressLine | null => {
    if (mode === "off" || event.kind !== "tool_call") return null;
    if (mode === "new" && event.phase !== "started") return null;

    const key = `${event.callId}\u0000${event.phase}`;
    if (seen.has(key)) return null;
    seen.add(key);

    const name = sanitize(event.name, NAME_MAX) || "tool";
    if (event.phase === "started") {
      const input = sanitize(event.input, INPUT_MAX);
      return {
        callId: event.callId,
        phase: event.phase,
        text: `▶ ${name}${input ? ` ${input}` : ""}`,
      };
    }

    const marker = event.outcome === "success" ? "✓" : event.outcome === "error" ? "✗" : "■";
    const result = mode === "verbose" ? sanitize(event.resultSummary ?? "", RESULT_MAX) : "";
    return {
      callId: event.callId,
      phase: event.phase,
      text: `${marker} ${name}${result ? ` — ${result}` : ""}`,
    };
  };

  return { render, reset: () => seen.clear() };
}

export function createToolProgressFilter(mode: ToolProgressMode): ToolProgressFilter {
  const policy = createToolProgressPolicy(mode);
  const filter = ((event: RunnerEvent) => policy.render(event)) as ToolProgressFilter;
  filter.reset = policy.reset;
  return filter;
}

function sanitize(value: string, maxLength: number): string {
  let text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/<@!?\d+>/g, "@user")
    .replace(/@(everyone|here)\b/gi, "[$1]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "$1[redacted]")
    .replace(/\b(token|api[_-]?key|secret|password)(\s*[:=]\s*)[^\s,;}]+/gi, "$1$2[redacted]")
    .trim();
  if (text.length > maxLength) text = `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  return text;
}
