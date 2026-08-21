/**
 * atomic-write.test.ts - bounded win32 rename retry (wp05 / defect #12).
 *
 * Platform and IO are injected, so Linux CI drives the win32 branch and no test
 * ever sleeps for real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renameWithRetry } from "../src/atomic-write.ts";

function errWithCode(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}

test("a clean rename does not retry", () => {
  let renames = 0;
  const sleeps: number[] = [];
  renameWithRetry("tmp", "final", "win32", () => { renames++; }, (ms) => { sleeps.push(ms); });
  assert.equal(renames, 1);
  assert.deepEqual(sleeps, []);
});

test("EBUSY then success retries once", () => {
  let renames = 0;
  const sleeps: number[] = [];
  renameWithRetry("tmp", "final", "win32", () => {
    renames++;
    if (renames === 1) throw errWithCode("EBUSY");
  }, (ms) => { sleeps.push(ms); });
  assert.equal(renames, 2);
  assert.deepEqual(sleeps, [25]);
});

test("three failures rethrow the last error", () => {
  let renames = 0;
  const sleeps: number[] = [];
  const thrown: NodeJS.ErrnoException[] = [];
  assert.throws(
    () => renameWithRetry("tmp", "final", "win32", () => {
      renames++;
      const e = errWithCode("EPERM");
      (e as Error & { attempt?: number }).attempt = renames;
      thrown.push(e);
      throw e;
    }, (ms) => { sleeps.push(ms); }),
    (err: Error & { attempt?: number }) => err.attempt === 3,
  );
  assert.equal(renames, 3);
  assert.deepEqual(sleeps, [25, 50]);
  assert.equal(thrown.length, 3);
});

test("POSIX never retries", () => {
  // The retry must not mask a real POSIX failure.
  let renames = 0;
  let slept = false;
  assert.throws(() => renameWithRetry("tmp", "final", "linux", () => {
    renames++;
    throw errWithCode("EBUSY");
  }, () => { slept = true; }), /EBUSY/);
  assert.equal(renames, 1);
  assert.equal(slept, false);
});

test("ENOENT is not transient", () => {
  let renames = 0;
  assert.throws(() => renameWithRetry("tmp", "final", "win32", () => {
    renames++;
    throw errWithCode("ENOENT");
  }, () => { throw new Error("must not sleep"); }), /ENOENT/);
  assert.equal(renames, 1);
});

test("EACCES is transient on win32", () => {
  let renames = 0;
  renameWithRetry("tmp", "final", "win32", () => {
    renames++;
    if (renames === 1) throw errWithCode("EACCES");
  }, () => {});
  assert.equal(renames, 2);
});

