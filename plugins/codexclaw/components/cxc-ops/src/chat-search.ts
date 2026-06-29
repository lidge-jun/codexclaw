/**
 * chat-search.ts — wrapper over codex app-server `thread/search` (L20.4 / 204).
 *
 * The app-server JSON-RPC method `thread/search` exists (ThreadSearchParams with a
 * required `search_term`) but has no CLI/agent-tool surface, so this provides one.
 * When no app-server is reachable, it degrades to a clear "unavailable" message
 * instead of hanging or throwing — codexclaw has no server of its own to assume.
 */
export interface ChatSearchOptions {
  /** app-server base URL; default reads CODEX_APP_SERVER_URL or localhost. */
  baseUrl?: string;
  limit?: number;
  /** injectable fetch for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** abort timeout in ms (default 4000). */
  timeoutMs?: number;
}

export interface ChatSearchHit {
  threadId: string;
  snippet: string;
}

export type ChatSearchOutcome =
  | { status: "ok"; hits: ChatSearchHit[] }
  | { status: "no_results" }
  | { status: "unavailable"; reason: string };

function resolveBaseUrl(opts: ChatSearchOptions): string {
  return (
    opts.baseUrl ??
    process.env.CODEX_APP_SERVER_URL ??
    "http://127.0.0.1:1456"
  );
}

/**
 * Search chat threads. Always resolves (never rejects) so the CLI can print a
 * clean message: ok / no_results / unavailable.
 */
export async function chatSearch(term: string, opts: ChatSearchOptions = {}): Promise<ChatSearchOutcome> {
  const trimmed = (term ?? "").trim();
  if (!trimmed) return { status: "unavailable", reason: "empty search term" };

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { status: "unavailable", reason: "no fetch implementation available" };
  }

  const baseUrl = resolveBaseUrl(opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);

  try {
    const res = await fetchImpl(`${baseUrl}/thread/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ search_term: trimmed, limit: opts.limit ?? 20 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { status: "unavailable", reason: `app-server returned HTTP ${res.status}` };
    }
    const data = (await res.json()) as { results?: Array<{ thread_id?: string; snippet?: string }> };
    const hits: ChatSearchHit[] = (data.results ?? [])
      .filter((r) => typeof r.thread_id === "string")
      .map((r) => ({ threadId: r.thread_id as string, snippet: typeof r.snippet === "string" ? r.snippet : "" }));
    return hits.length ? { status: "ok", hits } : { status: "no_results" };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "app-server did not respond (timeout)"
        : `app-server unreachable: ${err instanceof Error ? err.message : String(err)}`;
    return { status: "unavailable", reason };
  } finally {
    clearTimeout(timer);
  }
}

export function renderChatSearch(outcome: ChatSearchOutcome): string {
  switch (outcome.status) {
    case "ok":
      return outcome.hits.map((h) => `${h.threadId}  ${h.snippet}`).join("\n");
    case "no_results":
      return "no results";
    case "unavailable":
      return `chat-search unavailable: ${outcome.reason}`;
  }
}
