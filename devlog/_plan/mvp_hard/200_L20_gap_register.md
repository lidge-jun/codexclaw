# L20 / 200 — L1-L19 Gap Register (full-span sweep) + remediation loops

Status: PLANNED (gap scan DONE; remediation in PABCD work-phases) · 2026-06-30 · mvp_hard loop L20 · class C3

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
| G8 | HIGH | doc/SoT | `devlog/_plan/mvp_hard/000_INDEX.md:68` | canonical two-axis summary still says L9/L11/L12 are decision-DONE/impl-PLANNED, contradicting the same table's `L9|DONE|DONE` and `L12|DONE|DONE` rows → top-level SoT internally false. |
| G9 | RESOLVED (WP3) | false-claim | `dev/SKILL.md:3` frontmatter | FIXED 2026-06-30: "enforces" → "defines … (agent-followed, not hook-enforced)". Hubble confirmed no E1/E2/E8 backs skill-load; honest E7 wording now. |
| G10 | MED | stale doc | `122_L12.2...md:87` | acceptance still claims "pending question blocks at I / handleStop returns block", but the I-phase Stop guard was dropped and shipped code releases at phase=I (L17 firewall). |
| G11 | MED | stale doc | `structure/INDEX.md:197` CLI Surface | omits live `cxc freeze` (bin dispatches it at :131). |
| G12 | MED | stale doc | `structure/INDEX.md:219` + `100_L10...md:42` | project-state map omits `.codexclaw/interview/freeze.json` + `.codexclaw/interviews/` runtime paths. |
| G13 | MED | stale doc | `100_L10...md:64,79` | L10 evidence anchors cite deleted `cxc-ops/src/chat-search.ts` + a verification contract expecting retired `chat-search unavailable` behavior. |
| G14 | MED | stale doc | `110_L11...md:99,100,102,350` | "Current command reality" still calls subagents/provider CLI placeholder + interview runtime planned + bin header lists chat-search (all shipped/retired since). |
| G15 | MED | stale doc | `132_L13.2...md:22,26,38` | two-axis migration doc still lists L9/L12 as DONE|PLANNED + requires roadmap.html reconciliation (no roadmap.html in repo). |
| G16 | MED | doc/INDEX | `000_INDEX.md:45` | L3 row claims "hook wiring to transition()" but shipped path uses applyHumanTransition(); naming overclaim. |
| G17 | RESOLVED (WP3) | stale doc | `skills/loop/SKILL.md` + `skills/goalplan/SKILL.md` | FIXED 2026-06-30: reworded to "the hook does not move phases AUTONOMOUSLY; it persists a transition only in response to an explicit chat orchestrate command". Matches handleUserPromptSubmit→applyHumanTransition. |
| G18 | RESOLVED (WP3) | stale doc | `skills/pabcd/SKILL.md:96` | FIXED 2026-06-30: now "shipped append-only Interview Q/A capture ledger, written by the PostToolUse request_user_input hook". |
| G19 | MED | test gap | hooks/*.json (5 of 6) | only `user-prompt-submit` has a manifest-path e2e (build.test.mjs:87); Stop/PreToolUse×2/PostToolUse/SessionStart hook entrypoints have no e2e through `dist/cli.js hook <event>`. |
| G20 | PARTIAL (WP1) | test gap | `orchestrate-cli.test.ts` | DONE: `--session <unknown>` refusal + D-close + cli-bootstrap tests added. REMAINING: I/P/A Stop-command coverage (folded into WP7 test hardening). |
| G21 | RESOLVED (WP5) | tracking | `190...md:52` (src↔dist freshness) + `180...md:46` (C10 mitigation) | FIXED 2026-06-30: promoted both prose follow-ups to tracked, ranked rows F1/F2 (see "Tracked follow-up debt" section), each routed to WP7. F2≡G23 (cross-linked). |
| G22 | LOW | residue | `config-guard/src/cli.ts:18` (C6) | `assertNotRealCodexHome` exported but imported only by tests. |
| G23 | LOW | residue | `subagent-config/test/mcp.test.ts:26` (C10) | fixed 8s stdio timeout → flaky under build+test contention. |

## Tracked follow-up debt (G21 — promoted from prose to actionable rows)

These were buried as one-off prose in earlier loop docs. Promoted here so they are tracked,
ranked, and routed to a real work-phase (not lost). Each carries its origin and target WP.

| F | Sev | Origin (file:line) | Actionable item | Routed to |
|---|-----|--------------------|-----------------|-----------|
| F1 | LOW | `190_L19_dist_packaging_contract.md:52` | No test proves committed `dist/` matches current `src/` BEFORE a build; `build.test.mjs` proves post-build idempotency only. Add a src↔dist freshness assertion (e.g. build into a temp dir, diff against committed `dist/`) so a stale commit fails CI. | WP7 |
| F2 | LOW | `180_L18_enforcement_gate.md:46` | C10 build+test contention flaky: `subagent-config/test/mcp.test.ts` MCP stdio roundtrip (~8s) times out when `npm test` runs immediately after `npm run build`. Mitigate via explicit per-test timeout or serialized build/test, or formally accept the risk with a documented `npm test` standalone contract. | WP7 (= G23) |

> Note: F2 and G23 are the same defect; G23 stays the canonical row, F2 records the prose origin
> so the `180...md:46` follow-up is no longer orphaned. F1 complements G19 (test coverage).

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
