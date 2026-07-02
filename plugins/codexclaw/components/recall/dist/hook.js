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









/** Past-work recall idioms. Korean forms cover 그때/지난번/저번/예전에/기억/뭐였지. */
const RECALL_PATTERNS                    = [
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
  /\b(as|we)\s+discussed\s+(earlier|before)\b/i,
  /\bearlier\s+(session|conversation|work)\b/i,
];

/** Suppress the nudge when the prompt already drives recall itself. */
const ALREADY_RECALLING = /\bcxc\s+(chat|memory)\s+(search|index)\b|\$cxc-recall\b/;

export function detectRecallIntent(prompt        )          {
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

function buildContextOutput(eventName        , ctx        )         {
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
export function handleUserPromptSubmit(payload                         )         {
  try {
    if (payload.hook_event_name !== "UserPromptSubmit") return "";
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    if (!detectRecallIntent(prompt)) return "";
    return buildContextOutput("UserPromptSubmit", DIRECTIVE);
  } catch {
    return "";
  }
}
