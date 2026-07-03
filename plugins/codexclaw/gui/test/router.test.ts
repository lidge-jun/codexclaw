/** router.test.ts — hash route resolution (pure logic, stubbed location). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentRoute } from "../src/router.ts";

function withHash(hash: string, fn: () => void): void {
  const g = globalThis as { location?: { hash: string } };
  const prev = g.location;
  g.location = { hash };
  try {
    fn();
  } finally {
    if (prev === undefined) delete g.location;
    else g.location = prev;
  }
}

test("empty hash defaults to /channels", () => {
  withHash("", () => assert.equal(currentRoute(), "/channels"));
  withHash("#", () => assert.equal(currentRoute(), "/channels"));
  withHash("#/", () => assert.equal(currentRoute(), "/channels"));
});

test("explicit hash routes resolve to their path", () => {
  withHash("#/agents", () => assert.equal(currentRoute(), "/agents"));
  withHash("#/subagents", () => assert.equal(currentRoute(), "/subagents"));
  withHash("#/channels", () => assert.equal(currentRoute(), "/channels"));
});
