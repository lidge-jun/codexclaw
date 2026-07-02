/**
 * hook.ts — UserPromptSubmit recall-intent nudge.
 *
 * When the user's prompt references past work (Korean or English recall idioms)
 * and no recall command is already present, inject a short additionalContext
 * directive pointing at `cxc chat search` / `cxc memory search`. Stateless and
 * FAIL-OPEN: any parse/shape problem yields empty output (no injection).
 * Envelope parity with pabcd-state buildContextOutput (CRLF normalize, trim,
 * 32k cap — this directive is far below the cap).
 */

export interface UserPromptSubmitPayload {
  hook_event_name?: string;
  prompt?: string;
  cwd?: string;
  session_id?: string;
  turn_id?: string;
}

/** Past-work recall idioms. Korean forms cover 그때/지난번/저번/예전에/기억/뭐였지. */
const RECALL_PATTERNS: readonly RegExp[] = [
  /그때\s*(그|한|했|만든|작업)/,
  /지난\s*번/,
  /지난\s*세션/,
  /저번\s*(에|세션|주|것|거)/,
  /예전에\s*(하|했|만든|작업|쓰)/,
  /전에\s*(했|만든|작업했|얘기했|말했)/,
  /기억\s*(나|안\s*나|하|해)/,
  /뭐였지|뭐\s*였더라|어떻게\s*했었지|어디까지\s*했/,
  /\blast\s+(time|session|week)\b/i,
  /\bprevious(ly)?\s+(session|work|discussed|conversation)?\b/i,
  /\bwhat\s+did\s+(we|i|you)\s+(do|discuss|decide|build)\b/i,
  /\bremember\s+(when|what|the|that|how)\b/i,
  /\b(as|we)\s+discussed\s+(earlier|before|previously|last\s+time)\b/i,
  /\bdiscussed\s+previously\b/i,
  /\bearlier\s+(session|conversation|work)\b/i,
];

/**
 * Suppress the nudge when the prompt already drives recall itself — the `cxc`
 * form, the raw `codexclaw.mjs` form, a generic `chat/memory search` invocation,
 * or an explicit skill mention.
 */
const ALREADY_RECALLING =
  /\bcxc\s+(chat|memory)\s+(search|index)\b|\bcodexclaw(\.mjs)?\s+(chat|memory)\s+(search|index)\b|\b(chat|memory)\s+search\s+["']|\$cxc-recall\b/;

export function detectRecallIntent(prompt: string): boolean {
  if (prompt.trim() === "") return false;
  if (ALREADY_RECALLING.test(prompt)) return false;
  return RECALL_PATTERNS.some((re) => re.test(prompt));
}

const DIRECTIVE = [
  "[cxc-recall] The prompt references past work. Before asking the user to re-explain,",
  "search prior sessions (read-only):",
  '  cxc chat search "<distinctive terms>" --days 0   # full-history FTS over ~/.codex',
  '  cxc memory search "<topic>"                      # durable per-thread summaries',
  "Add --context 2 to read around a hit, --cwd <repo> to scope. Details: $cxc-recall.",
].join("\n");

const MAX_CTX = 32_768;

function buildContextOutput(eventName: string, ctx: string): string {
  const norm = (ctx ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!norm) return "";
  const capped =
    norm.length <= MAX_CTX
      ? norm
      : `${norm.slice(0, MAX_CTX - 64).replace(/[ \t\r\n]+$/, "")}\n\n[truncated]`;
  return `${JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: capped },
  })}\n`;
}

/** Returns the stdout line for the hook process ("" = no injection). */
export function handleUserPromptSubmit(payload: UserPromptSubmitPayload): string {
  try {
    if (payload.hook_event_name !== "UserPromptSubmit") return "";
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!detectRecallIntent(prompt)) return "";
    return buildContextOutput("UserPromptSubmit", DIRECTIVE);
  } catch {
    return "";
  }
}

/**
 * SessionStart: advertise recall so every agent session starts knowing past-work
 * search exists (cli-jaw AGENTS.md § Memory Lookup Scope parity). `status` is the
 * pre-fetched read-only index status line ("" when unavailable); the caller owns
 * the sqlite read so this stays pure and testable.
 */
export function handleSessionStart(status: string): string {
  const lines = [
    "[cxc-recall] Past-session recall is available (read-only). Before asking the user",
    "about prior work — unfamiliar terms, lost context, \"그때/지난번/last time\" — run:",
    '  cxc chat search "<terms>" --days 0   |   cxc memory search "<topic>"',
  ];
  if (status !== "") lines.push(`Index: ${status}. Details: $cxc-recall.`);
  else lines.push("Details: $cxc-recall.");
  return buildContextOutput("SessionStart", lines.join("\n"));
}

/**
 * PostCompact: compaction IS the context-loss moment — steer the agent to recover
 * specifics from past sessions instead of asking the user to re-explain.
 */
export function handlePostCompact(): string {
  return buildContextOutput(
    "PostCompact",
    [
      "[cxc-recall] Context was just compacted. If any earlier detail is now missing,",
      "recover it from past sessions before asking the user to repeat themselves:",
      '  cxc chat search "<distinctive terms>" --days 0 --context 2',
      '  cxc memory search "<topic>"',
      "Details: $cxc-recall.",
    ].join("\n"),
  );
}
