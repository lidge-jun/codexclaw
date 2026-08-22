/**
 * wsl.ts - filesystem-based WSL detection and mount-root resolution.
 *
 * Deliberately NO `wsl.exe` / `wslpath` subprocess. `wsl.exe` writes UTF-16LE to
 * stdout, so every consumer needs a BOM-aware decoder, and a wrong guess about
 * the console code page produces a plausible-but-wrong path. The kernel already
 * publishes everything needed in `/proc` and `/etc` (opencodex home.ts:82-119).
 *
 * Every probe is a defaulted parameter so both branches run on one CI OS.
 */
import { readFileSync } from "node:fs";

export interface WslDeps {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  /** `/proc/version` contents, or null when unreadable. */
  procVersion?: string | null;
  /** `/etc/wsl.conf` contents, or null when absent. */
  wslConf?: string | null;
  /** `/proc/mounts` contents, or null when unreadable. */
  procMounts?: string | null;
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * True when this process runs inside WSL.
 *
 * Env vars first (`WSL_DISTRO_NAME` / `WSL_INTEROP` are set by the init process and
 * are the cheapest signal), then `/proc/version`, which carries "microsoft" in the
 * kernel string on both WSL1 and WSL2. Non-linux platforms short-circuit false:
 * a Windows-side process is not "in WSL" even when WSL is installed.
 */
export function isWslRuntime(deps: WslDeps = {}): boolean {
  if ((deps.platform ?? process.platform) !== "linux") return false;
  const env = deps.env ?? process.env;
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true;
  const version = deps.procVersion !== undefined ? deps.procVersion : readOrNull("/proc/version");
  return /microsoft|wsl/i.test(version ?? "");
}

/**
 * The `[automount] root` from `/etc/wsl.conf`, defaulting to `/mnt`.
 *
 * Hardcoding `/mnt` is wrong on any distro whose user set `root = /` (a common
 * config for shorter paths, making the Windows C: drive `/c`). Comments and quotes
 * are stripped, the key match is case-insensitive, and a non-absolute value falls
 * back rather than producing a relative mount path (opencodex home.ts:51-72).
 */
export function automountRoot(deps: WslDeps = {}): string {
  const conf = deps.wslConf !== undefined ? deps.wslConf : readOrNull("/etc/wsl.conf");
  if (!conf) return "/mnt";
  let inAutomount = false;
  for (const rawLine of conf.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line.length === 0) continue;
    const section = /^\[(.+)\]$/.exec(line);
    if (section) {
      inAutomount = section[1].trim().toLowerCase() === "automount";
      continue;
    }
    if (!inAutomount) continue;
    const kv = /^([A-Za-z]+)\s*=\s*(.+)$/.exec(line);
    if (!kv || kv[1].toLowerCase() !== "root") continue;
    const value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (!value.startsWith("/")) return "/mnt";
    return value.replace(/\/+$/, "") || "/";
  }
  return "/mnt";
}

/** Escape a literal for RegExp embedding. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `dir` sits on a Windows drive mounted into WSL.
 *
 * The root is escaped before regex use because it comes from a user-editable
 * config file (opencodex shim.ts:494-498).
 */
export function isWindowsInteropDir(dir: string, root = "/mnt"): boolean {
  const trimmed = root.replace(/\/+$/, "");
  const escaped = escapeRegExp(trimmed);
  return new RegExp(`^${escaped}/[a-z](/|$)`, "i").test(dir);
}

/**
 * Rewrite a Windows `USERPROFILE` into its WSL mount path, or null when it does
 * not look like one.
 *
 * Backslashes are normalized first, then an ANCHORED drive-letter pattern runs,
 * and the drive is lowercased: `/mnt/C` does not exist while `/mnt/c` does
 * (opencodex home.ts:22-29).
 */
export function windowsHomeToWslPath(value: string, root = "/mnt"): string | null {
  const normalized = value.replaceAll("\\", "/");
  const match = /^([A-Za-z]):\/Users\/([^/]+)$/.exec(normalized);
  if (!match) return null;
  const base = root === "/" ? "" : root.replace(/\/+$/, "");
  return `${base}/${match[1].toLowerCase()}/Users/${match[2]}`;
}

export type FilesystemTier = "native" | "drvfs" | "9p" | "unc" | "unknown";

/**
 * Classify the filesystem a path lives on.
 *
 * Detecting WSL is not enough. State on drvfs or a UNC share appears to lock and
 * then does not, so lock-dependent features need a specific refusal rather than a
 * mysterious later failure (opencodex native-main-owner.ts:76-92).
 */
export function filesystemTier(path: string, deps: WslDeps = {}): FilesystemTier {
  const platform = deps.platform ?? process.platform;
  if (platform === "win32") {
    const normalized = path.replaceAll("/", "\\");
    if (normalized.startsWith("\\\\?\\UNC\\")) return "unc";
    if (normalized.startsWith("\\\\") && !normalized.startsWith("\\\\?\\")) return "unc";
    return "native";
  }
  if (platform !== "linux") return "native";
  const mounts = deps.procMounts !== undefined ? deps.procMounts : readOrNull("/proc/mounts");
  if (!mounts) return "unknown";
  // Longest covering mount prefix wins: /mnt/c is more specific than /.
  let best: { point: string; type: string } | null = null;
  for (const line of mounts.split(/\r?\n/)) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const point = parts[1];
    if (path !== point && !path.startsWith(point.endsWith("/") ? point : point + "/")) continue;
    if (!best || point.length > best.point.length) best = { point, type: parts[2] };
  }
  if (!best) return "unknown";
  if (best.type === "drvfs") return "drvfs";
  if (best.type === "9p") return "9p";
  return "native";
}
