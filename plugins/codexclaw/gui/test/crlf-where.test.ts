/**
 * crlf-where.test.ts - where.exe stdout is CRLF (wp08 / 002 B9).
 *
 * SCOPE NARROWED (#131, wp6). detectDeps() no longer parses `where` stdout on win32:
 * it resolves PATH+PATHEXT through resolveWindowsCommand, because `where` lists the
 * extensionless npm sh shim first and that file is not an executable image. The
 * splitLines idiom below now pins only the POSIX `command -v` branch, plus the `?? ""`
 * guard. It is kept because that branch is still live and this package owns the helper.
 *
 * The win32 half is pinned by the launcher case at the bottom of this file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitLines } from "../src/server/text-lines.ts";
import { commandInvocation, resolveWindowsCommand } from "../../components/cxc-ops/src/win-exec.ts";

/** The idiom detectDeps() uses on `where` / `command -v` stdout. */
function firstPath(stdout: string): string {
  return splitLines(stdout)[0]?.trim() ?? "";
}

test("CRLF where output yields a clean first path", () => {
  const stdout = "C:\\Program Files\\nodejs\\node.exe\r\nC:\\other\\node.exe\r\n";
  const first = firstPath(stdout);
  assert.equal(first, "C:\\Program Files\\nodejs\\node.exe");
  assert.equal(first.includes("\r"), false, "no CR may survive into a spawned path");
});

test("LF where output is unchanged by the idiom", () => {
  assert.equal(firstPath("/usr/bin/node\n/usr/local/bin/node\n"), "/usr/bin/node");
});

test("empty stdout does not throw", () => {
  // The `?? ""` guard: any future filter() would make this undefined.trim().
  assert.equal(firstPath(""), "");
  assert.doesNotThrow(() => firstPath(""));
  assert.equal(splitLines("").filter((l) => l.length > 0)[0]?.trim() ?? "", "");
});

// #131 win32 half. An npm global install lays down BOTH an extensionless sh shim and a
// .cmd launcher, and `where` lists the extensionless one first. detectDeps() no longer
// asks `where` at all on win32; this pins the replacement.
test("win32 launcher selection prefers the PATHEXT launcher over the extensionless shim", t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-which-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "ocx"), "#!/bin/sh\n");      // npm sh shim, not an image
  writeFileSync(join(dir, "ocx.cmd"), "@echo off\r\n"); // the real launcher

  // Case-insensitive compare: candidates are built with the PATHEXT spelling (".CMD")
  // and Windows existsSync ignores case, so the resolved path carries PATHEXT casing.
  // What is pinned is that the extensionless shim LOST.
  const want = join(dir, "ocx.cmd").toLowerCase();
  assert.equal(resolveWindowsCommand("ocx", { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" }).toLowerCase(), want);
  // A child can arrive with `Path` instead of `PATH`.
  assert.equal(resolveWindowsCommand("ocx", { Path: dir }).toLowerCase(), want);

  // A .cmd must route through ComSpec with verbatim args; an .exe must not.
  const cmd = commandInvocation(join(dir, "ocx.cmd"), ["status", "--json"], "win32", { ComSpec: "cmd.exe" });
  assert.equal(cmd.file, "cmd.exe");
  assert.deepEqual(cmd.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(cmd.options.windowsVerbatimArguments, true);
  const exe = commandInvocation(join(dir, "ocx.exe"), ["status"], "win32", {});
  assert.notEqual(exe.options.windowsVerbatimArguments, true);
});
