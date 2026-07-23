/**
 * payload-bin.test.mjs — payload-resident `cxc` dispatcher contract (260724 WP1).
 *
 * `bin/cxc.mjs` is plain .mjs OUTSIDE the build (no dist), so this file is its
 * ONLY freshness contract. Three layers:
 *   1. Existence + `help` smoke (headed "payload dispatcher").
 *   2. Command-set parity with the repo-root bin (M2 anti-drift guard): every
 *      COMMAND_TABLE verb must be a `case "<verb>":` in bin/codexclaw.mjs
 *      (root may carry repo-checkout extras: gui, map, help).
 *   3. CR-B sandbox sim: copy the payload to a tmpdir, strip PATH of any repo
 *      cxc, and prove the fresh-install lifecycle end-to-end — status, hook
 *      SessionStart bootstrap, IDLE->P, and an attested P->A through the real
 *      plan-artifact gate — while `command -v cxc` fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const payloadRoot = resolve(here, "..");
const payloadBin = join(payloadRoot, "bin", "cxc.mjs");
const rootBin = join(repoRoot, "bin", "codexclaw.mjs");

test("payload bin exists and `help` exits 0 headed as the payload dispatcher", () => {
  assert.ok(existsSync(payloadBin), "plugins/codexclaw/bin/cxc.mjs must exist");
  const res = spawnSync(process.execPath, [payloadBin, "help"], { encoding: "utf8" });
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /payload dispatcher/);
});

test("parity: every payload COMMAND_TABLE verb is handled by the root bin", async () => {
  const { COMMAND_TABLE } = await import(pathToFileURL(payloadBin).href);
  const verbs = Object.keys(COMMAND_TABLE);
  assert.ok(verbs.length > 0, "COMMAND_TABLE must not be empty");
  const rootSrc = readFileSync(rootBin, "utf8");
  const rootVerbs = new Set(
    [...rootSrc.matchAll(/^\s*case "([^"]+)":/gm)].map((m) => m[1]),
  );
  for (const verb of verbs) {
    assert.ok(rootVerbs.has(verb), `root bin must handle payload verb '${verb}'`);
  }
  // Root-only extras are allowed (repo-checkout surfaces) — just document them.
  for (const extra of ["gui", "map", "help"]) {
    assert.ok(rootVerbs.has(extra), `root bin should still carry '${extra}'`);
  }
});

test("CR-B sandbox: payload-only install runs the full orchestrate lifecycle without cxc on PATH", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "cxc-payload-sim-"));
  const payload = join(sandbox, "payload");
  const home = join(sandbox, "home");
  const work = join(sandbox, "work");
  mkdirSync(home, { recursive: true });
  mkdirSync(work, { recursive: true });
  // Remote-install copy semantics (L1 assumption documented in 010): the
  // marketplace materializes a COPY of the payload tree, not repo symlinks.
  cpSync(payloadRoot, payload, { recursive: true });

  // PATH deliberately excludes any repo/npm bin dir that could carry `cxc`.
  const env = { PATH: "/usr/bin:/bin", HOME: home };
  const run = (args, opts = {}) =>
    spawnSync(process.execPath, args, { encoding: "utf8", cwd: work, env, ...opts });

  // Prove the premise: `cxc` is NOT resolvable in this environment.
  const probe = spawnSync("sh", ["-c", "command -v cxc"], { encoding: "utf8", env });
  assert.notEqual(probe.status, 0, `cxc must be absent from the sandbox PATH (found: ${probe.stdout})`);

  const simBin = join(payload, "bin", "cxc.mjs");

  // 1. Read-only status before any session exists targets sim explicitly.
  const status = run([simBin, "orchestrate", "status", "--session", "sim"]);
  assert.equal(status.status, 0, `stderr: ${status.stderr}`);
  assert.match(status.stdout, /phase=IDLE/);

  // 2. SessionStart hook bootstraps the session file (the real fresh-install path).
  const hook = run(
    [join(payload, "components", "pabcd-state", "dist", "cli.js"), "hook", "session-start"],
    { input: JSON.stringify({ session_id: "sim", cwd: work, hook_event_name: "SessionStart" }) },
  );
  assert.equal(hook.status, 0, `stderr: ${hook.stderr}`);

  // 3. IDLE -> P (mutating verb against the bootstrapped session).
  const toP = run([simBin, "orchestrate", "P", "--session", "sim"]);
  assert.equal(toP.status, 0, `out: ${toP.stdout} err: ${toP.stderr}`);

  // 4. Attested P -> A through the REAL plan-artifact gate: the planUnit must
  //    exist on disk with a numbered doc, so create it first (fail-closed edge).
  const planUnit = join(work, "devlog", "_plan", "x");
  mkdirSync(planUnit, { recursive: true });
  writeFileSync(join(planUnit, "000_plan.md"), "# sim plan\n");
  const toA = run([
    simBin,
    "orchestrate",
    "A",
    "--session",
    "sim",
    "--attest",
    JSON.stringify({ from: "P", to: "A", did: "x", planUnit: "devlog/_plan/x" }),
  ]);
  assert.equal(toA.status, 0, `out: ${toA.stdout} err: ${toA.stderr}`);
});
