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
| A4 | RESOLVED (L17) | ~~`interview/SKILL.md:25-32`: `PostToolUse` auto-capture is "planned runtime / until that runtime lands"~~ | FIXED 2026-06-30: `interview/SKILL.md` now carries a "Runtime Status (shipped)" section; `cli.ts:81-90` + `hook.ts:419-439` confirm `post-tool-use` dispatches to `handlePostToolUse` and captures `request_user_input` results |
| A5 | RESOLVED (L17) | ~~`pabcd/SKILL.md:16`: interview trigger covers "요구사항 정리", "스펙 정리해줘", "any variation"~~ | FIXED 2026-06-30: `pabcd/SKILL.md` Interview Trigger now splits **hook auto-trigger** (narrow: `interview`/`인터뷰`/`orchestrate i`, matching `detectTrigger()` `hook.ts:64-75`) from **agent judgment** (broad phrasings). Doc-fix chosen over widening `detectTrigger` (Carson MED-risk: broad regex would mis-fire). |
| A6 | RESOLVED (L15+L16) | ~~`cxc-dev` routes to `dev-*` but no enforcement~~ | FIXED 2026-06-30: L16 made the dev routing table STRICT (DEV-ROUTE-01: MUST read the router before writing) and documented the E6 dev-only-implicit decision; L15 pre-loads the matching `cxc-*` skill as a subagent spawn attachment. Routing is now a STRICT main-agent rule + a subagent attachment, not weak prose. (No hook enforces skill load — `00_philosophy.md` §1 — so the main-agent side is self-enforced wording.) |

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
| C1 | PARTIAL (L15) | ~~`spawn-wrapper.ts` builder is test-only~~ | L15 added the skill-routing builder (`SURFACE_SKILL`, `buildSpawnItems`, `resolveSpawnPayloadWithSkills`) + tests. The builder is now the documented dispatch contract (E5); a `^spawn_agent$` PreToolUse caller (E3) is the L15.2 follow-up. Until that hook ships, the production caller is the main agent following the doctrine, not a hook. |
| A7 | RESOLVED (L17) | `hook.ts handleStop`: the autonomous Stop loop blocked any non-IDLE active-goal phase incl. `phase === "I"`, emitting an `I`-specific continuation block — contradicting "Stop never drives the Interview" (Noether verification audit, post-Carson) | FIXED 2026-06-30: added guard 2a' in `handleStop` (`hook.ts`): `if (state.phase === "I") return ""`. Stop now releases at phase=I under an active goal. Test `hook-continuation.test.ts` "L17 firewall: Stop NEVER drives an active-goal phase=I session" + interview/SKILL.md wording corrected. |
| C2 | RESOLVED (L17) | ~~`minds.ts:2` "5-Mind contradiction dispatcher surface" imported only by `test/minds.test.ts`~~ | FIXED 2026-06-30: `hook.ts:24` imports `MIND_DISPATCH_DIRECTIVE` from `minds.ts`; `interviewDirective()` (`hook.ts:126`) now emits the Mind-dispatch contract into the production Interview directive. Test `hook-continuation.test.ts:115` asserts the directive carries the contract. minds.ts is now on the live hook path (E4 directive). |
| C3 | DOCUMENTED (L17) | `triage.ts:2` "severity triage + assumption transition" | `triageContradiction`/`autoResolveToAssumption` are pure helpers the main session calls when acting on the Mind-dispatch directive (C2). Reachable-via-directive, not dead: the I-phase directive instructs the agent to triage rescan findings. Not hook-invoked by design (no host triage event); kept as documented helpers per `structure/30` honesty rule. |
| C4 | DOCUMENTED (L17) | `rescan-coordinator.ts:2` "interactive-interview signal helper" | Same as C3: rescan-coordinator computes the "more interview vs proceed" signal the agent surfaces at the end of a rescan. Reachable-via-directive (the Mind-dispatch contract references the rescan loop), not wired to `handleStop` by design — goal-active suppresses Interview entirely, so a Stop-time rescan would contradict the firewall. Documented helper. |
| C5 | RESOLVED (L14) | ~~`freeze.ts:124` `GOAL_ACTIVATION_DIRECTIVE` test-only~~ | FIXED 2026-06-30: now emitted by the production path `runFreeze` (`freeze-cli.ts`) when the interview is ready, surfaced via `cxc freeze` (`bin/codexclaw.mjs`) |
| C6 | LOW | `config-guard/src/cli.ts:18` exports `assertNotRealCodexHome` | imported only by `test/activate.test.ts:9` |
| C7 | LOW | `structure/INDEX.md` (pre-fix) "manifest wires five hook JSON files" | `plugin.json:20-26` declares six (adds `post-tool-use-capturing-interview-answers.json`) — fixed in INDEX 2026-06-30 |
| C8 | MED | build compiles every `src/*.ts` -> `dist/*.js` (`build.mjs:62,68,74`) and `.gitignore:2` ignores `dist/` | only a subset of `dist/` is git-tracked; several runtime `dist/*.js` that `bin`/`hook` load are untracked — packaging relies on a local build, not the repo |
| C9 | LOW | component test surface looks uniform | root `package.json:23` globs all test dirs, but only `config-guard`/`cxc-ops`/`pabcd-state` have a package-local `test` script; `provider-bridge`/`subagent-config` do not |
| C10 | LOW (flaky) | `subagent-config/test/mcp.test.ts:57` MCP stdio roundtrip assumed reliable | times out (~8s) when the full `npm test` runs concurrently with `npm run build` (process/IO contention). Single-file + standalone `npm test` runs are green (5/5, 332/332). Real but environmental; candidate for an explicit timeout or build/test serialization in the L18 gate work. |

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
