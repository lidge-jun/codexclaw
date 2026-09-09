/** Decode OCX errors at the native wait string boundary; this is not a retry engine. */
const NEXT_CODES = new Set([
  "insufficient_quota", "rate_limit_exceeded", "upstream_server_error",
  "model_not_found", "unsupported_model", "unsupported_reasoning_effort",
  "input_admission_refused",
]);
export interface FailureDecision { code: string | null; action: "next" | "stop" | "unknown"; }

export function decodeDispatchFailure(value: unknown): FailureDecision {
  if (typeof value === "string") {
    const text = value.trim();
    try { return decodeDispatchFailure(JSON.parse(text)); } catch { /* native prose surface */ }
    // Only complete code tokens and canonical transport prefixes, never arbitrary keywords.
    if (/^[a-z][a-z0-9_]*$/.test(text)) return codeDecision(text);
    if (/^(?:Cursor rate limit exceeded|Rate limit reached)(?:[\s.:]|$)/i.test(text)) {
      return codeDecision("rate_limit_exceeded");
    }
    if (/^(?:You've hit your usage limit|You have exceeded your current quota)(?:[\s.:]|$)/i.test(text)) {
      return codeDecision("insufficient_quota");
    }
    return { code: null, action: "unknown" };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { code: null, action: "unknown" };
  const record = value as Record<string, unknown>;
  // Only known envelope paths. Do not search arbitrary nested task output for error codes.
  if (typeof record.code === "string") return codeDecision(record.code);
  if (record.error !== undefined) return decodeDispatchFailure(record.error);
  if (record.last_error !== undefined) return decodeDispatchFailure(record.last_error);
  if (record.response && typeof record.response === "object") {
    return decodeDispatchFailure((record.response as Record<string, unknown>).error);
  }
  return { code: null, action: "unknown" };
}
function codeDecision(code: string): FailureDecision {
  // All other codes, including policy, auth, cancellation and context overflow, stop.
  return { code, action: NEXT_CODES.has(code) ? "next" : "stop" };
}
