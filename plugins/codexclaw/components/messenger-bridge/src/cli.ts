/**
 * cli.ts — `messenger-bridge` entry point. Subcommand: serve.
 *
 * `serve [--port <n>] [--cwd <path>]` boots the bridge HTTP server on
 * 127.0.0.1 (loopback only — remote access is the messengers' job, never this
 * port), serving the built GUI + JSON API over the project-scoped bridge DB.
 * SIGINT/SIGTERM close the server and the DB cleanly.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync } from "node:fs";
import { openBridgeDb } from "./db.ts";
import { createBridgeServer } from "./server.ts";
import { BridgeController } from "./bridge-controller.ts";
import { DiscordThreadSweepScheduler, HeartbeatScheduler } from "./heartbeat.ts";
import { installService, uninstallService, serviceStatus } from "./service.ts";

const DEFAULT_PORT = 7717;

function pluginRootFrom(metaUrl: string): string {
  // dist/cli.js -> components/messenger-bridge/dist -> component -> components -> <pluginRoot>
  const here = dirname(fileURLToPath(metaUrl));
  return resolve(here, "..", "..", "..");
}

function componentVersion(metaUrl: string): string {
  try {
    const here = dirname(fileURLToPath(metaUrl));
    const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export interface ServeArgs {
  port: number;
  cwd: string;
}

export function parseServeArgs(argv: string[], processCwd: string): ServeArgs {
  let port = DEFAULT_PORT;
  let cwd = processCwd;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port" && argv[i + 1] !== undefined) {
      const parsed = Number.parseInt(argv[i + 1] as string, 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 65535) {
        throw new Error(`invalid --port value: ${argv[i + 1]}`);
      }
      port = parsed;
      i += 1;
    } else if (argv[i] === "--cwd" && argv[i + 1] !== undefined) {
      cwd = resolve(processCwd, argv[i + 1] as string);
      i += 1;
    }
  }
  return { port, cwd };
}

async function runServe(argv: string[], metaUrl: string): Promise<number> {
  const args = parseServeArgs(argv, process.cwd());
  const guiDir = resolve(pluginRootFrom(metaUrl), "gui", "dist");
  const db = openBridgeDb(args.cwd);
  const log = (line: string) => process.stdout.write(`${line}\n`);
  const controller = new BridgeController({ db, workdir: args.cwd, log });
  const scheduler = new HeartbeatScheduler({
    db,
    service: () => controller.service(),
    workdir: args.cwd,
    log,
  });
  const discordSweep = new DiscordThreadSweepScheduler({ db, log });
  const server = createBridgeServer({
    db,
    cwd: args.cwd,
    guiDir,
    version: componentVersion(metaUrl),
    controller,
  });

  // Start every enabled agent's adapter via the controller, then heartbeats.
  void controller
    .reload()
    .then(() => {
      scheduler.start();
      discordSweep.start();
    })
    .catch((err: unknown) => {
      process.stderr.write(`cxc serve: adapter start failed: ${(err as Error).message}\n`);
    });

  return new Promise<number>((resolvePromise) => {
    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      // Ordering matters: stop the scheduler BEFORE the controller nulls the
      // shared AgentService, and both before the server/db close (plan rev-2 #3).
      scheduler.stop();
      discordSweep.stop();
      await controller.stop();
      server.close(() => {
        db.close();
        resolvePromise(0);
      });
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    server.listen(args.port, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : args.port;
      process.stdout.write(`cxc serve: listening on http://127.0.0.1:${port} (cwd: ${args.cwd})\n`);
      const active = db.getActiveChannel();
      if (active?.token) {
        process.stdout.write(`cxc serve: ${active.kind} channel active\n`);
      }
    });
    server.on("error", (err) => {
      process.stderr.write(`cxc serve error: ${err.message}\n`);
      db.close();
      resolvePromise(1);
    });
  });
}

function runService(argv: string[], metaUrl: string): number {
  const sub = argv[0] ?? "status";
  if (sub === "install") {
    // Resolve the codexclaw CLI entry (bin/codexclaw.mjs) from the plugin root.
    const cliPath = resolve(pluginRootFrom(metaUrl), "..", "..", "bin", "codexclaw.mjs");
    const portArg = argv.indexOf("--port");
    const port = portArg >= 0 && argv[portArg + 1] ? Number.parseInt(argv[portArg + 1] as string, 10) : 7717;
    const result = installService({ nodePath: process.execPath, cliPath, workdir: process.cwd(), port });
    process.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (sub === "uninstall") {
    const result = uninstallService();
    process.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  const result = serviceStatus();
  process.stdout.write(`${result.message}\n`);
  return 0;
}

export async function main(argv: string[], metaUrl: string): Promise<number> {
  const cmd = argv[0] ?? "help";
  switch (cmd) {
    case "serve":
      return runServe(argv.slice(1), metaUrl);
    case "service":
      return runService(argv.slice(1), metaUrl);
    default:
      process.stdout.write(
        "messenger-bridge <serve [--port <n>] [--cwd <path>] | service <install|uninstall|status> [--port <n>]>\n",
      );
      return 0;
  }
}

// Direct-exec guard: run only when invoked as a script, not when imported by tests.
// Realpath both sides so symlinked installs (plugin cache, npm global) still match.
function realOrSelf(p: string): string {
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
      process.stderr.write(
        `messenger-bridge error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}
