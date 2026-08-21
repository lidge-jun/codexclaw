/**
 * win-paths.test.ts - platform-parameterized path identity (wp05 / defect #3).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { samePathIdentity, escapeRegExp, homePathVariants } from "../src/win-paths.ts";

test("samePathIdentity folds case only on win32", () => {
  assert.equal(samePathIdentity("C:\\A", "c:\\a", "win32"), true);
  assert.equal(samePathIdentity("/a/B", "/a/b", "linux"), false);
  assert.equal(samePathIdentity("/a/b", "/a/b", "linux"), true);
});

test("homePathVariants returns both separator forms, longest first", () => {
  const variants = homePathVariants("C:\\Users\\jun", "linux");
  assert.ok(variants.includes("C:/Users/jun"));
  assert.ok(variants.includes("C:\\Users\\jun"));
  for (let i = 1; i < variants.length; i++) {
    assert.ok(variants[i - 1].length >= variants[i].length, "variants must be sorted longest first");
  }
});

test("homePathVariants includes the realpath form on win32", () => {
  const stub = () => "C:\\Users\\SUPERL~1";
  const win = homePathVariants("C:\\Users\\superlongname", "win32", stub);
  assert.ok(win.includes("C:\\Users\\SUPERL~1"), "8.3 short form must be redactable");

  // The same stub must NOT be consulted on posix: folding there would be wrong.
  let consulted = false;
  const posix = homePathVariants("/home/jun", "linux", () => {
    consulted = true;
    return "/home/OTHER";
  });
  assert.equal(consulted, false);
  assert.ok(posix.includes("/home/jun"));
  assert.ok(!posix.some((v) => v.includes("OTHER")), "posix must not consult realpath");
});

test("an unreadable home does not throw", () => {
  const variants = homePathVariants("C:\\Users\\jun", "win32", () => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  });
  assert.ok(variants.includes("C:\\Users\\jun"));
  assert.ok(variants.includes("C:/Users/jun"));
});

test("empty and whitespace-only home yield no variants", () => {
  assert.deepEqual(homePathVariants("", "win32"), []);
  assert.deepEqual(homePathVariants("   ", "linux"), []);
});

test("escapeRegExp neutralizes regex metacharacters", () => {
  const escaped = escapeRegExp("C:\\Users\\a+b(1)");
  assert.match("C:\\Users\\a+b(1)", new RegExp(escaped));
  assert.doesNotMatch("C:\\Users\\aab1", new RegExp(escaped));
});
