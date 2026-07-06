/**
 * cli.ts — `cxc-ops` entry point (L20). Subcommands: doctor | reset | hook.
 *
 * Resolves the plugin root relative to this compiled file (dist/ -> component ->
 * components -> plugin root). doctor/reset are synchronous. Exit codes: doctor
 * FAIL -> 1, else 0; reset always 0 on a clean run. Unknown subcommands print the
 * usage line and exit 0 (informational, not an error).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import { runDoctor, renderDoctor } from "./doctor.js";
import { parseResetScope, runReset, renderReset } from "./reset.js";
import { runMapAffordanceSessionStart } from "./map-affordance.js";

/** Read all of stdin synchronously (hook payload); "" if none/unavailable. */
function readStdinSync()         {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function pluginRootFrom(metaUrl        )         {
  // dist/cli.js -> components/cxc-ops/dist -> components/cxc-ops -> components -> <pluginRoot>
  const here = dirname(fileURLToPath(metaUrl));
  return resolve(here, "..", "..", "..");
}

export async function main(argv          , metaUrl        )                  {
  const cmd = argv[0] ?? "help";
  const rest = argv.slice(1);

  switch (cmd) {
    case "doctor": {
      const report = runDoctor(pluginRootFrom(metaUrl));
      process.stdout.write(`${renderDoctor(report)}\n`);
      return report.overall === "FAIL" ? 1 : 0;
    }
    case "reset": {
      const scope = parseResetScope(rest);
      const result = runReset(process.cwd(), scope);
      process.stdout.write(`${renderReset(result)}\n`);
      return 0;
    }
    case "hook": {
      // Only the map-affordance SessionStart hook lives here today.
      if (rest[0] === "session-start") {
        const out = runMapAffordanceSessionStart(readStdinSync(), process.cwd());
        if (out) process.stdout.write(out);
        return 0; // read-only affordance never fails the session
      }
      process.stdout.write("cxc-ops hook <session-start>\n");
      return 0;
    }
    default:
      process.stdout.write("cxc-ops <doctor|reset [--state|--generated|--goalplans|--all]|hook session-start>\n");
      return 0;
  }
}

// Direct-exec guard: run only when invoked as a script, not when imported by tests.
// Compare via realpath — the plugin cache reaches this file through a symlinked
// components/ dir, so a plain resolve() comparison misses real hook invocations.
function realOrSelf(p        )         {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const invokedPath = process.argv[1] ? realOrSelf(resolve(process.argv[1])) : "";
const selfPath = realOrSelf(fileURLToPath(import.meta.url));
if (invokedPath === selfPath) {
  main(process.argv.slice(2), import.meta.url).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`cxc-ops error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
