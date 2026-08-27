# A 감사 1차 — 증거 모델 보정

Date: 2026-08-27
Reviewer: independent explorer
Verdict: FAIL → blockers folded, same-reviewer re-audit pending

## Blocker synthesis

| # | Root cause | Decision | Plan change |
| --- | --- | --- | --- |
| 1 | Senpi prompt guidance와 OMO adapter parser/runtime state를 기능 이름으로 뭉쳤다. | ACCEPT | owner를 Senpi core / OMO Codex / OMO Senpi / OMO OpenCode / CodexClaw로 분리하고 evidence class와 신뢰 경계를 필수화했다. |
| 2 | `path:line`과 prose flow만 요구해 실제 발화·비발화와 상태 수명을 증명하지 못했다. | ACCEPT | positive/negative trigger, before→after, output, bypass, compaction/queued lifetime을 행 필수 필드로 추가했다. |
| 3 | `rg` token 존재와 untracked `git diff --check`가 의미 완전성을 검증한다고 과장했다. | ACCEPT | 의미 검증은 C 독립 review로 명시하고, 문서 commit 뒤 `git show --check`와 `git ls-tree` 8-file assertion으로 tracked artifact를 검증한다. |
| 4 | npm beta/remote main identity receipt가 문서에 보존되지 않았다. | ACCEPT | P에서 실행한 `npm view`와 `git ls-remote` 결과를 plan에 보존했다. |
| 5 | 4.19 parity dedup이 free-form label뿐이었다. | ACCEPT | prior row/disposition, 5.0 evidence/delta, new disposition/reason 스키마를 필수화했다. |
| 6 | lane failure와 distinct-agent retry/disposition 기록이 없었다. | ACCEPT | failure 조건, 1회 distinct retry, main reclaim, bounded wave, per-return disposition을 정의했다. |
| 7 | OMO async queue와 persisted task graph, shared skill과 Ultimate runtime이 한 축이었다. | ACCEPT | OMO shared prompt/skill, dynamic prompt, async queue, task graph, goal을 별도 lane으로 쪼개고 4.19 baseline lane을 추가했다. |
| 8 | 실제 research wave/attachment 자체의 receipt가 없었다. | ACCEPT | `009`에 agent id, skill path, disposition, follow-up/stop reason을 남기되 child skill use까지 증명한다고 과장하지 않는다. |
| 9 | 2차 감사에서 `git show HEAD -- path`가 빈 출력 exit 0을 낼 수 있었다. | ACCEPT | B 직후 exact SHA를 고정하고, exact subject와 exact 8-path `diff-tree`를 먼저 단정한 뒤 그 SHA에 `git show --check`를 실행한다. |
| 10 | npm dist-tag version과 clone root package version 표기가 섞였다. | ACCEPT | npm `5.0.0-0.beta.22`와 clone root `5.0.0-beta.22`를 분리해 표기했다. |

Blocker끼리 충돌하지 않는다. owner 분리는 activation trace와 old-parity key의 기준을 더 명확히 하고, verifier 하향은 완료 기준을 약화하지 않고 자동화가 볼 수 없는 부분을 정직하게 독립 검토로 옮긴다.

## 감사에서 확인된 기준점

- Senpi IntentGate는 user text를 파싱하는 함수가 아니라 모델용 prompt section이다: `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/intent-gate.ts:14-45`, `devlog/.senpi/packages/coding-agent/src/core/dynamic-prompt/build.ts:61-90`.
- OMO Senpi adapter가 keyword parser와 session arming을 소유한다: `devlog/.omo/packages/omo-senpi/src/components/skill-pointers/index.ts:23-58`, `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:283-383`.
- OMO Codex와 Senpi adapter는 겹침/억제 규칙이 다르다: `devlog/.omo/packages/omo-codex/plugin/components/ultrawork/src/codex-hook.ts:5-85`, `devlog/.omo/packages/omo-senpi/src/components/ultrawork/index.ts:4-15`.
- CodexClaw Tier 3는 현재 opt-in, one-shot, non-durable 계약이다: `plugins/codexclaw/skills/search/SKILL.md:118-177`.
- CodexClaw activation recorder는 정의됐지만 production caller가 확인되지 않아 dormant 후보로 조사한다: `plugins/codexclaw/components/cxc-ops/src/activation-trace.ts:45-140`, `plugins/codexclaw/components/pabcd-state/src/release-gate.ts:387-395`.
