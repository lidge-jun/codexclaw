/**
 * receipt-spawn.test.ts - issue #40: `cxc receipt test -- npm test` on Windows.
 *
 * The receipt runner used to hand its argv straight to a shell-less spawnSync,
 * which cannot start the command people actually pass. Bare `npm` skips PATHEXT
 * (ENOENT) and the resolved `npm.cmd` is refused by Node after the
 * CVE-2024-27980 hardening (EINVAL) - so the documented C->D receipt path did
 * not work on Windows at all.
 *
 * Platform and env are parameters, so this contract runs identically everywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandInvocation } from "../src/win-exec.ts";

function fakePathDir(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "cxc-receipt-spawn-"));
  mkdirSync(dir, { recursive: true });
  for (const name of names) writeFileSync(join(dir, name), "");
  return dir;
}

test("SHARED-HELPER-01: this package's win-exec copy is the same contract", () => {
  const inv = commandInvocation("npm", ["test"], "linux", {});
  assert.equal(inv.file, "npm");
  assert.deepEqual(inv.args, ["test"]);
  assert.deepEqual(inv.options, {});
});

test("SHARED-HELPER-01: the copy is byte-identical to the cxc-ops original", () => {
  const here = readFileSync(new URL("../src/win-exec.ts", import.meta.url));
  const origin = readFileSync(new URL("../../cxc-ops/src/win-exec.ts", import.meta.url));
  assert.ok(here.equals(origin), "win-exec.ts copies have drifted apart");
});

test("issue #40: a bare npm on win32 resolves its shim instead of ENOENTing", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const inv = commandInvocation("npm", ["test"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  // A .cmd cannot be spawned directly, so it must go through ComSpec.
  assert.equal(inv.file, "C:\\Windows\\system32\\cmd.exe");
  assert.equal(inv.options.windowsVerbatimArguments, true);
  // The extension case comes from PATHEXT, so compare case-insensitively.
  const line = inv.args[3].toLowerCase();
  assert.ok(line.includes("npm.cmd"), `shim not in the command line: ${inv.args[3]}`);
  assert.ok(line.includes("test"), `argument lost: ${line}`);
});

test("issue #40: a resolved .exe still spawns directly, with no shell hop", () => {
  const dir = fakePathDir(["node.exe"]);
  const inv = commandInvocation("node", ["--test"], "win32", {
    PATH: dir,
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  assert.equal(inv.file.toLowerCase(), join(dir, "node.exe").toLowerCase());
  assert.deepEqual(inv.args, ["--test"]);
});

test("issue #40: cmd metacharacters in an argument cannot end the command line", () => {
  const dir = fakePathDir(["npm.cmd"]);
  const inv = commandInvocation("npm", ["run", "a&b", "C:\\Program Files\\x"], "win32", {
    PATH: dir,
    PATHEXT: ".CMD",
    ComSpec: "cmd.exe",
  });
  const line = inv.args[3];
  assert.ok(!/(^|[^^])&/.test(line), `a bare & would end the line early: ${line}`);
  assert.ok(line.includes("Program^ Files"), `space not escaped: ${line}`);
});

test("issue #40: a win32 PATH is split on ';' even when the host uses ':'", () => {
  const first = fakePathDir([]);
  const second = fakePathDir(["npm.cmd"]);
  const inv = commandInvocation("npm", ["test"], "win32", {
    PATH: [first, second].join(";"),
    PATHEXT: ".CMD",
    ComSpec: "cmd.exe",
  });
  // Splitting on the HOST delimiter would collapse both entries into one bogus
  // directory and resolve nothing, leaving a bare "npm" that cannot start.
  assert.ok(
    inv.args[3].toLowerCase().includes("npm.cmd"),
    `second PATH entry not searched: ${inv.args[3]}`,
  );
});
