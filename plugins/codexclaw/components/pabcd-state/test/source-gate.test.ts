import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBoundSourceIdentity } from "../src/source-gate.ts";

const SESSION = "019a0000-0000-7000-8000-000000000001";

function dir(t: TestContext, prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

function initRepo(cwd: string): void {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(cwd, "gitconfig"), GIT_CONFIG_SYSTEM: join(cwd, "gitconfig") };
  const git = (...args: string[]) => execFileSync("git", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q");
  writeFileSync(join(cwd, "tracked.txt"), "x\n");
  git("add", "tracked.txt");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
}

// #133: the predicate is "the SOURCE identity is unavailable", NOT "there is no .git".
// Written the other way it would reject the #109 split-cwd case at the door and the
// #109 fix would have to undo this gate.
test("a non-git workspace has no resolvable source identity", t => {
  const cwd = dir(t, "cxc-gate-nongit-");
  const res = checkBoundSourceIdentity(cwd, SESSION);
  assert.equal(res.ok, false);
  // The message must offer both exits, or the user is told to stop without being told how.
  assert.match(res.reason ?? "", /cxc session source/);
  assert.match(res.reason ?? "", /unbound/);
  assert.match(res.reason ?? "", /CHECK-BINDING-01/);
});

test("a clean git workspace resolves", t => {
  const cwd = dir(t, "cxc-gate-git-");
  initRepo(cwd);
  assert.equal(checkBoundSourceIdentity(cwd, SESSION).ok, true);
});

// Dirty is a RESOLVED identity. Confusing "dirty" with "unavailable" would refuse every
// real working session, which is the failure mode this case exists to prevent.
test("a dirty git workspace still resolves", t => {
  const cwd = dir(t, "cxc-gate-dirty-");
  initRepo(cwd);
  writeFileSync(join(cwd, "tracked.txt"), "changed\n");
  writeFileSync(join(cwd, "untracked.txt"), "new\n");
  assert.equal(checkBoundSourceIdentity(cwd, SESSION).ok, true);
});
