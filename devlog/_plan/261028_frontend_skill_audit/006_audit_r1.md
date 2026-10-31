# 006 — Audit round 1

Reviewer: sol "Carson", agent 01a17e2d-637b-7462-b559-be9411f9e35b, 2026-10-28. Verdict: **FAIL** (3 High).

## Synthesis (REVIEW-SYNTHESIS-01)

Root cause: the roadmap treated evidence files and a few context lines as descriptions rather
than copy-paste content, and one WCAG paraphrase dropped allowed conditions.

| # | Blocker | Disposition |
|---|---|---|
| 1 | Fixture files not specified; script cannot resolve packages from the evidence path | Folded: 020 H now carries both HTML files in full, the scratch install, a NODE_PATH run command and the expected output and exit codes. Re-run on 2026-10-28 from /tmp/fxtest with these exact files: before exit 1 (image-alt, target-size), after exit 0. Content A documents the same NODE_PATH install. |
| 2 | 3.3.8 narrower than W3C | Folded: content A row lists all four allowed conditions (alternative method, assisting mechanism with paste and autocomplete as examples, object recognition, user-provided non-text content). |
| 3 | Abbreviated "Before" lines (010 E, 030 #13, 030 G) | Folded: full original lines inserted; a script compared every context and removal line in all diff blocks with the target files (or the wp1 file text for 030 A) and found all verbatim. |
| R | 001 raw report was "undefined" | Fixed: report body restored. |

## Reviewer report (verbatim)

검증 스크립트는 현재 트리에서 모두 통과했어요. `check-prompt-architecture.mjs`와 `gate.mjs`가 각각 exit 0을 반환했고, 전자는 `skills/**/*.md`의 링크와 규칙 ID를 읽으며 후자는 그 검사를 호출합니다([검사 범위](plugins/codexclaw/scripts/check-prompt-architecture.mjs:154), [호출부](plugins/codexclaw/scripts/gate.mjs:341)). 계획대로 적용하면 **wp1 단독, wp1+wp2, 전체**에서 check 3·4는 통과할 것으로 보입니다. 요청하신 다섯 앵커도 각 단계에 존재하며, 새 규칙 ID의 정의는 파일별로 한 곳씩입니다. 이는 아직 적용 전 계획에 대한 예측이에요.

1. **High — wp2의 신규 증거 파일이 실행 가능한 수준으로 명세되지 않았어요.** [020:25](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:25)는 `before.html`, `after.html`, 스크립트, `run.log`를 NEW로 지정하지만 [H절](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:356)에는 HTML 전문과 재현 명령이 없습니다. 더구나 저장 예정 위치의 스크립트에서 두 패키지를 해석해 보니 모두 `MODULE_NOT_FOUND`였어요. `/tmp/axeprobe/node_modules`에는 있지만 [스크립트의 `require`](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:68)는 그 경로를 찾지 못합니다. **수정:** 두 HTML의 전문, 정확한 실행 명령과 모듈 경로 설정, 기대 exit code를 020에 넣고 그 명령으로 재실행하세요. 이는 [DIFFLEVEL-ROADMAP-01](plugins/codexclaw/skills/pabcd/references/implementation-units.md:7)의 전체 신규 내용 요건에도 필요합니다.

2. **High — 인증 적합성 판단이 WCAG 3.3.8보다 좁아요.** [020:118](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:118)은 인지 기능 시험에 *대체 수단*이 있어야 한다고 서술하지만, [W3C 3.3.8](https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum)은 보조 메커니즘, 객체 인식, 사용자 제공 개인 콘텐츠도 별도 허용 조건으로 명시합니다. 이 문구대로면 통과 가능한 인증 절차를 실패로 판정할 수 있어요. **수정:** 네 허용 조건을 모두 적고, 붙여넣기·비밀번호 관리자는 보조 메커니즘의 예로 설명하세요.

3. **High — 일부 “Before”는 해당 줄의 정확한 원문이 아니에요.** [010:250](devlog/_plan/261028_frontend_skill_audit/010_phase1.md:250)은 `...`로 시작하고, [030:50](devlog/_plan/261028_frontend_skill_audit/030_phase3.md:50)의 #13도 실제 `korea-2026.md:37`의 일부를 생략합니다. [030:108](devlog/_plan/261028_frontend_skill_audit/030_phase3.md:108)의 SoT 변경 #24–27 역시 행 전체가 아닌 조각만 제시합니다. 나머지 030의 #1–12, #14–21은 지정 줄에서 원문 또는 명시된 부분 문자열을 확인했어요. **수정:** 생략된 항목에 전체 기존 줄과 전체 교체 줄을 넣어 복사 가능한 diff로 만드세요.

비차단 잔여 사항: [001 조사 기록](devlog/_plan/261028_frontend_skill_audit/001_hig_foundations.md:12)의 원문 보고가 `undefined`라 22개 기초 원칙의 조사 근거를 그 문서에서 추적할 수 없습니다. 다만 010의 HIG slug 다섯 개(`design-principles`, `layout`, `onboarding`, `drag-and-drop`, `managing-accounts`)는 Apple JSON에서 모두 HTTP 200으로 확인했어요. [W3C 원문](https://www.w3.org/TR/WCAG22/)과 대조한 기준 표는 **31 A + 24 AA = 55**, 2.2 추가 여섯 항목과 등급이 맞고, axe 태그·`AxeBuilder` 호출 형식도 [axe 규칙 목록](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)과 [Playwright 설명서](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md)에 존재합니다. 심각도·S1 wontfix·GAP-id→V-id 인계는 네 파일 사이에서 일치하고, 기존 시각 검증·anti-slop·접근성 패턴·QA 증거 계약은 참조 소유자로 유지됩니다. 단계 구분은 의존 순서이고 번호 규칙도 지켰으며, [030의 PR 체인](devlog/_plan/261028_frontend_skill_audit/030_phase3.md:90)은 수동 연결과 미병합 경계를 명시합니다.

VERDICT: FAIL



# Round 2

Verdict FAIL, 1 High: the content A example ran `node axe-wcag22.cjs` after `cd /tmp/axe-wcag22`, so the script path did not resolve. Folded: the install runs in a subshell and the run line uses the script's absolute path; verified from the home directory with /tmp/fxtest/axe-wcag22.cjs (before.html exit 1). Prior blockers 1-3 confirmed closed by the reviewer.

## Reviewer report round 2 (verbatim)

재감사에서 **1차 차단 항목 세 건은 모두 닫힌 것**으로 확인했어요. 현재 트리의 `check-prompt-architecture.mjs`와 `gate.mjs`는 각각 exit 0입니다. [020 H의 HTML과 스크립트](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:364)를 `/tmp`에 복사해 실행한 결과도 계획과 일치했어요: 수정 전 `image-alt`·`target-size`로 exit 1, 수정 후 위반 없음으로 exit 0. [3.3.8 문구](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:126)는 [W3C의 네 허용 조건](https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum)을 모두 담고 있습니다. 010 E, 030 diff 13·SoT의 기존 줄도 현재 파일과 정확히 일치하며, 001 조사 본문도 복원됐어요.

1. **High — 수정된 자동 검사 안내의 실행 명령이 스크립트를 찾지 못합니다.** [020의 설치·실행 예시](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:84)는 `cd /tmp/axe-wcag22` 후 `node axe-wcag22.cjs`를 실행하지만, 계획상 스크립트는 증거 디렉터리에 저장됩니다. 같은 위치에서 실행해 `MODULE_NOT_FOUND`를 확인했어요. H절의 저장 경로를 쓰는 명령은 정상 동작합니다. **수정:** 본문 예시도 저장된 스크립트의 절대 경로를 사용하거나, 실행 전에 저장 위치로 이동하도록 바꾸세요.

`blocking_issues: 1` — 기존 차단 항목의 수정 과정에서 생긴 실행 안내 오류입니다. 그 외 새 차단 사항은 확인되지 않았어요.

VERDICT: FAIL

# Round 3

Verdict PASS.

차단 항목이 닫혔어요. [수정된 실행 안내](devlog/_plan/261028_frontend_skill_audit/020_phase2.md:84)는 설치를 서브셸에서 수행하고 스크립트의 절대 경로를 사용합니다. 실제로 다른 작업 디렉터리에서 `/tmp` 복사본을 실행해 수정 전 exit 1(`image-alt`, `target-size`), 수정 후 exit 0(`[]`)을 확인했어요. `check-prompt-architecture.mjs`와 `gate.mjs`도 모두 exit 0이며, 이번 수정으로 생긴 새 차단 사항은 없습니다.

VERDICT: PASS

