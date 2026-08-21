/**
 * win-exec.test.ts - the spawn-shape contract for commandInvocation (wp06 / 050 section 1).
 *
 * Every case drives platform and env as parameters, so the whole file runs
 * identically on Windows and on Linux CI. The helper is duplicated byte-for-byte
 * into skill-search and messenger-bridge under SHARED-HELPER-01; those packages
 * carry a one-line identity check against this same contract.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandInvocation, envValue, resolveWindowsCommand } from "../src/win-exec.ts";

/** A throwaway PATH dir holding the given command files. */
function fakePathDir(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "cxc-winexec-"));
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), "");
  return dir;
}

test("POSIX is a passthrough", () => {
  const inv = commandInvocation("npm", ["run", "dev"], "linux", {});
  assert.equal(inv.file, "npm");
  assert.deepEqual(inv.args, ["run", "dev"]);
  assert.deepEqual(inv.options, {});
});

test("an .exe resolves and spawns directly, with no cmd.exe hop", () => {
  const dir = fakePathDir(["gh.exe"]);
  const inv = commandInvocation("gh", ["auth", "status"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  // The extension case comes from PATHEXT, so compare case-insensitively.
  assert.equal(inv.file.toLowerCase(), join(dir, "gh.exe").toLowerCase());
  assert.deepEqual(inv.args, ["auth", "status"]);
  assert.equal(inv.options.windowsVerbatimArguments, undefined);
});

test("a .cmd routes through ComSpec with /d /s /c and verbatim args", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const comspec = "C:\\Windows\\system32\\cmd.exe";
  const inv = commandInvocation("npm", ["run", "dev"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: comspec,
  });
  assert.equal(inv.file, comspec);
  assert.deepEqual(inv.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(inv.options.windowsVerbatimArguments, true);
  assert.match(inv.args[3], /npm\.cmd/i);
});

test("arguments with spaces and metacharacters survive the cmd route", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const inv = commandInvocation("npm", ["run", "C:\\Program Files\\a&b"], "win32", {
    PATH: dir,
    PATHEXT: ".CMD",
    ComSpec: "cmd.exe",
  });
  const line = inv.args[3];
  // The ampersand must be caret-escaped so cmd.exe cannot treat it as a separator.
  assert.ok(line.includes("^&"), `ampersand not escaped in: ${line}`);
  assert.ok(line.includes("Program^ Files"), `space not escaped in: ${line}`);
  assert.ok(!/(^|[^^])&/.test(line), "a bare & would end the command line early");
});

test("envValue finds Path when asked for PATH, and reports genuinely absent keys", () => {
  assert.equal(envValue({ Path: "C:\\bin" }, "PATH"), "C:\\bin");
  assert.equal(envValue({ PATH: "C:\\bin" }, "PATH"), "C:\\bin");
  assert.equal(envValue({ ComSpec: "cmd.exe" }, "COMSPEC"), "cmd.exe");
  assert.equal(envValue({ Path: "C:\\bin" }, "PATHEXT"), undefined);
});

test("PATHEXT defaults when unset, so .EXE is still tried", () => {
  const dir = fakePathDir(["gh.exe"]);
  const inv = commandInvocation("gh", [], "win32", { PATH: dir });
  assert.equal(inv.file.toLowerCase(), join(dir, "gh.exe").toLowerCase());
});

test("an unresolvable command returns the input, leaving ENOENT to the caller", () => {
  const inv = commandInvocation("definitely-not-installed", ["--version"], "win32", {
    PATH: fakePathDir([]),
    PATHEXT: ".EXE",
  });
  assert.equal(inv.file, "definitely-not-installed");
  assert.deepEqual(inv.args, ["--version"]);
});

test("a command carrying a path separator is not PATH-resolved", () => {
  const inv = commandInvocation("C:\\tools\\gh.exe", [], "win32", { PATH: "C:\\bin" });
  assert.equal(inv.file, "C:\\tools\\gh.exe");
  assert.equal(resolveWindowsCommand("./local.exe", { PATH: "C:\\bin" }), "./local.exe");
});

