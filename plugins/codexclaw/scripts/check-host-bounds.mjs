#!/usr/bin/env node
/**
 * check-host-bounds.mjs — re-derive the recorded host bounds from the artifacts.
 *
 * test/fixtures/host-thread-bounds.json records what the Codex desktop bundle and the
 * codex-rs sources say about lane dispatch. A number written down once rots quietly, so
 * this reads the artifacts again where they exist on this machine.
 *
 * Honesty rule, same as the report gate: an artifact that is absent makes a check NOT RUN.
 * NOT RUN never renders as a pass, and the exit code fails only on real drift, because a
 * CI runner without the desktop bundle has proven nothing either way.
 *
 * Usage: node check-host-bounds.mjs [--json] [--require-artifacts]
 */
import { existsSync, openSync, readSync, closeSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(here, "..", "test", "fixtures", "host-thread-bounds.json");
const WINDOW = 4000;

/** Read a text window around a byte offset; binaries are fine, we only match ASCII. */
function windowAt(file, offset) {
  const fd = openSync(file, "r");
  try {
    const start = Math.max(0, offset - WINDOW / 2);
    const buffer = Buffer.alloc(WINDOW);
    const read = readSync(fd, buffer, 0, WINDOW, start);
    return buffer.subarray(0, read).toString("latin1");
  } finally {
    closeSync(fd);
  }
}

/** "app.asar@29657396 (i9n=8 ...)" -> 29657396 */
function asarOffset(evidence) {
  const match = /app\.asar@(\d+)/.exec(evidence);
  return match ? Number(match[1]) : null;
}

/** "codex-rs/core/src/config/mod.rs:207 ..." -> { path, line } */
function sourceRef(evidence) {
  const match = /(codex-rs\/[\w./-]+\.rs):(\d+)/.exec(evidence);
  return match ? { path: match[1], line: Number(match[2]) } : null;
}

export function checkBounds(fixture, { appAsar, codexSource } = {}) {
  const results = [];
  const record = (id, status, detail) => results.push({ id, status, detail });
  const entries = [...(fixture.bounds ?? []), ...(fixture.shapes ?? [])];

  for (const entry of entries) {
    const needle = String(entry.value);
    const offset = asarOffset(entry.evidence ?? "");
    const source = sourceRef(entry.evidence ?? "");

    if (offset !== null) {
      if (!appAsar || !existsSync(appAsar)) {
        record(entry.id, "NOT_RUN", "app.asar is not on this machine");
        continue;
      }
      const text = windowAt(appAsar, offset);
      // 120000 is written 12e4 in the bundle; accept either spelling of the same number.
      const alternatives = [needle];
      if (/^\d+$/.test(needle)) {
        const n = Number(needle);
        if (n >= 1000 && n % 1000 === 0) alternatives.push(String(n / 10 ** String(n).match(/0+$/)[0].length) + "e" + String(n).match(/0+$/)[0].length);
      }
      const hit = alternatives.some((a) => text.includes(a));
      record(entry.id, hit ? "PASS" : "FAIL", hit ? "found near byte " + offset : "not found near byte " + offset + " (tried " + alternatives.join(", ") + ")");
      continue;
    }

    if (source) {
      const file = codexSource ? resolve(codexSource, source.path) : null;
      if (!file || !existsSync(file)) {
        record(entry.id, "NOT_RUN", "codex source checkout is not on this machine");
        continue;
      }
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      const near = lines.slice(Math.max(0, source.line - 4), source.line + 3).join("\n");
      const hit = near.includes(needle);
      record(entry.id, hit ? "PASS" : "FAIL", hit ? source.path + ":" + source.line : "not found near " + source.path + ":" + source.line);
      continue;
    }

    record(entry.id, "NOT_RUN", "no machine-readable evidence locator");
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const notRun = results.filter((r) => r.status === "NOT_RUN");
  return {
    verdict: failed.length ? "FAIL" : notRun.length ? "PARTIAL" : "PASS",
    passed: results.length - failed.length - notRun.length,
    notRun: notRun.length,
    failed: failed.length,
    results,
  };
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invoked) {
  const args = process.argv.slice(2);
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  const report = checkBounds(fixture, {
    appAsar: fixture.artifacts?.appAsar,
    codexSource: fixture.artifacts?.codexSource,
  });
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    for (const r of report.results) console.log(r.status.padEnd(8) + r.id + "  " + r.detail);
    console.log("[codexclaw host-bounds] " + report.verdict + " - " + report.passed + " verified, " + report.notRun + " not run, " + report.failed + " drifted");
  }
  const strict = args.includes("--require-artifacts");
  process.exitCode = report.failed || (strict && report.notRun) ? 1 : 0;
}
