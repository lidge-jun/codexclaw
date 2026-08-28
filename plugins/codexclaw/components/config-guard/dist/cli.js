// Thin CLI wrapper. This is the ONLY layer that resolves the real `codex` binary and the real
// codexHome — the lib layers (features/activate/deactivate) take everything injected so tests
// can never reach ~/.codex.

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDeclaredState,                  } from "./features.js";
import { activate } from "./activate.js";
import { deactivate } from "./deactivate.js";

export function resolveCodexHome(env                    = process.env)         {
  const fromEnv = env.CODEX_HOME?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : join(homedir(), ".codex");
}

export function makeRealRunner()              {
  return (args) => {
    const res = spawnSync("codex", [...args], { encoding: "utf8" });
    return {
      stdout: res.stdout ?? "",
      stderr: res.stderr ?? (res.error ? String(res.error.message) : ""),
      exitCode: typeof res.status === "number" ? res.status : 1,
    };
  };
}

function main(argv                   )         {
  const cmd = argv[0];
  const run = makeRealRunner();
  const codexHome = resolveCodexHome();

  switch (cmd) {
    case "enable": {
      const m = activate({ run, codexHome });
      const turnedOn = Object.entries(m.flags)
        .filter(([, r]) => r.enabledByCodexclaw)
        .map(([k]) => k);
      const failed = Object.entries(m.flags)
        .filter(([, r]) => r.enableFailed)
        .map(([k]) => k);
      process.stdout.write(
        `codexclaw: enabled [${turnedOn.join(", ") || "none"}]` +
          (failed.length ? ` (soft-failed: ${failed.join(", ")})` : "") +
          (m.backupPath ? `\nbackup: ${m.backupPath}` : "") +
          "\n",
      );
      return 0;
    }
    case "disable": {
      const r = deactivate({ run, codexHome });
      if (r.noManifest) {
        process.stdout.write("codexclaw: no install manifest; nothing to revert\n");
      } else {
        const lines = [
          `codexclaw: disabled [${r.disabled.join(", ") || "none"}]; kept pre-existing [${r.skippedPreExisting.join(", ") || "none"}]`,
        ];
        if (r.restoredKeys.length > 0) lines.push(`restored keys: ${r.restoredKeys.join(", ")}`);
        if (r.skippedExternal.length > 0) {
          const detail = r.skippedExternal.map((s) => `${s.target} (${s.reason})`).join(", ");
          lines.push(`left to their current owner: ${detail}`);
        }
        // Reported, never a gate: the file changing since install is normal, because
        // codexclaw is not its only writer.
        if (r.fileDrifted) lines.push("note: config.toml changed since activation; reverted per key");
        if (r.featuresStateUnavailable) {
          lines.push("note: could not read 'codex features list'; reverted flags from the manifest alone");
        }
        process.stdout.write(`${lines.join("\n")}\n`);
      }
      return 0;
    }
    case "status": {
      const state = readDeclaredState(run);
      for (const [k, v] of state) process.stdout.write(`${k}: ${v ? "enabled" : "disabled"}\n`);
      return 0;
    }
    default:
      process.stderr.write("usage: config-guard <enable|disable|status>\n");
      return 2;
  }
}

// Realpath both sides: symlinked installs (plugin cache, npm global) otherwise miss.
const isDirect = (() => {
  try {
    if (process.argv[1] === undefined) return false;
    const self = realpathSync(fileURLToPath(import.meta.url));
    let invoked = process.argv[1];
    try {
      invoked = realpathSync(invoked);
    } catch {
      /* keep unresolved */
    }
    return self === invoked;
  } catch {
    return false;
  }
})();
if (isDirect) {
  process.exit(main(process.argv.slice(2)));
}
