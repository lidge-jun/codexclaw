# 071 — wp1 receipt: memory-write gate 목적지 분류

날짜: 2026-09-10 (KST). 세션 01a0880e-149e-72d0-86db-53bd99bcac0e. 브랜치 `codex/memory-l1-wp1-gate`(origin/dev db4e9412 위), 구현 커밋 `1e4c5897`, PR #124.

## 결론

게이트의 셸 분기가 "명령 본문에 메모리 경로 문자열이 있는가"에서 "명령이 어디에 쓰는가"로 바뀌었다. 이 세션에서 네 번 재현된 오탐(읽기 sed, stderr 리다이렉션, devlog heredoc 본문)이 설치본 dist CLI 스모크에서 allow로 바뀌었고, 진짜 쓰기(`>`, 공백 없는 `>>`, `sed -i`)는 계속 deny다. 툴 이름 분기와 apply_patch/Write/Edit 분기는 손대지 않았다.

## 무엇이 바뀌었나

- NEW `components/pabcd-state/src/shell-write-destinations.ts`(388줄, 순수 함수) + `dist/shell-write-destinations.js`(`git add -f`, dist/는 gitignore).
- MODIFY `memory-write-gate.ts`: `shellPathTokens`·write-verb 정규식 삭제, import + re-export, 셸 분기 교체(-50/+31).
- 테스트: `shell-write-destinations.test.ts`(NEW, 4 케이스 — 리다이렉션 14형태, heredoc/herestring 4, 동사 14, 체인 2), `memory-write-gate.test.ts`(+2 테스트, A1 세 형태·라이브 heredoc 포함).
- docs-site `reference/hooks.md` Pre-tool guards에 memory-write 항목.

계획(010)과의 차이 두 가지. (1) `perl -pe`/`-ne` 같은 옵션 묶음 끝의 `e`가 다음 인자를 프로그램 텍스트로 소비하도록 보강 — 계획 파서는 `'s/a/b/'`를 목적지로 과수집했다(무해하지만 단위 테스트가 잡음). (2) heredoc 본문 제거를 `stripHeredocBodies` 전처리로 분리 — 계획의 `skipHeredoc`은 `cat <<EOF > /w/x.md`에서 같은 줄의 리다이렉션까지 건너뛰어 실제 쓰기를 놓쳤다. 둘 다 파서 단위 테스트가 고정한다.

## 증거

- receipt: `.codexclaw/evidence/01a0880e-149e-72d0-86db-53bd99bcac0e/test-receipt.json` — `/tmp/mfu-260910/check-wp1.sh`, exit 0. 내용: dist CLI `hook pre-tool-use-memory-write`에 stdin 픽스처 6건(allow 3: sed -n, 2>/dev/null, heredoc 본문 devlog; deny 3: `>`, 공백 없는 `>>`, `sed -i`) + pabcd-state 스위트 1216 pass/0 fail + dist-freshness·packaging 5 pass.
- 원격 CI: PR #124 최종 head 전건 통과 후 머지(아래 갱신).
- 감사: 010에 대해 grok-4.6 리뷰어 3라운드(FAIL 4 → FAIL 1 → PASS), 000 §A 감사 기록과 010 말미 참조.

## 개선되지 않은 것 (LOOP-PESSIMIST-01)

- 잔여 우회 `echo hi -> P`, 서브셸·변수 확장·`python -c`는 그대로다(early warning). 
- 라이브 재검증(설치본 재설치 뒤 이 세션 형태의 명령이 실제로 통과하는지)은 머지·재설치 뒤에만 가능하다. 이 문서 시점에는 dist CLI 스모크까지만 확인했다.
- 방향이 틀렸다는 신호: 재설치 후에도 같은 명령이 막히면 원인은 파서가 아니라 훅 matcher/툴 이름 매핑이다.

## 다음

wp2 P: 020을 현재 트리와 대조. `query-words.ts`의 VERSION 분류와 그룹 단위 완화.

