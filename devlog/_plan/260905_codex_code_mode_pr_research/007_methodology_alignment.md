# PABCD Initiative 원문으로 방향 재정렬

- 날짜: 2026-09-05
- 현재 단계: I. 제품 코드·설정 변경안 구현 전.
- 원문 저장소: `/Users/jun/Developer/new/700_projects/pabcd_initiative`
- 읽은 HEAD: `848e6c5` (2026-09-02), clean. 원문 저장소는 수정하지 않았다.
- 사용자 교정: “그냥 프로젝트의 방향성이 그렇다는거야 ../pabcd 이니셔티브인가 거기를 봐봐”.

## 질문 철회

앞서 제시한 “공통 기본값 / loop 한정 / 선택형 경량 프로필” 선택은 철회한다. 사용자는 별도 경량 기능의 옵션을 고르는 것이 아니라 프로젝트의 설계 원칙을 설명했다. 어떤 함수에 어떤 조건을 넣을지는 그 원칙을 만족시키기 위한 구현 판단이다.

## 원문에서 확인한 원칙

| 근거 | 확인한 내용 | CodexClaw에 적용할 해석 |
| --- | --- | --- |
| `pabcd_initiative/README.md:3` | 방법론의 canonical home, FSM·attestation·dev skill family·router+references | 개발 품질 규율을 유지하며 실행은 runtime에 맡김 |
| 위 README `:7`, `:48` | agent-neutral 내용, downstream은 adapted port | 방법론을 Codex 훅 코드에 중복 복사하지 않음 |
| `skills/dev/SKILL.md:44` | C0/C1은 reference 읽기를 생략하고 필요한 routing table만 읽음 | 작은 작업에 전체 방법론을 로드하지 않음 |
| 같은 파일 `:67` | methodology는 조건부 overlay, universal 아님 | 작업·위험·실제 변화에 따라 스킬 선택 |
| 같은 파일 `:134`, `:152` | 필요한 역할 스킬은 작업 전 읽기; 규칙의 canonical owner는 하나 | lazy-load는 필요한 규칙 누락을 허용하는 말이 아님 |
| `skills/dev-pabcd/SKILL.md:11` | FSM·worker dispatch는 runtime별 어댑터 | Codex가 주는 실행·도구·서브에이전트 표면 재사용 |
| `codexclaw/structure/00_philosophy.md:40` | 스킬 선택·reference 읽기는 모델 자율 판단 | 훅이 의미 판단을 대신한다고 주장하지 않음 |
| 같은 파일 `:46` | 훅이 실제로 소유한 표면에서만 enforcement | 보호·상태·완료 불변식과 안내문을 분리 |
| `codexclaw/docs/native-thin-harness.md:38` | initiative는 방법론 SoT, CodexClaw는 runtime adapter | 프로젝트 전반의 판단 기준이며 별도 opt-in 철학이 아님 |
| 같은 파일 `:75`, `:84` | 훅은 기계적 불변식, 비용은 호출·IO·지연으로 계측 | 파일 수가 아니라 실제 hot-path 비용과 회귀를 판단 |

위 표의 `skills/` 경로는 initiative 루트 기준이다. CodexClaw 문서는 현재 관리 worktree 기준이다. 원문의 boss/employee/task_tags 표현을 새 Codex runtime이나 별도 role 체계로 그대로 복사하지 않는다.

## 사용자 의도와 원문을 합친 목표

1. 사용자는 보통 `cxc-loop`만 호출한다. 이번 답변으로 이 표현은 HOTL에서 in-scope 계획을 모두 완수하라는 의미로 확정됐다.
2. 에이전트가 작업을 분류하고 필요한 스킬 본문·reference를 선택한다. 선택된 스킬도 필요 이상의 reference를 재귀적으로 전부 읽지 않는다.
3. 툴 실행은 native code mode·명령 실행·서브에이전트 표면을 사용한다. 실패 의미와 승인 범위를 보존한다.
4. hooks는 짧은 상태 연결과 실제 검증이 필요한 불변식만 맡긴다. 장문의 방법론 반복 주입과 선택을 대신하는 로직은 제거·이관 후보로 본다.
5. 일반 세션도 이 원칙의 적용 대상이다. 그렇다고 일반 요청이 자동으로 HOTL이 되거나 모든 기존 훅을 조건 없이 삭제한다는 뜻은 아니다.

## 원문과 구분할 새 정책

initiative의 `skills/dev-pabcd/SKILL.md:9`에는 사용자 승인 후 전진이라는 일반 안내가 있다. 따라서 “bare cxc-loop는 HOTL”이 원문에 이미 적혀 있다고 주장하지 않는다. 이것은 이번에 사용자가 명확히 정한 CodexClaw 진입 정책이다. 중립 방법론을 통째로 바꾸거나 원문 저장소를 수정할 권한으로 확대하지 않는다.

## 구현 전에 확인할 것

- `loop`의 긴 진입 본문, `pabcd`의 canonical 절차, `dev`의 표면 routing이 중복되는지 점검.
- 네 비용을 따로 관측: 스킬 metadata, 선택된 SKILL 본문, 선택된 references, hook 추가 문맥.
- `cxc skill search`는 현재 외부 카탈로그 검색이다. 설치된 스킬을 찾는 native 목록과 혼동하지 않음.
- spawn hook의 선택된 본문 선제 주입과 native/self-load 전달을 비교하되, 모델·V1/V2·부모/자식 effective 설정을 기록.
- 같은 규칙의 실제 적용·보호·완료 증거가 유지되는 후보 중 비용이 낮은 구현을 선택.
- 모든 프로브는 확정된 macmini/Astra high Fast/bypass JSONL 조건을 사용. 다른 모델에까지 효과가 입증됐다고 일반화하지 않음.

## 인터뷰 판정

사용자가 원문을 지목한 뒤 두 Mind에게 원문 경로와 현재 I 상태를 전달하고 재검토시켰다. 앞선 범위 옵션 질문은 철회한다. 남은 차이는 구현·계측에서 해결할 항목이며, 프로젝트 방향을 다시 사용자에게 선택시키지 않는다.
