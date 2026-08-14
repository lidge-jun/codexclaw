/**
 * activation-trace.test.ts — opt-in eval trace tests (issue #11).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isTracingEnabled,
  TraceBuilder,
  emitTrace,
  readTraces,
  TRACE_SCHEMA_VERSION,
} from "../src/activation-trace.ts";

// --- isTracingEnabled ---

test("isTracingEnabled: disabled by default", () => {
  assert.equal(isTracingEnabled({}), false);
});

test("isTracingEnabled: enabled with CODEXCLAW_TRACE_ACTIVATIONS=1", () => {
  assert.equal(isTracingEnabled({ CODEXCLAW_TRACE_ACTIVATIONS: "1" }), true);
});

test("isTracingEnabled: other values are disabled", () => {
  assert.equal(isTracingEnabled({ CODEXCLAW_TRACE_ACTIVATIONS: "true" }), false);
  assert.equal(isTracingEnabled({ CODEXCLAW_TRACE_ACTIVATIONS: "0" }), false);
});

// --- TraceBuilder ---

test("TraceBuilder: records all four layers", () => {
  const tb = new TraceBuilder("sess-1", "turn-1");
  tb.setWorkClass("C2", "C2");
  tb.recordInstalled("dev", 100);
  tb.recordVisible("dev", 50);
  tb.recordActivated("dev-backend", 2000);
  tb.recordReferenced("dev-backend", "references/core/crud-api.md", 500);
  tb.recordReferenced("dev", "SKILL.md", 300, "audit_api");

  const trace = tb.build();
  assert.equal(trace.schemaVersion, TRACE_SCHEMA_VERSION);
  assert.equal(trace.sessionId, "sess-1");
  assert.equal(trace.events.length, 5);
  assert.equal(trace.events[0].layer, "installed");
  assert.equal(trace.events[1].layer, "visible");
  assert.equal(trace.events[2].layer, "activated");
  assert.equal(trace.events[3].layer, "referenced");
  assert.equal(trace.events[3].subagentTask, undefined);
  assert.equal(trace.events[4].subagentTask, "audit_api");
  assert.equal(trace.workClass.expected, "C2");
  assert.equal(trace.workClass.observed, "C2");
  // Token estimates: ~bytes/4
  assert.ok(trace.tokenEstimates.routerBodies > 0);
  assert.ok(trace.tokenEstimates.references > 0);
  assert.ok(trace.tokenEstimates.subagentAttachments > 0);
});

test("TraceBuilder: installed != visible != activated != referenced", () => {
  const tb = new TraceBuilder("sess-2", "turn-2");
  tb.recordInstalled("dev", 100);
  tb.recordInstalled("search", 80);
  tb.recordVisible("dev", 50);
  // search is installed but not visible (implicit=false)
  tb.recordActivated("dev", 2000);
  // search is installed but never activated
  const trace = tb.build();
  const installed = trace.events.filter((e) => e.layer === "installed");
  const visible = trace.events.filter((e) => e.layer === "visible");
  const activated = trace.events.filter((e) => e.layer === "activated");
  assert.equal(installed.length, 2);
  assert.equal(visible.length, 1);
  assert.equal(activated.length, 1);
  assert.equal(activated[0].skill, "dev");
});

test("TraceBuilder: C0/C1 fast-path has no activated routers", () => {
  const tb = new TraceBuilder("sess-3", "turn-3");
  tb.setWorkClass("C0", "C0");
  tb.recordInstalled("dev", 100);
  tb.recordVisible("dev", 50);
  // C0: no router activated, no references
  const trace = tb.build();
  const activated = trace.events.filter((e) => e.layer === "activated");
  assert.equal(activated.length, 0);
  assert.equal(trace.tokenEstimates.routerBodies, 0);
  assert.equal(trace.tokenEstimates.references, 0);
});

test("TraceBuilder: subagent attachment tracked separately", () => {
  const tb = new TraceBuilder("sess-4", "turn-4");
  tb.recordReferenced("dev", "SKILL.md", 1000, "task_a");
  tb.recordReferenced("search", "SKILL.md", 800, "task_a");
  tb.recordReferenced("dev-backend", "references/core/crud-api.md", 500);
  const trace = tb.build();
  // subagent cost: 1000 + 800 = 1800 bytes -> ~450 tokens
  assert.equal(trace.tokenEstimates.subagentAttachments, Math.ceil(1800 / 4));
  // reference cost: 500 bytes -> 125 tokens
  assert.equal(trace.tokenEstimates.references, Math.ceil(500 / 4));
});

// --- emit/read ---

test("emitTrace: disabled tracing produces no file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-trace-"));
  try {
    const tb = new TraceBuilder("sess-5", "turn-5");
    const result = emitTrace(tb.build(), dir, {});
    assert.equal(result, null);
    assert.equal(existsSync(join(dir, ".codexclaw", "traces")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("emitTrace: enabled tracing writes JSONL and readTraces recovers it", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-trace-"));
  try {
    const env = { CODEXCLAW_TRACE_ACTIVATIONS: "1" };

    const tb1 = new TraceBuilder("sess-6", "turn-6");
    tb1.recordActivated("dev", 1000);
    const path1 = emitTrace(tb1.build(), dir, env);
    assert.ok(path1);

    const tb2 = new TraceBuilder("sess-6", "turn-7");
    tb2.recordActivated("search", 800);
    emitTrace(tb2.build(), dir, env);

    const traces = readTraces(dir);
    assert.equal(traces.length, 2);
    assert.equal(traces[0].turnId, "turn-6");
    assert.equal(traces[1].turnId, "turn-7");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readTraces: missing file returns empty array", () => {
  const dir = mkdtempSync(join(tmpdir(), "cxc-trace-"));
  try {
    const traces = readTraces(dir);
    assert.deepEqual(traces, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
