import { test } from "node:test";
import assert from "node:assert/strict";
import { detectOcx, parseOcxStatus, renderStatusLine } from "../src/detect.ts";

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
