/**
 * detect.ts — opencodex (`ocx`) DETECT-ONLY provider detection (L23 / 230).
 *
 * Q-P2-2: detect-only. We resolve whether `ocx` exists and, if so, read its
 * NON-MUTATING status (`ocx status --json`). We NEVER run `ocx ensure`/`sync`
 * (those mutate codex config), never mutate codex config ourselves, and never
 * vendor opencodex. When ocx is absent, codexclaw stays on the native Codex
 * catalog. A detected-but-unreadable ocx is reported as ERROR — never silently
 * downgraded to the absent path (that would hide a real failure).
 *
 * Ground truth (opencodex v2.6.x): `ocx` has no `list` command; `ocx status
 * --json` is the read-only probe and reports proxy running state, defaultProvider,
 * and the listen port (the 10100 link-bar surface L27/L28 need). The models
 * catalog itself is synced into codex config separately (L25 reads that).
 */


















/** Parse `ocx status --json` output into the fields the bridge surfaces.
 *  Returns null when the payload is missing/unparseable. */
export function parseOcxStatus(stdout        )                   {
  const text = (stdout ?? "").trim();
  if (!text) return null;
  let parsed         ;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed                           ;
  const proxy = (obj.proxy ?? {})                           ;
  const listen = (obj.listen ?? {})                           ;
  // Require at least the proxy.running boolean to consider this a valid status.
  if (typeof proxy.running !== "boolean") return null;
  return {
    running: proxy.running,
    defaultProvider: typeof obj.defaultProvider === "string" ? obj.defaultProvider : null,
    port: typeof listen.port === "number" ? listen.port : null,
  };
}

/**
 * Detect opencodex. Pure given its injectable deps; the real CLI passes a
 * PATH-resolver and a `status --json` runner.
 */
export function detectOcx(deps             = {})                 {
  const which = deps.which ?? (() => null);
  const ocxPath = which("ocx");
  if (!ocxPath) {
    return { mode: "native", reason: "ocx not found on PATH; using native Codex catalog" };
  }

  const runStatus = deps.runStatus;
  if (!runStatus) {
    return { mode: "error", ocxPath, reason: "ocx detected but no status reader available" };
  }

  let result                                           ;
  try {
    result = runStatus(ocxPath);
  } catch (err) {
    return { mode: "error", ocxPath, reason: `ocx status invocation threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (result.status !== 0) {
    return { mode: "error", ocxPath, reason: `ocx status exited ${result.status ?? "null"}` };
  }
  const status = parseOcxStatus(result.stdout);
  if (!status) {
    return { mode: "error", ocxPath, reason: "ocx status produced no parseable payload" };
  }
  return { mode: "provider", ocxPath, status };
}

/** Render a single machine-readable status line for downstream catalog/GUI. */
export function renderStatusLine(status                )         {
  switch (status.mode) {
    case "provider":
      return JSON.stringify({ provider: "ocx", mode: "provider", ocxPath: status.ocxPath, ...status.status });
    case "native":
      return JSON.stringify({ provider: "ocx", mode: "native", reason: status.reason });
    case "error":
      return JSON.stringify({ provider: "ocx", mode: "error", ocxPath: status.ocxPath, reason: status.reason });
  }
}
