# Independent WP3 C-phase review

WP3 fails its preservation gate: three old routing/correctness obligations have no current owner, the new architecture checker has reproduced false greens, and four host-bound checks disappear from the pinned test relocation. The shortened dispatch resolver matches its new document owner exactly, but the diff also changes model aliases, so it is not wholly behavior-neutral.

Anchor: base `a3001789`, HEAD `79239e8a4f605f8f7c8bd9275ee23cebb0f65a7a`, branch `codex/prompt-reduction-core`; physical cwd `/Users/jun/.codex/worktrees/55e8/codexclaw`. Plan read: `devlog/_plan/261009_prompt_reduction/020_wp3_core_skills.md`, including A-round amendments, revalidation, neutral reviewer packets and failure-class additions. This is a bounded read-only leaf with only the two requested review artifacts writable. No builds, suite runs, actual agent spawning, git writes, goals or orchestration.

## Automated/source probes

`node plugins/codexclaw/scripts/check-prompt-architecture.mjs` freshly exited 0 and printed `[prompt-architecture] OK`. That result is structural evidence only; it does not establish preservation or soundness of every parser branch.

An in-memory harness evaluated the checker source with a virtual filesystem. It removed only module imports/exports, the CLI entrypoint and the shebang, and supplied the original filesystem/path operations against virtual files. No fixture files were written. Initial harness attempt failed on the unremoved shebang; corrected invocation completed. Results:

| Virtual fixture | Actual checker outcome |
|---|---|
| Two files defining a heading `## ` followed by inline-code `FOO-BAR-01` | `ok:true`, definitions empty |
| Two files with `FOO-BAR-01 (**STRICT**) must do.` | `ok:true`, definitions empty |
| YAML `description: >` followed by 400 characters | `ok:true` |
| Table cell `[missing][r]`, definition `[r]: nope.md` | `ok:true` |
| Ordinary table cell `[missing](nope.md)` | `ok:false`, missing target reported |
| Link to `#foo-bar-01` under heading with inline-code rule ID | `ok:false`, real heading incorrectly rejected |
| Only `Follow FOO-BAR-01.` after its unique definition disappears | `ok:true` |

Stubbed, in-process resolver calls used `components/subagent-config/dist/dispatch-card.js`; no native agent call occurred. V1 and V2 each called exactly one stub, V2 included `task_name:model_probe` and `fork_turns:none`. Extracting the fenced resolver specifically from the `SessionStart dispatch card` section of `delegation.md` gave exact equality with `RESOLVER_CELL`. Cards with an absent catalog were 380 and 420 characters for unresolved/V1 respectively, beneath 450.

## Numbered findings

1. **High — LOST installed CLI recovery can invoke the wrong control implementation.** Location: `plugins/codexclaw/skills/loop/references/runtime-lifecycle.md:8`; old `loop/SKILL.md:113-114`, ledger L033. Trigger: PATH resolves an older development `cxc` during session binding or loop recovery. Old router required `node <pluginRoot>/bin/cxc.mjs` from the installed plugin while preserving the development checkout. Current runtime entry and `pabcd/references/phase-control.md:100-117` contain identity recovery but no CLI provenance recovery. The lane ledger at `evidence/obligations-loop-pabcd.md:31` names a destination that does not contain the obligation. Impact: correct-looking commands can run a stale parser/identity implementation. Restore one operative owner and route to it. `verification: verified` by destination reads and skills-wide search. Preservation blocker.

2. **High — LOST skill-relative link base breaks owner discovery outside the plugin checkout.** Location: `plugins/codexclaw/skills/dev/SKILL.md:55`; old `loop/SKILL.md:56`, ledger L012. Trigger: a selected skill has `references/...` links while the working directory is the user's project. Old text explicitly resolved those links from the skill directory, not cwd. The shortened dev reading contract only covers completeness/truncation. `evidence/obligations-loop-pabcd.md:22` calls the deletion a duplicate of that contract; it is not. Impact: wrong/missing reference files, and therefore omitted governed instructions. Restore the resolution rule in the reading owner. `verification: verified`. Preservation blocker.

3. **High — LOST native versus external skill discovery distinction.** Location: `plugins/codexclaw/skills/loop/SKILL.md:16`; current external route `plugins/codexclaw/skills/dev/SKILL.md:158`; old `loop/SKILL.md:83-85`, ledger L029. Trigger: an agent tries to load an installed owner after reading loop's pointer to dev for “installed-skill discovery.” Dev sends capability gaps to `skill-catalog.md` and `cxc skill search/show`; that catalog describes external jaw/clawhub/hermes loading and never states that native installed owners come from the installed listing/router. Impact: external catalog/adapted owner selected in place of the installed native owner; missing installed capability incorrectly inferred. Restore the native loading distinction at one owner. Explicit-only/leaf-safe boundaries themselves survive. `verification: verified`. Preservation blocker.

4. **Medium — definition/anchor scanner discards rule IDs in real Markdown headings and misses decorated classes.** Locations: `plugins/codexclaw/scripts/check-prompt-architecture.mjs:72`, `:78`, `:136`, `:150`; tests `plugins/codexclaw/test/prompt-architecture.test.mjs:53`. Trigger: define `## ` with an inline-code rule ID, or a definition `FOO-BAR-01 (**STRICT**)`. `stripCode` removes the heading's visible ID before both slugging and ownership parsing; class regex accepts neither the bold class nor several existing colon/prefix forms. Impact: duplicate definitions pass; valid inline-code heading links fail. The current refs ledger itself notes six scanner-unrecognized IDs at `evidence/obligations-refs.md:546-552`, including live prose owners PHASE-SPLIT-01 and AUDIT-LOOP-01. Existing fixtures exercise only favorable definition spellings. Preserve inline text for headings, recognize the approved definition forms or explicitly reject unsupported forms, and add negatives/valid-heading controls. `verification: verified` via virtual fixtures and owner reads. Deleting a unique definition also passes because the checker only iterates discovered definitions; the plan's migrated-ID exactly-one audit needs separately recorded evidence and cannot be inferred from this gate.

5. **Medium — valid multiline catalog descriptions evade L2 budgets.** Locations: `plugins/codexclaw/scripts/check-prompt-architecture.mjs:49`, `:58`; tests `plugins/codexclaw/test/prompt-architecture.test.mjs:35`. Trigger: YAML folded/literal scalar (`description: >` or `|`, likewise `short_description`). Parser returns only the scalar marker as the value, counting one character regardless of continuation length. Impact: the hard catalog budget returns green for arbitrarily large valid descriptions. Parse the supported YAML scalar forms or fail closed on unsupported forms; independently test both description surfaces and CRLF/quoted cases. `verification: verified` for folded description via virtual fixture; short-description same-code-path case established by source inspection.

6. **Medium — reference-style Markdown links are never checked, including table owner routes.** Location: `plugins/codexclaw/scripts/check-prompt-architecture.mjs:137`; tests `plugins/codexclaw/test/prompt-architecture.test.mjs:40`. Trigger: `[owner][r]` in a routing table with `[r]: absent.md` or a bad fragment. Regex sees only inline `](...)`. Impact: advertised “every relative Markdown link” gate allows unresolved owners. Ordinary inline table links are correctly checked; the defect is syntax coverage, not tables generally. Parse reference definitions/usages or narrow and enforce allowed syntax. Anchor handling also accepts `{#custom}` as a real anchor without naming a compatible renderer, while inline-code ATX heading content is wrongly discarded; document the supported dialect and test its actual slug rules. `verification: verified` for missing reference-style target via virtual fixture; custom-anchor rendering is a policy uncertainty, not a separate confirmed blocker.

7. **Medium — host-envelope relocation drops four pinned value comparisons.** Location: `plugins/codexclaw/test/lane-packet.test.mjs:378`; surviving owner checks `:349-367`. Trigger: change the owner's documented `read_thread.turnLimit`, `read_thread.maxOutputCharsPerItem`, `list_threads.limit`, or `get_handoff_status.waitMs` bound while keeping routing links/nonempty owner. Old delegation test compared all six named bounds with the fixture. New tests only compare owner path and nonempty text. Surviving lane-owner test checks wait-target max, wait timeout and worktree retention; cap test checks fixture equals 6 and error phrase but not owner numeric value. Impact: four formerly checked host contracts can drift while pinned tests remain green. Move each original value comparison to the host-envelope owner, ideally extracting its named row rather than matching any number anywhere. Removing redundant prose copies is justified; losing independent comparisons is not. `verification: verified` by base-to-head test diff and current full test-span reads. Plan amendment to assert links does not waive unchanged decisions/correctness proof.

8. **Medium — dispatch change includes model migration beyond text relocation.** Location: `plugins/codexclaw/components/subagent-config/src/dispatch-card.ts:4`. Trigger: caller requests alias deepseek, kimi or sol, or uses the probe. Compared with base, mappings change from `command-code/deepseek-deepseek-v4.1-flash` to `...flash-fast`, `kimi/kimi-for-coding-highspeed` to `kimi/k3`, and `gpt-6-sol` to `gpt-6.1-sol`. Impact: selected provider/model and probe payload change, despite review criterion that decisions remain unchanged. The updated map agrees with delegation's alias table, but tests derive expected IDs from `MODEL_ALIASES`, so do not independently validate the migration. Treat it as a separate documented/authorized decision with evidence, or preserve base values for this reduction. Resolver branching/schema/override decisions remain unchanged, and no live-routing claim is made. `verification: verified` by source diff, base snapshot and stub payload observation.

## Dispatch and pinned-test disposition

The resolver is identical to its current document owner, including family ambiguity rejection, exactly-one-spawn selection, V1 payload and V2 no-history payload. The 450-character cap and fallback-first owner cues survive. `DISPATCH_OWNER` uses a skill mention plus reference fragment, consistent with the placement standard. Actual runtime family/model availability was not exercised.

`dispatch-card.test.ts` retains executable family/no-spawn/ambiguous-family tests after moving the cell out of L1; catalog disabled/hidden/passthrough checks survive. Its new document equality assertion compares executable text from two sources, an appropriate seam. Its heading existence assertion plus global `includes(RESOLVER_CELL)` would not catch moving the code to an unrelated section, although the current copy is under the correct heading. The cap assertions now use the exported cap; the fallback CLI independently pins 450, so cap growth is still caught by that second test.

Pinned `manifest-policy.test.mjs`, `native-execution.test.mjs`, `attest-shape-hint.test.ts` and `spawn-attach-hook.test.ts` have no diff against the base. No new skips/lowered suite thresholds were found in the changed tests. `lane-packet.test.mjs` is weakened as finding 7 specifies. New architecture tests cover ordinary inline links, missing ordinary anchors, simple definition duplicates, legacy freeze growth/staleness and exact-size eligible baselines; they omit the reproduced parser cases, short-description overflow and unique migrated-ID disappearance.

## Changed-file coverage

| Files | Disposition |
|---|---|
| dev/loop/pabcd SKILL.md | reviewed: complete old text and complete current routers; 197-row independent ledger |
| dev hosted-ci-evidence.md and stacked-prs.md | reviewed: CI block preservation, routing, permissions, cascade/merge contracts and sampled ledger destinations |
| loop durable-goalplan/lane-dispatch/runtime-lifecycle/waiting refs | reviewed: full current text and relevant base/test changes; sample spans |
| pabcd delegation/dispatch-surfaces/implementation-units/plan-output/phase-control refs | reviewed: full current text, resolver relocation, state/attest schema, sample spans |
| check-prompt-architecture.mjs, baseline JSON, gate.mjs | reviewed: parser/control flow, in-memory negative probes, gate exception propagation and baseline eligibility contract |
| prompt-architecture.test.mjs and lane-packet.test.mjs | reviewed: all new architecture test text, changed host tests plus surviving owner comparisons |
| subagent-config src/dist dispatch-card and two changed test files | reviewed: source diff, dist import/stub execution, current tests and base interdiff; no rebuild performed |
| structure/70_prompt_architecture.md and INDEX.md | reviewed: full new standard and one-row INDEX diff scope |
| CHANGELOG and plan/evidence/research additions outside requested product diff | out-of-scope for product review; assigned plan and lane ledgers used only as inputs, not accepted as proof; unrelated WP6 research not reviewed |

## blocking_issues

- L012, L029, L033 are LOST and must receive operative current owners (findings 1-3).
- Fix or explicitly narrow the gate's claimed parser contract and retain truthful limitations (findings 4-6).
- Restore the four host-bound comparisons at their canonical owner (finding 7).
- Explain and evidence the alias migration or remove it from the behavior-preserving reduction (finding 8).

The requested two evidence files are the only writes. Full suites/builds and live provider tests are NOT RUN under this packet. The earlier shell write attempt was rejected by WORKTREE-GUARD-03 because quoted review content resembled a worktree-removal command; no file was written by that attempt. Structured patches wrote only the two authorized paths.

VERDICT: FAIL
