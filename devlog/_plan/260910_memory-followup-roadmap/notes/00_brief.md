# 00 — 조사 브리프 (서브에이전트 공용)

날짜: 2026-09-10 (KST). 메인 세션: 01a0880e-149e-72d0-86db-53bd99bcac0e. 워크트리: /Users/jun/.codex/worktrees/3412/codexclaw (HEAD = origin/dev 369ed0e1).

## 배경
- 2026-09-09에 codexclaw 메모리 업그레이드 L0 PR 8개(#100 #102 #103 #104 #105 #106 #107 #108)가 dev에 머지됐다. 인도 문서: devlog/_plan/260909_memory-upgrade-l0/040_delivery.md, 근거 노트: devlog/_plan/260909_memory-upgrade-l0/research/01~08.
- 머지 전 dev: 0cacdc8d2e8df26b96d47a325270cc7a25069904. 머지 후 dev(현재): 369ed0e110ad77a4bcfa1784ac5156b89a754a42.
- 설치된 플러그인 캐시: /Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.2.24+codex.20260908031619 (버전 문자열은 옛 스탬프지만 내용은 2026-09-10 06:23 재설치본, #108의 normalizeCwd까지 포함). CLI: node <cache>/bin/cxc.mjs
- ~/.codex/config.toml: [memories] generate_memories=true use_memories=true dedicated_tools=true.
- 그 뒤 "메모리 상태 점검" 태스크(01a08805-2ace-7250-8272-3636e50fa5eb)가 검색 38회 평가를 했고 문제를 보고했다. 평가 산출물: /Users/jun/.codex/visualizations/2026/09/09/01a08805-2ace-7250-8272-3636e50fa5eb/memory-search-eval/{report.md,cases.json,results.json,followups.json}
  주요 증상: 자연어 질의 0건(키워드는 됨), Aside가 없는 문자열에도 0.64~0.68 점수로 무관 후보 반환, 위키 wiki_lookup.py가 대표 문서(100.md 등)만 읽어 상세 문서 누락, 유사 릴리스 혼동(2.49.0 provenance), 주입 요약(memory_summary.md)이 2,500토큰 상한 94% 포화·과거 지시가 상시 선호로 일반화·중복, 읽기 전용 sed가 memory-write gate에 차단.
- 메인 세션에서 방금 재현된 게이트 오탐: 워크트리 devlog 아래 파일을 쓰는 heredoc 명령이 본문에 메모리 디렉터리 경로 문자열을 담고 있다는 이유로 MEMORY-WRITE-GATE에 차단됐다(실제 쓰기 대상은 devlog). 이 오탐은 #102가 만든 회귀 후보다.

## 핵심 질문
1. 지금 보이는 문제가 L0 작업(#100~#108)이 만든 회귀인가, 원래 있던/다른 층(Codex 네이티브, Aside, 위키)의 문제인가?
2. cxc-recall 스킬과 메모리 전반을 어떻게 보강해야 하는가 (로드맵 입력).

## 규칙 (엄수)
- 읽기 전용. 레포·~/.codex/memories·~/.aside·kim_wiki·config를 절대 수정하지 않는다. git checkout/branch/commit/push 금지. 임시 복제본은 /tmp/mfu-260910/ 아래에만 만든다.
- 결과 파일은 지정된 경로 하나에만 쓴다: /Users/jun/.codex/worktrees/3412/codexclaw/devlog/_plan/260910_memory-followup-roadmap/notes/<번호>_<slug>.md
- 주의: 셸 명령 본문에 Codex 메모리 디렉터리의 절대 경로 문자열이 들어가면 PreToolUse 게이트가 쓰기로 오인해 명령을 막을 수 있다. 메모리 파일을 읽을 때는 cat/rg를 쓰고, 노트 파일에 그 경로를 적어야 하면 apply_patch로 쓰거나 "~/.codex/memories"처럼 물결표 표기를 쓴다. 막힌 명령과 메시지는 그대로 기록한다(그 자체가 근거다).
- 형식: 한국어, 사실 위주, 모든 주장에 파일:행 또는 명령+출력 근거를 붙인다. 확인 못 한 것은 (unknown)으로 남긴다. 추측과 사실을 구분한다. 첫째/둘째 나열, AI투 마무리 금지.
- 마지막 섹션은 반드시 "## 로드맵 입력"으로, (a) 회귀 여부 판정 (b) 수정 후보를 P0/P1/P2로 (c) 각 후보의 대상 파일과 검증 명령을 적는다.
- 질문하지 말고 끝까지 진행한다. 끝나면 파일 경로와 핵심 발견 3줄을 최종 메시지로 보고한다.

