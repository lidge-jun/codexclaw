/**
 * loop-activation-doc-sync.test.mjs
 *
 * Keeps cxc-loop and cxc-pabcd aligned on the activation contract:
 * HOTL continuation needs both an ACTIVE host goal and an in-flight PABCD
 * cycle; HITL PABCD remains valid without a goal but does not arm Stop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(path) {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

test("cxc-loop activation contract stays tied to cxc-pabcd and host goal state", () => {
  const loopSkill = read("plugins/codexclaw/skills/loop/SKILL.md");
  const pabcdSkill = read("plugins/codexclaw/skills/pabcd/SKILL.md");

  assert.match(loopSkill, /overlay on `cxc-pabcd`, not a replacement/);
  assert.match(loopSkill, /Before claiming a[\s\S]+loop is active[\s\S]+enter a real PABCD state/);
  assert.match(loopSkill, /ACTIVE host goal must exist AND a PABCD cycle must be[\s\S]+in flight/);
  assert.match(loopSkill, /Goal active without PABCD active is not a work loop/);
  assert.match(loopSkill, /PABCD active without a[\s\S]+goal is HITL, not HOTL/);
  assert.match(loopSkill, /subagents never[\s\S]+create or update host goals/);

  assert.match(pabcdSkill, /Loop \/ goal activation handoff/);
  assert.match(pabcdSkill, /`cxc-loop` depends on PABCD; it does not replace it/);
  assert.match(pabcdSkill, /HOTL requires both an ACTIVE host goal and a non-IDLE PABCD cycle before Stop[\s\S]+continuation arms/);
  assert.match(pabcdSkill, /main session alone owns host-goal lifecycle and PABCD[\s\S]+transitions/);
});
