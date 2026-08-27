# Auditable maturity score ledger

## Rules

- Scores are integer maturity stages, not decimal rankings.
- 5 requires persistent measured operating feedback and a decision gate. No domain receives 5 from architecture quality alone.
- N/E means bounded evidence was insufficient; it is excluded from averages and shown as hatched/grey, never zero.
- Product-wide overall rankings are not published. Only domain heatmaps and CodexClaw pillar averages are shown.
- Confidence: High = current shipped source plus test/runtime path; Medium = current source with incomplete reachability; Low = historical or asymmetric competitor evidence.
- Every score row carries exact anchor codes resolved in Appendix B.

## Reproducible counts

```bash
find plugins/codexclaw/components -path '*/src/*' -type f \( -name '*.ts' -o -name '*.mjs' \) -exec sh -c 'for f do n=$(wc -l < "$f"); [ "$n" -gt 400 ] && echo "$f"; done' sh {} + | wc -l
find plugins/codexclaw/components -path '*/src/*' -type f \( -name '*.ts' -o -name '*.mjs' \) -exec sh -c 'for f do n=$(wc -l < "$f"); [ "$n" -gt 800 ] && echo "$f"; done' sh {} + | wc -l
find plugins/codexclaw/components -path '*/src/win-exec.ts' | wc -l
```

Expected baseline for this report: 21 plugin `src` files >400 LOC; 4 files >800 LOC; 4 `win-exec.ts` owners. Root `bin/codexclaw.mjs` is separately reported and makes the broader runtime count 22.

Preflight on 2026-08-27 returned `21 / 4 / 4`. Pinned OMO object proof:

```bash
git -C devlog/.omo cat-file -e HEAD:packages/omo-opencode/src/cli/tui-installer.ts
git -C devlog/.omo cat-file -e HEAD:packages/skills-loader-core/src/features/opencode-skill-loader/async-loader.ts
git -C devlog/.omo cat-file -e HEAD:packages/omo-opencode/src/tools/delegate-task/skill-resolver.ts
```

## Domain scores

| Domain | CodexClaw | OMO | Senpi | Confidence C/O/S | Anchor codes / rationale |
| --- | ---: | ---: | ---: | --- | --- |
| Orchestration | 4 | 4 | 3 | H/H/M | C1,O1,S1. Durable FSM/checkpoints; Senpi goal is narrower than product orchestration. |
| Goal/task state | 3 | 4 | 4 | H/H/H | C2,O2,S1. CXC completion strong but public task lifecycle absent. |
| Research/knowledge | 3 | 4 | 2 | H/H/M | C3,O3,S2. CXC recall is runtime but Tier3 state is prose; OMO lineage is deeper. |
| Multi-agent | 3 | 4 | 3 | M/H/M | C4,O4,S3. CXC policy/evidence strong; effective lifecycle truth incomplete. |
| Evidence/QA | 4 | 4 | 3 | H/H/M | C5,O5,S1. CXC source identity; OMO artifact semantics; bounded Senpi evidence. |
| Trust/security | 3 | 3 | 4 | H/M/H | C6,O5,S4. CXC lacks signing/SAST; Senpi owns permission/project trust/sandbox. |
| Release assurance | 4 | 4 | 4 | H/M/H | C7,O7,S5. Candidate design and CI/package matrices; current CXC HEAD certification separate. |
| Human authority | 4 | 3 | 4 | H/M/H | C8,O1,S4. CXC HITL/HOTL firewall; OMO mode overlap; Senpi ask/deny/user transitions. |
| Onboarding | 3 | 4 | 3 | H/H/L | C9,O8,S10. Senpi score provisional from bounded runtime guidance. |
| Operator console | 2 | 4 | 3 | H/H/L | C10,O8,S7. CXC console is bridge-centric; Senpi bounded evidence only. |
| Remote/messenger | 4 | N/E | N/E | H/-/- | C11. No comparable OMO/Senpi surface inspected; excluded from averages. |
| Observability | 2 | 4 | 4 | H/H/H | C12,O4,S7. CXC metrics/logs reset or fragment; peers own live task/monitor state. |
| Capability/tool routing | 2 | 4 | 4 | M/H/H | C13,O11,S6. CXC resolver/route builder disconnected; peers production-wire context. |
| Workspace intelligence | 2 | N/E | N/E | H/-/- | C14. Map payload contradiction; competitors not symmetrically audited. |
| Cross-platform | 4 | 4 | 4 | H/H/H | C15,O7,S5. Broad OS evidence; CXC real Windows install lifecycle missing. |
| Maintainability | 2 | 3 | 4 | H/M/H | C16,O7,S5. CXC no typecheck and 21 oversized plugin-src files. |
| Distribution/install | 4 | 4 | 4 | H/H/H | C17,O10,S5. Broad artifacts, but no product receives 5 without measured closed-loop ops. |
| Model/provider portability | 3 | 4 | 4 | M/H/H | C18,O9,S8. CXC controls are rich but vocabulary/capability truth drifts. |
| Performance operations | 2 | 3 | 3 | H/M/H | C19,O7,S9. CXC comparator not a gate; Senpi trend advisory. |
| Ecosystem/extensibility | 3 | 4 | 4 | M/H/H | C20,O10,S10. CXC rich internal skills but mutable external discovery/no stable ABI. |

## Exact anchor code index

- C1 `plugins/codexclaw/components/pabcd-state/src/fsm.ts:23-70`; `plugins/codexclaw/components/pabcd-state/src/hook.ts:1275-1336`.
- C2 `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:59-90,700-749`; `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts:37-84`.
- C3 `plugins/codexclaw/skills/search/SKILL.md:118-177`; `plugins/codexclaw/components/recall/src/chat-search.ts:28-97`.
- C4 `plugins/codexclaw/components/subagent-config/src/store.ts:16-58`; `plugins/codexclaw/components/subagent-config/src/spawn-attach-hook.ts:745-929`.
- C5 `plugins/codexclaw/components/pabcd-state/src/source-identity.ts:168-208`; `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:921-994`.
- C6 `plugins/codexclaw/components/cxc-ops/src/hook-trust.ts:308-467`; `docs/security-hardening.md:86-95`.
- C7 `.github/workflows/release.yml:68-225`; `.github/workflows/packed-install.yml:21-160`.
- C8 `plugins/codexclaw/components/pabcd-state/src/interview.ts:264-340`; `plugins/codexclaw/components/pabcd-state/src/goal-active.ts:57-89`.
- C9 `README.md:48-61`; `plugins/codexclaw/gui/src/pages/Channels.tsx:216-295`.
- C10 `plugins/codexclaw/gui/src/App.tsx:20-25`; `plugins/codexclaw/gui/src/pages/Dashboard.tsx:181-243`.
- C11 `plugins/codexclaw/components/messenger-bridge/README.md:1-30,73-107`.
- C12 `plugins/codexclaw/components/messenger-bridge/src/event-log.ts:27-45,112-139`; `plugins/codexclaw/components/messenger-bridge/src/metrics.ts:1-20,42-90`.
- C13 `plugins/codexclaw/components/subagent-config/src/capabilities.ts:54-128`; `plugins/codexclaw/components/subagent-config/src/spawn-wrapper.ts:428-500`.
- C14 `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:101-120`; `plugins/codexclaw/bin/cxc.mjs:89-139`.
- C15 `.github/workflows/ci.yml:12-55`; `.github/workflows/wsl.yml:13-40`.
- C16 `package.json:21-24`; `plugins/codexclaw/components/pabcd-state/src/hook.ts:1469`; `plugins/codexclaw/components/pabcd-state/src/goalplan.ts:1094`.
- C17 `.agents/plugins/marketplace.json:6-18`; `plugins/codexclaw/test/payload-bin.test.mjs:53-106`.
- C18 `plugins/codexclaw/components/provider-bridge/src/detect.ts:1-101`; `plugins/codexclaw/gui/src/api.ts:12-16,239-241`.
- C19 `plugins/codexclaw/scripts/hook-bench.mjs:123-160`; `plugins/codexclaw/scripts/hook-bench-compare.mjs:5-40`.
- C20 `plugins/codexclaw/components/skill-search/src/cli.ts:153-230`; `plugins/codexclaw/components/skill-search/src/sources.ts:10-20`.
- O1 `devlog/.omo/packages/omo-codex/plugin/components/ulw-loop/src/checkpoint.ts:158-252`.
- O2 `devlog/.omo/packages/team-core/src/team-tasklist/claim.ts:45-96`; `devlog/.omo/packages/omo-opencode/src/tools/task/types.ts:3-21`.
- O3 `devlog/.omo/packages/shared-skills/skills/ulw-research/SKILL.md:61-149,195-260`.
- O4 `devlog/.omo/packages/omo-opencode/src/features/background-agent/manager.ts:245-320,587-655`.
- O5 `devlog/.omo/packages/omo-codex/plugin/components/ulw-loop/src/quality-gate.ts:93-205`.
- O7 `devlog/.omo/.github/workflows/ci.yml:145-378`; `devlog/.omo/package.json:40-47,224-250`.
- O8 `devlog/.omo/packages/omo-opencode/src/cli/tui-installer.ts:22-210`; `devlog/.omo/packages/omo-opencode/src/tui.ts:118-184`.
- O9 `devlog/.omo/packages/omo-opencode/src/config/schema/agent-overrides.ts:6-67`; `devlog/.omo/packages/omo-opencode/src/config/schema/categories.ts:5-40`.
- O10 `devlog/.omo/package.json:8-40`; `devlog/.omo/packages/omo-codex/package.json:2-32`; `devlog/.omo/packages/omo-senpi/package.json:2-56`.
- O11 `devlog/.omo/packages/skills-loader-core/src/features/opencode-skill-loader/async-loader.ts:74-100`; `devlog/.omo/packages/omo-opencode/src/tools/delegate-task/skill-resolver.ts:71-114`.
- S1 `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/goal/store.ts:19-82,148-208`; `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/goal/todo-gate.ts:8-30`.
- S2 `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/intent-gate.ts:14-45`; `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/parallel-tools.ts:1-6`.
- S3 `devlog/.senpi/packages/agent/src/agent-loop.ts:846-993`; `devlog/.omo/packages/senpi-task/src/lifecycle/shutdown.ts:9-67`.
- S4 `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/permission-system/index.ts:102-155`; `devlog/.senpi/packages/coding-agent/src/core/project-trust.ts:46-95`.
- S5 `devlog/.senpi/.github/workflows/ci.yml:13-187`; `devlog/.senpi/.github/workflows/build-binaries.yml:81-140`.
- S6 `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/build.ts:61-101`; `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/tool-section.ts:12-45`.
- S7 `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/terminal/monitor-registry.ts:55-164`; `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/goal/monitor-continuation.ts:323-618`.
- S8 `devlog/.senpi/package.json:15-45`; `devlog/.senpi/packages/coding-agent/package.json:10-50`.
- S9 `devlog/.senpi/.github/workflows/perf-trend.yml:1-13,82-88`.
- S10 `devlog/.senpi/packages/coding-agent/src/core/extensions/builtin/index.ts:61-100`; `devlog/.senpi/package.json:5-14`.
