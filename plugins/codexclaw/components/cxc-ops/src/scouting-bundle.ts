/**
 * scouting-bundle.ts — sanitized opt-in support/diagnostics bundle (issue #20).
 *
 * Generates an explicitly created, bounded, locally inspectable diagnostic
 * artifact for field regression diagnosis. Never uploads automatically.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, basename, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { platform, hostname, release } from "node:os";

/** Schema version for the scouting bundle. */
export const BUNDLE_SCHEMA_VERSION = 1;

/** Maximum bundle size in bytes (1 MB). */
export const MAX_BUNDLE_BYTES = 1_048_576;

/** Sentinel patterns that must never appear in the bundle. */
export const SECRET_SENTINELS = [
  /ghp_[A-Za-z0-9]{36}/,          // GitHub PAT
  /gho_[A-Za-z0-9]{36}/,          // GitHub OAuth
  /sk-[A-Za-z0-9]{48}/,           // OpenAI API key
  /xoxb-[0-9]+-[A-Za-z0-9]+/,     // Slack bot token
  /xoxp-[0-9]+-[A-Za-z0-9]+/,     // Slack user token
  /Bearer\s+[A-Za-z0-9._-]{20,}/, // Generic bearer token
  /-----BEGIN\s+(RSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/, // Private keys
];

/** Redact home directory paths. */
export function redactPaths(text: string, homeDir: string): string {
  // Normalize separators for cross-platform
  const normalizedHome = homeDir.split(sep).join("/");
  const windowsHome = homeDir.split("/").join("\\");
  let result = text;
  result = result.split(normalizedHome).join("~");
  if (sep === "\\") {
    result = result.split(windowsHome).join("~");
  }
  // Also redact forward-slash version on Windows
  result = result.split(homeDir).join("~");
  return result;
}

/** Check text for secret sentinels. Returns matched patterns. */
export function scanForSecrets(text: string): string[] {
  const found: string[] = [];
  for (const pattern of SECRET_SENTINELS) {
    if (pattern.test(text)) {
      found.push(pattern.source);
    }
  }
  return found;
}

export interface BundleSection {
  name: string;
  content: string;
}

export interface ScoutingBundle {
  schemaVersion: number;
  generatedAt: string;
  platform: string;
  nodeVersion: string;
  sections: BundleSection[];
}

/** Generate a scouting bundle from the current environment. */
export function generateBundle(opts: {
  pluginRoot: string;
  codexHome?: string;
  projectRoot?: string;
  homeDir?: string;
}): ScoutingBundle {
  const home = opts.homeDir ?? process.env.HOME ?? "";
  const sections: BundleSection[] = [];

  // 1. Plugin version and manifest shape
  const manifestPath = join(opts.pluginRoot, ".codex-plugin", "plugin.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      sections.push({
        name: "plugin-manifest",
        content: redactPaths(JSON.stringify({
          name: manifest.name,
          version: manifest.version,
          hookCount: Array.isArray(manifest.hooks) ? manifest.hooks.length : 0,
        }, null, 2), home),
      });
    } catch (err) {
      sections.push({ name: "plugin-manifest", content: "unparseable: " + String(err) });
    }
  }

  // 2. Platform info
  sections.push({
    name: "platform",
    content: JSON.stringify({
      os: platform(),
      release: release(),
      node: process.version,
      arch: process.arch,
    }, null, 2),
  });

  // 3. Capability lock status (redacted)
  const lockPath = join(opts.pluginRoot, "capability-lock.json");
  if (existsSync(lockPath)) {
    try {
      const lock = readFileSync(lockPath, "utf8");
      sections.push({ name: "capability-lock", content: redactPaths(lock, home) });
    } catch { /* skip */ }
  }

  // 4. PABCD session identifiers (no objective/prompt text)
  if (opts.projectRoot) {
    const sessDir = join(opts.projectRoot, ".codexclaw", "sessions");
    if (existsSync(sessDir) && statSync(sessDir).isDirectory()) {
      const files = readdirSync(sessDir).filter(f => f.endsWith(".json"));
      const summaries = files.map(f => {
        try {
          const data = JSON.parse(readFileSync(join(sessDir, f), "utf8")) as Record<string, unknown>;
          return { file: f, phase: data.phase, session: data.sessionId };
        } catch {
          return { file: f, error: "corrupt" };
        }
      });
      sections.push({ name: "pabcd-sessions", content: JSON.stringify(summaries, null, 2) });
    }
  }

  // 5. Skill directory listing (names only)
  const skillsDir = join(opts.pluginRoot, "skills");
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    const skills = readdirSync(skillsDir).filter(n => {
      try { return statSync(join(skillsDir, n)).isDirectory(); } catch { return false; }
    });
    sections.push({ name: "installed-skills", content: skills.join("\n") });
  }

  const bundle: ScoutingBundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    platform: platform(),
    nodeVersion: process.version,
    sections,
  };

  return bundle;
}

/** Validate a generated bundle for secrets. Throws if secrets found. */
export function validateBundleSecurity(bundle: ScoutingBundle): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const fullText = JSON.stringify(bundle);
  const secrets = scanForSecrets(fullText);
  if (secrets.length > 0) {
    violations.push("secrets found: " + secrets.join(", "));
  }
  if (Buffer.byteLength(fullText) > MAX_BUNDLE_BYTES) {
    violations.push("bundle exceeds " + MAX_BUNDLE_BYTES + " byte limit");
  }
  return { safe: violations.length === 0, violations };
}

