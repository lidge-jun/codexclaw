import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(here, f), "utf8"));
const cases = read("cases.json");
const baseline = read("baseline.json");
const guided = read("guided.json");
assert.deepEqual(guided.map((x) => x.id).sort(), cases.map((x) => x.id).sort());
assert.deepEqual(baseline.map((x) => x.id).sort(), cases.map((x) => x.id).sort());
// Outcome keys are compared with the accepted scenario boundaries, not skill wording.
const requiredSend = new Set(["idle_question", "active_impact", "incoming_old_goal", "active_own_goal"]);
for (const row of guided) {
  const kinds = row.actions.map((a) => a.kind);
  assert.equal(kinds.includes("send"), requiredSend.has(row.id), row.id + ": send boundary");
  assert.equal(kinds.includes("execute"), row.id === "trivial", row.id + ": execute boundary");
  if (["stopped_peer", "unknown_intent", "active_own_goal", "blind_audit"].includes(row.id)) {
    assert.ok(kinds.includes("continue"), row.id + ": preserve independent work");
  }
  if (row.id === "missing_exception") assert.ok(kinds.includes("read"));
  assert.ok(row.guidanceUsed.length > 0, row.id + ": missing actor-reported guidance provenance");
}
const kinds = (rows, id) => rows.find((r) => r.id === id).actions.map((a) => a.kind);
console.log("PASS 12 guided scenario action boundaries (simulation; semantic review required)");
console.log("ACK baseline=" + kinds(baseline, "ack").join(",") + "; guided=" + kinds(guided, "ack").join(","));
