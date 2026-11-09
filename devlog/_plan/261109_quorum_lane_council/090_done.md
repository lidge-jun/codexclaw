# 261109 Lane council: done record

## Conclusion

`check-lane-packet.mjs --council` gives every dispatch lane of a valid packet set four
deterministic role stances (CEO, Reviewer, QA, CSO) and a pass/hold/reject verdict. Issue
#338. One work-phase, single PABCD cycle.

## Evidence (head 96e8d27a plus this record)

- Red first: `node --test plugins/codexclaw/test/lane-council.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` for `scripts/lane-council.mjs` before the module existed.
- Green: the same file, 12 tests, 12 pass, exit 0.
- `node plugins/codexclaw/scripts/gate.mjs` OK; `check-prompt-architecture.mjs` OK;
  `sync-readme-badges.mjs` ok on all three READMEs; `npm run build` exit 0.
- `npm test`: 3890 tests, 3883 pass, 5 skipped, 2 fail. Both failures belong to this
  machine: `gui/test/router.test.ts` cannot resolve `react` (GUI dependencies not
  installed in this worktree), and `lane-packet.test.mjs` "a drifted value is reported
  as drift" fails identically on `origin/dev` with this change stashed (it reads a
  local host artifact). Hosted CI is the authority for both.
- CLI smoke on a four-lane set: exit 2, holds the reworded CI-flake lane (83% similar)
  and the docs lane that says "deploy" without declaring it; "do not merge" in the same
  objective is ignored; the release lane that declares release and publish passes. The
  same set without `--council` prints OK and exits 0.

## What did not improve, and what would refute the direction

- Lexical similarity cannot see semantic duplicates: two measured pairs that describe the
  same investigation in different words scored 0.58 and 0.765 and pass. If coordinators
  mostly duplicate work in different words, the Reviewer stance adds little and an LLM
  critic (out of scope here) is the next step.
- The CSO reads packet fields only. Outbound wording placed elsewhere in a creation
  prompt escapes it; that is documented under Known limitation.
- If real fan-outs show frequent false holds on code wording ("fix the delete endpoint",
  "payment form"), the category lists need a narrower verb grammar; the stable rule ids
  and `RULES_VERSION` exist so that change is visible.

