/**
 * maintenance.test.ts — idle-gated maintenance, footprint metric and capture window (261022 follow-up).
 * Deterministic: spawn is injected, delays are zero, clocks are explicit.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openIndex, indexDiskBytes } from "../src/index-db.ts";
import { ingest, capTextWindow, CAP_ELISION } from "../src/ingest.ts";
import { maintenancePaths, maintenanceDue, readStamp, runMaintenance, scheduleMaintenance, LOCK_STALE_MS, MAINTENANCE_INTERVAL_MS } from "../src/maintenance.ts";
import { measureFootprint, formatFootprint } from "../src/footprint.ts";
import { checkMemoryFootprint } from "../../cxc-ops/src/doctor.ts";

const MB = 1024 * 1024;

function history(root: string, sessions: number, msgs: number): void {
  let seed = 9;
  const next = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const words = ["budget", "index", "recall", "메모리", "세션", "vacuum", "trigram", "hook"];
  const base = Date.UTC(2026, 1, 1);
  for (let i = 0; i < sessions; i += 1) {
    const t = new Date(base + i * 3_600_000);
    const [y, m, d] = [String(t.getUTCFullYear()), String(t.getUTCMonth() + 1).padStart(2, "0"), String(t.getUTCDate()).padStart(2, "0")];
    const dir = join(root, "sessions", y, m, d);
    mkdirSync(dir, { recursive: true });
    const id = "019f0000-0000-7000-8000-" + String(i).padStart(12, "0");
    let body = JSON.stringify({ timestamp: t.toISOString(), type: "session_meta", payload: { id, cwd: "/proj/m", originator: "codex-tui" } }) + "\n";
    for (let k = 0; k < msgs; k += 1) {
      let text = "";
      while (text.length < 1500) text += words[Math.floor(next() * words.length)] + Math.floor(next() * 9999) + " ";
      body += JSON.stringify({ timestamp: t.toISOString(), type: "response_item", payload: { type: "message", role: k % 2 ? "assistant" : "user", content: [{ type: "input_text", text }] } }) + "\n";
    }
    const path = join(dir, "rollout-" + y + "-" + m + "-" + d + "T" + String(t.getUTCHours()).padStart(2, "0") + "-00-00-" + id + ".jsonl");
    writeFileSync(path, body);
    utimesSync(path, t.getTime() / 1000, t.getTime() / 1000);
  }
}

test("capture keeps a head+tail window within the cap", () => {
  assert.equal(capTextWindow("short", 10), "short");
  const text = "H".repeat(3000) + "MIDDLE" + "T".repeat(3000);
  const out = capTextWindow(text, 1024);
  assert.ok(out.length <= 1024);
  assert.ok(out.startsWith("HHH") && out.endsWith("TTT"));
  assert.ok(out.includes(CAP_ELISION) && !out.includes("MIDDLE"));
});

test("SessionStart schedules at most one pass per interval, only for an existing index", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-maint-sched-"));
  try {
    const paths = { ...maintenancePaths(join(root, "recall", "index.sqlite")), root };
    const spawned: string[][] = [];
    const spawn = (_cmd: string, args: string[]) => { spawned.push(args); };
    const now = Date.UTC(2026, 9, 22);

    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now, spawn }), "no-index", "a hook never materializes the cache");
    assert.equal(spawned.length, 0);

    openIndex(paths.index).close();
    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now, spawn }), "scheduled");
    assert.equal(spawned.length, 1);
    const args = spawned[0]!;
    assert.deepEqual(args.slice(0, 4), ["/cli.js", "chat", "maintain", "--lock-token"]);
    // A second session starting while the pass is pending spawns nothing.
    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now + 1000, spawn }), "busy");
    assert.equal(spawned.length, 1);

    // A runner without the token cannot hijack the claimed lock.
    assert.equal(runMaintenance(paths, { home: root, lockToken: "not-the-token", nowMs: now }), null);
    const stamp = runMaintenance(paths, { home: root, lockToken: args[4]!, nowMs: now });
    assert.ok(stamp?.ok);
    assert.equal(existsSync(paths.lock), false, "the pass releases the lock");

    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now + 3_600_000, spawn }), "not-due");
    assert.equal(maintenanceDue(paths, now + MAINTENANCE_INTERVAL_MS), true);
    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now + MAINTENANCE_INTERVAL_MS, spawn }), "scheduled");

    // A crashed runner's lock is taken over once stale.
    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now + MAINTENANCE_INTERVAL_MS + 60_000, spawn }), "busy");
    assert.equal(scheduleMaintenance(paths, "/cli.js", { nowMs: now + MAINTENANCE_INTERVAL_MS + LOCK_STALE_MS + 1000, spawn }), "scheduled");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the maintenance pass compacts an oversized index without anyone searching", () => {
  const root = mkdtempSync(join(tmpdir(), "recall-maint-run-"));
  try {
    history(root, 50, 50);
    const paths = { ...maintenancePaths(join(root, "recall", "index.sqlite")), root };
    const db = openIndex(paths.index);
    ingest(root, db, 0, { budget: null });
    db.close();
    const before = indexDiskBytes(paths.index);
    const budget = { maxBytes: Math.floor(before / 3), lowWater: 0.8 };

    const stamp = runMaintenance(paths, { home: root, budget, nowMs: Date.UTC(2026, 9, 22) });
    assert.ok(stamp?.ok, stamp?.detail);
    assert.equal(stamp!.beforeBytes, before);
    assert.ok(stamp!.evicted > 0);
    assert.ok(indexDiskBytes(paths.index) <= budget.maxBytes + 64 * 1024, "now " + indexDiskBytes(paths.index));
    assert.ok(stamp!.footprintBytes >= indexDiskBytes(paths.index));
    assert.deepEqual(readStamp(paths), stamp);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("footprint reports every area of the codexclaw store and honours its entry cap", () => {
  const root = mkdtempSync(join(tmpdir(), "cxc-footprint-"));
  try {
    for (const [rel, size] of [["recall/index.sqlite", 3000], ["backups/0.2.36/x", 500], ["projects/p/state/ledger.jsonl", 200], ["loose.json", 10]] as const) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), "x".repeat(size));
    }
    const fp = measureFootprint(root);
    assert.equal(fp.totalBytes, 3710);
    assert.deepEqual([fp.areas.recall, fp.areas.backups, fp.areas.projects, fp.areas.other], [3000, 500, 200, 10]);
    assert.equal(fp.truncated, false);
    assert.match(formatFootprint(fp), /^3\.6 KiB \(recall 2\.9 KiB, backups 500 B, projects 200 B, other 10 B\)$/);
    assert.equal(measureFootprint(root, { maxEntries: 2 }).truncated, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("doctor memory-footprint warns over the target and names the compaction", () => {
  const mod = (total: number, recall: number) => ({
    measureFootprint: () => ({ totalBytes: total, areas: { recall }, truncated: false }),
    formatFootprint: () => "fp",
    FOOTPRINT_WARN_BYTES: 100 * MB,
  });
  assert.equal(checkMemoryFootprint("/r", mod(40 * MB, 30 * MB)).severity, "PASS");
  const big = checkMemoryFootprint("/r", mod(410 * MB, 400 * MB));
  assert.equal(big.severity, "WARN");
  assert.equal(big.repair, "cxc chat index --compact");
  assert.equal(checkMemoryFootprint("/r", mod(60 * MB, 58 * MB)).severity, "WARN", "recall past its budget");
  assert.equal(checkMemoryFootprint("/r", null).severity, "PASS");
});
