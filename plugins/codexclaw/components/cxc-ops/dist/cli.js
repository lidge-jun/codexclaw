/**
 * cli.ts — `cxc-ops` entry point (L20). Subcommands: doctor | reset | chat-search.
 *
 * Resolves the plugin root relative to this compiled file (dist/ -> component ->
 * components -> plugin root). doctor/reset are synchronous; chat-search awaits the
 * app-server wrapper. Exit codes: doctor FAIL -> 1, else 0; reset always 0 on a
 * clean run; chat-search unavailable -> 0 (informational, not an error).
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDoctor, renderDoctor } from "./doctor.js";
import { parseResetScope, runReset, renderReset } from "./reset.js";
import { chatSearch, renderChatSearch } from "./chat-search.js";

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
    case "chat-search": {
      const { term, limit } = parseChatSearchArgs(rest);
      const outcome = await chatSearch(term, { limit: Number.isFinite(limit) ? limit : undefined });
      process.stdout.write(`${renderChatSearch(outcome)}\n`);
      return 0;
    }
    default:
      process.stdout.write("cxc-ops <doctor|reset [--state|--generated|--all]|chat-search \"<term>\" [--limit N]>\n");
      return 0;
  }
}

export function parseChatSearchArgs(args          )                                   {
  const flagIdx = args.findIndex((a) => a === "--limit");
  const limit = flagIdx >= 0 ? Number(args[flagIdx + 1]) : undefined;
  const term = args
    .filter((a, i) => a !== "--limit" && !(flagIdx >= 0 && i === flagIdx + 1))
    .join(" ");
  return { term, limit };
}

// Direct-exec guard: run only when invoked as a script, not when imported by tests.
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath === selfPath) {
  main(process.argv.slice(2), import.meta.url).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`cxc-ops error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
