/** service.test.ts — launchd plist generation + path resolution (pure; no launchctl). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlist, servicePaths, SERVICE_LABEL, uninstallService, serviceStatus } from "../src/service.ts";

test("buildPlist embeds the serve command, keepalive, and log paths", () => {
  const xml = buildPlist({
    nodePath: "/usr/bin/node",
    cliPath: "/repo/bin/codexclaw.mjs",
    workdir: "/work/dir",
    port: 7717,
    outLog: "/home/.codexclaw/serve.out.log",
    errLog: "/home/.codexclaw/serve.err.log",
  });
  assert.match(xml, /<string>com\.codexclaw\.serve<\/string>/);
  assert.match(xml, /<string>\/usr\/bin\/node<\/string>/);
  assert.match(xml, /<string>\/repo\/bin\/codexclaw\.mjs<\/string>/);
  assert.match(xml, /<string>serve<\/string>/);
  assert.match(xml, /<string>--port<\/string>\s*<string>7717<\/string>/);
  assert.match(xml, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(xml, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(xml, /serve\.out\.log/);
  assert.match(xml, /serve\.err\.log/);
});

test("buildPlist XML-escapes paths with special chars", () => {
  const xml = buildPlist({
    nodePath: "/usr/bin/node",
    cliPath: "/repo/bin & tools/cli.mjs",
    workdir: "/work/<dir>",
    port: 80,
    outLog: "/o.log",
    errLog: "/e.log",
  });
  assert.match(xml, /bin &amp; tools/);
  assert.match(xml, /&lt;dir&gt;/);
  assert.ok(!xml.includes("<dir>"));
});

test("servicePaths derive from a given home", () => {
  const p = servicePaths("/Users/jun");
  assert.equal(p.plist, `/Users/jun/Library/LaunchAgents/${SERVICE_LABEL}.plist`);
  assert.equal(p.outLog, "/Users/jun/.codexclaw/serve.out.log");
  assert.equal(p.stateDir, "/Users/jun/.codexclaw");
});

test("uninstall/status are safe no-ops when not installed", () => {
  // Use an empty temp home so no real plist exists.
  const fakeHome = "/tmp/cxc-service-none-" + process.pid;
  const un = uninstallService(fakeHome);
  if (process.platform === "darwin") {
    assert.equal(un.ok, true);
    assert.match(un.message, /not installed|nothing to remove/);
  } else {
    // Non-darwin reports unsupported rather than pretending (service.ts:120-123).
    assert.equal(un.ok, false);
    assert.match(un.message, /only supported on macOS/);
  }
  const st = serviceStatus(fakeHome);
  assert.equal(st.ok, true);
  assert.match(st.message, /not installed/);
});
