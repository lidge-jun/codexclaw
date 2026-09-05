#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const digest = bytes => createHash("sha256").update(bytes).digest("hex");
export const fileDigest = file => digest(readFileSync(file));
const json = file => JSON.parse(readFileSync(file, "utf8"));
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", {flag:"wx", mode:0o600});
const inside = (root, file) => file.startsWith(root + sep);

function real(file) {
  if (!isAbsolute(file)) throw new Error("absolute path required");
  // Check every component, including a link whose resolved spelling is unchanged.
  for (let path = resolve(file); ; path = dirname(path)) {
    if (lstatSync(path).isSymbolicLink()) throw new Error("symlinked path refused");
    if (dirname(path) === path) break;
  }
  const path = realpathSync(file);
  if (path !== resolve(file)) throw new Error("symlinked path refused");
  return path;
}

export function payloadDigest(root) {
  real(root); // Walking entries alone misses a replaced payload root/ancestor.
  const rows = [];
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error("payload symlink refused");
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) rows.push([relative(root, path), fileDigest(path)]);
      else throw new Error("non-file payload entry refused");
    }
  }
  walk(root);
  return digest(JSON.stringify(rows));
}

const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";

export function probeEnv(home, launchDir, pluginRoot) {
  return {
    PATH: [launchDir, dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    CODEXCLAW_CXC: shellQuote(process.execPath) + " " + shellQuote(join(pluginRoot, "bin", "cxc.mjs")),
    LANG: "en_US.UTF-8", HOME: home, USERPROFILE: home,
    CODEX_HOME: join(home, ".codex"), CODEX_SQLITE_HOME: join(home, ".codex"),
    TMPDIR: join(home, "tmp"),
  };
}

export function execArgs(tier, finalPath) {
  if (tier !== "priority") throw new Error("only audited priority condition is supported");
  return ["exec", "-m", "gpt-6-astra", "-c", 'model_reasoning_effort="high"',
    "-c", 'service_tier="priority"', "--dangerously-bypass-approvals-and-sandbox",
    "--json", "-o", finalPath];
}

function cleanSource(root, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("exact source SHA required");
  for (const [args, expected] of [
    [["rev-parse", "HEAD"], sha], [["status", "--porcelain"], ""],
  ]) {
    const r = spawnSync("git", args, {cwd:root, encoding:"utf8", timeout:10000});
    if (r.status !== 0 || r.stdout.trim() !== expected) throw new Error("source identity mismatch or dirty source");
  }
  const listed = spawnSync("git", ["ls-files", "-z"], {cwd:root, encoding:"utf8", timeout:10000, maxBuffer:16 * 1024 * 1024});
  if (listed.error || listed.signal || listed.status !== 0) throw new Error("source file inventory failed");
  const files = listed.stdout.split("\0").filter(Boolean).sort().map(name => {
    const path = real(resolve(root, name));
    if (!inside(root, path) || !lstatSync(path).isFile()) throw new Error("contained source file required");
    return [name, fileDigest(path)];
  });
  return digest(JSON.stringify([sha, files]));
}

function prepare(spec) {
  // Platform compatibility only; the operator must establish physical host identity.
  if (process.platform !== "darwin") throw new Error("macOS required; physical host identity is operator-verified");
  if (spec.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(spec.candidate || "")) throw new Error("invalid run spec");
  const root = real(spec.root), sourceRoot = real(spec.sourceRoot);
  if (root === sourceRoot || inside(sourceRoot, root)) throw new Error("run root must be outside source");
  const home = real(join(root, "home")), cwd = real(join(root, "work"));
  if (home === realpathSync(homedir())) throw new Error("shared HOME refused");
  const codexHome = real(join(home, ".codex"));
  real(join(codexHome, "config.toml"));
  real(join(root, "prompt.txt"));
  real(join(root, "approval.md"));
  const installed = json(real(join(root, "install.json")));
  const pluginRoot = real(installed.installedPath || installed.path || "");
  if (!inside(codexHome, pluginRoot)) throw new Error("installed root outside isolated CODEX_HOME");
  const manifest = json(join(pluginRoot, ".codex-plugin", "plugin.json"));
  if (manifest.name !== "codexclaw" || manifest.version !== spec.expectedVersion) throw new Error("manifest identity mismatch");
  const timeoutMs = spec.timeoutMs ?? 180000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw new Error("invalid timeout");
  execArgs(spec.serviceTier, "final.txt");
  cleanSource(sourceRoot, spec.sourceSha);
  const codexBin = realpathSync(spec.codexBin);
  if (!isAbsolute(spec.codexBin)) throw new Error("absolute Codex binary required");
  payloadDigest(pluginRoot); // reject nested links before executing any candidate code
  const launchDir = join(home, "probe-bin");
  mkdirSync(launchDir, {mode:0o700});
  const env = probeEnv(home, launchDir, pluginRoot);
  writeFileSync(join(launchDir, "cxc"), "#!/bin/sh\nexec " + env.CODEXCLAW_CXC + ' "$@"\n', {flag:"wx", mode:0o700});
  writeFileSync(join(launchDir, "codex"), "#!/bin/sh\nexec " + shellQuote(codexBin) + ' "$@"\n', {flag:"wx", mode:0o700});
  const out = join(root, "output");
  mkdirSync(out, {mode:0o700}); // exclusive; a failed run is never overwritten
  mkdirSync(join(home, "tmp"), {recursive:true, mode:0o700});
  return {root, sourceRoot, sourceSha:spec.sourceSha, home, cwd, codexHome, pluginRoot, codexBin, launchDir, out, timeoutMs, env};
}

function doctor(p, label) {
  const r = spawnSync(process.execPath, [join(p.pluginRoot, "bin", "cxc.mjs"), "doctor", "--json"], {
    cwd:p.cwd, env:p.env, encoding:"utf8", timeout:30000, maxBuffer:16 * 1024 * 1024,
  });
  writeFileSync(join(p.out, `doctor-${label}.json`), r.stdout || "", {flag:"wx", mode:0o600});
  writeFileSync(join(p.out, `doctor-${label}.stderr`), r.stderr || "", {flag:"wx", mode:0o600});
  if (r.error || r.signal) throw new Error("doctor transport failure");
  const report = JSON.parse(r.stdout);
  for (const name of ["manifest", "hooks", "hook-trust", "install-root"]) {
    const matches = report.checks.filter(c => c.name === name);
    if (matches.length !== 1 || matches[0].severity !== "PASS") throw new Error(`doctor ${name} not PASS`);
  }
  return {rc:r.status, selectedChecks:"PASS"};
}

function snapshot(p) {
  // A matching digest is not path identity: re-establish isolation at EVERY
  // snapshot, before dispatching either doctor and after either child returns.
  for (const path of [p.root, p.sourceRoot, p.home, p.cwd, p.codexHome, p.pluginRoot, p.launchDir, p.out]) {
    if (!lstatSync(real(path)).isDirectory()) throw new Error("identity directory required");
  }
  if (p.root === p.sourceRoot || inside(p.sourceRoot, p.root)) throw new Error("run root must be outside source");
  if (p.home === realpathSync(homedir())) throw new Error("shared HOME refused");
  for (const [root, path] of [[p.root, p.home], [p.root, p.cwd], [p.home, p.codexHome],
    [p.codexHome, p.pluginRoot], [p.home, p.launchDir], [p.root, p.out]]) {
    if (!inside(root, path)) throw new Error("identity path escapes isolated root");
  }
  const hashes = {};
  for (const [key, root, name] of [["config", p.codexHome, "config.toml"],
    ["cxcLauncher", p.launchDir, "cxc"], ["codexLauncher", p.launchDir, "codex"],
    ["approval", p.root, "approval.md"], ["install", p.root, "install.json"], ["prompt", p.root, "prompt.txt"]]) {
    const path = real(join(root, name));
    if (!inside(root, path) || !lstatSync(path).isFile()) throw new Error("contained identity file required");
    hashes[key] = fileDigest(path);
  }
  for (const [key, file] of [["codex", p.codexBin], ["recorder", fileURLToPath(import.meta.url)]]) {
    const path = real(file);
    if (!lstatSync(path).isFile()) throw new Error("entrypoint identity file required");
    hashes[key] = fileDigest(path);
  }
  return {...hashes, payload:payloadDigest(p.pluginRoot), source:cleanSource(p.sourceRoot, p.sourceSha)};
}

export function runOwned({bin, args, cwd, env, prompt, timeoutMs, stdoutFd, stderrFd}) {
  return new Promise(resolveRun => {
    const started = Date.now();
    const child = spawn(bin, args, {cwd, env, detached:true, stdio:["pipe", stdoutFd, stderrFd]});
    let interruption = null, spawnError = null, escalation;
    const signalGroup = signal => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); } catch (error) {
        if (error.code !== "ESRCH") spawnError = error.code || "SIGNAL_ERROR";
      }
    };
    const stop = reason => {
      if (interruption) return;
      interruption = reason;
      signalGroup("SIGTERM");
      escalation = setTimeout(() => signalGroup("SIGKILL"), 3000);
    };
    const interrupt = () => stop("SIGINT"), terminate = () => stop("SIGTERM");
    process.once("SIGINT", interrupt); process.once("SIGTERM", terminate);
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    child.on("error", error => { spawnError = error.code || "SPAWN_ERROR"; });
    child.stdin.on("error", error => { if (error.code !== "EPIPE") stop("stdin-error"); });
    child.on("close", (rc, signal) => {
      signalGroup("SIGKILL"); // only descendants still in this owned process group
      clearTimeout(timer); clearTimeout(escalation);
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
      resolveRun({rc, signal, interruption, spawnError, elapsedMs:Date.now() - started});
    });
    child.stdin.end(prompt);
  });
}

export async function record(spec) {
  const p = prepare(spec);
  const before = snapshot(p), beforeDoctor = doctor(p, "before");
  if (JSON.stringify(before) !== JSON.stringify(snapshot(p))) {
    throw new Error("identity changed during preflight doctor");
  }
  const prompt = readFileSync(join(p.root, "prompt.txt"));
  if (digest(prompt) !== before.prompt) throw new Error("prompt identity changed before dispatch");
  const finalPath = join(p.out, "final.txt"), args = execArgs(spec.serviceTier, finalPath);
  const stdoutFd = openSync(join(p.out, "stdout.jsonl"), "wx", 0o600);
  const stderrFd = openSync(join(p.out, "stderr.log"), "wx", 0o600);
  let outcome;
  try {
    outcome = await runOwned({bin:p.codexBin, args, cwd:p.cwd, env:p.env, prompt,
      timeoutMs:p.timeoutMs, stdoutFd, stderrFd});
  } finally { closeSync(stdoutFd); closeSync(stderrFd); }
  let afterDoctor, after, postflightError = false;
  try {
    after = snapshot(p);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("identity changed during run");
    afterDoctor = doctor(p, "after");
    after = snapshot(p);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("identity changed during doctor");
  }
  catch { postflightError = true; }
  const files = {};
  for (const name of ["stdout.jsonl", "stderr.log", "final.txt", "doctor-before.json",
    "doctor-before.stderr", "doctor-after.json", "doctor-after.stderr"]) {
    if (existsSync(join(p.out, name))) files[name] = fileDigest(join(p.out, name));
  }
  const report = {
    schemaVersion:1, candidate:spec.candidate, sourceSha:p.sourceSha,
    pluginRoot:p.pluginRoot, version:spec.expectedVersion,
    codexBin:p.codexBin, codexSha256:before.codex,
    dispatch:{path:p.env.PATH, cxc:p.env.CODEXCLAW_CXC, launcherRoot:p.launchDir},
    recorderSha256:before.recorder,
    approvalSha256:before.approval,
    installSha256:before.install, promptSha256:digest(prompt),
    requested:{model:"gpt-6-astra", effort:"high", serviceTier:spec.serviceTier},
    args, timeoutMs:p.timeoutMs, before, after, beforeDoctor, afterDoctor, postflightError, outcome, files,
  };
  save(join(p.out, "run.json"), report);
  const ok = outcome.rc === 0 && !outcome.signal && !outcome.interruption && !outcome.spawnError
    && !postflightError && JSON.stringify(before) === JSON.stringify(after);
  return {ok, out:p.out};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    if (process.argv.length !== 3) throw new Error("one spec path required");
    const result = await record(json(process.argv[2]));
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error("probe-recorder: preflight or recording failed; inspect private artifacts");
    process.exitCode = 2;
  }
}
