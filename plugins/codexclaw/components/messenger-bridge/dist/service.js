/**
 * service.ts — install cxc serve as a background daemon (Phase 8).
 *
 * macOS launchd: writes a per-user LaunchAgent that runs `cxc serve` on login
 * and keeps it alive (KeepAlive), logging to ~/.codexclaw/serve.{out,err}.log.
 * The plist builder is pure (unit-tested); install/uninstall/status shell out
 * to launchctl. Non-darwin platforms report unsupported rather than pretending.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export const SERVICE_LABEL = "com.codexclaw.serve";








export function servicePaths(home = homedir())               {
  return {
    plist: join(home, "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`),
    outLog: join(home, ".codexclaw", "serve.out.log"),
    errLog: join(home, ".codexclaw", "serve.err.log"),
    stateDir: join(home, ".codexclaw"),
  };
}










function xmlEscape(value        )         {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Pure: render the launchd plist XML for `cxc serve`. */
export function buildPlist(input            )         {
  const args = [input.nodePath, input.cliPath, "serve", "--port", String(input.port), "--cwd", input.workdir];
  const argXml = args.map((a) => `    <string>${xmlEscape(a)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(input.workdir)}</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(input.outLog)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(input.errLog)}</string>
</dict>
</plist>
`;
}






function launchctl(...args          )                                   {
  const res = spawnSync("launchctl", args, { encoding: "utf8" });
  return { code: res.status ?? 1, stderr: typeof res.stderr === "string" ? res.stderr : "" };
}









export function installService(opts                )                {
  if (platform() !== "darwin") {
    return { ok: false, message: "cxc service is only supported on macOS (launchd) today." };
  }
  const paths = servicePaths(opts.home);
  mkdirSync(paths.stateDir, { recursive: true });
  mkdirSync(join(opts.home ?? homedir(), "Library", "LaunchAgents"), { recursive: true });
  const plist = buildPlist({
    nodePath: opts.nodePath,
    cliPath: opts.cliPath,
    workdir: opts.workdir,
    port: opts.port ?? 7717,
    outLog: paths.outLog,
    errLog: paths.errLog,
  });
  writeFileSync(paths.plist, plist, "utf8");
  // Reload: unload if present, then load.
  launchctl("unload", paths.plist);
  const load = launchctl("load", paths.plist);
  if (load.code !== 0) {
    return { ok: false, message: `plist written to ${paths.plist} but launchctl load failed: ${load.stderr.trim()}` };
  }
  return { ok: true, message: `cxc service installed and started (label ${SERVICE_LABEL}, logs in ${paths.stateDir}).` };
}

export function uninstallService(home         )                {
  if (platform() !== "darwin") {
    return { ok: false, message: "cxc service is only supported on macOS today." };
  }
  const paths = servicePaths(home);
  if (!existsSync(paths.plist)) {
    return { ok: true, message: "cxc service is not installed (nothing to remove)." };
  }
  launchctl("unload", paths.plist);
  rmSync(paths.plist, { force: true });
  return { ok: true, message: "cxc service stopped and removed." };
}

export function serviceStatus(home         )                {
  const paths = servicePaths(home);
  if (!existsSync(paths.plist)) {
    return { ok: true, message: "cxc service: not installed." };
  }
  if (platform() !== "darwin") {
    return { ok: true, message: `cxc service: plist present at ${paths.plist} (launchctl unavailable off macOS).` };
  }
  const res = spawnSync("launchctl", ["list", SERVICE_LABEL], { encoding: "utf8" });
  if ((res.status ?? 1) === 0) {
    return { ok: true, message: `cxc service: installed and loaded. Logs: ${paths.outLog}` };
  }
  return { ok: true, message: `cxc service: installed but not loaded (run 'cxc service install' to start).` };
}
