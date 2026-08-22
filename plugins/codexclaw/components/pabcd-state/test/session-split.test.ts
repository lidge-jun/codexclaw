/**
 * session-split.test.ts — issue #48: session files live at
 * `<cwd>/.codexclaw/sessions/<id>.json`, so the same `--session` id resolves to
 * different state depending on where the process started.
 *
 * Reported symptom: a thread whose cwd was `~/.cli-jaw` while its work was in
 * `~/kim_wiki` interviewed one FSM and orchestrated the other. `status` said
 * `phase=IDLE` for a cycle that had just closed D in the other tree, and the next
 * turn re-injected Interview from the stale copy.
 *
 * Relocating the store would break every existing session, so the fix makes the
 * split VISIBLE instead. Detection only: the other tree is never read or written.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findForeignSessionCopies, defaultState, STATE_DIR } from "../src/state.ts";

function treeWithSession(id: string): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-split-"));
  mkdirSync(join(root, STATE_DIR, "sessions"), { recursive: true });
  writeFileSync(
    join(root, STATE_DIR, "sessions", `${id}.json`),
    JSON.stringify(defaultState(id), null, 2),
  );
  return root;
}

test("a session id present in a sibling tree is reported", () => {
  const mine = treeWithSession("s-dup");
  const other = treeWithSession("s-dup");
  try {
    const found = findForeignSessionCopies(mine, "s-dup", [other]);
    assert.equal(found.length, 1);
    assert.match(found[0], /s-dup\.json$/);
    assert.ok(found[0].startsWith(other), "must name the OTHER tree, not this one");
  } finally {
    rmSync(mine, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test("the caller's own tree is never reported as foreign", () => {
  const mine = treeWithSession("s-self");
  try {
    // Passing your own cwd as a candidate must not produce a self-warning.
    assert.deepEqual(findForeignSessionCopies(mine, "s-self", [mine]), []);
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

test("a candidate without that session is not reported", () => {
  const mine = treeWithSession("s-only");
  const bare = mkdtempSync(join(tmpdir(), "cxc-bare-"));
  try {
    assert.deepEqual(findForeignSessionCopies(mine, "s-only", [bare]), []);
  } finally {
    rmSync(mine, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
});

test("unreadable or missing candidates are skipped, not thrown", () => {
  const mine = treeWithSession("s-safe");
  try {
    const found = findForeignSessionCopies(mine, "s-safe", [
      join(tmpdir(), "cxc-does-not-exist-" + Date.now()),
      "",
    ]);
    assert.deepEqual(found, []);
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});
