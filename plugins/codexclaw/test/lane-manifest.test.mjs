// lane-manifest.test.mjs — issue #184. The manifest exists to make a duplicate lane
// visible before two branches diverge, so the interesting cases are the collisions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLaneManifest } from "../scripts/check-lane-manifest.mjs";

const lane = (over = {}) => ({
  id: "lane-1",
  taskId: "01a0-aaaa",
  hostId: "local",
  worktree: "/w/one",
  branch: "codex/one",
  owner: "task:01a0-aaaa",
  base: { ref: "dev", sha: "abc1234" },
  head: "def5678",
  status: "running",
  issue: "lidge-jun/codexclaw#184",
  ...over,
});
const manifest = (lanes) => ({ repository: "lidge-jun/codexclaw", lanes });

test("#184: a complete two-lane manifest validates", () => {
  const r = validateLaneManifest(
    manifest([lane(), lane({ id: "lane-2", branch: "codex/two", worktree: "/w/two", issue: "lidge-jun/codexclaw#175" })]),
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.lanes, 2);
});

test("#184: two active lanes on one issue with no scope is the collision this exists to catch", () => {
  const r = validateLaneManifest(manifest([lane(), lane({ id: "lane-2", branch: "codex/two", worktree: "/w/two" })]));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /shares lidge-jun\/codexclaw#184 .*no scope/.test(e)), r.errors.join("|"));
});

test("#184: sharing an issue is allowed when each lane names a different part", () => {
  const r = validateLaneManifest(
    manifest([
      lane({ scope: "validator" }),
      lane({ id: "lane-2", branch: "codex/two", worktree: "/w/two", scope: "docs" }),
    ]),
  );
  assert.deepEqual(r.errors, []);
});

test("#184: identical scopes are still a collision", () => {
  const r = validateLaneManifest(
    manifest([lane({ scope: "docs" }), lane({ id: "lane-2", branch: "codex/two", worktree: "/w/two", scope: "docs" })]),
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /scope "docs"/.test(e)), r.errors.join("|"));
});

test("#184: a finished lane does not block a new one on the same issue", () => {
  const r = validateLaneManifest(
    manifest([lane({ status: "merged" }), lane({ id: "lane-2", branch: "codex/two", worktree: "/w/two" })]),
  );
  assert.deepEqual(r.errors, []);
});

test("#184: base ref, base sha and head are each required", () => {
  for (const [over, pattern] of [
    [{ base: { sha: "abc1234" } }, /base\.ref is required/],
    [{ base: { ref: "dev" } }, /base\.sha is required/],
    [{ head: undefined }, /head is required/],
    [{ head: "not-a-sha" }, /head is required/],
  ]) {
    const r = validateLaneManifest(manifest([lane(over)]));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => pattern.test(e)), pattern + " missing from " + r.errors.join("|"));
  }
});

test("#184: a bare issue number is rejected because it is ambiguous across repositories", () => {
  const r = validateLaneManifest(manifest([lane({ issue: "184" })]));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /repository-qualified/.test(e)), r.errors.join("|"));
});

test("#184: duplicate lane ids and duplicate branches are both rejected", () => {
  const dupId = validateLaneManifest(manifest([lane(), lane({ branch: "codex/two", worktree: "/w/two", issue: "lidge-jun/codexclaw#1" })]));
  assert.ok(dupId.errors.some((e) => /duplicates an earlier lane/.test(e)), dupId.errors.join("|"));

  const dupBranch = validateLaneManifest(
    manifest([lane(), lane({ id: "lane-2", worktree: "/w/two", issue: "lidge-jun/codexclaw#1" })]),
  );
  assert.ok(dupBranch.errors.some((e) => /already claimed by lane/.test(e)), dupBranch.errors.join("|"));
});

test("#184: identity fields are required, and a manifest without a repository is rejected", () => {
  const missing = validateLaneManifest(manifest([lane({ hostId: "" })]));
  assert.ok(missing.errors.some((e) => /hostId is required/.test(e)));

  const noRepo = validateLaneManifest({ lanes: [lane()] });
  assert.ok(noRepo.errors.some((e) => /repository is required/.test(e)));

  assert.equal(validateLaneManifest(null).ok, false);
  assert.equal(validateLaneManifest({ repository: "a/b" }).ok, false);
});
