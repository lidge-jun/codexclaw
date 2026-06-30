---
created: 2026-06-30
tags: [codexclaw, contradiction, truth-table, drift, sot]
aliases: [Contradiction Register, codexclaw drift register, structure truth table]
---

# Contradiction Register (SOT)

> cli-jaw keeps a `CAPABILITY_TRUTH_TABLE.md` so claims never drift from code. This is
> codexclaw's equivalent: a single place that records where a *document claims* one
> thing and the *code/another doc* says another, with file:line evidence. It is the
> input to the L14 interview and to any future status-sync gate.
>
> Sourced from a 2026-06-30 three-agent read-only sweep (skill↔runtime, doc-status,
> code-structure). Each row is "claim (file:line) vs reality (file:line)". Resolving a
> row means making the surfaces agree, then deleting the row or marking it RESOLVED in
> the same change.

Severity legend: **HIGH** = false capability or false-DONE that misleads execution ·
**MED** = stale/contradictory status across surfaces · **LOW** = count/label drift.

---

## A. Skill claim vs runtime code (model-autonomy honesty)

| # | Severity | Claim | Reality |
| --- | --- | --- | --- |
| A1 | RESOLVED (L14) | ~~`loop/SKILL.md`, `goalplan/SKILL.md`: Stop re-enters next work-phase `P`~~ | FIXED 2026-06-30: `loop`/`goalplan`/`dev` SKILL now state the AGENT runs `cxc orchestrate P`; `handleStop` only blocks (`hook.ts:391-415`) |
| A2 | RESOLVED (L14) | ~~`loop/SKILL.md`: auto-advances `I -> P`~~ | FIXED 2026-06-30: docs state no auto-advance; the agent advances every phase via explicit command |
| A3 | RESOLVED (L14) | ~~`loop/SKILL.md`: Stop blocks only on "concrete pending work"~~ | FIXED 2026-06-30: loop SKILL now describes the coarse state-signal guard (goal + in-flight + stagnation), not a content check |
| A4 | HIGH | `interview/SKILL.md:25-32`: `PostToolUse` auto-capture is "planned runtime / until that runtime lands" | `cli.ts:81-90`, `hook.ts:419-439`: CLI already dispatches `post-tool-use` to `handlePostToolUse`, which captures `request_user_input` results — shipped, not planned |
| A5 | MED | `pabcd/SKILL.md:16`: interview trigger covers "요구사항 정리", "스펙 정리해줘", "any variation" | `hook.ts:64-75`: `detectTrigger()` I-branch matches only `interview`, `인터뷰`, `orchestrate i` |
| A6 | HIGH | `dev/SKILL.md:3,119-134`: `cxc-dev` routes to `dev-*` routers by surface | all `dev-*/agents/openai.yaml:5` are `allow_implicit_invocation:false`; only `dev/agents/openai.yaml:5` is `true` — no config-level auto-routing/loading exists |

Cluster verdict: the skill prose describes an *enforced* loop/interview runtime that the
hooks do not implement. This is the central L14 honesty gap (`20_pabcd_dispatch_doctrine.md`
§1, §4). Either wire the arming branches or downgrade the prose to guidance.

---

## B. Status drift across documents (false-DONE / split-brain)

| # | Severity | Surface A | Surface B |
| --- | --- | --- | --- |
| B1 | HIGH | `mvp_hard/000_INDEX.md:53`: L11 decision DONE / impl PLANNED | `110_L11_developer_docs_website.md:3`: Status DONE (while `:8` says "no docs-site scaffold shipped") |
| B2 | HIGH | `mvp_hard/000_INDEX.md:54`: L12 impl DONE | same INDEX `:63` and `README.md:49` and `roadmap.html:232`: L12 impl PLANNED |
| B3 | HIGH | `mvp_hard/000_INDEX.md:51`: L9 impl DONE | `090_L9...md:3` "parity plan only; runtime deferred" + `:58` "no runtime spawn wrapper implemented"; `README.md:49` L9 impl PLANNED |
| B4 | MED | `README.md:13`: production wrapper planned (L9 impl PLANNED) | `091_L9.1_spawn_wrapper.md:3`: Status DONE (shipped+tested) |
| B5 | MED | `structure/INDEX.md:180-181` (pre-fix): `cxc subagents`/`cxc provider` are stubs | `093_L9.3_operator_surface.md:3`: Status DONE (shipped+tested) — fixed in INDEX 2026-06-30; row kept for trace |
| B6 | MED | `100_L10...md:3`: Status DONE | same doc `:6` "docs-only decision pass"; `:19` lists `cxc chat-search` in-scope while `INDEX.md:82` says RETIRED |
| B7 | LOW | `110_L11...md:88`: live root commands include `chat-search` | `structure/INDEX.md`: `cxc chat-search` RETIRED |

Cluster verdict: L9/L11/L12 are the recurring false-DONE trio. The fix is the two-axis
status rule (`00_philosophy.md` §3): keep decision and impl on separate columns and never
let an INDEX impl-DONE outrun the loop doc's own "no runtime shipped" admission.

---

## C. Code / config structure (dead code, packaging, counts)

| # | Severity | Claim | Reality |
| --- | --- | --- | --- |
| C1 | HIGH | `spawn-wrapper.ts:2` "production spawn payload builder" | `resolveSpawnPayload` (`:123`) imported only by `test/spawn-wrapper.test.ts:16` — no production caller |
| C2 | MED | `minds.ts:2` "5-Mind contradiction dispatcher surface" | `MINDS`/`selectMinds`/etc. imported only by `test/minds.test.ts:3` |
| C3 | MED | `triage.ts:2` "severity triage + assumption transition" | `triageContradiction`/`autoResolveToAssumption` imported only by `test/triage.test.ts:3` |
| C4 | MED | `rescan-coordinator.ts:2` "interactive-interview signal helper" | exports imported only by `test/rescan-coordinator.test.ts:15`; never wired to `handleStop` |
| C5 | RESOLVED (L14) | ~~`freeze.ts:124` `GOAL_ACTIVATION_DIRECTIVE` test-only~~ | FIXED 2026-06-30: now emitted by the production path `runFreeze` (`freeze-cli.ts`) when the interview is ready, surfaced via `cxc freeze` (`bin/codexclaw.mjs`) |
| C6 | LOW | `config-guard/src/cli.ts:18` exports `assertNotRealCodexHome` | imported only by `test/activate.test.ts:9` |
| C7 | LOW | `structure/INDEX.md` (pre-fix) "manifest wires five hook JSON files" | `plugin.json:20-26` declares six (adds `post-tool-use-capturing-interview-answers.json`) — fixed in INDEX 2026-06-30 |
| C8 | MED | build compiles every `src/*.ts` -> `dist/*.js` (`build.mjs:62,68,74`) and `.gitignore:2` ignores `dist/` | only a subset of `dist/` is git-tracked; several runtime `dist/*.js` that `bin`/`hook` load are untracked — packaging relies on a local build, not the repo |
| C9 | LOW | component test surface looks uniform | root `package.json:23` globs all test dirs, but only `config-guard`/`cxc-ops`/`pabcd-state` have a package-local `test` script; `provider-bridge`/`subagent-config` do not |

Cluster verdict: the dead-code rows (C1-C6) are mostly the *same* L14 story — wrappers,
minds/triage/rescan helpers, and the goal-activation directive were built as tested pure
functions but never wired into a production path. They are not waste to delete; they are
the staged pieces L14 is meant to connect. C8 is a real packaging/deploy contract gap
(the cli-jaw "dist is what runs, not src" lesson) and deserves its own decision.

---

## How to use this register

1. Before marking any loop DONE, scan this file for an open row touching that loop.
2. When you resolve a contradiction, edit both surfaces in the same commit and update or
   remove the row here.
3. A future status-sync gate (`20_pabcd_dispatch_doctrine.md` §7) should mechanize rows
   in clusters B and C7/C9.
4. Cluster A and C1-C6 feed directly into the L14 interview — they are the contradictions
   to surface to the user as questions before implementing.
