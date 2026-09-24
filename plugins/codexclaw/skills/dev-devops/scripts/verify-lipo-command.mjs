#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const USAGE = "usage: --artifact <file> --arch <name> --arch <name> --candidate-json <argv-json> [--lipo <path>]";

export function parseArgs(argv) {
  const options = { arches: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!["--artifact", "--arch", "--candidate-json", "--lipo"].includes(flag)) {
      throw new Error(`unknown argument ${flag}`);
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value; ${USAGE}`);
    if (flag === "--arch") options.arches.push(value);
    else if (flag === "--candidate-json") {
      try { options.candidate = JSON.parse(value); }
      catch { throw new Error("candidate-json must be valid JSON argv"); }
    } else options[flag === "--artifact" ? "artifact" : "lipo"] = value;
  }
  if (!options.artifact || options.arches.length < 2) throw new Error(USAGE);
  if (new Set(options.arches).size !== options.arches.length) throw new Error("duplicate --arch value");
  if (!Array.isArray(options.candidate) || options.candidate.length < 2
    || options.candidate.some((x) => typeof x !== "string" || x.length === 0)
    || options.candidate.filter((x) => x === "{artifact}").length !== 1
    || options.candidate[0] === "{artifact}") {
    throw new Error("candidate-json must be a non-empty string argv array with exactly one {artifact} placeholder");
  }
  return { ...options, lipo: options.lipo ?? "lipo" };
}

function run(argv) {
  const nodeModule = /\.(?:mjs|cjs|js)$/i.test(argv[0]);
  const result = spawnSync(nodeModule ? process.execPath : argv[0],
    nodeModule ? argv : argv.slice(1), { encoding: "utf8" });
  return {
    status: result.error ? null : result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error.message } : {}),
  };
}

function failure(result) {
  return result.stderr.trim() || result.error || `exit ${result.status}`;
}

export function runOracle(options, { removeTree = rmSync } = {}) {
  let root;
  let outcome;
  try {
    const expected = [...options.arches].sort();
    const inspected = run([options.lipo, "-archs", options.artifact]);
    if (inspected.status !== 0) throw new Error(`cannot inspect artifact: ${failure(inspected)}`);
    const actual = inspected.stdout.trim().split(/\s+/).filter(Boolean).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`artifact architectures ${actual.join(" ")} do not equal ${expected.join(" ")}`);
    }

    root = mkdtempSync(join(tmpdir(), "cxc-lipo-oracle-"));
    const negative = join(root, "negative-thin");
    const retained = expected.at(-1);
    const missing = expected[0];
    const thin = run([options.lipo, "-thin", retained, options.artifact, "-output", negative]);
    if (thin.status !== 0) throw new Error(`could not create negative control: ${failure(thin)}`);
    const candidate = (artifact) => options.candidate.map((x) => x === "{artifact}" ? artifact : x);
    const good = run(candidate(options.artifact));
    const bad = run(candidate(negative));
    if (good.status !== 0 || bad.status === 0 || bad.status === null) {
      outcome = { code: 1, report: { ok: false, expected, actual, good,
        negative: { artifact: negative, missing, result: bad } } };
    } else {
      outcome = { code: 0, report: { ok: true, expected, actual,
        goodExit: good.status, negativeExit: bad.status, missing } };
    }
  } catch (error) {
    outcome = { code: 2, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (root) {
      try { removeTree(root, { recursive: true, force: true }); }
      catch (error) {
        outcome = { code: 2, error: `cleanup failed for ${root}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
  }
  return outcome;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  let outcome;
  try { outcome = runOracle(parseArgs(process.argv.slice(2))); }
  catch (error) { outcome = { code: 2, error: error instanceof Error ? error.message : String(error) }; }
  if (outcome.report) {
    const message = JSON.stringify(outcome.report, null, 2);
    (outcome.code === 0 ? console.log : console.error)(message);
  }
  if (outcome.error) console.error(`[lipo oracle] ${outcome.error}`);
  process.exitCode = outcome.code;
}
