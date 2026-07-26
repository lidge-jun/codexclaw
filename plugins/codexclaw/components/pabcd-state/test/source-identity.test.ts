/**
 * source-identity tests (WP9 / plan 020).
 *
 * Every case builds a real `git init` fixture. The porcelain edge cases here
 * (quoted paths, untracked directories, RM/MM/MD/AD) were all reproduced by the
 * A-phase reviewer on a live repo before being written down, so these are
 * regressions against observed behaviour rather than imagined shapes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertNever,
  captureSourceIdentity,
  compareSource,
  describeSource,
  type SourceComparison,
} from "../src/source-identity.ts";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
}

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "cxc-srcid-"));
  git(root, "init", "-q", ".");
  writeFileSync(join(root, ".gitignore"), "ignored/\n");
  writeFileSync(join(root, "tracked.ts"), "a\n");
  mkdirSync(join(root, "sub"), { recursive: true });
  writeFileSync(join(root, "sub", "x.ts"), "b\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  return root;
}

function kindOf(root: string, before: ReturnType<typeof captureSourceIdentity>): SourceComparison["kind"] {
  return compareSource(before, captureSourceIdentity(root)).kind;
}

test("T1: two captures of a clean tree are the same", () => {
  const root = repo();
  assert.equal(kindOf(root, captureSourceIdentity(root)), "same");
});

test("T2: editing a tracked file differs and marks the tree dirty", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "tracked.ts"), "changed\n");
  const after = captureSourceIdentity(root);
  assert.equal(compareSource(before, after).kind, "different");
  assert.equal(after.dirty, true);
});

test("T3: a new untracked file differs", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "new.ts"), "n\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T4: a file under a gitignored path is the same (we trust .gitignore)", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  mkdirSync(join(root, "ignored"), { recursive: true });
  writeFileSync(join(root, "ignored", "junk.ts"), "j\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "same");
});

test("T5: deleting a tracked file differs", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  rmSync(join(root, "tracked.ts"));
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T6: renaming a tracked file differs", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  git(root, "mv", "tracked.ts", "moved.ts");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T7: staging without committing differs", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "staged.ts"), "s\n");
  git(root, "add", "staged.ts");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T8: adding then removing an untracked file restores the identity", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "temp.ts"), "t\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
  rmSync(join(root, "temp.ts"));
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "same");
});

test("T9: committing changes the sha even when the tree ends up identical", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "tracked.ts"), "c\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "second");
  const after = captureSourceIdentity(root);
  assert.equal(after.dirty, false);
  assert.equal(compareSource(before, after).kind, "different");
});

test("T10: reverting a dirty edit restores the identity", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "tracked.ts"), "dirty\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
  writeFileSync(join(root, "tracked.ts"), "a\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "same");
});

test("T11: a non-git directory is unavailable on both sides", () => {
  const plain = mkdtempSync(join(tmpdir(), "cxc-nogit-"));
  const id = captureSourceIdentity(plain);
  assert.equal(id.kind, "unavailable");
  assert.equal(compareSource(id, id).kind, "unavailable");
});

test("T12: one unavailable side is unavailable, never different", () => {
  const root = repo();
  const plain = mkdtempSync(join(tmpdir(), "cxc-nogit-"));
  assert.equal(compareSource(captureSourceIdentity(root), captureSourceIdentity(plain)).kind, "unavailable");
});

test("T13: describeSource shows a short sha and the dirty marker", () => {
  const root = repo();
  const clean = captureSourceIdentity(root);
  assert.match(describeSource(clean), /^[0-9a-f]{7}$/);
  writeFileSync(join(root, "tracked.ts"), "d\n");
  assert.match(describeSource(captureSourceIdentity(root)), /^[0-9a-f]{7}\+dirty$/);
});

test("T14: same size and same mtime but different bytes still differs", () => {
  const root = repo();
  writeFileSync(join(root, "tracked.ts"), "aaaa\n");
  const before = captureSourceIdentity(root);
  const stamp = new Date(1700000000000);
  utimesSync(join(root, "tracked.ts"), stamp, stamp);
  const beforePinned = captureSourceIdentity(root);
  writeFileSync(join(root, "tracked.ts"), "bbbb\n");
  utimesSync(join(root, "tracked.ts"), stamp, stamp);
  assert.equal(compareSource(before, beforePinned).kind, "same");
  assert.equal(compareSource(beforePinned, captureSourceIdentity(root)).kind, "different");
});

test("T15: assertNever rejects an unhandled case at runtime and at compile time", () => {
  function handled(r: SourceComparison): string {
    switch (r.kind) {
      case "same":
        return "s";
      case "different":
        return "d";
      case "unavailable":
        return "u";
      default:
        return assertNever(r);
    }
  }
  assert.equal(handled({ kind: "same" }), "s");
  assert.equal(handled({ kind: "different", detail: "x" }), "d");
  assert.equal(handled({ kind: "unavailable", reason: "x" }), "u");

  // Dropping a case must not type-check. If it ever compiles cleanly, the
  // expect-error directive below turns into an unused-directive error, so this
  // guard cannot rot silently. (Do not write that directive's name in prose —
  // tsc reads it as a real directive wherever it appears.)
  function missingCase(r: SourceComparison): string {
    switch (r.kind) {
      case "same":
        return "s";
      case "different":
        return "d";
      default:
        // @ts-expect-error "unavailable" is still reachable here
        return assertNever(r);
    }
  }
  assert.equal(missingCase({ kind: "same" }), "s");
});

test("T16: paths containing spaces and quotes are reconstructed intact", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  const weird = 'untracked "quote" and space.ts';
  writeFileSync(join(root, weird), "w\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
  // and removing it restores identity, proving the path round-tripped
  rmSync(join(root, weird));
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "same");
});

test("T17: editing a file inside an untracked directory differs", () => {
  const root = repo();
  mkdirSync(join(root, "untracked dir"), { recursive: true });
  writeFileSync(join(root, "untracked dir", "new.ts"), "one\n");
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "untracked dir", "new.ts"), "two\n");
  // Without --untracked-files=all this is a single unchanged `?? untracked dir/`.
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T18: editing a renamed file again differs while the status stays RM", () => {
  const root = repo();
  git(root, "mv", "tracked.ts", "renamed.ts");
  writeFileSync(join(root, "renamed.ts"), "one\n");
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "renamed.ts"), "two\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T19: editing again under a steady MM status differs", () => {
  const root = repo();
  writeFileSync(join(root, "tracked.ts"), "staged\n");
  git(root, "add", "tracked.ts");
  writeFileSync(join(root, "tracked.ts"), "one\n");
  const before = captureSourceIdentity(root);
  writeFileSync(join(root, "tracked.ts"), "two\n");
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T20: swapping which path is the rename source differs", () => {
  const root = repo();
  git(root, "mv", "tracked.ts", "a.ts");
  const before = captureSourceIdentity(root);
  renameSync(join(root, "a.ts"), join(root, "b.ts"));
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});

test("T21: MD and AD statuses are recorded through the fallback rule", () => {
  const root = repo();
  const before = captureSourceIdentity(root);
  // MD: staged modification, then deleted from the working tree.
  writeFileSync(join(root, "tracked.ts"), "staged\n");
  git(root, "add", "tracked.ts");
  rmSync(join(root, "tracked.ts"));
  // AD: added to the index, then deleted from the working tree.
  writeFileSync(join(root, "added.ts"), "added\n");
  git(root, "add", "added.ts");
  rmSync(join(root, "added.ts"));
  const status = git(root, "status", "--porcelain=v1");
  assert.match(status, /MD tracked\.ts/);
  assert.match(status, /AD added\.ts/);
  assert.equal(compareSource(before, captureSourceIdentity(root)).kind, "different");
});
