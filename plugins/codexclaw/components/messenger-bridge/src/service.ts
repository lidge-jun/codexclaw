/**
 * service.ts — install cxc serve as a background daemon (Phase 8).
 *
 * Three-way platform dispatch following the opencodex service.ts pattern:
 *   macOS  → launchd (LaunchAgent plist)
 *   Linux  → systemd (user unit)
 *   Windows → Task Scheduler (schtasks)
 *
 * Each platform module is pure except for the shell-out helpers. The
 * platformOps() dispatcher selects the right implementation at runtime.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export const SERVICE_LABEL = "com.codexclaw.serve";
const SYSTEMD_UNIT = "codexclaw-serve.service";
const TASK_NAME = "codexclaw-serve";

// ── Shared types ──

export interface ServiceResult {
  ok: boolean;
  message: string;
}

export interface InstallOptions {
  nodePath: string;
  cliPath: string;
  workdir: string;
  port?: number;
  home?: string;
}

interface ServiceOps {
  install: (opts: InstallOptions) => ServiceResult;
  uninstall: (home?: string) => ServiceResult;
  status: (home?: string) => ServiceResult;
}

function stateDir(home = homedir()): string {
  return join(home, ".codexclaw");
}

function logPaths(home = homedir()): { outLog: string; errLog: string } {
  return {
    outLog: join(stateDir(home), "serve.out.log"),
    errLog: join(stateDir(home), "serve.err.log"),
  };
}

// ── macOS (launchd) ──

export interface ServicePaths {
  plist: string;
  outLog: string;
  errLog: string;
  stateDir: string;
}

export function servicePaths(home = homedir()): ServicePaths {
  return {
    plist: join(home, "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`),
    ...logPaths(home),
    stateDir: stateDir(home),
  };
}

export interface PlistInput {
  nodePath: string;
  cliPath: string;
  workdir: string;
  port: number;
  outLog: string;
  errLog: string;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Pure: render the launchd plist XML for `cxc serve`. */
export function buildPlist(input: PlistInput): string {
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

function launchctl(...args: string[]): { code: number; stderr: string } {
  const res = spawnSync("launchctl", args, { encoding: "utf8" });
  return { code: res.status ?? 1, stderr: typeof res.stderr === "string" ? res.stderr : "" };
}

const launchdOps: ServiceOps = {
  install(opts) {
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
    launchctl("unload", paths.plist);
    const load = launchctl("load", paths.plist);
    if (load.code !== 0) {
      return { ok: false, message: `plist written but launchctl load failed: ${load.stderr.trim()}` };
    }
    return { ok: true, message: `cxc service installed (launchd, label ${SERVICE_LABEL}).` };
  },
  uninstall(home?) {
    const paths = servicePaths(home);
    if (!existsSync(paths.plist)) return { ok: true, message: "cxc service: not installed." };
    launchctl("unload", paths.plist);
    rmSync(paths.plist, { force: true });
    return { ok: true, message: "cxc service stopped and removed (launchd)." };
  },
  status(home?) {
    const paths = servicePaths(home);
    if (!existsSync(paths.plist)) return { ok: true, message: "cxc service: not installed." };
    const res = spawnSync("launchctl", ["list", SERVICE_LABEL], { encoding: "utf8" });
    if ((res.status ?? 1) === 0) return { ok: true, message: `cxc service: loaded. Logs: ${paths.outLog}` };
    return { ok: true, message: "cxc service: installed but not loaded." };
  },
};

// ── Linux (systemd user unit) ──

function unitPath(home = homedir()): string {
  return join(home, ".config", "systemd", "user", SYSTEMD_UNIT);
}

function buildSystemdUnit(opts: InstallOptions): string {
  const port = opts.port ?? 7717;
  const logs = logPaths(opts.home);
  return `[Unit]
Description=codexclaw serve daemon
After=network.target

[Service]
Type=simple
ExecStart=${opts.nodePath} ${opts.cliPath} serve --port ${port} --cwd ${opts.workdir}
Restart=on-failure
RestartSec=5
WorkingDirectory=${opts.workdir}
StandardOutput=append:${logs.outLog}
StandardError=append:${logs.errLog}

[Install]
WantedBy=default.target
`;
}

function systemctl(...args: string[]): { code: number; stderr: string } {
  const res = spawnSync("systemctl", ["--user", ...args], { encoding: "utf8" });
  return { code: res.status ?? 1, stderr: typeof res.stderr === "string" ? res.stderr : "" };
}

function isSystemd(): boolean {
  try { return spawnSync("systemctl", ["--user", "--version"], { encoding: "utf8" }).status === 0; } catch { return false; }
}

const systemdOps: ServiceOps = {
  install(opts) {
    if (existsSync("/.dockerenv")) return { ok: false, message: "Docker detected. Run 'cxc serve' directly." };
    if (!isSystemd()) return { ok: false, message: "systemd not found. Run 'cxc serve' under your process supervisor." };
    const uPath = unitPath(opts.home);
    mkdirSync(join(opts.home ?? homedir(), ".config", "systemd", "user"), { recursive: true });
    mkdirSync(stateDir(opts.home), { recursive: true });
    writeFileSync(uPath, buildSystemdUnit(opts), "utf8");
    systemctl("daemon-reload");
    systemctl("enable", SYSTEMD_UNIT);
    const start = systemctl("start", SYSTEMD_UNIT);
    if (start.code !== 0) return { ok: false, message: `unit written but start failed: ${start.stderr.trim()}` };
    return { ok: true, message: `cxc service installed (systemd user unit). For auto-start on boot: loginctl enable-linger $USER` };
  },
  uninstall(home?) {
    const uPath = unitPath(home);
    if (!existsSync(uPath)) return { ok: true, message: "cxc service: not installed." };
    systemctl("stop", SYSTEMD_UNIT);
    systemctl("disable", SYSTEMD_UNIT);
    rmSync(uPath, { force: true });
    systemctl("daemon-reload");
    return { ok: true, message: "cxc service stopped and removed (systemd)." };
  },
  status(home?) {
    if (!isSystemd()) return { ok: true, message: "cxc service: systemd not available." };
    const uPath = unitPath(home);
    if (!existsSync(uPath)) return { ok: true, message: "cxc service: not installed." };
    const res = spawnSync("systemctl", ["--user", "is-active", SYSTEMD_UNIT], { encoding: "utf8" });
    const state = (res.stdout ?? "").trim();
    return { ok: true, message: `cxc service: ${state || "unknown"} (systemd).` };
  },
};

// ── Windows (Task Scheduler) ──

function schtasksExe(): string {
  const candidate = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "schtasks.exe");
  return existsSync(candidate) ? candidate : "schtasks.exe";
}

function schtasks(args: string[]): { code: number; stdout: string; stderr: string } {
  const res = spawnSync(schtasksExe(), args, { encoding: "utf8", shell: false });
  return {
    code: res.status ?? 1,
    stdout: typeof res.stdout === "string" ? res.stdout : "",
    stderr: typeof res.stderr === "string" ? res.stderr : "",
  };
}

function buildWindowsScript(opts: InstallOptions): string {
  const port = opts.port ?? 7717;
  // Use .cmd batch script so Task Scheduler can run it directly
  return `@echo off\r\n"${opts.nodePath}" "${opts.cliPath}" serve --port ${port} --cwd "${opts.workdir}"\r\n`;
}

function windowsScriptPath(home = homedir()): string {
  return join(stateDir(home), "serve.cmd");
}

const windowsOps: ServiceOps = {
  install(opts) {
    const dir = stateDir(opts.home);
    mkdirSync(dir, { recursive: true });
    const script = windowsScriptPath(opts.home);
    writeFileSync(script, buildWindowsScript(opts), "utf8");
    // Remove existing task if present (ignore errors)
    schtasks(["/delete", "/tn", TASK_NAME, "/f"]);
    // Create: run on logon, restart on failure
    const create = schtasks([
      "/create", "/tn", TASK_NAME,
      "/tr", `"${script}"`,
      "/sc", "ONLOGON",
      "/rl", "LIMITED",
      "/f",
    ]);
    if (create.code !== 0) return { ok: false, message: `schtasks create failed: ${create.stderr.trim()}` };
    const run = schtasks(["/run", "/tn", TASK_NAME]);
    if (run.code !== 0) return { ok: false, message: `task created but run failed: ${run.stderr.trim()}` };
    return { ok: true, message: `cxc service installed (Task Scheduler, task ${TASK_NAME}).` };
  },
  uninstall(home?) {
    const res = schtasks(["/query", "/tn", TASK_NAME]);
    if (!res.stdout.includes(TASK_NAME)) return { ok: true, message: "cxc service: not installed." };
    schtasks(["/end", "/tn", TASK_NAME]);
    schtasks(["/delete", "/tn", TASK_NAME, "/f"]);
    const script = windowsScriptPath(home);
    if (existsSync(script)) rmSync(script, { force: true });
    return { ok: true, message: "cxc service stopped and removed (Task Scheduler)." };
  },
  status(home?) {
    const res = schtasks(["/query", "/tn", TASK_NAME]);
    if (!res.stdout.includes(TASK_NAME)) return { ok: true, message: "cxc service: not installed." };
    const running = res.stdout.includes("Running");
    return { ok: true, message: `cxc service: ${running ? "running" : "installed, not running"} (Task Scheduler).` };
  },
};

// ── Platform dispatcher ──

function platformOps(): ServiceOps | null {
  if (platform() === "darwin") return launchdOps;
  if (platform() === "linux") return systemdOps;
  if (platform() === "win32") return windowsOps;
  return null;
}

export function installService(opts: InstallOptions): ServiceResult {
  const ops = platformOps();
  if (!ops) return { ok: false, message: `cxc service: unsupported on ${platform()}. Supports macOS (launchd), Linux (systemd), Windows (Task Scheduler).` };
  return ops.install(opts);
}

export function uninstallService(home?: string): ServiceResult {
  const ops = platformOps();
  if (!ops) return { ok: false, message: `cxc service: unsupported on ${platform()}.` };
  return ops.uninstall(home);
}

export function serviceStatus(home?: string): ServiceResult {
  const ops = platformOps();
  if (!ops) return { ok: true, message: `cxc service: unsupported on ${platform()}.` };
  return ops.status(home);
}
