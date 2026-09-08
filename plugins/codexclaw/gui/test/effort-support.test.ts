/** effort-support.test.ts — the three-state reasoning-effort ladder (pure logic).
 *
 *  `reasoningEfforts()` returns null when a catalog source does not advertise a ladder
 *  and [] when it advertises an empty one. Collapsing null into [] with `?? []` disables
 *  every effort option for models whose ladder is simply unreported, which is a live
 *  state on real OCX rosters. These tests pin the distinction at the UI predicate. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { effortExcluded } from "../src/effort-support.ts";

test("an advertised ladder excludes the efforts it omits", () => {
  assert.equal(effortExcluded(["low", "high"], "medium"), true);
  assert.equal(effortExcluded(["low", "high"], "low"), false);
});

test("an unreported ladder (null) excludes nothing", () => {
  // Regression: `supported ?? []` made this true and greyed out every option.
  for (const effort of ["low", "medium", "high", "xhigh", "max"]) {
    assert.equal(effortExcluded(null, effort), false);
  }
});

test("no selected model (undefined) excludes nothing", () => {
  assert.equal(effortExcluded(undefined, "high"), false);
});

test("an explicitly empty ladder excludes every effort", () => {
  // [] is a positive claim that the model advertises no efforts, unlike null.
  assert.equal(effortExcluded([], "low"), true);
  assert.equal(effortExcluded([], "high"), true);
});
