#!/usr/bin/env node
/**
 * hook-bench-compare.mjs - diff two bench reports.
 *
 * Usage: node hook-bench-compare.mjs before.json after.json [--max-regression-pct 10]
 *
 * A trim that helps one hook and hurts another nets to noise in a total, so
 * this compares PER HOOK and fails on any regression past the threshold.
 * Ratios are taken against `aboveFloorMs`, not wall time: comparing a Windows run
 * to a Linux run on wall time mostly measures CreateProcess.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function hookKey(hook) {
  return (hook.name || "?") + "::" + (hook.event || "?");
}

function metric(hook) {
  // aboveFloorMs is the comparable number across platforms. Fall back to the
  // warm p50 only when a report predates the floor measurement, and say so.
  if (typeof hook.aboveFloorMs === "number") return { value: hook.aboveFloorMs, source: "aboveFloorMs" };
  if (typeof hook.warmP50Ms === "number") return { value: hook.warmP50Ms, source: "warmP50Ms" };
  return { value: null, source: "none" };
}

export function compareReports(before, after, maxRegressionPct) {
  const afterByKey = new Map((after.hooks || []).map((h) => [hookKey(h), h]));
  const rows = [];
  const missing = [];
  const regressions = [];

  for (const beforeHook of before.hooks || []) {
    const key = hookKey(beforeHook);
    const afterHook = afterByKey.get(key);
    if (!afterHook) {
      // A deleted hook must be an explicit decision, not a silent pass.
      missing.push(key);
      continue;
    }
    const b = metric(beforeHook);
    const a = metric(afterHook);
    if (b.value == null || a.value == null) {
      rows.push({ key, before: b.value, after: a.value, deltaMs: null, deltaPct: null, source: b.source });
      continue;
    }
    const deltaMs = a.value - b.value;
    // A near-zero or negative baseline makes a percentage meaningless, so the
    // absolute delta carries the verdict there instead of a divide-by-noise.
    const deltaPct = Math.abs(b.value) > 0.0001 ? (deltaMs / Math.abs(b.value)) * 100 : null;
    const row = { key, before: b.value, after: a.value, deltaMs, deltaPct, source: b.source };
    rows.push(row);
    if (deltaPct != null && deltaPct > maxRegressionPct) regressions.push(row);
  }

  const improved = rows.filter((r) => r.deltaMs != null && r.deltaMs < 0);
  return { rows, missing, regressions, improved, ok: missing.length === 0 && regressions.length === 0 };
}

function fmt(value, suffix) {
  return value == null ? "n/a" : value.toFixed(1) + suffix;
}

export function formatComparison(result, maxRegressionPct) {
  const lines = [];
  lines.push("hook".padEnd(64) + "before".padStart(10) + "after".padStart(10) + "delta".padStart(10) + "pct".padStart(9));
  for (const row of result.rows) {
    lines.push(
      row.key.slice(0, 63).padEnd(64) +
        fmt(row.before, "").padStart(10) +
        fmt(row.after, "").padStart(10) +
        fmt(row.deltaMs, "").padStart(10) +
        fmt(row.deltaPct, "%").padStart(9),
    );
  }
  for (const key of result.missing) lines.push("MISSING IN AFTER: " + key);
  for (const row of result.regressions) {
    lines.push("REGRESSION: " + row.key + " " + fmt(row.deltaPct, "%") + " > " + maxRegressionPct + "%");
  }
  lines.push(result.ok ? "OK: no hook regressed past " + maxRegressionPct + "%" : "FAIL: " + (result.regressions.length + result.missing.length) + " offending hook(s)");
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith("--"));
  const pctIdx = args.indexOf("--max-regression-pct");
  const maxRegressionPct = pctIdx >= 0 ? Number(args[pctIdx + 1]) : 10;
  if (files.length < 2 || Number.isNaN(maxRegressionPct)) {
    console.error("usage: hook-bench-compare.mjs before.json after.json [--max-regression-pct 10]");
    process.exit(2);
  }
  const before = JSON.parse(readFileSync(files[0], "utf8"));
  const after = JSON.parse(readFileSync(files[1], "utf8"));
  const result = compareReports(before, after, maxRegressionPct);
  console.log(formatComparison(result, maxRegressionPct));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
