/**
 * rules.ts — SessionStart project-rule injector (lazygap_impl 060.1).
 *
 * Daemon-free: reads project rule blocks from `.codexclaw/rules/*.md` (or a root
 * `AGENTS.md` fallback), concatenates + dedups + caps length, and emits a SessionStart
 * `additionalContext` envelope so the rules surface as developer context at session start.
 *
 * This is a DIRECTIVE surface (E4), not enforcement: it only adds context. Nothing here
 * blocks, and an absent/empty rules source yields "" (no injection — never fabricated).
 * Pure `node:fs` + string work under `cwd`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const RULES_DIR = ".codexclaw/rules";
export const RULES_FALLBACK = "AGENTS.md";
/** Cap the injected context so a large rules dir cannot bloat every session. */
export const RULES_MAX_CHARS = 8000;

function readRuleFiles(cwd: string): string[] {
  const dir = join(cwd, RULES_DIR);
  const blocks: string[] = [];
  try {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      for (const name of readdirSync(dir).sort()) {
        if (!name.endsWith(".md") || name.startsWith(".")) continue;
        try {
          const text = readFileSync(join(dir, name), "utf8").trim();
          if (text.length > 0) blocks.push(text);
        } catch {
          // skip an unreadable rule file; never trap the session
        }
      }
    }
  } catch {
    // directory scan failed -> treat as no rules dir
  }
  if (blocks.length === 0) {
    // fallback: a project-root AGENTS.md
    try {
      const fb = join(cwd, RULES_FALLBACK);
      if (existsSync(fb) && statSync(fb).isFile()) {
        const text = readFileSync(fb, "utf8").trim();
        if (text.length > 0) blocks.push(text);
      }
    } catch {
      // ignore
    }
  }
  return blocks;
}

/** Dedup identical blocks (order-preserving) and join with a separator. */
function concatRules(blocks: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const b of blocks) {
    if (seen.has(b)) continue;
    seen.add(b);
    unique.push(b);
  }
  return unique.join("\n\n---\n\n");
}

/**
 * Build the SessionStart additionalContext envelope for project rules, or "" when there
 * are no rules. Length-capped. Never throws (fail-open: any error yields "").
 */
export function buildRulesContext(cwd: string): string {
  try {
    const blocks = readRuleFiles(cwd);
    if (blocks.length === 0) return "";
    let body = concatRules(blocks);
    if (body.length > RULES_MAX_CHARS) {
      body = `${body.slice(0, RULES_MAX_CHARS)}\n...[codexclaw rules truncated at ${RULES_MAX_CHARS} chars]`;
    }
    const additionalContext = `[codexclaw project rules]\n${body}`;
    return `${JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    })}\n`;
  } catch {
    return "";
  }
}

/**
 * Resolve the cwd from a SessionStart hook payload (falls back to process cwd), then build
 * the rules context. Never throws — any parse failure degrades to the process cwd.
 */
export function buildRulesContextFromRaw(raw: string, fallbackCwd: string): string {
  let cwd = fallbackCwd;
  try {
    const parsed = JSON.parse((raw ?? "").trim()) as { cwd?: unknown };
    if (parsed && typeof parsed === "object" && typeof parsed.cwd === "string" && parsed.cwd.length > 0) {
      cwd = parsed.cwd;
    }
  } catch {
    // keep fallback
  }
  return buildRulesContext(cwd);
}
