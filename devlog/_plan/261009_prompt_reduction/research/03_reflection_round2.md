# Architect re-reflection — round 2

**ALIGNED. No remaining P0–P3 plan gap in the reviewed amendments.** Review scope: 001 history/budgets/enforcement, amendment sections of 010/020/030/040, and 002. This verdict concerns the executable plan, not implemented behavior or delivery. The reduced metadata/framework scope remains accepted (`devlog/_plan/261009_prompt_reduction/002_architect_consultation.md:4-7`).

## Prior-gap disposition

| Gap / decisions | Amended evidence | Verdict |
|---|---|---|
| G1 — aggregate UPS proof; D4/D8/D11 | `devlog/_plan/261009_prompt_reduction/010_wp2_l1_injections.md:79`; `devlog/_plan/261009_prompt_reduction/001_layering_standard.md:50` | Closed: real registered hook commands, isolated fixtures, sum across co-emitting hooks, separate recall data, ordinary/triggered/recovery scenarios, nonzero exit above aggregate ceilings. Component tests plus this script suffice; no shared fixture framework required. |
| G2 — duplicate-ID exception; D7/D10/D11 | `devlog/_plan/261009_prompt_reduction/001_layering_standard.md:65`; `devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md:49` | Closed: exact frozen legacy file lists; new definitions cannot enter them; migrated core IDs must have exactly one definition; duplicate negative fixture. |
| G3 — budget exception drift; D8/D11 | `devlog/_plan/261009_prompt_reduction/001_layering_standard.md:53,57`; `devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md:48-49`; `devlog/_plan/261009_prompt_reduction/030_wp4_routers_catalog.md:35` | Closed with an explicit proof limit: exact-size baseline, frozen eligible set and negative fixtures catch unacknowledged drift. Simultaneous baseline/eligible-set edits are a named, reviewable bypass, not an automatic predecessor-comparison ratchet. Whole-file L3 accounting is accepted. |
| G4 — pointer resolution; D7/D11 | `devlog/_plan/261009_prompt_reduction/010_wp2_l1_injections.md:80`; `devlog/_plan/261009_prompt_reduction/001_layering_standard.md:64`; `devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md:49` | Closed: native skill mentions, existing target files and heading fragments; missing-anchor negative fixture. |
| G5 — destination order/writers; D4/D6/D12 | `devlog/_plan/261009_prompt_reduction/010_wp2_l1_injections.md:77-78`; `devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md:51-52` | Closed: dispatch card/helper owner move together in PR B; terminal owner lands in PR A; phase-control has an assigned writer; revised scopes separate concurrent edits. |
| G6 — live IDs versus history; D1/D9 | `devlog/_plan/261009_prompt_reduction/001_layering_standard.md:42` | Closed: exclusion applies to historical incident identifiers; live identity/state and labeled recall data remain permitted. |

## Additional amended acceptance boundaries

The obligation ledger covers rules without IDs and blocks lost safety/permission/correctness obligations; wp4 records destinations and reviews activation rows. These supply semantic survival review alongside structural gates (`devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md:50`; `devlog/_plan/261009_prompt_reduction/030_wp4_routers_catalog.md:33-34`).

Deployment amendments pin checkout and installed payload evidence, skip dirty/off-target hosts, and require a deny smoke; installer success alone is insufficient. This fits D12's delivery/proof boundary (`devlog/_plan/261009_prompt_reduction/040_wp5_release_deploy.md:32-34`).

No further amendment requested. Treat amendment sections as superseding their earlier conflicting instructions. In completion reporting, retain 001's explicit baseline-bypass limitation: the gate detects unchecked drift; reviewers govern simultaneous changes to the baseline and eligible set (`devlog/_plan/261009_prompt_reduction/001_layering_standard.md:57,68`). Only this reflection file was written; no implementation, runtime tests, orchestration or Git writes were performed.
