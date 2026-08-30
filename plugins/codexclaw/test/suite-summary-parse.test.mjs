// The TAP summary parser the CI and release workflows use to learn how many tests ran.
//
// It broke the first time it executed on a windows runner: `node --test` prefixes its
// summary with `ℹ`, three UTF-8 bytes, and `grep -Eo '^. tests [0-9]+'` only spans that
// with a multibyte-aware `.`. Git bash on the windows runners runs under the C locale,
// where the pattern matched nothing, the total came back empty, and the step failed on a
// suite that had actually passed with `fail 0`. Ubuntu's UTF-8 locale hid it.
//
// So the grammar is extracted from the workflows and exercised under BOTH locales here.
// A future edit that reintroduces a leading-glyph anchor fails on any machine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

// A realistic log: a test title that ends in a number, one that ends in the word tests,
// then the summary block. Only the summary lines may be matched.
const SAMPLE_LOG = [
  "✔ resolves a port when PATHEXT lists 3",
  "✔ a helper that ships no tests",
  "✔ rejects a manifest declaring 12 tests",
  "ℹ tests 2273",
  "ℹ suites 0",
  "ℹ pass 2266",
  "ℹ fail 0",
  "ℹ cancelled 0",
  "ℹ skipped 7",
  "ℹ todo 0",
  "ℹ duration_ms 172365.0608",
  "",
].join("\n");

/** Every `grep -Eo '<pattern>'` a workflow uses to read the suite summary. */
function summaryPatterns(workflow) {
  const body = readFileSync(join(repoRoot, ".github", "workflows", workflow), "utf8");
  const found = [];
  for (const m of body.matchAll(/grep -Eo '([^']*(?:tests|pass|fail)[^']*)'/g)) {
    found.push(m[1]);
  }
  return found;
}

function grepUnder(locale, pattern, logPath) {
  const r = spawnSync("grep", ["-Eo", pattern, logPath], {
    encoding: "utf8",
    env: { ...process.env, LC_ALL: locale, LANG: locale },
  });
  return (r.stdout ?? "").trim().split("\n").filter(Boolean);
}

function withSampleLog(fn) {
  const dir = mkdtempSync(join(tmpdir(), "cxc-tap-"));
  try {
    const p = join(dir, "suite.log");
    writeFileSync(p, SAMPLE_LOG);
    return fn(p);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("both workflows declare a summary pattern to parse", () => {
  for (const wf of ["ci.yml", "release.yml"]) {
    assert.ok(summaryPatterns(wf).length > 0, wf + " declares no suite-summary grep");
  }
});

test("every workflow summary pattern resolves identically under C and UTF-8", () => {
  withSampleLog((logPath) => {
    for (const wf of ["ci.yml", "release.yml"]) {
      for (const pattern of summaryPatterns(wf)) {
        const c = grepUnder("C", pattern, logPath);
        const utf8 = grepUnder("en_US.UTF-8", pattern, logPath);
        assert.ok(
          c.length > 0,
          wf + ": pattern " + JSON.stringify(pattern) +
            " matches nothing under the C locale, which is what Git bash uses on the" +
            " windows runners. Anchor on the value, not on the leading glyph.",
        );
        assert.deepEqual(
          c,
          utf8,
          wf + ": pattern " + JSON.stringify(pattern) + " is locale-dependent",
        );
      }
    }
  });
});

test("the parsed totals are the summary numbers, not a test title's digits", () => {
  withSampleLog((logPath) => {
    const expected = { tests: "2273", pass: "2266", fail: "0" };
    for (const wf of ["ci.yml", "release.yml"]) {
      for (const pattern of summaryPatterns(wf)) {
        const kind = ["tests", "pass", "fail"].find((k) => pattern.includes(k));
        if (!kind) continue;
        // The workflows take the LAST match and then extract its digits.
        const matches = grepUnder("C", pattern, logPath);
        const digits = /([0-9]+)/.exec(matches[matches.length - 1] ?? "");
        assert.ok(digits, wf + ": no digits in " + JSON.stringify(pattern));
        assert.equal(
          digits[1],
          expected[kind],
          wf + ": pattern " + JSON.stringify(pattern) + " read " + digits[1] +
            " instead of the summary's " + expected[kind] +
            " — a test title's trailing number was matched",
        );
      }
    }
  });
});
