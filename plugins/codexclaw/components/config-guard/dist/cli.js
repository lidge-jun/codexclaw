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
      } else if (r.skippedDrift) {
        process.stdout.write(
          "codexclaw: config drifted since activation; left flags untouched (safe no-op)\n",
        );
      } else {
        process.stdout.write(
          `codexclaw: disabled [${r.disabled.join(", ") || "none"}]; kept pre-existing [${r.skippedPreExisting.join(", ") || "none"}]\n`,
        );
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
