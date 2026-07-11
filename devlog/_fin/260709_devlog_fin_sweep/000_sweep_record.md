# devlog/_plan → _fin 전수 이동 스윕 (260709)

Scope: `devlog/_plan/` 35개 항목 전수 검토 → 완료 판정된 폴더를 `devlog/_fin/`으로
`git mv` + 살아있는 문서/테스트/코드의 `devlog/_plan/<moved>` 경로 참조를 `_fin`으로 갱신.
판정 기준: 폴더 자체의 close-out 기록 + **현재 트리 코드-레벨 대조**(산출물 실재 확인).
A-게이트 리뷰(gpt-5.5, FAIL→반영): enhance/promptgap 이동 철회, ouroboros MOC 정정 후 이동.

## MOVE — 완료 검증 30건

| Folder | Evidence (current tree) |
|---|---|
| 260629_research_elicitation | findings 완결, PoC는 optional 명시; 선택질문은 native request_user_input으로 흡수 |
| 260630_ouroboros_interview_research | minds.ts + MIND_DISPATCH_DIRECTIVE 출하. MOC의 TODO 라인이 stale(010-040 전부 실재)이라 2026-07-09 인덱스 정정 후 이동 |
| 260701_emergence_harness | divergence-cli.ts/metric-cli.ts 출하; impl 폴더는 이미 _fin. 테스트가 HTML 경로 참조 → 갱신 필요 |
| 260702_astgrep_active | edit-shape.ts + skills/ast-grep 존재 |
| 260702_codex_recall | recall 컴포넌트 + index-db/ingest/index-search 출하 |
| 260703_gui_production_hardening | 80_completion.md (644/644) + gui/src 존재, gui 테스트 977 스위트에 포함 |
| 260703_meetup_presentation | ~/Developer/codexmeetup/workflow_show_and_tell.pptx 실재 |
| 260703_messenger_bridge_active | 90_phase9 하드닝 기록 (65/65) + 컴포넌트 출하 |
| 260705_hook_diet_skill_implicit | hooks/_deprecated/ + hooks.md "2026-07-05 hook diet" 명기; skills_ref_curation 050_done의 WP1 |
| 260705_loop_search_consolidation | dev SKILL의 Capability Routing Hub + goalplan/ultraresearch/skill-hub DEPRECATED 명기 |
| 260705_skills_ref_curation | 050_done.md (HITL 3 work-phases, A-gate 3회) |
| 260705_telegram_cwd_sessions | setBindingWorkdir: db.ts/server.ts/gateway-commands.ts |
| 260706_loop_mechanism_research | 제안한 LOOP-MECHANISM-PROOF-01이 loop SKILL에 존재 (연구 소비됨) |
| 260706_repo_map | cxc map 출하; map e2e가 977 스위트에서 green |
| 260707_codex_rs_native_tooling_research | 300_recommendations로 연구 종결 (후속 스파이크는 후보로만) |
| 260707_cxc_qa | skills/qa + QA-HTTP-01 앵커 존재 |
| 260707_fancy_default_color_wrap | 050_done (DONE, 증거 캡처) + dev-uiux ism 콘텐츠 11 히트 |
| 260707_fork_fsm_bug | orchestrate-cli.ts --session 강제 (이 세션에서 라이브 검증됨) |
| 260707_fugu_orchestration_adoption | COLLAPSE-AGGREGATOR-01 등 rule ID가 structure/skills에 존재 |
| 260707_gjc_adoption | DISPATCH-ACTOR-01/RETIRE-01이 structure/20 + loop SKILL에 존재 |
| 260707_harness_divergence_interview | DIVERGE-TIER-01이 loop SKILL에 존재; 020_verification 기록 |
| 260707_kwrite_psns_port | cxc-psns/kwrite 스킬 실사용 (세션 프리앰블 affordance 포함); 000_record의 open ends는 deliberate 명시 |
| 260707_liquid_glass_motion_trends | 050_done + Liquid Glass가 dev-frontend/uiux SKILL + references에 존재 |
| 260707_memory_system_research | README frontmatter: status research-done, phase1-shipped |
| 260707_messenger_bridge_native_commands | 100_impl_final_summary (loop validate OK, 21/21) + gateway-commands.ts 출하 |
| 260707_release_readiness | 90_results (DONE) + 공개 리포/manifest interface 필드 |
| 260707_remote_usability | 100_final_summary (6/6) + skills/remote 존재 |
| 260707_thariq_fable_youtube_plugin_research | 040_final_synthesis, "no patch from this unit alone" 경계 명시 |
| 260708_scroll_driven_effects | motion.md에 Cinematic Section Transitions 섹션 반영됨 |
| lazygap | freeze-boundary goal-arm 독트린이 loop SKILL에 존재; lazygap_impl은 이미 _fin |

## KEEP — _plan 잔류 5건

| Item | 근거 |
|---|---|
| 260709_audit_nearpass_gate | phase2/3 미착수: pabcd-state src/test에 nearpass 코드 0건, phase1 인용 문자열(VERDICT: PASS 등)도 현 트리에 없음 |
| promptgap_impl | 100 문서 자체 status "P plan written, editing dev+pabcd next"; dev는 반영됐으나 pabcd 0히트, 영역 101-109 미착수 |
| promptgap | 연구 자체는 DONE이나, 잔류하는 promptgap_impl(100_family_invariants.md:5)이 `../promptgap/` 상대링크로 참조 — impl 종결 시 짝으로 이동 (리뷰어 P1) |
| 260705_messenger_bridge_enhance | 폴더 자체 상태가 PLAN/PABCD active/Status: P — close-out 기록 부재. 코드 심볼(pause/resume 등)은 후속 260707_native_commands 루프가 출하한 것과 구분 불가 (리뷰어 P1) |
| roadmap.html | 폴더가 아닌 느슨한 파일 (이동 대상 아님) |

## 참조 갱신 (이동과 함께 `_plan` → `_fin`)

- `plugins/codexclaw/test/emergence-doc-sync.test.mjs:25,56` (테스트가 HTML을 직접 read — 미갱신 시 스위트 파손)
- `structure/INDEX.md:108,118` (260702_codex_recall)
- `structure/00_philosophy.md:69,74` (codex_recall, messenger_bridge_active)
- `plugins/codexclaw/skills/pabcd/SKILL.md:94` (fork_fsm_bug)
- `plugins/codexclaw/skills/dev-uiux-design/references/color-system.md:29` (liquid_glass)
- `plugins/codexclaw/skills/dev-frontend/references/core/motion.md:113,568,847,848` (liquid_glass, scroll_driven)
- `plugins/codexclaw/skills/dev-frontend/references/core/liquid-glass.md:7` (liquid_glass)
- `plugins/codexclaw/components/messenger-bridge/test/agent-store.test.ts:3` (주석, gui_production_hardening)
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:146` (주석, fork_fsm_bug — dist 재빌드 필요)
- 손대지 않음: devlog 내부 상호참조(역사 기록), `../jawcode/...`(타 리포), `structure/INDEX.md`의 기존 stale `_plan/mvp_res|mvp_hard` 참조(이번 이동과 무관한 선행 부채 — 보고만)
- 선행 부채 추가 보고(리뷰어 P3): `plugins/codexclaw/test/gate.test.mjs:90,104`가 `devlog/_plan/mvp_hard` 경로를 구성 — mvp_hard는 이미 _fin에 있으나 테스트는 픽스처 경로 생성이라 977 스위트 green (이번 이동 무관)

## Verification

- 이동 후: `ls devlog/_plan` 잔류 3건만, `git status` rename 스테이징 확인
- `rg "devlog/_plan/(2606|2607|2608|lazygap|promptgap)" --glob '!devlog/**'` → promptgap_impl 외 0건
- `npm run build` + `npm test` 전체 green (emergence-doc-sync 포함)
