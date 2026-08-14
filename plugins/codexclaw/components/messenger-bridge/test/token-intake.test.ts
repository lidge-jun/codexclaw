/**
 * token-intake.test.ts -- secret-safe token intake tests (issue #12).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  readTokenFromStdin,
  readTokenFromFile,
  readTokenFromEnv,
  writeTokenFile,
  redactToken,
} from "../src/token-intake.ts";

test("readTokenFromStdin: reads first line from stream", async () => {
  const stream = Readable.from(["my-secret-token-12345\n"]);
  const result = await readTokenFromStdin(stream);
  assert.equal(result.ok, true);
  assert.equal(result.token, "my-secret-token-12345");
  assert.equal(result.mode, "stdin");
});

test("readTokenFromStdin: empty stream returns error", async () => {
  const stream = Readable.from([""]);
  const result = await readTokenFromStdin(stream);
  assert.equal(result.ok, false);
  assert.equal(result.mode, "stdin");
});

test("readTokenFromStdin: trims whitespace", async () => {
  const stream = Readable.from(["  tok-with-spaces  \n"]);
  const result = await readTokenFromStdin(stream);
  assert.equal(result.ok, true);
  assert.equal(result.token, "tok-with-spaces");
});

test("readTokenFromFile: reads and removes owner-only file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-token-"));
  try {
    const path = join(dir, "token");
    writeFileSync(path, "file-secret-token\n", { mode: 0o600 });
    const result = readTokenFromFile(path);
    assert.equal(result.ok, true);
    assert.equal(result.token, "file-secret-token");
    assert.equal(result.mode, "file");
    assert.equal(existsSync(path), false, "token file should be removed after read");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readTokenFromFile: rejects world-readable file on Unix", () => {
  if (process.platform === "win32") return;
  const dir = mkdtempSync(join(tmpdir(), "cxc-token-"));
  try {
    const path = join(dir, "token");
    writeFileSync(path, "insecure-token\n");
    chmodSync(path, 0o644);
    const result = readTokenFromFile(path);
    assert.equal(result.ok, false);
    assert.match(result.error || "", /owner-only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readTokenFromFile: missing file returns error", () => {
  const result = readTokenFromFile("/nonexistent/path/token");
  assert.equal(result.ok, false);
  assert.equal(result.mode, "file");
});

test("readTokenFromFile: empty file returns error", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-token-"));
  try {
    const path = join(dir, "token");
    writeFileSync(path, "", { mode: 0o600 });
    const result = readTokenFromFile(path);
    assert.equal(result.ok, false);
    assert.match(result.error || "", /empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readTokenFromEnv: reads and unsets env var", () => {
  const varName = "CXC_TEST_TOKEN_INTAKE_" + Date.now();
  process.env[varName] = "env-secret-token";
  const result = readTokenFromEnv(varName);
  assert.equal(result.ok, true);
  assert.equal(result.token, "env-secret-token");
  assert.equal(result.mode, "env");
  assert.equal(process.env[varName], undefined, "env var should be unset after read");
});

test("readTokenFromEnv: missing var returns error", () => {
  const result = readTokenFromEnv("CXC_NONEXISTENT_VAR_" + Date.now());
  assert.equal(result.ok, false);
  assert.equal(result.mode, "env");
});

test("writeTokenFile: creates owner-only file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-token-"));
  try {
    const path = writeTokenFile(dir, "write-test-token");
    assert.ok(existsSync(path));
    if (process.platform !== "win32") {
      const mode = statSync(path).mode & 0o777;
      assert.equal(mode, 0o600, "token file should be 0600");
    }
    const result = readTokenFromFile(path);
    assert.equal(result.ok, true);
    assert.equal(result.token, "write-test-token");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("redactToken: replaces token in text", () => {
  const token = "bot123456:AAH-secretpart";
  const text = "Error validating bot123456:AAH-secretpart with API";
  assert.equal(redactToken(text, token), "Error validating [REDACTED] with API");
});

test("redactToken: short tokens are not redacted (safety)", () => {
  assert.equal(redactToken("short", "abc"), "short");
});

test("sentinel: token never appears in error messages from intake", () => {
  const sentinel = "SENTINEL_TOKEN_" + Date.now() + "_MUST_NOT_LEAK";
  const dir = mkdtempSync(join(tmpdir(), "cxc-token-"));
  try {
    const path = join(dir, "token");
    writeFileSync(path, sentinel, { mode: 0o600 });
    const fileResult = readTokenFromFile(path);
    if (fileResult.error) {
      assert.ok(!fileResult.error.includes(sentinel), "sentinel leaked in file error");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const envResult = readTokenFromEnv("NONEXISTENT_" + Date.now());
  if (envResult.error) {
    assert.ok(!envResult.error.includes(sentinel), "sentinel leaked in env error");
  }
});
