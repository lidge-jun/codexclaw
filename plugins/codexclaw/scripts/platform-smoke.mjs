#!/usr/bin/env node
/**
 * platform-smoke.mjs - execute the surfaces that only break on a real OS.
 *
 * The unit suites are pure-function suites: they pass identically on every
 * platform, which is exactly why a green three-OS matrix shipped a bundle that
 * shreds its own output on Windows (002 B3) and a `cxc gui` that ENOENTs (002 B4).
 * Every check here SPAWNS or writes something real.
 *
 * Exit 0 on success, 1 with a named failing check otherwise.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// NOT `new URL(...).pathname`: on Windows that yields "/C:/Users/..." with a leading
// slash, which spawnSync cannot resolve. fileURLToPath is the only correct spelling,
// and this is the campaign's Windows-verification script.
export const CLI = fileURLToPath(new URL("../../../bin/codexclaw.mjs", import.meta.url));
const failures = [];

function check(name, fn) {
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
  } catch (err) {
    failures.push(`${name}: threw ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", timeout: 60_000, ...opts });
}

// wp05: the bundle must not be character-shredded and must not leak the username.
export function checkScoutingBundle() {
  const res = runCli(["doctor", "--bundle"]);
  if (res.status !== 0 && res.status !== 1) return `exit ${res.status}`;
  if (/(~.){5}/.test(res.stdout)) return "output is character-shredded (empty homeDir redaction)";
  const user = (homedir().split(/[\\/]/).pop() ?? "").trim();
  if (user && res.stdout.toLowerCase().includes(user.toLowerCase())) {
    return `home directory leaked (${user} present)`;
  }
  return null;
}

// wp06: the python ladder must not exit 9009 silently on the Store stub.
export function checkMapLadder() {
  const res = runCli(["map", "--help"]);
  if (res.status === 9009) return "exited 9009 (Microsoft Store python stub) with no diagnostic";
  if (res.status !== 0 && res.status !== 1 && (res.stdout + res.stderr).trim() === "") return "failed with no message";
  if ((res.stdout + res.stderr).trim() === "" && res.error) return String(res.error);
  return null;
}

// wp02: --attest-file is the only Windows-viable attest path.
export function checkAttestFile() {
  const dir = mkdtempSync(join(tmpdir(), "cxc-smoke-"));
  try {
    const file = join(dir, "attest.json");
    writeFileSync(file, JSON.stringify({ from: "A", to: "B", did: "smoke" }), "utf8");
    const res = runCli(["orchestrate", "B", "--session", "cli", "--attest-file", file], { cwd: dir });
    const out = res.stdout + res.stderr;
    if (/could not read the attest file|no attest file/i.test(out)) return "the file was not read";
    // A gate rejection is a PASS here: it proves the JSON parsed and reached the
    // validator. Only a read failure or an unknown flag is a smoke failure.
    if (/unknown|unrecognized/i.test(out)) return "--attest-file is not a recognized flag";
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// wp08: the bench must run at all (it hard-coded /tmp).
export function checkHookBench() {
  const bench = fileURLToPath(new URL("./hook-bench.mjs", import.meta.url));
  const res = spawnSync(process.execPath, [bench, "--iterations", "1", "--json"], {
    encoding: "utf8",
    timeout: 180_000,
  });
  if (res.status !== 0) return `exit ${res.status}: ${(res.stderr || "").slice(0, 200)}`;
  return null;
}

// wp07: the doctor must classify the filesystem rather than guess.
export function checkDoctorWsl() {
  const res = runCli(["doctor"]);
  if (res.status !== 0 && res.status !== 1) return `unexpected exit ${res.status}`;
  if (!/wsl/i.test(res.stdout)) return "no wsl residency line in doctor output";
  return null;
}

// FSM viability: the status verb must answer on any host without a session file.
export function checkOrchestrateStatus() {
  const res = runCli(["orchestrate", "status", "--session", "smoke-status-probe"]);
  if (res.status !== 0) return `exit ${res.status}: ${(res.stderr || "").slice(0, 120)}`;
  if (!/phase=/.test(res.stdout)) return "status output missing phase=";
  return null;
}

export function checks() {
  return [
    ["scouting-bundle", checkScoutingBundle],
    ["map-ladder", checkMapLadder],
    ["attest-file", checkAttestFile],
    ["hook-bench", checkHookBench],
    ["doctor-wsl", checkDoctorWsl],
    ["orchestrate-status", checkOrchestrateStatus],
  ];
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  for (const [name, fn] of checks()) check(name, fn);
  if (failures.length > 0) {
    console.error("platform smoke FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(`platform smoke OK on ${process.platform}`);
}
