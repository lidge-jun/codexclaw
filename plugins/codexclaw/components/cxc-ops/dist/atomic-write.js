/**
 * atomic-write.ts - publish-by-rename with a bounded win32 retry.
 *
 * POSIX `rename(2)` replaces the destination unconditionally. Windows fails with
 * EPERM/EACCES/EBUSY while a scanner, indexer, or sync client holds a transient
 * handle on the target - which is routine here, because hooks fire concurrently
 * (SessionStart, UserPromptSubmit, PreToolUse all touch session state).
 *
 * The envelope is sized for a scanner blinking, not for a file someone actually
 * has open: two retries at 25ms and 50ms. A longer wait would turn a hot-path
 * hook into a visible stall, and a file genuinely held open is a real error that
 * should surface (opencodex `windows-atomic-replace.ts:1-18`).
 */
import { renameSync } from "node:fs";

const RETRY_DELAYS_MS = [25, 50]         ;
const TRANSIENT_WIN32_CODES                      = new Set(["EBUSY", "EPERM", "EACCES"]);

function sleepSync(ms        )       {
  // Synchronous by necessity: every call site is a sync write path.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransientWin32(err         , platform                 )          {
  if (platform !== "win32") return false;
  const code = (err                         )?.code;
  return typeof code === "string" && TRANSIENT_WIN32_CODES.has(code);
}

/** `renameSync` with a bounded win32-only retry. Rethrows the final error. */
export function renameWithRetry(
  tmp        ,
  finalPath        ,
  platform                  = process.platform,
  rename                                 = renameSync,
  sleep                       = sleepSync,
)       {
  for (let attempt = 0; ; attempt++) {
    try {
      rename(tmp, finalPath);
      return;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length || !isTransientWin32(err, platform)) throw err;
      sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

