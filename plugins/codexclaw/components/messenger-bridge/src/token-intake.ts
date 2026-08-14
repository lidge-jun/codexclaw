/**
 * token-intake.ts -- secret-safe token intake paths (issue #12).
 *
 * Provides alternatives to placing raw tokens in agent-authored JSON payloads.
 * Three intake modes:
 *   1. stdin   -- read from stdin (non-interactive, pipe-friendly)
 *   2. file    -- read from a temp file (owner-only 0600), then securely remove
 *   3. env     -- read from an environment variable, then unset
 *
 * The token never appears in argv, process title, or command payloads.
 * Validation errors are generic and do not include token fragments.
 */
import { readFileSync, unlinkSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type IntakeMode = "stdin" | "file" | "env";

export interface IntakeResult {
  ok: boolean;
  token?: string;
  error?: string;
  mode: IntakeMode;
}

/**
 * Read a token from stdin (one line, trimmed).
 * Resolves after the first line or EOF.
 */
export function readTokenFromStdin(stream?: NodeJS.ReadableStream): Promise<IntakeResult> {
  const input = stream ?? process.stdin;
  return new Promise((resolve) => {
    const rl = createInterface({ input, terminal: false });
    let token = "";
    let resolved = false;
    rl.on("line", (line) => {
      if (!resolved) {
        token = line.trim();
        resolved = true;
        rl.close();
      }
    });
    rl.on("close", () => {
      if (!resolved) {
        resolve({ ok: false, error: "no token provided on stdin", mode: "stdin" });
        return;
      }
      if (token.length === 0) {
        resolve({ ok: false, error: "empty token", mode: "stdin" });
        return;
      }
      resolve({ ok: true, token, mode: "stdin" });
    });
    rl.on("error", () => {
      if (!resolved) {
        resolve({ ok: false, error: "failed to read stdin", mode: "stdin" });
      }
    });
  });
}

/**
 * Read a token from a file, then securely remove it.
 * File must be owner-only (mode 0600 or 0400) on Unix.
 */
export function readTokenFromFile(path: string): IntakeResult {
  try {
    const stat = statSync(path);
    // On Unix, check permissions (skip on Windows where mode is meaningless)
    if (process.platform !== "win32") {
      const mode = stat.mode & 0o777;
      if (mode & 0o077) {
        return { ok: false, error: "token file must be owner-only (0600)", mode: "file" };
      }
    }
    const token = readFileSync(path, "utf8").trim();
    // Securely remove the file
    try { unlinkSync(path); } catch { /* best-effort */ }
    if (token.length === 0) {
      return { ok: false, error: "empty token file", mode: "file" };
    }
    return { ok: true, token, mode: "file" };
  } catch {
    return { ok: false, error: "failed to read token file", mode: "file" };
  }
}

/**
 * Read a token from an environment variable, then unset it.
 */
export function readTokenFromEnv(varName: string): IntakeResult {
  const token = (process.env[varName] ?? "").trim();
  // Unset the variable to reduce persistence surface
  delete process.env[varName];
  if (token.length === 0) {
    return { ok: false, error: "environment variable not set or empty", mode: "env" };
  }
  return { ok: true, token, mode: "env" };
}

/**
 * Write a token to a temp file with owner-only permissions.
 * Returns the path. The caller or readTokenFromFile will remove it.
 */
export function writeTokenFile(dir: string, token: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ".cxc-token-" + Date.now());
  writeFileSync(path, token, { mode: 0o600 });
  return path;
}

/**
 * Scan a string for token-like values and redact them.
 * Used to sanitize error messages and logs.
 */
export function redactToken(text: string, token: string): string {
  if (!token || token.length < 8) return text;
  return text.split(token).join("[REDACTED]");
}
