import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRulesContext, buildRulesContextFromRaw, RULES_MAX_CHARS } from "../src/rules.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-rules-"));
}

test("060.1: no rules dir and no AGENTS.md => empty string (no injection)", () => {
  assert.equal(buildRulesContext(tmp()), "");
});

test("060.1: .codexclaw/rules/*.md are concatenated into a SessionStart envelope", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "rules");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.md"), "Rule A: always test.");
  writeFileSync(join(dir, "b.md"), "Rule B: small commits.");
  const out = JSON.parse(buildRulesContext(cwd).trim());
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /Rule A: always test\./);
  assert.match(out.hookSpecificOutput.additionalContext, /Rule B: small commits\./);
});

test("060.1: AGENTS.md fallback used only when no rules dir blocks", () => {
  const cwd = tmp();
  writeFileSync(join(cwd, "AGENTS.md"), "Root agent rules.");
  assert.match(JSON.parse(buildRulesContext(cwd).trim()).hookSpecificOutput.additionalContext, /Root agent rules\./);
});

test("060.1: duplicate rule blocks are deduped", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "rules");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.md"), "Same block.");
  writeFileSync(join(dir, "b.md"), "Same block.");
  const ctx = JSON.parse(buildRulesContext(cwd).trim()).hookSpecificOutput.additionalContext;
  assert.equal(ctx.match(/Same block\./g).length, 1, "duplicate blocks must dedup to one");
});

test("060.1: oversized rules are length-capped", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "rules");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "big.md"), "x".repeat(RULES_MAX_CHARS + 5000));
  const ctx = JSON.parse(buildRulesContext(cwd).trim()).hookSpecificOutput.additionalContext;
  assert.match(ctx, /rules truncated/);
});

test("060.1: buildRulesContextFromRaw resolves cwd from the payload", () => {
  const cwd = tmp();
  const dir = join(cwd, ".codexclaw", "rules");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "a.md"), "Payload-cwd rule.");
  const raw = JSON.stringify({ hook_event_name: "SessionStart", cwd });
  assert.match(buildRulesContextFromRaw(raw, "/nonexistent"), /Payload-cwd rule\./);
  // malformed raw => falls back to the given cwd (empty here)
  assert.equal(buildRulesContextFromRaw("{bad", tmp()), "");
});
