/** Decode OCX errors at the native wait string boundary; this is not a retry engine. */
const NEXT_CODES = new Set([
  "insufficient_quota", "rate_limit_exceeded", "upstream_server_error",
  "model_not_found", "unsupported_model", "unsupported_reasoning_effort",
  "input_admission_refused",
]);


export function decodeDispatchFailure(value         )                  {
  if (typeof value === "string") {
    const text = value.trim();
    try { return decodeDispatchFailure(JSON.parse(text)); } catch { /* native prose surface */ }
    // Codex 0.153.4 rewrites HTTP/SSE errors before wait_agent exposes them.
    // Match observed host templates, not quota/server keywords in arbitrary prose.
    if (text === "Quota exceeded. Check your plan and billing details.") {
      return codeDecision("insufficient_quota");
    }
    if (text === "exceeded retry limit, last status: 429 Too Many Requests" || text.startsWith("rate limit exceeded: ")) {
      return codeDecision("rate_limit_exceeded");
    }
    if (text === "We're currently experiencing high demand, which may cause temporary errors.") {
      return codeDecision("upstream_server_error");
    }
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
  const record = value                           ;
  // Only known envelope paths. Do not search arbitrary nested task output for error codes.
  if (typeof record.code === "string") return codeDecision(record.code);
  if (record.error !== undefined) return decodeDispatchFailure(record.error);
  if (record.last_error !== undefined) return decodeDispatchFailure(record.last_error);
  if (record.response && typeof record.response === "object") {
    return decodeDispatchFailure((record.response                           ).error);
  }
  return { code: null, action: "unknown" };
}
function codeDecision(code        )                  {
  // All other codes, including policy, auth, cancellation and context overflow, stop.
  return { code, action: NEXT_CODES.has(code) ? "next" : "stop" };
}
