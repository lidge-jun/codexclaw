/**
 * project-root.test.ts — the dashboard API must operate on the PROJECT root's
 * .codexclaw/, not the vite dev-server cwd (plugins/codexclaw/gui/). Regression
 * for the bug where GUI saves landed in gui/.codexclaw/subagents.json, which no
 * spawn-time hook ever reads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { resolveProjectRoot } from "../src/server/middleware.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "cxc-gui-root-"));
}

test("CODEXCLAW_ROOT override wins", () => {
  assert.equal(resolveProjectRoot("/anywhere", { CODEXCLAW_ROOT: "/explicit/root" } as NodeJS.ProcessEnv), "/explicit/root");
});

test("walks up to the nearest .codexclaw/ marker (no .git anywhere)", () => {
  const root = tmp();
  mkdirSync(join(root, ".codexclaw"));
  const nested = join(root, "plugins", "codexclaw", "gui");
  mkdirSync(nested, { recursive: true });
  assert.equal(resolveProjectRoot(nested, {} as NodeJS.ProcessEnv), root);
});

test("walks up to the nearest .git/ marker when no .codexclaw exists", () => {
  const root = tmp();
  mkdirSync(join(root, ".git"));
  const nested = join(root, "a", "b");
  mkdirSync(nested, { recursive: true });
  assert.equal(resolveProjectRoot(nested, {} as NodeJS.ProcessEnv), root);
});

test("no marker anywhere -> falls back to the start dir", () => {
  const bare = join(tmp(), "x", "y");
  mkdirSync(bare, { recursive: true });
  assert.equal(resolveProjectRoot(bare, {} as NodeJS.ProcessEnv), bare);
});

test("a dir that itself has .codexclaw resolves to itself", () => {
  const root = tmp();
  mkdirSync(join(root, ".codexclaw"));
  assert.equal(resolveProjectRoot(root, {} as NodeJS.ProcessEnv), root);
});

test(".git outranks an intermediate .codexclaw (hook-state dirs at incidental depths)", () => {
  const root = tmp();
  mkdirSync(join(root, ".git"));
  // an incidental hook-state dir between the start and the repo root
  const mid = join(root, "plugins", "codexclaw");
  mkdirSync(join(mid, ".codexclaw"), { recursive: true });
  const nested = join(mid, "gui");
  mkdirSync(nested, { recursive: true });
  assert.equal(resolveProjectRoot(nested, {} as NodeJS.ProcessEnv), root);
});

test("~/.codexclaw is codexclaw's global store, not a project root", () => {
  // A real user has ~/.codexclaw (recall index, skill cache). A start dir with no
  // marker of its own must NOT resolve to the whole home directory just because the
  // walk passes through it.
  const bare = join(tmp(), "x", "y");
  mkdirSync(bare, { recursive: true });
  assert.notEqual(resolveProjectRoot(bare, {} as NodeJS.ProcessEnv), homedir());
  assert.equal(resolveProjectRoot(bare, {} as NodeJS.ProcessEnv), bare);
});

test("the home exclusion survives a differently-cased path on win32", () => {
  // Windows paths are case-insensitive, so a start dir spelled "c:\users\..." walks
  // up to a lowercase spelling of home that an exact compare would miss.
  if (process.platform !== "win32") return;
  const bare = join(tmp(), "x", "y");
  mkdirSync(bare, { recursive: true });
  const lowered = bare.toLowerCase();
  assert.notEqual(
    resolveProjectRoot(lowered, {} as NodeJS.ProcessEnv).toLowerCase(),
    homedir().toLowerCase(),
  );
});
