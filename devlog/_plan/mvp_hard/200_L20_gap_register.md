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
| G3 | HIGH | code bug | `components/pabcd-state/src/state.ts:193` `readInterviewEvents()` | parses every line of `.codexclaw/interviews/<id>.jsonl` as scan evidence, but Q/A capture events share that file → mixed ledger misread; scan-evidence gate (L13) corrupted on real data. |
| G4 | HIGH | wiring | `components/subagent-config/src/spawn-wrapper.ts` (resolveSpawnPayloadWithSkills/buildSpawnItems) | E5 skill-attachment builder has NO non-test caller; `dev/SKILL.md` claims dispatches are "pre-loaded as an attachment" → doctrine-only. Either wire a production caller or downgrade the claim to honest guidance. |
| G5 | HIGH | wiring | `components/subagent-config/src/mcp.ts:90` `catalog_list` | calls `buildCatalog()` with no `providerStatus`, so the MCP catalog surface can NEVER expose ocx models despite the provider-bridge design + the mcp.ts:9 doc claim. |
| G6 | HIGH | stub | `gui/src/server/handlers.ts:53` | provider mode hard-coded to `{ mode:"provider", ocxModels: undefined }` → always `unsupported-ocx-catalog`; GUI provider-backed model selection is a stub. |
| G7 | MED | gate gap | `scripts/gate.mjs:122` checkForbiddenClaims | only scans `skills/**/SKILL.md`; `structure/*.md` (declared SOT) is not scanned for false-enforcement prose. |
| G8 | HIGH | doc/SoT | `devlog/_plan/mvp_hard/000_INDEX.md:68` | canonical two-axis summary still says L9/L11/L12 are decision-DONE/impl-PLANNED, contradicting the same table's `L9|DONE|DONE` and `L12|DONE|DONE` rows → top-level SoT internally false. |
| G9 | HIGH | false-claim | `dev/SKILL.md:3` frontmatter | "enforces modular limits, pre-write search, verification-before-completion, safety rules" — no E1/E2/E8 branch backs these; E7 prose wearing enforcement language (violates enforcement ladder). |
| G10 | MED | stale doc | `122_L12.2...md:87` | acceptance still claims "pending question blocks at I / handleStop returns block", but the I-phase Stop guard was dropped and shipped code releases at phase=I (L17 firewall). |
| G11 | MED | stale doc | `structure/INDEX.md:197` CLI Surface | omits live `cxc freeze` (bin dispatches it at :131). |
| G12 | MED | stale doc | `structure/INDEX.md:219` + `100_L10...md:42` | project-state map omits `.codexclaw/interview/freeze.json` + `.codexclaw/interviews/` runtime paths. |
| G13 | MED | stale doc | `100_L10...md:64,79` | L10 evidence anchors cite deleted `cxc-ops/src/chat-search.ts` + a verification contract expecting retired `chat-search unavailable` behavior. |
| G14 | MED | stale doc | `110_L11...md:99,100,102,350` | "Current command reality" still calls subagents/provider CLI placeholder + interview runtime planned + bin header lists chat-search (all shipped/retired since). |
| G15 | MED | stale doc | `132_L13.2...md:22,26,38` | two-axis migration doc still lists L9/L12 as DONE|PLANNED + requires roadmap.html reconciliation (no roadmap.html in repo). |
| G16 | MED | doc/INDEX | `000_INDEX.md:45` | L3 row claims "hook wiring to transition()" but shipped path uses applyHumanTransition(); naming overclaim. |
| G17 | MED | stale doc | `skills/loop/SKILL.md:21` + `skills/goalplan/SKILL.md:27` | "the hook does not move phases" — but the chat orchestrate path DOES transition+persist via handleUserPromptSubmit→applyHumanTransition. |
| G18 | LOW | stale doc | `skills/pabcd/SKILL.md:96` | calls `.codexclaw/interviews/<id>.jsonl` a "planned" ledger; capture is shipped. |
| G19 | MED | test gap | hooks/*.json (5 of 6) | only `user-prompt-submit` has a manifest-path e2e (build.test.mjs:87); Stop/PreToolUse×2/PostToolUse/SessionStart hook entrypoints have no e2e through `dist/cli.js hook <event>`. |
| G20 | PARTIAL (WP1) | test gap | `orchestrate-cli.test.ts` | DONE: `--session <unknown>` refusal + D-close + cli-bootstrap tests added. REMAINING: I/P/A Stop-command coverage (folded into WP7 test hardening). |
| G21 | MED | tracking | `190...md:52` (src↔dist freshness) + `180...md:46` (C10 mitigation) | promised follow-ups exist only as prose, not actionable/tracked. |
| G22 | LOW | residue | `config-guard/src/cli.ts:18` (C6) | `assertNotRealCodexHome` exported but imported only by tests. |
| G23 | LOW | residue | `subagent-config/test/mcp.test.ts:26` (C10) | fixed 8s stdio timeout → flaky under build+test contention. |

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
