import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateLanePacket, validateLanePacketSet, councilLanePackets } from "../scripts/check-lane-packet.mjs";
import { councilLane, outboundMentions, similarity, NEAR_DUPLICATE, RULES_VERSION } from "../scripts/lane-council.mjs";

// LANE-COUNCIL-01: role stances on dispatch packets before a fan-out, after Quorum
// (tryquorum/quorum rules.ts decide(), dedup.ts). These pin the verdicts a coordinator acts
// on: which lanes to rewrite, which to ask the user about, which to dispatch.
const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, "..", "scripts", "check-lane-packet.mjs");

let n = 0;
const lane = (objective, extra = {}) => {
  n += 1;
  return {
    lane: "lane-" + n,
    mode: "dispatch",
    work: { objective, criteria: ["focused test passes"], writeScope: ["scope/" + n], base: "dev", branch: "codex/lane-" + n },
    reporting: { evidence: ["branch head sha"], onBlocked: "report and stop" },
    ...extra,
  };
};
const council = (lanes) => {
  const r = councilLanePackets({ lanes });
  assert.equal(r.ok, true, r.errors.join("; "));
  return r.council;
};
const verdict = (c, id) => c.verdicts.find((v) => v.lane === id);
const rules = (v) => v.stances.map((s) => s.rule);

test("distinct dispatch lanes pass with one stance from each role", () => {
  const a = lane("Fix Windows CI for recall"), b = lane("Fix Windows CI for state-cli"), c = lane("Port the WCAG owner to noslopdesign");
  const out = council([a, b, c]);
  assert.equal(out.rulesVersion, RULES_VERSION);
  assert.deepEqual(out.pass, [a.lane, b.lane, c.lane]);
  for (const v of out.verdicts) assert.deepEqual(v.stances.map((s) => s.role), ["ceo", "reviewer", "qa", "cso"]);
  assert.ok(similarity(a.work.objective, b.work.objective) < NEAR_DUPLICATE);
});

test("an exact duplicate objective rejects the later lane and keeps the first", () => {
  const a = lane("Fix the Windows CI flake in state sync."), b = lane("fix the windows CI flake in  state-sync");
  const out = council([a, b]);
  assert.equal(verdict(out, a.lane).decision, "pass");
  assert.equal(verdict(out, b.lane).decision, "reject");
  assert.ok(rules(verdict(out, b.lane)).includes("REVIEWER-DUPLICATE"));
  assert.deepEqual(out.reject, [b.lane]);
});

test("a reworded or contained objective holds; the measured distinct slice stays below the line", () => {
  const a = lane("Fix the Windows CI flake in state sync"), b = lane("Fix the flaky Windows CI run in state sync");
  const c = lane("Update README badges"), d = lane("Update README badges for test count");
  const out = council([a, b, c, d]);
  for (const id of [b.lane, d.lane]) {
    assert.equal(verdict(out, id).decision, "hold", id);
    assert.ok(rules(verdict(out, id)).includes("REVIEWER-NEAR-DUPLICATE"));
  }
  assert.deepEqual(out.hold, [b.lane, d.lane]);
});

test("created lanes are peers but are never evaluated themselves", () => {
  const created = lane("Implement goalplan link-criterion verb");
  created.mode = "bound";
  created.address = { threadId: "01a0b875-9bb1", hostId: "local" };
  const pending = lane("Deploy the docs site");
  pending.mode = "pending";
  pending.creation = { provisionalId: "queued-1", hostId: "local", requestedAt: "2026-11-09T00:00:00Z" };
  const repeat = lane("Implement goalplan link-criterion verb");
  const out = council([repeat, created, pending]);
  assert.equal(verdict(out, created.lane).decision, "not-evaluated");
  assert.equal(verdict(out, pending.lane).decision, "not-evaluated", "a created lane is not held for its wording");
  assert.equal(verdict(out, repeat.lane).decision, "reject", "a dispatch lane repeating a created lane is the main duplicate case");
  assert.deepEqual(out.notEvaluated, [created.lane, pending.lane]);
});

test("a single packet has no peers and a non-loop lane without an objective holds", () => {
  const solo = councilLanePackets(lane("Add the council flag"));
  assert.equal(solo.ok, true);
  assert.equal(solo.council.verdicts[0].decision, "pass");
  assert.ok(rules(solo.council.verdicts[0]).includes("REVIEWER-NO-PEERS"));
  const p = lane(undefined);
  delete p.work.objective;
  delete p.work.criteria;
  const v = councilLanePackets(p).council.verdicts[0];
  assert.equal(v.decision, "hold");
  assert.ok(rules(v).includes("CEO-NO-OBJECTIVE"));
  assert.ok(rules(v).includes("QA-EVIDENCE"), "QA never cuts a packet the contract accepts");
});

// Each category: English and Korean wording that must hold, and the declaration that clears it.
const CATEGORIES = {
  merge: { words: ["merge the PR into dev", "land the branch after CI", "머지까지 진행", "dev에 병합"], declare: (p) => { p.authority = { push: true, merge: true, mergeTarget: p.work.branch }; } },
  push: { words: ["push the branch", "git push origin", "브랜치 푸시"], declare: (p) => { p.authority = { push: true }; } },
  pr: { words: ["open a PR against dev", "create a draft pull request", "PR 올리기", "PR을 생성", "submit a pull request"], declare: (p) => { p.authority = { push: true, openPr: true }; } },
  deploy: { words: ["deploy to production", "roll out the change", "go live tonight", "ship it", "스테이징에 배포"], declare: (p) => { p.authority = { outbound: ["deploy"] }; } },
  release: { words: ["cut a release", "git tag the head", "tag v1.2.0", "릴리스 진행", "릴리즈 만들기"], declare: (p) => { p.authority = { outbound: ["release"] }; } },
  publish: { words: ["publish the package", "run \u0060npm publish\u0060", "블로그에 게시", "뉴스레터 발행"], declare: (p) => { p.authority = { outbound: ["publish"] }; } },
  send: { words: ["send the summary to the team", "email the customer", "post the summary to Slack", "approve the PR", "comment on the issue", "메일 보내기", "알림 전송", "공지 발송", "submit the application form", "apply for the grant", "DM the maintainer", "서류 제출", "휴가 신청"], declare: (p) => { p.authority = { outbound: ["send"] }; } },
  destroy: { words: ["delete the stale branches", "drop the users table", "rm -rf build", "wipe the state dir", "git reset --hard", "clear the npm cache", "force-push the branch", "오래된 브랜치 삭제", "상태 초기화"], declare: (p) => { p.authority = { push: true, outbound: ["destroy"] }; } },
  pay: { words: ["pay the invoice", "purchase a license", "buy credits", "결제하기", "라이선스 구매", "송금 처리", "transfer funds to the vendor"], declare: (p) => { p.authority = { outbound: ["pay"] }; } },
};

test("outbound wording holds per category until the packet declares it", () => {
  for (const [category, { words, declare }] of Object.entries(CATEGORIES)) {
    for (const phrase of words) {
      assert.ok(outboundMentions(phrase).some((m) => m.category === category), category + ": " + phrase);
      const v = council([lane(phrase)]).verdicts[0];
      assert.equal(v.decision, "hold", phrase);
      assert.ok(rules(v).includes("CSO-OUTBOUND-" + category), phrase + " -> " + rules(v).join(","));
      const cleared = lane(phrase);
      declare(cleared);
      const w = council([cleared]).verdicts[0];
      assert.equal(rules(w).includes("CSO-OUTBOUND-" + category), false, "declared " + category + ": " + phrase);
    }
  }
});

test("outbound wording in criteria counts as much as in the objective", () => {
  const p = lane("Fix the flaky sync test");
  p.work.criteria = ["test passes", "deploy the fix to staging"];
  assert.ok(rules(council([p]).verdicts[0]).includes("CSO-OUTBOUND-deploy"));
});

test("code nouns, identifiers and governed negation do not hold", () => {
  for (const phrase of ["write release notes", "refactor mergeLanes", "resolve merge conflicts", "fix publishConfig parsing", "결제 모듈 리팩터", "배포 스크립트 정리", "push notifications badge", "do not merge", "Never deploy from a lane", "Don’t publish anything", "without sending email", "병합은 하지 마요", "머지 금지", "배포하지 말 것", "apply the patch"])
    assert.deepEqual(outboundMentions(phrase), [], phrase);
});

test("negation suppresses only the verb it governs", () => {
  assert.deepEqual(outboundMentions("do not merge until CI passes, then merge").map((m) => m.category), ["merge"]);
  assert.deepEqual(outboundMentions("배포하지 않고 머지").map((m) => m.category), ["merge"]);
  assert.deepEqual(outboundMentions("never skip the deploy step").map((m) => m.category), ["deploy"]);
  assert.deepEqual(outboundMentions("submit a PR").map((m) => m.category), ["pr"], "a PR submission is the pr category, not send");
});

test("authority.outbound is a packet field: known list categories only", () => {
  const ok = lane("x"); ok.authority = { outbound: ["deploy", "send"] };
  assert.equal(validateLanePacket(ok).ok, true);
  const empty = lane("x"); empty.authority = { outbound: [] };
  assert.equal(validateLanePacket(empty).ok, true);
  for (const outbound of ["deploy", [1], [""], ["teleport"], ["merge"], ["push"], ["pr"], null, {}]) {
    const p = lane("x"); p.authority = { outbound };
    const r = validateLanePacket(p);
    assert.equal(r.ok, false, JSON.stringify(outbound));
    assert.match(r.errors.join(" "), /authority\.outbound/);
  }
});

test("an invalid set never reaches the council", () => {
  const a = lane("one"), b = lane("two");
  b.work.branch = a.work.branch;
  const r = councilLanePackets({ lanes: [a, b] });
  assert.equal(r.ok, false);
  assert.equal(r.council, undefined);
});

test("CLI: --council exits 0 pass, 2 hold, 1 reject or invalid; without it nothing changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "lane-council-cli-"));
  try {
    const file = join(dir, "set.json");
    const invoke = (args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 20000 });
    const write = (lanes) => writeFileSync(file, JSON.stringify({ lanes }));

    write([lane("Fix Windows CI for recall"), lane("Port the WCAG owner")]);
    let r = invoke([file, "--council"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /pass=2 hold=0 reject=0/);

    const held = lane("deploy the docs site");
    write([held]);
    r = invoke(["--council", file, "--json"]);
    assert.equal(r.status, 2, r.stderr);
    const json = JSON.parse(r.stdout);
    assert.deepEqual(json.council.hold, [held.lane]);
    assert.equal(json.council.rulesVersion, RULES_VERSION);
    assert.match(invoke([file, "--council"]).stdout, new RegExp("HOLD " + held.lane + ".*CSO-OUTBOUND-deploy"));
    assert.equal(invoke([file]).status, 0, "without --council a hold is not an error");
    assert.deepEqual(JSON.parse(invoke([file, "--json"]).stdout), validateLanePacketSet({ lanes: [held] }));

    write([lane("Same objective"), lane("same objective")]);
    r = invoke([file, "--council"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /REJECT lane-\d+.*REVIEWER-DUPLICATE/);

    const a = lane("one"), b = lane("two");
    b.work.branch = a.work.branch;
    write([a, b]);
    r = invoke([file, "--council"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /same branch/);

    assert.equal(invoke([file, "--council", "--council"]).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


// PR review round 1 (#339): everyday dev wording must not hold, and the destructive and
// outbound wording the first lists missed must.
const MUST_PASS = [
  "fix the delete endpoint", "add a delete button", "delete key handler", "send a request to the server",
  "send email validation", "publish the type definitions", "publish eslint config", "pay attention to errors",
  "ship the feature flag code", "merge the two arrays in the util", "push the button in the UI", "submit button",
  "dm", "게시판 글 목록", "전송 속도 개선", "결제: 모듈 정리", "make sure not to deploy", "dont merge",
  "cant publish yet", "merge is not allowed", "deploy is out of scope",
];
const MUST_HOLD = {
  destroy: ["destroy the environment", "destroyed caches", "clear the npm cache"],
  send: ["sent the summary", "emailed summary"],
  pr: ["gh pr create --fill"],
  merge: ["gh pr merge 12", "land the changes", "do not forget to merge the PR"],
  release: ["gh release create v2"],
  deploy: ["upload to prod", "release it to production"],
};

test("everyday dev wording does not hold", () => {
  for (const phrase of MUST_PASS) assert.deepEqual(outboundMentions(phrase), [], phrase);
});

test("destructive and outbound wording the first lists missed holds", () => {
  for (const [category, phrases] of Object.entries(MUST_HOLD))
    for (const phrase of phrases)
      assert.ok(outboundMentions(phrase).some((m) => m.category === category), category + ": " + phrase + " -> " + JSON.stringify(outboundMentions(phrase)));
});

test("authority.outbound refuses inherited names and repeated entries", () => {
  for (const outbound of [["toString"], ["constructor"], ["deploy", "deploy"]]) {
    const p = lane("x"); p.authority = { outbound };
    const r = validateLanePacket(p);
    assert.equal(r.ok, false, JSON.stringify(outbound));
    assert.doesNotMatch(r.errors.join(" "), /native code/);
  }
});

test("councilLane refuses a packet without a lane id with a contract error", () => {
  assert.throws(() => councilLane({ work: { objective: "x" } }), /validated packet/);
});
