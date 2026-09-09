# 040 wp7: 이번 세션의 교훈을 codexclaw 전반에 반영

사용자 요청: "이 교훈을 codexclaw 쪽에 더 반영할 수 있으면 그것도 같이 해줘". wp2와 같은 PR에 담는다.

## 교훈 → 위치 → 변경 (diff-level)

| 교훈 | 파일 | 변경 |
|---|---|---|
| PDF에 em dash와 AI 말투가 그대로 들어가면 독자가 읽기를 멈춘다(동료 피드백); 카드·콜아웃·동그라미 번호는 시각적 AI 신호 | `dev/SKILL.md` FAMILY-SLOP-01 | 한 문단 추가: 한국어 산출물에 em dash 금지, bold-label 불릿·3항목 반사 나열 금지, 인쇄 문서의 반사 부품은 `dev-visualizer` REPORT-DESIGN-01 참조 |
| 공개 레포의 devlog 증거에 고객 보고서·개인 카톡 원문이 커밋됐다(wp1 감사 blocker 1) | `dev/SKILL.md` §5 git 규칙 옆 | FAMILY-PRIVACY-01 (STRICT): devlog/evidence에 고객·개인 데이터(메시지 원문, 고객 문서 사본, 실명 대화)를 두지 않는다; 레포 밖 작업 공간에 두고 devlog에는 파일명과 요약만; push 전 PR 범위에 식별자 grep 0건 |
| patina의 한국어 AI 신호와 "숫자·극성·인과 보존" 검증 | `kwrite/references/ai-tell-taxonomy.md` | CAT-11 추가(과도한 중요성 부여, ~적 접미사 남용, 연결사 머리, 완화 표현, em dash), 수정 원칙에 fidelity 항목(숫자·방향·인과가 바뀐 윤문은 되돌림; patina `droppedNumbers` 발상) |
| 인쇄·PDF 문서에도 UI와 같은 LLM 기본값 목록이 필요하다 | `dev-uiux-design/SKILL.md` "Do not default to" 문장 | 문서·보고서용 반사 부품 한 줄과 REPORT-DESIGN-01 포인터 |
| fresh-reader는 HTML이 아니라 렌더링된 페이지를 읽어야 조판·시각 슬롭을 잡는다 | `pabcd/references/phase-check.md` C-READER-01 | "렌더링된 산출물(PDF 페이지 이미지)을 읽고, AI 템플릿처럼 보이는 시각 요소를 묻는다" 한 문장 |
| Aside 기본 모델 무료 쿼터 소진(402)으로 레인이 즉사 | `~/.codex/skills/aside-jun/SKILL.md` (개인 스킬, 레포 밖) | "When something goes wrong"에 402 free_quota_exhausted → `-m opencodex/<provider>/<model>` 항목 |

## 검증

각 파일의 YAML frontmatter 유효(기존 manifest-policy 테스트), skill-catalog·inventory 테스트, 문구가 기존 규칙 ID와 충돌하지 않음(FAMILY-* 목록 grep). 코드 변경 없음.

## 하지 않는 것

훅으로 강제하지 않는다(구조 원칙: 스킬 문구는 agent-followed). 새 스킬 폴더를 만들지 않는다.
