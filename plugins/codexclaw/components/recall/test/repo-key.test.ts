/**
 * repo-key.test.ts — normalization of the project identity key (260910 wp4).
 *
 * The rule under test: every spelling of ONE remote collapses to one key, and
 * two different remotes never do. git itself is never spawned here — the origin
 * reader is injected.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRepoKey, repoKeyForCwd, repoKeysEqual, readOriginUrl } from "../src/repo-key.ts";

const CANON = "github.com/lidge-jun/codexclaw";

test("https, ssh and scp spellings of one remote share a key", () => {
  for (const url of [
    "https://github.com/lidge-jun/codexclaw.git",
    "https://github.com/lidge-jun/codexclaw",
    "https://github.com/lidge-jun/codexclaw/",
    "git@github.com:lidge-jun/codexclaw.git",
    "ssh://git@github.com/lidge-jun/codexclaw",
    "ssh://git@github.com:22/lidge-jun/codexclaw.git",
    "git://github.com/lidge-jun/codexclaw.git",
    "  https://github.com/lidge-jun/codexclaw.git  ",
  ]) {
    assert.equal(normalizeRepoKey(url), CANON, `${url} must normalize to ${CANON}`);
  }
});

test("host case folds, path case does not", () => {
  assert.equal(normalizeRepoKey("https://GitHub.COM/lidge-jun/codexclaw.git"), CANON);
  // A forge path can be case-sensitive: folding it would merge two repositories.
  assert.notEqual(normalizeRepoKey("https://github.com/Lidge-Jun/CodexClaw.git"), CANON);
});

test("two forks of one name stay different projects", () => {
  const mine = normalizeRepoKey("https://github.com/lidge-jun/cli-jaw.git");
  const theirs = normalizeRepoKey("git@github.com:bitkyc08-arch/cli-jaw.git");
  assert.equal(mine, "github.com/lidge-jun/cli-jaw");
  assert.equal(theirs, "github.com/bitkyc08-arch/cli-jaw");
  assert.equal(repoKeysEqual(mine, theirs), false);
  // ...and a different host with the same path is a different project too.
  assert.notEqual(normalizeRepoKey("https://gitlab.com/lidge-jun/cli-jaw.git"), mine);
});

test("absent or unparseable input is null, never a partial key", () => {
  for (const bad of [null, undefined, "", "   ", "not a url", "/Users/jun/local/repo", 42 as unknown as string]) {
    assert.equal(normalizeRepoKey(bad), null, `${String(bad)} must yield null`);
  }
  // A URL with no path carries no project identity.
  assert.equal(normalizeRepoKey("https://github.com/"), null);
});

test("null keys never compare equal, so a missing origin cannot federate", () => {
  assert.equal(repoKeysEqual(null, null), false);
  assert.equal(repoKeysEqual(CANON, null), false);
  assert.equal(repoKeysEqual("", ""), false);
  assert.equal(repoKeysEqual(CANON, CANON), true);
});

test("repoKeyForCwd normalizes what the injected reader returns", () => {
  assert.equal(repoKeyForCwd("/anywhere", () => "git@github.com:lidge-jun/codexclaw.git"), CANON);
  // git failing (no repo, no origin, no git at all) is one null, not a throw.
  assert.equal(repoKeyForCwd("/anywhere", () => null), null);
  assert.equal(repoKeyForCwd("/anywhere", () => ""), null);
});

test("the default reader answers null for a directory that does not exist", () => {
  // Real spawn, deliberately: the fail-soft contract is what every caller relies
  // on to fall back to cwd-prefix scoping.
  assert.equal(readOriginUrl("/nonexistent-path-for-recall-wp4"), null);
  assert.equal(readOriginUrl(""), null);
});
