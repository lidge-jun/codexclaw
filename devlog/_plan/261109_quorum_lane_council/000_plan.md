# 261109 Lane council: role stances before a lane fan-out (Quorum)

A coordinator that fans work out across lanes today learns only whether each packet is
coherent: lane id, branch and write-scope collisions, loop and merge authority. Nothing
asks whether two lanes chase the same objective under different branches, or whether a
lane's objective tells it to deploy, publish, send, destroy or pay when nobody declared
that action. This unit adds an opt-in `--council` preflight to
`check-lane-packet.mjs`, after [Quorum](https://github.com/tryquorum/quorum): four
deterministic role stances (CEO, Reviewer, QA, CSO) give each dispatch packet a
pass, hold or reject before creation. Coordinators get one list of lanes to rewrite and
one question for the user instead of discovering the overlap or the outbound action
after lanes have run.

## Loop spec

- **Loop archetype:** satisfy-spec, single work-phase (C3: public script contract plus a
  skill reference rule).
- **Trigger:** owner request (2026-11-09) to contribute Quorum's council idea to
  codexclaw with one issue and one implementation PR to `dev`.
- **Goal:** `node plugins/codexclaw/scripts/check-lane-packet.mjs <set.json> --council`
  prints a per-lane verdict with role stances and exits 0 (all pass), 2 (some hold) or
  1 (invalid or some reject).
- **Non-goals:** verdict memory reuse (codexclaw approvals are per person and per
  session; a fuzzy match must never stand in for one); LLM critic dispatch (A-phase and
  C-phase reviewers already own judgment); intercepting `create_thread` (no hook);
  merging, releasing, deploying.
- **Verifier:** `node --test plugins/codexclaw/test/lane-council.test.mjs` red before
  the module exists, green after; `node --test plugins/codexclaw/test/lane-packet.test.mjs`
  unchanged green; `npm run build`, `npm test`, `node plugins/codexclaw/scripts/gate.mjs`,
  `node plugins/codexclaw/scripts/check-prompt-architecture.mjs`.
- **Stop condition:** PR open against `dev` with the issue linked, reviewer round folded
  in, exact-head CI observed; merge stays with the maintainer.
- **Memory artifact:** this unit (`devlog/_plan/261109_quorum_lane_council/`), the issue
  and the PR description.
- **Expected terminal outcomes:** DONE with PR URL and head; NEEDS_HUMAN if CI fails for a
  reason outside this change.
- **Escalation condition:** any change to existing validator exit codes or accepted
  packets; anything that would need a hook.

## Placement

`plugins/codexclaw/scripts/check-lane-packet.mjs:1-21` already runs at the fan-out
point and `validateLanePacketSet` (`:184-207`) is the only place that sees every lane
together. `lane-dispatch.md` LANE-PACKET-01 documents it and its "Known limitation"
(`:153-156`): it neither intercepts dispatch nor enforces authorization. The council
keeps that tier (E7/E8, `structure/40_enforcement_methods.md`): an advisory preflight
the coordinator runs and follows.

## Design decisions (architect proposal 01a1be8f, dispositions)

| ID | Decision | Disposition |
|---|---|---|
| D1 | Pure module `scripts/lane-council.mjs` (`councilLane`, `councilLanes`; the CLI entry is `councilLanePackets` in check-lane-packet.mjs), no I/O; CLI validates first, invalid exits 1 before the council | accept |
| D2 | Only `dispatch` packets receive verdicts; `pending`/`bound` lanes already exist and are reported `not-evaluated`, but they are Reviewer peers: a dispatch lane is compared with every created lane and with the dispatch lanes before it | accept (audit M2 wording) |
| D3 | `{lane, decision, stances[{role, stance, rule, reason}]}` plus `rulesVersion`; stable rule ids | accept |
| D4 | `authority.outbound` is validated by `validateLanePacket`: known categories only; `merge`, `push`, `pr` refused there because `authority.merge/push/openPr` own them | accept |
| D5 | Wording says *declared*, never *granted*; pass means "no hold found" | accept |
| D6 | any cut -> reject, else any escalate -> hold, else pass; the set reports all holds together so the user is asked once | accept |
| D7 | exit 0/1 unchanged; 2 only with `--council` and a hold | accept |
| D8 | Reviewer compares within the set: exact normalized objective -> cut; near -> escalate | amend: threshold 0.8 plus containment (see below), not 0.9 |
| D9 | unclear outbound wording escalates | accept |

Architect conflicts folded: CEO and QA never cut a packet the contract accepts (non-loop
lanes need no objective or criteria, `lane-dispatch.md:32,47`): CEO escalates a missing
objective on a non-loop dispatch lane; QA keeps and names the field that defines done.
Destruction categories follow cxc-dev Safety Rules (file deletion, drops, resets, cache
clearing, force push), and push/PR wording is checked against `authority.push`/`openPr`.

D8 amendment, measured with Quorum's `similarity` (character-bigram Dice on the
normalized text): distinct slices scored 0.69-0.72 ("Fix Windows CI for recall" /
"for state-cli"), 0.625, 0.852 ("link-criterion" / "add-criterion"); reworded copies
0.825, 0.892, 0.923. No lexical threshold separates them cleanly. 0.8 holds every measured
copy and one distinct pair (0.852), which costs a coordinator one rewrite; a hold is cheap
and a missed duplicate is the failure this exists for. (The first draft said 0.85, which
would have let the 0.825 copy through.) Containment (one normalized
objective inside the other, shorter >= 12 chars) also holds ("Update README badges" /
"... for test count"). Semantic duplicates below that (0.58, 0.765) remain for reviewers.

## Rules (RULES_VERSION 1)

- **CEO** — `CEO-NO-OBJECTIVE` escalate: dispatch lane without `work.objective`.
  Otherwise keep.
- **Reviewer** — `REVIEWER-DUPLICATE` cut: normalized objective (NFC, lowercase,
  whitespace/punctuation/symbols removed, >= 4 chars) equals an earlier lane's.
  `REVIEWER-NEAR-DUPLICATE` escalate: Dice >= 0.8 or containment. Otherwise keep.
- **QA** — keep; reason names `work.criteria` when present, else `reporting.evidence`
  (the validator already refuses a loop without criteria and any lane without evidence).
- **CSO** — scan `work.objective` and `work.criteria`, code spans included ("run
  `npm publish`" is an instruction; the architect suggested skipping them, rejected).
  Categories and their declaration:
  `merge` (authority.merge), `push` (authority.push), `pr` (authority.openPr),
  `deploy`, `release`, `publish`, `send`, `destroy`, `pay` (authority.outbound).
  Undeclared match -> `CSO-OUTBOUND-<category>` escalate. English negation directly
  before the verb ("do not", "never", "without", ...) and Korean negation directly after
  it ("하지 마", "금지", "않") suppress that one match only; any other un-negated match in
  the same text still escalates. Word boundaries keep camelCase identifiers out.

## File map

| Path | Change |
|---|---|
| `plugins/codexclaw/scripts/lane-council.mjs` | new pure module |
| `plugins/codexclaw/scripts/check-lane-packet.mjs` | `authority.outbound` validation; `--council` flag, exit 2, text/json output |
| `plugins/codexclaw/test/lane-council.test.mjs` | new tests (red first) |
| `plugins/codexclaw/skills/loop/references/lane-dispatch.md` | LANE-COUNCIL-01 section, `authority.outbound` field row, limitation update |
| `structure/INDEX.md` | one sentence on the council next to the validator paragraph |
| `CHANGELOG.md` | Unreleased / Added |

Field chain for `authority.outbound`: creation = coordinator writes the packet JSON;
serialization = packet file / create_thread prompt; deserialization = `JSON.parse` in the
CLI; consumers = `validateLanePacket` (type/known-category check) and `councilLane`
(declared categories). No other consumer.

Enforcement bypass fields: tier E7/E8 advisory script; executing surface = coordinator
runs the CLI; known bypass = not running it, or wording the prompt outside the packet;
residual risk = lexical false negatives/positives listed above; wording downgrade = the
reference says "preflight", never "gate" or "only survivors run"; final enforcement layer:
none.


## Architect reflection (same architect 01a1be8f): ALIGNED, gaps and dispositions

1. `authority.outbound` is validated without `--council` too. Intended: the field is new,
   so no existing packet carries it; a malformed one should fail like any other malformed
   authority field. Packets without it are unchanged.
2. Mixed sets: `pending` and `bound` lanes are Reviewer peers (a dispatch lane repeating
   a created lane is the main duplicate case) but are themselves `notEvaluated`.
3. Single packet with `--council`: same `council` shape with one verdict; Reviewer keeps
   with rule `REVIEWER-NO-PEERS`.
4. Word lists pinned in tests per category, EN+KO, plus false-positive cases: "release
   notes", `mergeLanes`, "merge conflicts", "결제 모듈 리팩터". Korean nouns followed by a
   code noun (모듈, 기능, 화면, 로직, 코드, 버그, 테스트, 페이지, 버튼, API ...) are not actions.
5. Negation is per match: "배포하지 않고 머지" negates deploy and still escalates merge.

## Audit round 1 (hyds/deepseek-v4.1-flash-1m, GOAT task quorum-council-plan-audit-1): GO-WITH-FIXES (blockers=11)

| # | Finding | Disposition |
|---|---|---|
| H1 | Quorum's OUTBOUND also covers submit, apply, transfer, dm, 제출, 신청 | folded: `send` adds submit (not "submit a PR", which is `pr`), "apply for", dm, 제출, 신청; `pay` adds "transfer funds/money/payment". Bare "apply" is dropped on purpose: "apply the patch" is everyday lane wording |
| H2 | false-positive exclusions not specified | folded, see Matching contract |
| H3 | `authority.outbound` schema unspecified | folded: optional array of nonempty strings, each one of deploy, release, publish, send, destroy, pay; merge/push/pr refused with the field that owns them; an empty array is valid; not added to `resolved` (its shape is pinned by an existing deepEqual) |
| H4 | no CLI-level verification | folded: spawn cases in `lane-council.test.mjs` for exit 0/2/1, `--json` shape, duplicate `--council`, invalid set, and unchanged output without the flag |
| M1 | CEO hold on every non-loop lane without an objective | rebutted: the council is opt-in and exists to compare objectives; a lane without one cannot be compared, so a hold is the honest answer. It is a coordinator fix (write the objective), not a user question; the reference says so |
| M2 | D2 vs reflection 2 | folded into D2 |
| M3 | serialization stage missing | folded: LANE-PACKET-01's field table gains `authority.outbound`, so the field travels in the creation prompt like the other authority fields |
| M4 | output contract | folded, see Output contract |
| M5 | negation window | folded, see Matching contract |
| L1 | usage/header | folded: header and usage string list `--council` and exit 2 |
| L2 | rule-id placement | folded: LANE-COUNCIL-01 is defined once, as a heading in `lane-dispatch.md` |

Main judgment: near-pass. Every High finding is folded as a concrete contract below; the one
rebuttal is Medium with its basis stated.

### Matching contract

- Text is NFC-normalized. English patterns use word boundaries, so camelCase identifiers
  (`mergeLanes`, `publishConfig`) never match; verbs that double as nouns carry
  negative lookaheads ("merge conflicts/sort/queue/base", "push notifications"); "release"
  matches only after cut/publish/tag/create/draft/make, or as `git tag` / "tag v1".
- A Korean action noun followed by a code noun (모듈, 기능, 화면, 로직, 코드, 버그, 테스트,
  페이지, 버튼, 흐름, 폼, 내역, 로그, 설정, 스크립트, 단계, 노트, 문서, 알림, API) is not an action.
- Negation is per match. English: the 40 characters before the match must end in a
  negation (do/does/must/should/will/can not, don't, never, not, without, no, avoid) followed
  only by whitespace. Korean: the 24 characters after the match must start with an optional
  particle and 하지/지 + 마/말/않, 금지, 안 함/해/한다, or 하면/해서는 안 돼. A category escalates
  when any one of its matches is not negated.

### Output contract

- Without `--council`: byte-identical output and exit codes.
- With `--council`: validation runs first (honouring `--mode`); invalid -> errors on
  stderr, exit 1, no council. Valid -> the existing JSON envelope (`{ok, errors, lanes}` or
  `{ok, errors, resolved}`) plus `council: {rulesVersion, verdicts[{lane, decision,
  stances[{role, stance, rule, reason, ...}]}], pass[], hold[], reject[], notEvaluated[]}`.
  Text mode prints a summary line and one line per non-pass lane on stdout. Exit 1 on any
  reject, else 2 on any hold, else 0.
