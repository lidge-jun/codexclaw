import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectOcx, parseOcxStatus, renderStatusLine } from "../src/detect.ts";
import { commandInvocation, resolveWindowsCommand } from "../src/win-exec.ts";

const STATUS_JSON = JSON.stringify({
  schemaVersion: 1,
  proxy: { running: true, pid: 123 },
  listen: { port: 10100 },
  defaultProvider: "openai",
});

test("AC2: ocx absent -> native mode (exit-0 path)", () => {
  const s = detectOcx({ which: () => null });
  assert.equal(s.mode, "native");
  assert.match(renderStatusLine(s), /"mode":"native"/);
});

test("AC1: stub ocx present + readable status --json -> provider mode", () => {
  const s = detectOcx({
    which: () => "/usr/local/bin/ocx",
    runStatus: () => ({ status: 0, stdout: STATUS_JSON }),
  });
  assert.equal(s.mode, "provider");
  if (s.mode === "provider") {
    assert.equal(s.status.running, true);
    assert.equal(s.status.defaultProvider, "openai");
    assert.equal(s.status.port, 10100);
    assert.equal(s.ocxPath, "/usr/local/bin/ocx");
  }
  assert.match(renderStatusLine(s), /"port":10100/);
});

test("AC3: ocx detected but status exits non-zero -> error (NOT native, NOT fake provider)", () => {
  const s = detectOcx({ which: () => "/usr/local/bin/ocx", runStatus: () => ({ status: 1, stdout: "" }) });
  assert.equal(s.mode, "error");
  assert.match(renderStatusLine(s), /"mode":"error"/);
});

test("AC3: ocx detected but no runner wired -> error (detected-but-unreadable)", () => {
  const s = detectOcx({ which: () => "/usr/local/bin/ocx" });
  assert.equal(s.mode, "error");
});

test("AC3: ocx status throws -> error mode (never silently native)", () => {
  const s = detectOcx({
    which: () => "/usr/local/bin/ocx",
    runStatus: () => { throw new Error("spawn EACCES"); },
  });
  assert.equal(s.mode, "error");
  assert.match((s as { reason: string }).reason, /threw/);
});

test("AC3: status --json garbage/empty -> error (no parseable payload)", () => {
  const s = detectOcx({ which: () => "/x/ocx", runStatus: () => ({ status: 0, stdout: "   " }) });
  assert.equal(s.mode, "error");
});

test("parseOcxStatus: valid payload, missing proxy.running, non-json", () => {
  const ok = parseOcxStatus(STATUS_JSON);
  assert.equal(ok?.running, true);
  assert.equal(ok?.port, 10100);
  assert.equal(ok?.defaultProvider, "openai");
  assert.equal(parseOcxStatus('{"listen":{"port":1}}'), null); // no proxy.running
  assert.equal(parseOcxStatus("not json"), null);
  assert.equal(parseOcxStatus(""), null);
});

test("AC3: .cmd EINVAL (status=null) -> error mode, not native", () => {
  const s = detectOcx({
    which: () => "C:\\nvm4w\\nodejs\\ocx.cmd",
    runStatus: () => ({ status: null, stdout: "" }),
  });
  assert.equal(s.mode, "error");
  assert.match((s as { reason: string }).reason, /exited null/);
  assert.match(renderStatusLine(s), /"mode":"error"/);
});

// ---------------------------------------------------------------------------
// #131 half 1 — launcher selection.
// An npm global install lays down BOTH an extensionless sh shim and a .cmd
// launcher, and `where ocx` lists the extensionless one first. That file is not an
// executable image on Windows, so spawning it ENOENTs.
// ---------------------------------------------------------------------------
test("win32 launcher selection prefers the PATHEXT launcher over the extensionless shim", t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-pb-which-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "ocx"), "#!/bin/sh\n");      // npm sh shim, not an image
  writeFileSync(join(dir, "ocx.cmd"), "@echo off\r\n"); // the real launcher

  // Case-insensitive compare: candidates are built with the PATHEXT spelling
  // (".CMD") and Windows existsSync ignores case, so the resolved path carries
  // PATHEXT casing rather than the on-disk casing. What matters is that the
  // extensionless shim lost.
  const want = join(dir, "ocx.cmd").toLowerCase();
  assert.equal(
    resolveWindowsCommand("ocx", { PATH: dir, PATHEXT: ".COM;.EXE;.BAT;.CMD" }).toLowerCase(),
    want,
  );
  // A spawned child can arrive with `Path` instead of `PATH`; reading one fixed
  // spelling resolves against the wrong list.
  assert.equal(resolveWindowsCommand("ocx", { Path: dir }).toLowerCase(), want);
  // Nothing on PATH: the input comes back unchanged, which whichOcx maps to null.
  const empty = mkdtempSync(join(tmpdir(), "cxc-pb-empty-"));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  assert.equal(resolveWindowsCommand("ocx", { PATH: empty }), "ocx");
});

// ---------------------------------------------------------------------------
// #131 half 2 — ComSpec routing. After CVE-2024-27980 a shell-less .cmd spawn is
// EINVAL. Asserted on the invocation shape so it runs on every platform.
// ---------------------------------------------------------------------------
test("win32 .cmd routes through ComSpec with verbatim args; .exe does not", () => {
  const cmd = commandInvocation("C:\\nvm4w\\nodejs\\ocx.cmd", ["status", "--json"], "win32", {
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
  });
  assert.equal(cmd.file, "C:\\Windows\\system32\\cmd.exe");
  assert.deepEqual(cmd.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(cmd.options.windowsVerbatimArguments, true);
  assert.match(cmd.args[3], /status/);

  const exe = commandInvocation("C:\\tools\\ocx.exe", ["status", "--json"], "win32", {});
  assert.equal(exe.file, "C:\\tools\\ocx.exe");
  assert.deepEqual(exe.args, ["status", "--json"]);
  assert.notEqual(exe.options.windowsVerbatimArguments, true);

  // A metacharacter in the launcher path must be escaped, not passed through:
  // plain double quoting lets cmd execute only the prefix before `&`.
  const amp = commandInvocation("C:\\a&b\\ocx.cmd", ["status"], "win32", {});
  assert.match(amp.args[3], /\^&/);

  // POSIX is a passthrough.
  const posix = commandInvocation("/usr/local/bin/ocx", ["status"], "linux", {});
  assert.equal(posix.file, "/usr/local/bin/ocx");
  assert.deepEqual(posix.args, ["status"]);
});

// SHARED-HELPER-01: provider-bridge carries its own copy so a SessionStart hook
// never depends on another component having been built. The cost is drift, which
// this test converts into a loud failure.
test("provider-bridge win-exec.ts is byte-identical to the cxc-ops original", () => {
  const here = readFileSync(new URL("../src/win-exec.ts", import.meta.url));
  const origin = readFileSync(new URL("../../cxc-ops/src/win-exec.ts", import.meta.url));
  assert.deepEqual(here, origin);
});

// ---------------------------------------------------------------------------
// The wiring. The tests above exercise win-exec.ts directly and all pass when
// cli.ts is untouched. These two run the real cli.ts as a subprocess, so they are
// the only ones that prove whichOcx/runOcxStatus are actually wired.
// win32-only: the fixture needs a real .cmd, so Linux/macOS CI does not gate this.
// ---------------------------------------------------------------------------
const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function detectWithPath(path: string): { status: number | null; line: Record<string, unknown> } {
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI, "detect"], {
    encoding: "utf8",
    env: { ...process.env, PATH: path, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
  });
  const tail = (res.stdout ?? "").trim().split(/\r?\n/).pop() ?? "";
  return { status: res.status, line: tail ? JSON.parse(tail) : {} };
}

test("detect resolves the .cmd launcher and reads status through ComSpec end to end", { skip: process.platform !== "win32" }, t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-pb-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "ocx"), "#!/bin/sh\nexit 1\n");
  writeFileSync(
    join(dir, "ocx.cmd"),
    // cmd has no here-doc; one echo line. No cmd metacharacters in this payload.
    "@echo off\r\n" +
      'echo {"proxy":{"running":true},"defaultProvider":"openai","listen":{"port":10100}}\r\n',
  );

  // dir FIRST so the crafted launcher wins over any real ocx on this machine.
  const { status, line } = detectWithPath(`${dir};${process.env.PATH ?? ""}`);
  assert.equal(status, 0);
  assert.equal(line.mode, "provider");            // not "error", not "native"
  // The launcher, not the shim. Compare case-insensitively: resolveWindowsCommand
  // builds candidates with the PATHEXT spelling (".CMD") and Windows existsSync is
  // case-insensitive, so the returned path carries PATHEXT casing rather than the
  // on-disk casing. Harmless for spawning; see 010 §7.
  assert.equal(String(line.ocxPath).toLowerCase(), join(dir, "ocx.cmd").toLowerCase());
  assert.match(String(line.ocxPath), /\.cmd$/i);
  assert.equal(line.running, true);                // the payload really came back
  assert.equal(line.port, 10100);
});

test("no ocx on PATH resolves to native through the real resolver", { skip: process.platform !== "win32" }, t => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-pb-none-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { status, line } = detectWithPath(dir);
  assert.equal(status, 0);
  assert.equal(line.mode, "native");
});
