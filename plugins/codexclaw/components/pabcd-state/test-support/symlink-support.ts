/**
 * symlink-support.ts - shared host capability probe for the symlink guard tests.
 *
 * Issue #32: a stock non-admin Windows checkout cannot create symlinks, so
 * symlinkSync threw EPERM before the refusal guards under test ever ran. Probe
 * the host once and gate only the symlink-creating half of each case.
 *
 * This lives beside test/ rather than inside it: node --test treats every file
 * under a test directory as a test file, and a helper module with no cases
 * would report as an empty passing "test".
 */
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SymlinkSupport {
  /** file -> file symlinks (needs Developer Mode or elevation on Windows) */
  file: boolean;
  /** directory links; junctions cover this on Windows without elevation */
  dir: boolean;
}

/** Directory link that does not need elevation on Windows. */
export function symlinkDirSync(target: string, path: string): void {
  symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
}

let symlinkProbe: SymlinkSupport | null = null;

/**
 * A denied link answers EPERM/EACCES (and UNKNOWN on some Windows filesystems).
 * Any other failure is still treated as "unsupported" so a probe can never fail
 * the suite on its own; the gated assertions report a skip instead.
 */
export function supportsSymlinks(): SymlinkSupport {
  if (symlinkProbe) return symlinkProbe;
  const probeDir = mkdtempSync(join(tmpdir(), "cxc-symlink-probe-"));
  const support: SymlinkSupport = { file: false, dir: false };
  try {
    const target = join(probeDir, "target.txt");
    writeFileSync(target, "probe");
    try {
      symlinkSync(target, join(probeDir, "file-link"), "file");
      support.file = true;
    } catch {
      support.file = false;
    }
    const dirTarget = join(probeDir, "target-dir");
    mkdirSync(dirTarget, { recursive: true });
    try {
      symlinkDirSync(dirTarget, join(probeDir, "dir-link"));
      support.dir = true;
    } catch {
      support.dir = false;
    }
  } finally {
    try {
      rmSync(probeDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup of the probe dir; ignore
    }
  }
  symlinkProbe = support;
  return support;
}
