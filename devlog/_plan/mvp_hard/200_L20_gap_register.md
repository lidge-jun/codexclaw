# L20 / 200 — L1-L19 Gap Register (full-span sweep) + remediation loops

Status: DONE (gap scan + all 7 remediation work-phases shipped + tested) · 2026-06-30 · mvp_hard loop L20 · class C3

> Source: 5 parallel read-only gap-scan subagents (gpt-5.4) over L1-L19 deliverables —
> Pasteur (L1-L7), Leibniz (L8-L10), Raman (L11-L13), Halley (L14-L19 + register residue),
> Pauli (cross-cutting: doctrine↔code, dist/src, test coverage, GUI, MCP, provider).
> DONE = fully implemented + tested. Website (L11 impl), README, docs-site, logo dirs are
> user-owned and OUT of scope (do not touch).

## Gap table (ranked; G* = remediation id)

| G | Sev | Type | Location | Gap |
|---|-----|------|----------|-----|
| G1 | RESOLVED (WP1) | code bug | `components/pabcd-state/src/orchestrate-cli.ts` D path | FIXED 2026-06-30: CLI `D` now closes to IDLE (single `clearedIdle` write + single `done` C->IDLE ledger) after the C->D attest gate. Test "G1: C->D ... CLOSES to IDLE". |
| G2 | RESOLVED (WP1) | code bug | `components/pabcd-state/src/orchestrate-cli.ts` mutating path | FIXED 2026-06-30: explicit `--session <unknown>` on a mutating verb is refused (`RESERVED_SESSION_KEYS={cli}` + file-exists check); no divergent session minted. Tests "G2: unknown id refuses", "existing works", "cli bootstrap". |
| G3 | RESOLVED (WP2) | code bug (latent) | `components/pabcd-state/src/state.ts` `readInterviewEvents()` | FIXED 2026-06-30: now filters to `SCAN_EVENT_KINDS` + structural fields; Q/A rows in the shared ledger are skipped, not misread. Kepler A-gate: bug was real at the API boundary but LATENT — gates read `tracker.scanRounds` (not this reader), and the only caller was a test. Fix prevents corruption when a future consumer reads it. Test "G3: mixed ledger returns scan-only". |
| G4 | RESOLVED (WP3) | wiring/claim | `components/subagent-config/src/spawn-wrapper.ts` | FIXED 2026-06-30 (honesty): `dev/SKILL.md:131` reworded — the builder CAN attach skills only WHEN the dispatcher routes through `resolveSpawnPayloadWithSkills` (E5 doctrine), no auto hook yet. E3 feasibility (Curie): a `^spawn_agent$` PreToolUse `updatedInput` rewrite works ONLY on the v1 spawn surface; MultiAgentV2 spawn has `deny_unknown_fields` and no `items`, so injecting items fails parse. E3 stays DEFERRED (not durable across v1/v2); recorded as G4-followup. |
| G5 | RESOLVED (WP4) | wiring | `components/subagent-config/src/catalog.ts` `readNativeCacheDefault` | FIXED 2026-06-30 (user-steered): the real gap was the cache reader hard-filtering to 4 `NATIVE_OPENAI_MODELS`, DROPPING the routed `provider/model` slugs opencodex syncs into the codex config cache. Now admits routed slugs (contain "/") + labels them `ocx`. codexclaw reads codex config (never calls ocx live) — matches user intent "read opencodex's synced config, don't dynamically detect ocx". mcp.ts:9 + catalog_list docs corrected. |
| G6 | RESOLVED (WP4) | doc/correctness | `gui/src/server/handlers.ts` | FIXED 2026-06-30: GUI already wires `detectOcx()` mode; `ocxModels: undefined` on the provider input is CORRECT by design — ocx models arrive via the native cache (opencodex→codex config sync), not a live ocx call. Reworded the stub comment to state this. The catalog reader fix (G5) is what actually surfaces ocx-synced models. Not a live-HTTP gap. |
| G7 | RESOLVED (WP5) | gate gap | `scripts/gate.mjs` checkForbiddenClaims | FIXED 2026-06-30: scan now covers `structure/*.md` (declared SOT) in addition to `skills/**/SKILL.md`. Added line-local NEGATION + META exemptions so denied claims ("No hook enforces skill load") and cited examples are not false-flagged. Kant A-gate confirmed the only 2 live structure hits are both negation/meta. Tests: "SCANS structure/*.md and FIRES", "does NOT flag NEGATED or META". |
| G8 | RESOLVED (WP6) | doc/SoT | `000_INDEX.md:68` | FIXED 2026-06-30: prose now reads "L2-L10 and L12 are impl-DONE (L9 via 091/092/093, L12 via 121/122); L11 is decision-DONE/impl-PLANNED". Matches the ledger rows. Cicero (gpt-5.4) A-gate confirmed only L11 is DONE\|PLANNED. |
| G9 | RESOLVED (WP3) | false-claim | `dev/SKILL.md:3` frontmatter | FIXED 2026-06-30: "enforces" → "defines … (agent-followed, not hook-enforced)". Hubble confirmed no E1/E2/E8 backs skill-load; honest E7 wording now. |
| G10 | RESOLVED (WP6) | stale doc | `122_L12.2...md:87` | FIXED 2026-06-30: row reworded to "Pending question detected (pure helper) → hasPendingInterviewWork pending:true (NOT a Stop block — handleStop releases at phase=I)". Matches `hook.ts:419` and the same table's "handleStop unchanged" row. |
| G11 | RESOLVED (WP6) | stale doc | `structure/INDEX.md:197` CLI Surface | FIXED 2026-06-30: added the `cxc freeze` row (delegates to pabcd-state CLI; writes `.codexclaw/interview/freeze.json`). |
| G12 | RESOLVED (WP6) | stale doc | `structure/INDEX.md:219` | FIXED 2026-06-30: State Model tree now includes `interview/freeze.json` + `interviews/<sessionId>.jsonl`, with a prose paragraph describing each (freeze.ts / interview-ledger.ts). |
| G13 | RESOLVED (WP6) | stale doc | `100_L10...md:64,79` | FIXED 2026-06-30: chat-search row marked RETIRED; dead `chat-search.ts` anchor marked REMOVED; `transition.ts` source anchor corrected to `fsm.ts`+`appendLedger()`; verification contract now asserts chat-search is GONE (`! rg 'case "chat-search"'`, `test ! -f .../chat-search.ts`) instead of invoking it. Assertions pass. |
| G14 | RESOLVED (WP6) | stale doc | `110_L11...md:82,99,100,102,121,350` | FIXED 2026-06-30: "Live root commands" now lists `freeze`/`subagents`/`provider`; placeholder list reduced to L11 website + L20 packaging with a "shipped since" note (091/092/093, 121/122); state-reality list adds the two interview paths; the ":350" history snapshot annotated as superseded. |
| G15 | RESOLVED (WP6) | stale doc | `132_L13.2...md:22,26,44` | FIXED 2026-06-30: L9/L12 lines annotated "DONE\|PLANNED at this L13 pass — SINCE SHIPPED to DONE\|DONE (091/092/093, 121/122)"; §4 corrected to note `roadmap.html` EXISTS (Cicero flagged the absent-premise) and only L11 keeps IMPL PLANNED; §5 stale `Status: P` claim annotated as already-fixed history. roadmap.html badges + counters updated (L9/L12→DONE; done 37→39, planned 4→2). |
| G16 | RESOLVED (WP6) | doc/INDEX | `000_INDEX.md:45` | FIXED 2026-06-30: L3 row now "hook wiring via `applyHumanTransition()`". Also fixed the same overclaim in `031_L3.1...md:7` (chat path described as `applyHumanTransition()`, not `transition()`) — Cicero additional finding. |
| G17 | RESOLVED (WP3) | stale doc | `skills/loop/SKILL.md` + `skills/goalplan/SKILL.md` | FIXED 2026-06-30: reworded to "the hook does not move phases AUTONOMOUSLY; it persists a transition only in response to an explicit chat orchestrate command". Matches handleUserPromptSubmit→applyHumanTransition. |
| G18 | RESOLVED (WP3) | stale doc | `skills/pabcd/SKILL.md:96` | FIXED 2026-06-30: now "shipped append-only Interview Q/A capture ledger, written by the PostToolUse request_user_input hook". |
| G19 | RESOLVED (WP7) | test gap | hooks/*.json (5 of 6) | FIXED 2026-06-30: new `test/hook-e2e.test.mjs` drives all 6 manifest hook entrypoints through their real dist command (`cli.js hook <event>`) with deterministic payloads + env (CODEX_HOME=temp empty for the goal-DB read, controlled PATH for provider) — stop no-op release, goal-budget allow+deny, interview-in-goal allow, post-tool-use ledger side-effect, provider exit0+status line, plus a manifest→dist resolve check. Aristotle (gpt-5.4) A-gate supplied the contracts. 6 tests, deterministic standalone. |
| G20 | RESOLVED (WP8) | test gap | `orchestrate-cli.test.ts` | FIXED 2026-06-30: WP1 added `--session` refusal + D-close + cli-bootstrap; WP8 closed the residual ungated-edge coverage — IDLE->I entry, abort-to-I (P/A/B->I), illegal I->B refusal, and the I->P interview-flag contract (refused without a ready interview tracker, advances with one). The earlier "folded into WP7" note was inaccurate (WP7 added hook e2e, not CLI edge coverage); corrected here. 4 tests, 366/366 green. |
| G21 | RESOLVED (WP5) | tracking | `190...md:52` (src↔dist freshness) + `180...md:46` (C10 mitigation) | FIXED 2026-06-30: promoted both prose follow-ups to tracked, ranked rows F1/F2 (see "Tracked follow-up debt" section), each routed to WP7. F2≡G23 (cross-linked). |
| G22 | RESOLVED (WP7) | residue | `config-guard/src/cli.ts:18` (C6) | FIXED 2026-06-30: removed the dead prod export and relocated the guard into `config-guard/test/activate.test.ts` as a local helper (prod `main()` is meant to operate on the real `~/.codex`, so the guard has no prod caller — Aristotle confirmed). |
| G23 | RESOLVED (WP7+WP9) | residue | `subagent-config/test/mcp.test.ts:26` (C10) | FIXED 2026-06-30: WP7 raised the per-test MCP stdio kill-timer 8s→30s and hardened hook-e2e with settle-retry dist snapshots. WP9 then fixed the ROOT cause Maxwell's audit exposed: `npm test` ran test files in PARALLEL workers while build.test.mjs rebuilds (rmSync+recompile) the shared committed `dist/` 7×, so sibling readers (packaging.test.mjs, hook-e2e) caught the deleted window. Added `--test-concurrency=1` to the test script so files run sequentially — 8 consecutive full-suite runs green (was flaky ~1/3). |

## Tracked follow-up debt (G21 — promoted from prose to actionable rows)

These were buried as one-off prose in earlier loop docs. Promoted here so they are tracked,
ranked, and routed to a real work-phase (not lost). Each carries its origin and target WP.

| F | Sev | Origin (file:line) | Actionable item | Routed to |
|---|-----|--------------------|-----------------|-----------|
| F1 | RESOLVED (WP10) | `190_L19_dist_packaging_contract.md:52` | FIXED 2026-06-30: new `test/dist-freshness.test.mjs` recomputes each git-TRACKED dist file in-memory via build.mjs's newly-exported pure `compileSource` and asserts byte-equality with the committed file — a stale or missing committed dist fails CI. Read-only (no rebuild), so immune to C10. Negative control verified (fails on injected drift, passes after restore). 367/367 green. | WP10 |
| F2 | RESOLVED (WP7+WP9) | `180_L18_enforcement_gate.md:46` | FIXED 2026-06-30 (= G23): per-test MCP stdio timeout raised 8s→30s; hook-e2e uses settle-retry dist snapshots; and WP9 added `--test-concurrency=1` so test files no longer rebuild the shared `dist/` in parallel. The "run build and test separately" contract still holds for the byte-identical idempotency check. | WP7+WP9 (= G23) |

> Note: F2 and G23 are the same defect; G23 stays the canonical row, F2 records the prose origin
> so the `180...md:46` follow-up is no longer orphaned. F1 complements G19 (test coverage).

## WP6 extra findings (Cicero A-gate, folded into the WP6 fix)

The A-gate explorer surfaced contradictions beyond G8/G10-G16, all in the same doc set; fixed in WP6:

- `000_INDEX.md:117` — L9 prose said operator CLI/provider surfaces "remain deferred runtime work";
  reworded to "shipped + tested (091/092/093, `cxc subagents`/`cxc provider`)".
- `000_INDEX.md:155` — said answer capture "will use PostToolUse" and "Stop guard blocks pending/high
  I-phase work"; reworded to "shipped via PostToolUse; Stop releases at phase=I (block guard dropped)".
- `031_L3.1...md:7` — chat path described as `transition()`; corrected to `applyHumanTransition()`.
- `132_L13.2...md:44` — claimed `020/030/031/040` say `Status: P`; those headers are now `DONE`,
  so the line is annotated as historical drift, already fixed.
- `roadmap.html` — L9/L12 carried stale `IMPL PLANNED` badges; corrected to `DONE` + counters synced.

## WP9 residual fixes (Maxwell completion-audit, gpt-5.4)

An adversarial completion audit found three live contradictions left by the WP6 sweep + the
C10 root cause; all fixed in WP9:

- `roadmap.html:217` — L3 row still said "hook wiring to transition()"; corrected to
  `applyHumanTransition()` (the G16 fix had missed this third surface).
- `roadmap.html` L20 row — was a stale "Install/deploy hardening … ANALYZED | IMPL PLANNED"
  backlog row contradicting the INDEX `L20 | DONE | DONE`; replaced with the actual gap-register
  remediation row (DONE) and the summary counters reconciled (done 39→41, planned 2→1, ANALYZED 1→0).
- `132_L13.2…md:53` — acceptance criteria still asserted "No surface claims impl-DONE for
  L9/L11/L12"; annotated as the historical WP3 snapshot (L9/L12 runtime since shipped).
- C10 root cause — `--test-concurrency=1` added to the `npm test` script (see G23).

## Remediation work-phase plan (each = 1 full PABCD cycle)

- **WP1 (G1, G2, G20):** orchestrate-cli correctness — D closes to IDLE on the CLI path;
  `--session <missing>` refuses mutation (no silent divergent session); add the two guard tests.
- **WP2 (G3):** `readInterviewEvents()` must filter to scan-event rows only (ignore Q/A capture
  rows) so scan-evidence is correct on a real mixed ledger; add a mixed-ledger test.
- **WP3 (G4 + G9 + G17 + G18):** honest enforcement language — either wire the E5 spawn builder to a
  real caller or downgrade `dev/SKILL.md` "pre-loaded attachment"/"enforces" prose to guidance;
  fix the loop/goalplan/pabcd "hook does not move phases" / "planned ledger" claims.
- **WP4 (G5, G6):** provider catalog wiring — MCP `catalog_list` accepts/forwards providerStatus;
  GUI handler surfaces detected ocx models (or, if genuinely out of scope, make the doc/claim honest
  and the stub explicit). Decide in A-phase with subagent verification.
- **WP5 (G7 + G21):** extend `gate.mjs` to scan `structure/*.md` for false-enforcement prose; add a
  tracked src↔dist freshness check; record the C10 mitigation as a real gate/test or explicit
  accepted-risk row (not loose prose).
- **WP6 (G8, G10-G16):** doc/SoT truth sweep — fix the INDEX two-axis summary self-contradiction,
  stale L10/L11/L12.2/L13.2 docs, structure/INDEX CLI + project-state gaps, L3 naming. The L18 gate
  must stay green; extend it (WP5) so this drift can't recur.
- **WP7 (G19, G22, G23):** test/residue hardening — manifest-path hook e2e for the 5 uncovered
  hooks; resolve or formally accept C6/C10.

## Out of scope (user-owned)

- L11 docs website implementation, `README.md`, `docs-site/`, `logo-*` dirs. The README staleness
  the scanners flagged (README:13/:49) is recorded but NOT edited by this loop — it is the user's file.
