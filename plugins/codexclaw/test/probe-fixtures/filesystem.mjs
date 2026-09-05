// Canonical private filesystem and subprocess support; no tests run on import.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const recorderUrl = pathToFileURL(join(pluginRoot, "scripts/probe-recorder.mjs")).href;
export const benchmark = join(pluginRoot, "scripts/hook-bench.mjs");
export const darwinOnly = {
  skip: process.platform === "darwin" ? false : "Requires macOS recorder and owned process-group fixtures; always runs on macmini",
};

export const sha = bytes => createHash("sha256").update(bytes).digest("hex");
export const jsonl = rows => rows.map(row => JSON.stringify(row)).join("\n") + "\n";
export const readJson = file => JSON.parse(readFileSync(file, "utf8"));
export function tempRoot(t, prefix = "cxc-proof-") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

export function put(root, file, value, mode = 0o600) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, { mode });
  return path;
}

export const putJson = (root, file, value) => put(root, file, JSON.stringify(value));

export function isolatedEnv(root) {
  const home = join(root, "home");
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, "tmp"), { recursive: true });
  const system = process.platform === "win32"
    ? Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(SystemRoot|WINDIR|ComSpec|PATHEXT)$/i.test(key)))
    : {};
  return { ...system, PATH: [dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    HOME: home, USERPROFILE: home, CODEX_HOME: join(home, ".codex"),
    CODEX_SQLITE_HOME: join(home, ".codex"), TMPDIR: join(home, "tmp"), TEMP: join(home, "tmp"), TMP: join(home, "tmp"), LANG: "en_US.UTF-8" };
}

export function syncNode(args, root, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root, env: isolatedEnv(root), encoding: "utf8", timeout: 20000, ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}
