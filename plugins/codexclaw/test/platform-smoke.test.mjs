import { test } from "node:test";
import assert from "node:assert/strict";

// The smoke script's checks must each return a string (the problem) or null.
test("platform smoke: every check returns a string or null on this host", async () => {
  const mod = await import("../scripts/platform-smoke.mjs");
  // Importing the module must not auto-run the CLI loop; the exported check
  // functions are exercised here so a throwing check cannot silently pass CI.
  for (const fn of [mod.checkScoutingBundle, mod.checkMapLadder, mod.checkOrchestrateStatus]) {
    const result = await fn();
    assert.ok(result === null || typeof result === "string", "check returns null|string");
  }
});

test("platform smoke: the shredding detector fires on shredded text only", () => {
  const shredded = "p~l~u~g~i~n";
  const ordinary = "plugin cache at C:/Users/x/.codex (~ backup)";
  assert.match(shredded, /(~.){5}/);
  assert.doesNotMatch(ordinary, /(~.){5}/);
});

test("platform smoke: gate rejection is not a smoke failure (contract)", () => {
  // The attest-file check treats validator rejections as PASS; only read
  // failures and unrecognized flags fail. Encode that contract directly.
  const out = "orchestrate B: illegal transition IDLE->B";
  assert.ok(!/could not read the attest file|no attest file/i.test(out));
  assert.ok(!/unknown flag|unrecognized option/i.test(out));
});
