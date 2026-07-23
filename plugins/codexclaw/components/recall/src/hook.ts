/**
 * hook.ts — Recall hooks: SessionStart/PostCompact context injection +
 * UserPromptSubmit recall-intent nudge.
 *
 * SessionStart & PostCompact: inject a CWD-scoped summary of recent work so the
 * agent starts every session (and recovers after compaction) already knowing what
 * happened in this project. Uses the sidecar FTS index for speed (< 200ms).
 *
 * UserPromptSubmit: when the user's prompt references past work (Korean or English
 * recall idioms) and no recall command is already present, inject a short directive
 * pointing at `cxc chat search` / `cxc memory search`.
 *
 * FAIL-OPEN: any parse/shape problem yields empty output (no injection).
 * Envelope parity with pabcd-state buildContextOutput (CRLF normalize, trim,
 * 32k cap — this directive is far below the cap).
 */
import { searchChat, type ChatHit } from "./chat-search.ts";
import { searchMemory } from "./memory-search.ts";
import { basename } from "node:path";
// Cross-component dist import (established precedent: messenger-bridge api-compat).
// Resolves from BOTH src (test-time ../../cxc-ops/dist) and shipped dist layouts.
// Cross-component dist import, LAZY + FAIL-OPEN (260724 WP1): the entry must keep
// working when the cxc-ops sibling is absent (isolated dist snapshots in tests,
// partial checkouts). A missing resolver degrades to the literal `cxc`.
type CxcInvocationFn = (moduleUrl: string, env?: Record<string, string | undefined>) => string;
let cxcInvocationFn: CxcInvocationFn | null = null;
try {
  ({ cxcInvocation: cxcInvocationFn } = (await import("../../cxc-ops/dist/cxc-resolve.js")) as {
    cxcInvocation: CxcInvocationFn;
  });
} catch {
  cxcInvocationFn = null;
}
function cxcInvocation(moduleUrl: string): string {
  return cxcInvocationFn ? cxcInvocationFn(moduleUrl) : "cxc";
}

/**
 * The `cxc` prefix for COMMAND lines this hook emits. Resolved at emit time (not
 * import time) so the CODEXCLAW_CXC test seam and per-machine PATH state apply
 * per envelope. Recall injections emit BARE (un-backticked) command-block lines,
 * so only lines built through this helper are rewritten — prose mentions of the
 * word `cxc` (e.g. "$cxc-recall") keep the literal (H1, 260724 fresh-install).
 */
const CXC = (): string => cxcInvocation(import.meta.url);

export interface UserPromptSubmitPayload {
  hook_event_name?: string;
  prompt?: string;
  cwd?: string;
  session_id?: string;
  turn_id?: string;
}

export interface SessionStartPayload {
  hook_event_name?: string;
  cwd?: string;
  session_id?: string;
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

// WHY a builder, not a const: the command prefix must be resolved per emit.
function buildDirective(): string {
  const cxc = CXC();
  return [
    "[cxc-recall] The prompt references past work. Before asking the user to re-explain,",
    "search prior sessions (read-only):",
    `  ${cxc} chat search "<distinctive terms>" --days 0   # full-history FTS over ~/.codex`,
    `  ${cxc} memory search "<topic>"                      # durable per-thread summaries`,
    "Add --context 2 to read around a hit, --cwd <repo> to scope. Details: $cxc-recall.",
  ].join("\n");
}

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
    return buildContextOutput("UserPromptSubmit", buildDirective());
  } catch {
    return "";
  }
}

// ─── CWD Auto-Inject (L1 → L2 escalation) ───────────────────────────────────

/** Budget for the auto-injected context (chars). Keeps the injection compact. */
const AUTO_INJECT_BUDGET = 1400;
/** L1 (CWD-scoped) must yield at least this many chat hits to skip L2. */
const L1_MIN_HITS = 2;

/**
 * Build a compact summary of recent work using L1→L2 escalation:
 *   L1: CWD-scoped search (this project only)
 *   L2: global search (all sessions, no CWD filter) — only if L1 is empty/thin
 *
 * cli-jaw equivalent:
 *   L1 = `cli-jaw chat search` (single instance, implicit working_dir)
 *   L2 = `cli-jaw dashboard chat search` (cross-instance federation)
 * In Codex (single-home), L2 = same index but without --cwd filter.
 */
export function buildCwdContext(cwd: string): string {
  if (!cwd) return "";
  try {
    const cwdName = basename(cwd);
    const lines: string[] = [];

    // ── L1: CWD-scoped ──
    const l1Chat = searchChat(cwdName, {
      cwd,
      days: 7,
      limit: 8,
      noRefresh: true,
      source: "main",
      includeTools: false,
    });
    const l1Mem = searchMemory(cwdName, { limit: 3, days: 14 });

    const l1HasContent = l1Chat.hits.length >= L1_MIN_HITS || l1Mem.hits.length > 0;

    // ── L2: global (no CWD filter) — only when L1 is thin ──
    let l2Chat: typeof l1Chat | null = null;
    if (!l1HasContent) {
      l2Chat = searchChat(cwdName, {
        days: 14,
        limit: 8,
        noRefresh: true,
        source: "main",
        includeTools: false,
      });
    }

    const chatHits = l1HasContent ? l1Chat.hits : (l2Chat?.hits ?? []);
    const memHits = l1Mem.hits;
    const layer = l1HasContent ? "L1" : "L2";

    if (chatHits.length === 0 && memHits.length === 0) return "";

    const scope = layer === "L1" ? `${cwdName} (this CWD)` : `${cwdName} (global)`;
    lines.push(`[cxc-recall] Recent work — ${scope}:`);

    // Deduplicate chat by thread, pick most recent per thread
    const seenThreads = new Map<string, ChatHit>();
    for (const hit of chatHits) {
      const key = hit.threadId ?? hit.ts;
      if (!seenThreads.has(key)) seenThreads.set(key, hit);
    }
    const chatSummaries: string[] = [];
    for (const [, hit] of [...seenThreads.entries()].slice(0, 5)) {
      const date = hit.ts.slice(0, 10);
      const raw = (hit.title ?? hit.text).replace(/\n/g, " ").trim();
      const title = raw.length > 60 ? raw.slice(0, 57) + "..." : raw;
      const cwdTag = layer === "L2" && hit.cwd ? ` {${basename(hit.cwd)}}` : "";
      chatSummaries.push(`  \u2022 [${date}] ${title}${cwdTag}`);
    }
    if (chatSummaries.length) {
      lines.push("Sessions:");
      lines.push(...chatSummaries);
    }

    // Memory hits
    const memSummaries: string[] = [];
    for (const hit of memHits.slice(0, 2)) {
      const label = hit.relpath ?? hit.kind;
      const excerpt = hit.excerpt.slice(0, 100).replace(/\n/g, " ");
      memSummaries.push(`  \u2022 (${label}) ${excerpt}`);
    }
    if (memSummaries.length) {
      lines.push("Memory:");
      lines.push(...memSummaries);
    }

    if (layer === "L1") {
      lines.push(`Scope: CWD-local. Use \`${CXC()} chat search "<q>" --days 0\` for global.`);
    } else {
      lines.push(`Scope: global (no CWD-local hits). Use \`${CXC()} chat search "<q>" --cwd ${cwd}\` to re-scope.`);
    }

    let result = lines.join("\n");
    if (result.length > AUTO_INJECT_BUDGET) {
      result = result.slice(0, AUTO_INJECT_BUDGET - 20) + "\n  ...(truncated)";
    }
    return result;
  } catch {
    return "";
  }
}

/**
 * SessionStart: inject CWD-scoped recent work context + recall availability notice.
 * The `cwd` comes from the hook JSON payload; `status` is the index status line.
 */
export function handleSessionStart(status: string, cwd?: string): string {
  const parts: string[] = [];

  // Auto-inject CWD context (the actual memory recovery)
  if (cwd) {
    const cwdCtx = buildCwdContext(cwd);
    if (cwdCtx) parts.push(cwdCtx);
  }

  // Recall availability notice (pointer)
  const cxc = CXC();
  const notice = [
    "[cxc-recall] Past-session recall is available (read-only). Before asking the user",
    "about prior work \u2014 unfamiliar terms, lost context, \"\uadf8\ub54c/\uc9c0\ub09c\ubc88/last time\" \u2014 run:",
    `  ${cxc} chat search "<terms>" --days 0   |   ${cxc} memory search "<topic>"`,
  ];
  if (status !== "") notice.push(`Index: ${status}. Details: $cxc-recall.`);
  else notice.push("Details: $cxc-recall.");
  parts.push(notice.join("\n"));

  return buildContextOutput("SessionStart", parts.join("\n\n"));
}

/**
 * PostCompact: compaction IS the context-loss moment. Re-inject CWD context so
 * the agent doesn't lose project awareness, plus the recovery directive.
 */
export function handlePostCompact(cwd?: string): string {
  const parts: string[] = [];

  // Re-inject CWD context after compact
  if (cwd) {
    const cwdCtx = buildCwdContext(cwd);
    if (cwdCtx) parts.push(cwdCtx);
  }

  const cxc = CXC();
  parts.push(
    [
      "[cxc-recall] Context was just compacted. If any earlier detail is now missing,",
      "recover it from past sessions before asking the user to repeat themselves:",
      `  ${cxc} chat search "<distinctive terms>" --days 0 --context 2`,
      `  ${cxc} memory search "<topic>"`,
      "Details: $cxc-recall.",
    ].join("\n"),
  );

  return buildContextOutput("PostCompact", parts.join("\n\n"));
}
