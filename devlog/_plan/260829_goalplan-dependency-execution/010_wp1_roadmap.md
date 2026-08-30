# 010 — wp1: 로드맵 사이클 (docs-only)

이 phase는 코드를 바꾸지 않는다. 산출물은 문서다.

## 산출물 (전부 이 유닛)

- NEW 000_plan.md — 목표, 등급, loop-spec, work-phase 지도, 수용 기준
- NEW 001_goalplan_anatomy.md — 현재 타입·스키마 버전·디스크 레이아웃·원장·CLI·E8·없는 것
- NEW 002_blast_radius.md — 소비자 20곳 × 읽는 필드 × 위험도, 유실 경로 5개, 손댈 파일 목록
- NEW 003_dag_lessons.md — senpi-task 실측에서 뽑은 필수 불변식과 과잉 판정
- NEW 004_execution_owner.md — 실행 주체 결정과 과거 판정(REJECT/ADAPT/DEFER) 제약
- NEW 005_contract.md — 감사 blocker를 닫은 계약 정본. decade 문서와 충돌하면 이것이 이긴다
- NEW 006_host_runtime.md — codex-rs 실측(락 예산, continuation 소유, agent-graph 층 구분)
- NEW 020_wp2_schema_v3.md, 030_wp3_integrity.md, 040_wp4_dependency_aware.md,
  050_wp5_write_serialization.md, 060_wp6_public_surface.md, 070_wp7_regression.md
  — wp2~wp7 diff-level 설계. 파일명 decade와 wp 번호가 1:1이다(정본 §14)

## 방법

read-only 조사 파견 5기(gpt-5.6-sol medium)로 현재 구조·파급·DAG 교훈·실행 표면·과거 판정을
수집하고, 문서 작성 파견 6기로 decade 문서 초안을 만든 뒤 본체가 교차 검증한다.

감사 라운드 1·2가 모두 fail을 낸 원인은 파견들이 공통 계약 없이 병렬로 써서 phase 사이 이름·
범위·의미가 어긋난 것이다. 처방은 005_contract.md를 정본으로 세우고, 재작성 파견 패킷마다
정본 전문과 "충돌 시 정본이 이긴다"를 함께 넣는 것이다. 라운드 3 파견은 이 절차로 돌린다.

## 이 phase에서 확정된 설계 결정

1. senpi-task DAG 엔진을 이식하지 않는다(G8 REJECT 유지). goalplan이 유일한 상태 원천이다.
2. 첫 구현 phase는 reviver 보존이다. 이것 없이는 이후 모든 필드가 5개 RMW 경로에서 유실된다.
3. 저장(wp2)과 해석(wp4)을 분리한다. 의존 필드를 넣는 것과 선택 로직을 바꾸는 것은 다른 위험이다.
4. **ready/dependency 판정의 진실**은 pabcd-state, 턴 생성과 동시성 상한은 호스트 소유.
   Stop 훅은 턴 생성기가 아니라 같은 턴 안의 guard이며 실행기를 넣지 않는다(정본 §12).
5. claim/lease와 다중 실행자는 이번 범위 밖. **wp5**의 쓰기 직렬화로 단일 실행자를 보호한다.
6. 이번 작업의 본질은 새 엔진이 아니라 public task/criterion lifecycle을 닫는 것이다.
7. 완료 증거는 권위 상태에 둔다. `GoalplanTask.outcome`이 필수이고 원장 detail은 사본이다
   (정본 §4). 원장 append와 plan commit이 원자적이지 않아 원장만으로는 증거가 소실된다.
8. 락 실패의 의미는 두 층이다. 상태를 바꾸는 연산은 fail-closed, 훅 프로세스는 fail-open
   (정본 §11).

## 검증 (C)

- 유닛에 000~006과 010~070 decade 문서가 존재하고 각 decade 문서가 정확 경로·NEW/MODIFY/DELETE·
  before/after diff·테스트 케이스·검증 명령을 담고 있다
- 테스트가 이름과 `...`만 남은 곳이 없다. 전부 arrange/act/assert 본문까지 채워져 있다
  (DIFFLEVEL-ROADMAP-01, 정본 §10)
- 문서가 인용하는 유닛 내부 파일명이 정본 §14 목록 안에만 있다. verifier 명령의 문서 경로 인자도
  실제 파일을 가리킨다(존재하지 않는 경로는 git이 조용히 무시해 false-green이 된다)
- 인용한 코드 경로와 줄 번호 표본이 실제 파일에 존재한다
- 번역투 표본 검사 통과
- goalplan wp1~wp7 및 c-1~c-8이 이 문서 지도와 1:1로 일치한다
