import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_FILENAME,
  DEFAULT_INTERVIEW_POLICY,
  decideInterviewEntry,
  isInterviewPolicy,
  readInterviewPolicy,
  writeInterviewPolicy,
  type InterviewPolicy,
} from "../src/interview-policy.ts";
import { readFileSync } from "node:fs";

function repoWith(contents: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "cxc-policy-"));
  if (contents !== null) writeFileSync(join(dir, CONFIG_FILENAME), contents, "utf8");
  return dir;
}

const base = { orchestrationActive: false, goalSuppresses: false };

test("case 1: goal mode suppression beats an 'always' policy", () => {
  const d = decideInterviewEntry({ trigger: "P", policy: "always", orchestrationActive: false, goalSuppresses: true });
  assert.deepEqual(d, { phase: "P", adviseInterview: false });
});

test("case 2: the fail-closed 'unreadable' path behaves identically (same boolean)", () => {
  // suppressesInterview() returns true for both "active" and "unreadable"; the policy
  // layer only ever sees that boolean, so both goal states take the same branch.
  const d = decideInterviewEntry({ trigger: "P", policy: "always", orchestrationActive: true, goalSuppresses: true });
  assert.equal(d.adviseInterview, false);
});

test("case 3: 'always' advises even mid-cycle", () => {
  const d = decideInterviewEntry({ trigger: "P", policy: "always", orchestrationActive: true, goalSuppresses: false });
  assert.deepEqual(d, { phase: "P", adviseInterview: true });
});

test("case 4: 'new-unit' advises on the first plan request of a unit", () => {
  const d = decideInterviewEntry({ trigger: "P", policy: "new-unit", ...base });
  assert.deepEqual(d, { phase: "P", adviseInterview: true });
});

test("case 5: 'new-unit' does not interrupt a cycle already running", () => {
  const d = decideInterviewEntry({ trigger: "P", policy: "new-unit", orchestrationActive: true, goalSuppresses: false });
  assert.deepEqual(d, { phase: "P", adviseInterview: false });
});

test("case 6: 'off' keeps today's behavior exactly", () => {
  const d = decideInterviewEntry({ trigger: "P", policy: "off", ...base });
  assert.deepEqual(d, { phase: "P", adviseInterview: false });
});

test("case 7: no trigger means no opinion, so C0/C1 work is untouched", () => {
  for (const policy of ["off", "new-unit", "always"] as InterviewPolicy[]) {
    const d = decideInterviewEntry({ trigger: null, policy, ...base });
    assert.deepEqual(d, { phase: null, adviseInterview: false });
  }
});

test("case 8: an explicit I trigger passes through untouched under every policy", () => {
  for (const policy of ["off", "new-unit", "always"] as InterviewPolicy[]) {
    const d = decideInterviewEntry({ trigger: "I", policy, ...base });
    assert.deepEqual(d, { phase: "I", adviseInterview: false });
  }
});

test("blocker 2: A, B and C never promote — mayEnter's refusal stays intact", () => {
  for (const trigger of ["A", "B", "C"] as const) {
    const d = decideInterviewEntry({ trigger, policy: "always", ...base });
    assert.deepEqual(d, { phase: trigger, adviseInterview: false }, `${trigger} must not promote`);
  }
});

test("blocker 1: promotion never changes the phase, so no session can be wedged", () => {
  // The whole point of advisory-only: whatever the policy says, `phase` is the raw
  // trigger. A promoted turn cannot land in I with no interview tracker.
  for (const policy of ["off", "new-unit", "always"] as InterviewPolicy[]) {
    for (const trigger of ["P", "A", "B", "C"] as const) {
      for (const orchestrationActive of [false, true]) {
        for (const goalSuppresses of [false, true]) {
          const d = decideInterviewEntry({ trigger, policy, orchestrationActive, goalSuppresses });
          assert.equal(d.phase, trigger, "phase must always equal the raw trigger");
        }
      }
    }
  }
});

test("case 9: a repo with no codexclaw.json gets the default", () => {
  assert.equal(readInterviewPolicy(repoWith(null)), DEFAULT_INTERVIEW_POLICY);
  assert.equal(DEFAULT_INTERVIEW_POLICY, "new-unit");
});

test("case 10: malformed or hostile config falls back without throwing", () => {
  assert.equal(readInterviewPolicy(repoWith("{ not json")), "new-unit");
  assert.equal(readInterviewPolicy(repoWith("[]")), "new-unit");
  assert.equal(readInterviewPolicy(repoWith("null")), "new-unit");
  assert.equal(readInterviewPolicy(repoWith('{"interview":"bogus"}')), "new-unit");
  assert.equal(readInterviewPolicy(repoWith('{"interview":42}')), "new-unit");
  assert.equal(readInterviewPolicy(repoWith("{}")), "new-unit");
});

test("a valid config is honored", () => {
  assert.equal(readInterviewPolicy(repoWith('{"interview":"off"}')), "off");
  assert.equal(readInterviewPolicy(repoWith('{"interview":"always"}')), "always");
  assert.equal(readInterviewPolicy(repoWith('{"interview":"new-unit"}')), "new-unit");
});

test("isInterviewPolicy accepts exactly the three values", () => {
  assert.ok(isInterviewPolicy("off"));
  assert.ok(isInterviewPolicy("new-unit"));
  assert.ok(isInterviewPolicy("always"));
  assert.equal(isInterviewPolicy("Off"), false);
  assert.equal(isInterviewPolicy(""), false);
  assert.equal(isInterviewPolicy(undefined), false);
});

test("wp5: writing the policy round-trips through the reader", () => {
  const dir = repoWith(null);
  const res = writeInterviewPolicy(dir, "always");
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.replacedMalformed, false);
  assert.equal(readInterviewPolicy(dir), "always");
});

test("wp5: writing preserves unrelated keys in codexclaw.json", () => {
  const dir = repoWith(JSON.stringify({ somethingElse: { nested: 1 }, interview: "off" }));
  const res = writeInterviewPolicy(dir, "new-unit");
  assert.ok(res.ok);
  const parsed = JSON.parse(readFileSync(join(dir, CONFIG_FILENAME), "utf8"));
  assert.deepEqual(parsed.somethingElse, { nested: 1 }, "a foreign key must survive");
  assert.equal(parsed.interview, "new-unit");
});

test("wp5: a malformed file is replaced and the caller is told", () => {
  const dir = repoWith("{ not json");
  const res = writeInterviewPolicy(dir, "off");
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.replacedMalformed, true);
  assert.equal(readInterviewPolicy(dir), "off");
});
