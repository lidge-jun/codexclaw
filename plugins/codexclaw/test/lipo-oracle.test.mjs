import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, runOracle } from "../skills/dev-devops/scripts/verify-lipo-command.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(pluginRoot, "skills/dev-devops/scripts/verify-lipo-command.mjs");
const fake = join(pluginRoot, "test/fixtures/fake-lipo.mjs");

function fixture(fn, { arches = "x86_64 arm64e", env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cxc-lipo-test-"));
  const artifact = join(dir, "good");
  writeFileSync(artifact, arches);
  try {
    return fn({ dir, artifact, invoke(candidate, extra = [], overrideEnv = {}) {
      return spawnSync(process.execPath, [script, "--artifact", artifact,
        "--arch", "x86_64", "--arch", "arm64e", "--lipo", fake,
        "--candidate-json", JSON.stringify(candidate), ...extra],
      { encoding: "utf8", env: { ...process.env, ...env, ...overrideEnv } });
    } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("lipo oracle accepts a candidate that passes good and fails thin", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.goodExit, 0);
  assert.equal(report.negativeExit, 1);
  assert.equal(report.missing, "arm64e");
}));

test("lipo oracle rejects a candidate that passes both", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-always-pass", "{artifact}"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.good.status, 0);
  assert.equal(report.negative.result.status, 0);
}));

test("lipo oracle rejects a candidate that fails both", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-always-fail", "{artifact}"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.good.status, 1);
  assert.equal(report.negative.result.status, 1);
}));

test("lipo oracle rejects an artifact with the wrong architecture set", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /artifact architectures x86_64 do not equal arm64e x86_64/);
}, { arches: "x86_64" }));

test("malformed candidate argv is a usage error", () => fixture(({ artifact }) => {
  const prefix = [script, "--artifact", artifact, "--arch", "x86_64", "--arch", "arm64e", "--lipo", fake, "--candidate-json"];
  for (const candidate of ["null", "[]", '["lipo",1,"{artifact}"]', '["lipo","-archs"]']) {
    const result = spawnSync(process.execPath, [...prefix, candidate], { encoding: "utf8" });
    assert.equal(result.status, 2, candidate);
    assert.match(result.stderr, /candidate-json/);
  }
}));

test("shell tokens are passed as data, not expanded", () => fixture(({ dir, invoke }) => {
  const capture = join(dir, "capture.jsonl");
  const result = invoke([fake, ";", "-verify_arch", "x86_64", "{artifact}"], [],
    { CXC_FAKE_LIPO_CAPTURE: capture });
  assert.equal(result.status, 1);
  const calls = readFileSync(capture, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(calls.some((args) => args.includes(";")));
}));

test("lipo inspection failure is exit 2", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot inspect artifact/);
}, { env: { CXC_FAKE_LIPO_MODE: "archs-fail" } }));

test("thin-slice creation failure is exit 2", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /could not create negative control/);
}, { env: { CXC_FAKE_LIPO_MODE: "thin-fail" } }));

test("a thin command that writes nothing is exit 2, not a pass", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /thin command wrote no file/);
}, { env: { CXC_FAKE_LIPO_MODE: "thin-noop" } }));

test("a negative control that still holds every architecture is exit 2", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /could not create negative control: expected only/);
}, { env: { CXC_FAKE_LIPO_MODE: "thin-wrong" } }));

test("duplicate --arch is a usage error", () => fixture(({ invoke }) => {
  const result = invoke([fake, "-verify_arch", "arm64e", "{artifact}"], ["--arch", "x86_64"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicate --arch/);
}));

test("cleanup failure is exit 2 and names the temp path", () => fixture(({ artifact }) => {
  const options = parseArgs(["--artifact", artifact, "--arch", "x86_64", "--arch", "arm64e",
    "--lipo", fake, "--candidate-json", JSON.stringify([fake, "-verify_arch", "arm64e", "{artifact}"])]);
  let created;
  const result = runOracle(options, { removeTree(path) { created = path; throw new Error("fixture cleanup refused"); } });
  assert.equal(result.code, 2);
  assert.ok(created);
  assert.match(result.error, /cleanup failed for .*cxc-lipo-oracle-/);
  assert.match(result.error, /fixture cleanup refused/);
  rmSync(created, { recursive: true, force: true });
}));

const foundRealLipo = process.platform === "darwin"
  ? spawnSync("xcrun", ["--find", "lipo"], { encoding: "utf8" }) : null;
test("real lipo oracle is opt-in", {
  skip: process.env.CXC_REAL_LIPO !== "1" || foundRealLipo?.status !== 0,
}, () => {
  const found = foundRealLipo;
  const lipo = found.stdout.trim();
  const version = spawnSync(lipo, ["-version"], { encoding: "utf8" });
  const result = spawnSync(process.execPath, [script, "--artifact", "/bin/ls", "--arch", "x86_64",
    "--arch", "arm64e", "--lipo", lipo,
    "--candidate-json", JSON.stringify([lipo, "-verify_arch", "arm64e", "{artifact}"])], { encoding: "utf8" });
  console.log(`real lipo: ${lipo}; -version exit ${version.status}: ${(version.stdout || version.stderr).trim().split("\n")[0]}`);
  assert.equal(result.status, 0, result.stderr);
});
