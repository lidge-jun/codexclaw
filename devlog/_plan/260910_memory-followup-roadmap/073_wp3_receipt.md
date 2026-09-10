# 073 — wp3 receipt: cxc-recall 스킬 재작성 + docs-site

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp3-skill`(origin/dev e23e1285 위), 구현 커밋 `21a0f7b2`.

## 결론

cxc-recall SKILL.md가 실제 CLI와 일치한다(시놉시스 = cli.ts USAGE, 새 테스트가 고정). 두 엔진의 규칙을 분리해 적었고(#125의 VERSION·그룹 단위 완화 반영), 자연어→키워드 사다리, 결과 검증 규칙, 서브에이전트·관리형 워크트리·네이티브 memories.* 분담, 설치 조건부 외부 레인(Aside·위키)이 들어갔다. docs-site는 훅 개수를 28파일/29핸들러(#116 fallback + #102 memory-write + #119 bg-wake 3)로 맞췄다.

## 무엇이 바뀌었나

- `plugins/codexclaw/skills/recall/SKILL.md` 148→268줄. 과대 주장 4건 삭제("빈 결과는 없다", 양 엔진 trigram, 동일 JSON 스키마, "아무것도 안 바꾼다"), 18항목 정정.
- NEW `plugins/codexclaw/test/recall-skill-synopsis.test.mjs`(2 테스트: USAGE 플래그 ⊆ Commands 펜스, 과대 주장 문자열 부재·핵심 문장 존재).
- docs-site 7파일: how-it-works(이벤트 표 8/5/2/7/2/2/3), hooks.md(제목·도입 28/29, fallback·bg-wake 4행, PostCompact statusMessage 한 줄), plugin-manifest(hooks JSON 28개 = plugin.json:22-50), commands(`--rank`, `allow-write`, 기본값 문단), native-tools(memories.dedicated_tools는 미래 표면이 아님), index.mdx, installation.
- 테스트 배지 2956→2958.

계획(030)과의 차이: P 재검증이 plugin.json을 안 봐서 25/26으로 시작했고, A 리뷰어가 28/29를 잡아 3라운드에 걸쳐 본문을 고쳤다. 실제 훅 JSON에서 command/statusMessage/timeout을 읽어 표 행을 채웠다.

## 증거

- receipt `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json`: `/tmp/mfu-260910/check-wp3.sh` exit 0 — 시놉시스 테스트 2 pass, docs 개수·manifest 목록 = plugin.json·hooks 표 28개 전부 존재, 루트 묶음 458 pass.
- 감사: grok-4.6 리뷰어 r1 FAIL(3) → r2 FAIL(1) → r3 GO-WITH-FIXES(0, Medium 2 접음).
- docs-site 빌드는 로컬에서 돌리지 않았다(npm ci 필요). 원격 docs 워크플로가 판정한다.

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- SKILL의 워크트리 안내는 "wp4 전까지 `--cwd-only`에 메인 체크아웃 경로"라는 임시 문구다. wp4가 그 문단을 교체한다(040 §1 IN).
- 스킬 문서만으로 에이전트가 사다리를 실제로 따르는지는 이 사이클이 증명하지 못한다. 방향이 틀렸다는 신호: 다음 평가에서 자연어 질의가 여전히 재작성 없이 0건으로 끝나면 스킬 텍스트가 아니라 훅 주입(wp6 표적 회수 제안)이 필요한 자리다.

## 다음

wp5(자연어 완화, wp2 뒤)와 wp6(네이티브 통합, wp0 뒤)이 ready. wp4는 wp3 머지 뒤.

