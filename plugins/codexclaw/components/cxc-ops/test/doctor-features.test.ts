/**
 * doctor-features.test.ts — wp4 of 260829_request-user-input-autopilot.
 *
 * The two surfaces that report a missing feature flag both speak exactly once: `cxc enable`
 * warns at install time, and the SessionStart self-heal emits context for one turn. This
 * check is the standing surface, so its severity split is the contract worth pinning.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDeclaredFeaturesCheck,
  parseDoctorFeatures,
  DOCTOR_DECLARED_FEATURES,
  DOCTOR_SOFT_FEATURES,
} from "../src/doctor.ts";

const SOFT = "default_mode_request_user_input";

function listing(states: Record<string, boolean>): string {
  return DOCTOR_DECLARED_FEATURES.map((k) => `${k}  stable  ${states[k] === true}`).join("\n");
}

const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });

test("all flags on is a PASS carrying the count as evidence", () => {
  const all = Object.fromEntries(DOCTOR_DECLARED_FEATURES.map((k) => [k, true]));
  const c = buildDeclaredFeaturesCheck(ok(listing(all)));
  assert.equal(c.severity, "PASS");
  assert.match(c.evidence, /4\/4/);
});

test("a missing SOFT flag WARNs and names what is lost, not just what is off", () => {
  const states = Object.fromEntries(DOCTOR_DECLARED_FEATURES.map((k) => [k, k !== SOFT]));
  const c = buildDeclaredFeaturesCheck(ok(listing(states)));
  assert.equal(c.severity, "WARN", "reduced capability is not breakage; FAIL would leave a Plan-mode user permanently red");
  assert.match(c.evidence, /request_user_input/);
  assert.match(c.evidence, /Default mode/);
  assert.match(c.repair ?? "", new RegExp(`codex features enable ${SOFT}`));
});

test("a missing HARD flag FAILs and points at cxc enable", () => {
  const states = Object.fromEntries(DOCTOR_DECLARED_FEATURES.map((k) => [k, k !== "goals"]));
  const c = buildDeclaredFeaturesCheck(ok(listing(states)));
  assert.equal(c.severity, "FAIL");
  assert.match(c.evidence, /goals/);
  assert.equal(c.repair, "cxc enable");
});

test("a hard flag off outranks a soft flag off", () => {
  const states = Object.fromEntries(DOCTOR_DECLARED_FEATURES.map((k) => [k, k !== "hooks" && k !== SOFT]));
  const c = buildDeclaredFeaturesCheck(ok(listing(states)));
  assert.equal(c.severity, "FAIL");
  assert.match(c.evidence, /hooks/);
});

test("an unreachable codex WARNs rather than FAILs: a diagnostic must not invent a verdict", () => {
  const c = buildDeclaredFeaturesCheck({ status: 127, stdout: "", stderr: "command not found" });
  assert.equal(c.severity, "WARN");
  assert.match(c.evidence, /could not read/);
  assert.match(c.evidence, /exit 127/);
});

test("a spawn that threw (status null) still WARNs without printing a bogus exit code", () => {
  const c = buildDeclaredFeaturesCheck({ status: null, stdout: "", stderr: "EPERM" });
  assert.equal(c.severity, "WARN");
  assert.doesNotMatch(c.evidence, /exit null/);
});

test("the parser matches the first field exactly, so sibling keys cannot clobber", () => {
  const parsed = parseDoctorFeatures(
    ["multi_agent_v2  experimental  true", "multi_agent  stable  false", "plugin_hooks  stable  true", "hooks  stable  false"].join("\n"),
  );
  assert.equal(parsed.get("multi_agent"), false, "multi_agent_v2 must not satisfy multi_agent");
  assert.equal(parsed.get("hooks"), false, "plugin_hooks must not satisfy hooks");
  assert.equal(parsed.has("multi_agent_v2"), false, "undeclared keys are ignored");
});

test("an unparseable trailing token reads as not-enabled, the safe default", () => {
  const parsed = parseDoctorFeatures("goals  stable  maybe");
  assert.equal(parsed.has("goals"), false);
  const c = buildDeclaredFeaturesCheck(ok("goals  stable  maybe"));
  assert.equal(c.severity, "FAIL");
});

test("the doctor soft set matches the config-guard soft set", async () => {
  // Two modules declare this vocabulary; a drift would make the doctor report the wrong
  // severity for the exact flag this unit exists to protect.
  const { SOFT_FEATURES, DECLARED_FEATURES } = await import("../../config-guard/src/features.ts");
  assert.deepEqual([...DOCTOR_SOFT_FEATURES].sort(), [...SOFT_FEATURES].sort());
  assert.deepEqual([...DOCTOR_DECLARED_FEATURES].sort(), [...DECLARED_FEATURES].sort());
});
