/**
 * install-version.ts — which codexclaw build is running, and how to update it (#316).
 *
 * Skills and hooks can come from different builds. GOAT can hand a session the
 * skills of a newer machine while the host's installed hooks and cxc are older, so
 * a skill names a verb (\`cxc loop pr-record\`) the installed CLI lacks and the
 * installed gate ignores the record the verb wrote. Messages that meet something
 * newer than this build name the running version and the one update path.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The marketplace update, then hook re-trust and a new thread (README "Update"). */
export const UPDATE_PATH =
  "update the installed plugin: `codex plugin marketplace upgrade codexclaw`, re-approve the hooks Codex marks Modified, then open a new thread";

let cached                = null;

/** Version from the payload manifest (components/<c>/{src,dist}/ -> ../../../.codex-plugin). */
export function installedCxcVersion()         {
  if (cached !== null) return cached;
  try {
    const manifest = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".codex-plugin", "plugin.json");
    const version = (JSON.parse(readFileSync(manifest, "utf8"))                         ).version;
    cached = typeof version === "string" && version.length > 0 ? version : "unknown";
  } catch {
    cached = "unknown";
  }
  return cached;
}

/** One sentence for a message that met something this build does not know. */
export function newerThanInstallHint(what        )         {
  return what + " is newer than this install (cxc " + installedCxcVersion() + "); " + UPDATE_PATH + ".";
}
