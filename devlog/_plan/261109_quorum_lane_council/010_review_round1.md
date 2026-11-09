# 261109 Lane council: PR review round 1 fixes

Previous D (090_done.md): council shipped in PR #339 at 84982d3, CI green; the open risk
was lexical precision. The fresh PR reviewer (GOAT task quorum-council-pr-review-1,
hyds/deepseek-v4.1-flash-1m) confirmed it: GO-WITH-FIXES (blockers=2), both in the CSO
word lists. This cycle folds the findings; direction unchanged.

## Loop spec

- Archetype: satisfy-spec repair, one work-phase. Trigger: PR review findings 1-14.
- Goal: everyday dev wording from the review no longer holds; the missed destructive and
  outbound wording holds; both pinned as adversarial tests.
- Non-goals: semantic matching, LLM critics, new categories.
- Verifier: `node --test plugins/codexclaw/test/lane-council.test.mjs` (new adversarial
  tests red on 84982d3, green after), `lane-packet.test.mjs`, `gate.mjs`,
  `check-prompt-architecture.mjs`, hosted CI on the new head.
- Stop: fixes pushed to PR #339, same reviewer re-checks closure. Memory: this doc.
- Escalation: any change to exit codes or the non-council output.

## Dispositions

| # | Finding | Disposition |
|---|---|---|
| 1 (High) | FPs: delete endpoint/button/key, send a request, send email validation, publish type definitions/eslint config, pay attention, ship the feature flag code, merge the two arrays, push the button, submit button, bare dm, 게시판, 전송 속도 | fold: an English code-object guard after the ambiguous verbs (merge, push, deploy/ship, publish, send, submit, destroy/delete, pay): the next one to three words must not reach a code noun (endpoint, button, key, handler, request, validation, array, type, config, attention, flag ...); dm needs a target; KO guard gains 판, 물, 속도, 목록, 상태 ... and tolerates ":" between the words |
| 1 | "clear the npm cache" holds | rebut: cxc-dev Safety Rules list cache clearing as Destruction (ESCALATE) — `skills/dev/SKILL.md` "Destruction (ESCALATE): explicit approval for file deletion/table drops/state resets/cache clearing" |
| 1 | "ship a feature" holds | keep: shipping a feature to users is a release; the guard covers "feature flag code" |
| 2 (High) | FNs: destroy, sent, emailed, gh pr create, gh release create, land the changes, upload to prod | fold: destroy verb forms, sent, emailed, `gh pr create/merge`, `gh release create`, land + changes/commits, upload/release ... to prod/production/staging/npm |
| 3 | negation precision | fold: "not to", apostrophe-less contractions (dont, cant, wont), post-positive "is not allowed/forbidden/out of scope"; double negation left as is |
| 4 | tests mirror patterns | fold: adversarial lists from findings 1-3 pinned both ways |
| 5 | containment length and Quorum threshold undocumented | fold into the lane-dispatch table |
| 6 | `in FIELD_DECLARED` walks the prototype | fold: `Object.hasOwn` |
| 7 | councilLane TypeError on a packet without lane | fold: explicit contract error |
| 8 | re-validation per lane | rebut: `validateLanePacketSet` does not expose per-lane `resolved.mode`; calling the same pure validator keeps one source of truth |
| 9 | plan D1 names councilLaneSet | fold |
| 10 | force-push gives push and destroy | rebut: both declarations are needed (cxc-dev lists push and force push separately); one question per set is unchanged |
| 12 | "결제: 모듈" | fold (colon tolerated) |
| 13 | duplicate outbound entries | fold: refused |
| 11, 14 | QA inert; contractions | 11 already documented; 14 folded under 3 |


## Architect and audit

No design decision (D1-D9: module role, data shape, interface, flow) changes; this cycle
tunes rule data and adds tests, so the architect is not reinvoked (phase-audit.md,
"Architect recheck after audit amendments"). The audit input is the PR review itself;
its closure is re-checked by the same reviewer after the fixes (DISPATCH-ACTOR-01).

## Result

Red first: the four new tests failed on 84982d3 (16 tests, 4 fail). Green at 0cedf470:
`lane-council.test.mjs` 16/16, `gate.mjs` OK, `check-prompt-architecture.mjs` OK, smoke set
unchanged (exit 2, same two holds). One adjustment during B: `step` left the code-noun list
because it suppressed "never skip the deploy step", and `submit` uses a next-word guard so
"submit the application form" still holds while "submit button" does not.

Still true: matching is lexical. The guard trades a class of false holds for misses where a
real action's object happens to be a code noun within two words ("send the error report
to the vendor" passes). Closure goes back to the same reviewer.
