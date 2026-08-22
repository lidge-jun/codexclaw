/**
 * codex-bin.test.ts - the win32 `codex` resolution contract (issue #33, bug A).
 *
 * Every case drives platform and env as parameters, so the whole file runs
 * identically on Windows and on Linux CI. The two failure modes reproduced on a
 * stock Codex-desktop host are pinned here:
 *   - WindowsApps\codex.EXE spawns EPERM even though it is readable
 *   - the npm codex.CMD shim spawns EINVAL without a cmd.exe hop
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isWindowsAppsAlias,
  resolveCodexInvocation,
  spawnableWindowsCandidates,
} from "../src/codex-bin.ts";

/** A throwaway PATH dir holding the given command files. */
function fakePathDir(names: string[], prefix = "cxc-codexbin-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), "");
  return dir;
}

/** A dir whose path contains a WindowsApps segment, like the Store install. */
function fakeWindowsAppsDir(names: string[]): string {
  const base = mkdtempSync(join(tmpdir(), "cxc-store-"));
  const dir = join(base, "WindowsApps", "OpenAI.Codex_1.0.0_x64__abc", "app", "resources");
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), "");
  return dir;
}

test("POSIX is a passthrough", () => {
  const inv = resolveCodexInvocation("codex", ["features", "list"], "linux", {});
  assert.equal(inv.file, "codex");
  assert.deepEqual(inv.args, ["features", "list"]);
  assert.deepEqual(inv.options, {});
});

test("CODEX_BIN overrides discovery on POSIX", () => {
  const inv = resolveCodexInvocation("codex", ["features", "list"], "linux", {
    CODEX_BIN: "/opt/codex/bin/codex",
  });
  assert.equal(inv.file, "/opt/codex/bin/codex");
  assert.deepEqual(inv.args, ["features", "list"]);
});

test("CODEX_BIN pointing at a real .exe wins over PATH on win32", () => {
  const pathDir = fakePathDir(["codex.cmd"]);
  const overrideDir = fakePathDir(["codex.exe"], "cxc-override-");
  const override = join(overrideDir, "codex.exe");
  const inv = resolveCodexInvocation("codex", ["features", "list"], "win32", {
    CODEX_BIN: override,
    PATH: pathDir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  assert.equal(inv.file, override);
  assert.deepEqual(inv.args, ["features", "list"]);
  assert.equal(inv.options.windowsVerbatimArguments, undefined);
});

test("a WindowsApps segment is recognized, and a lookalike directory is not", () => {
  assert.equal(isWindowsAppsAlias("C:\\Program Files\\WindowsApps\\x\\codex.exe"), true);
  assert.equal(isWindowsAppsAlias("C:/Program Files/WindowsApps/x/codex.exe"), true);
  assert.equal(isWindowsAppsAlias("C:\\tools\\MyWindowsAppsBackup\\codex.exe"), false);
  assert.equal(isWindowsAppsAlias("C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd"), false);
});

test("the Store binary is skipped even though it exists and is readable", () => {
  // Measured on a stock host: this file is readable, is not a reparse point, and
  // still fails CreateProcess with EPERM. Only the path segment reveals it.
  const storeDir = fakeWindowsAppsDir(["codex.exe"]);
  const candidates = spawnableWindowsCandidates("codex", {
    PATH: storeDir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  });
  assert.deepEqual(candidates, []);
});

test("with only the Store binary on PATH, resolution falls back to cmd.exe", () => {
  const storeDir = fakeWindowsAppsDir(["codex.exe"]);
  const comspec = "C:\\Windows\\system32\\cmd.exe";
  const inv = resolveCodexInvocation("codex", ["features", "list"], "win32", {
    PATH: storeDir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: comspec,
  });
  assert.equal(inv.file, comspec);
  assert.deepEqual(inv.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(inv.options.windowsVerbatimArguments, true);
  assert.match(inv.args[3], /codex/);
});

test("the npm .cmd shim routes through ComSpec instead of spawning directly", () => {
  // A shell-less .cmd spawn is EINVAL after the CVE-2024-27980 hardening.
  const dir = fakePathDir(["codex.cmd"]);
  const comspec = "C:\\Windows\\system32\\cmd.exe";
  const inv = resolveCodexInvocation("codex", ["features", "list"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: comspec,
  });
  assert.equal(inv.file, comspec);
  assert.equal(inv.options.windowsVerbatimArguments, true);
  assert.match(inv.args[3], /codex\.cmd/i);
  assert.match(inv.args[3], /features/);
});

test("a real .exe earlier on PATH spawns directly, with no cmd.exe hop", () => {
  const dir = fakePathDir(["codex.exe"]);
  const inv = resolveCodexInvocation("codex", ["features", "list"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  assert.equal(inv.file.toLowerCase(), join(dir, "codex.exe").toLowerCase());
  assert.deepEqual(inv.args, ["features", "list"]);
  assert.equal(inv.options.windowsVerbatimArguments, undefined);
});

test("the npm shim is preferred when the Store dir sits earlier on PATH", () => {
  // This is the exact live layout from issue #33: both are present, and the
  // unusable one is NOT the one we may pick.
  const storeDir = fakeWindowsAppsDir(["codex.exe"]);
  const npmDir = fakePathDir(["codex.cmd"]);
  const candidates = spawnableWindowsCandidates("codex", {
    PATH: [storeDir, npmDir].join(";"),
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  });
  // The extension case comes from PATHEXT, so compare case-insensitively.
  assert.deepEqual(
    candidates.map((c) => c.toLowerCase()),
    [join(npmDir, "codex.cmd").toLowerCase()],
  );
});

test("an unresolvable codex still produces a runnable cmd.exe line, not a bare spawn", () => {
  const inv = resolveCodexInvocation("codex", ["features", "list"], "win32", {
    PATH: fakePathDir([]),
    PATHEXT: ".EXE",
    ComSpec: "cmd.exe",
  });
  assert.equal(inv.file, "cmd.exe");
  assert.equal(inv.options.windowsVerbatimArguments, true);
});

test("arguments with spaces and metacharacters survive the cmd fallback", () => {
  const inv = resolveCodexInvocation("codex", ["features", "C:\\Program Files\\a&b"], "win32", {
    PATH: fakeWindowsAppsDir(["codex.exe"]),
    PATHEXT: ".EXE",
    ComSpec: "cmd.exe",
  });
  const line = inv.args[3];
  assert.ok(line.includes("^&"), `ampersand not escaped in: ${line}`);
  assert.ok(line.includes("Program^ Files"), `space not escaped in: ${line}`);
  assert.ok(!/(^|[^^])&/.test(line), "a bare & would end the command line early");
});

test("a path-qualified command is not PATH-resolved, but a Store path is still refused", () => {
  const inv = resolveCodexInvocation("C:\\tools\\codex.exe", [], "win32", { PATH: "C:\\bin" });
  assert.equal(inv.file, "C:\\tools\\codex.exe");
  assert.deepEqual(spawnableWindowsCandidates("C:\\x\\WindowsApps\\codex.exe", {}), []);
});

test("ComSpec is honored when set to a non-default shell path", () => {
  const inv = resolveCodexInvocation("codex", [], "win32", {
    PATH: fakePathDir([]),
    PATHEXT: ".EXE",
    ComSpec: "D:\\alt\\cmd.exe",
  });
  assert.equal(inv.file, "D:\\alt\\cmd.exe");
});
