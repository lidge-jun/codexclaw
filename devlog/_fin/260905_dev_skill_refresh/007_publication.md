# PR publication

2026-09-05 사용자가 PR 생성과 merge를 명시적으로 승인했다. 최근 기능 PR #62의 관례에 따라 target은 dev다. main 승격이나 registry release는 범위에 포함하지 않는다.

- Branch: codex/dev-skill-refresh. 기존 managed worktree에서 detached HEAD를 그대로 채택했다.
- origin/dev 09708b2d의 peer collaboration 변경을 충돌 없이 merge했다. 통합 head 7aebbb1148f7592251536e8884a4c07e62169b48.
- PR: https://github.com/lidge-jun/codexclaw/pull/63
- 통합 후 focused 7/7와 repository gate PASS.
- 첫 CI run 33951942106: Linux/macOS에서 tests total2277, pass2276, fail0, skip1. 새 visualize regression은 두 OS에서 실제 PASS.
- 실패 원인은 후속 published-count 검사였다. badge2276과 실제 total2277 불일치.
- repo generator `inventory.mjs --write --tests 2277`로 README 세 언어의 badge/alt만 갱신했고, `--check --tests 2277` PASS. 테스트 기준이나 CI gate를 낮추지 않았다.

최종 PR head의 모든 CI와 review 상태를 다시 확인한 뒤 정상 merge한다. 결과 링크와 merge SHA는 PR 및 사용자 응답에 남긴다. 이 문서는 아직 진행 중인 Windows/WSL 검사나 merge를 완료로 표시하지 않는다.

## Windows CI 진단

첫 run의 Windows LF/CRLF 두 lane 모두 새 visualize test line34에서 status1/expected0로 실패했다. 다른 테스트 실패는 없었다. stdout/stderr가 assertion에 없어 실제 helper 진단을 볼 수 없었으므로, 기존 repo의 subprocess assertion 방식처럼 실패 출력만 추가했다. 기대값·skip·gate는 바꾸지 않았다.

- H1: native Windows 경로의 backslash가 Bash glob 접근을 깨뜨림. 반증: candidate가 선택되고 hash drift가 보고되면 경로 접근은 됐다.
- H2: checksum 출력의 filename escaping이 digest 비교에 섞임. 반증: reported digest가 깨끗한 64자리이고 선택된 파일이 동일하면 다른 원인이다.
- H3: shell/환경 또는 줄바꿈 때문에 script 자체가 오동작. 반증: 초기 empty-cache와 tracking 파싱이 정상이며 LF/CRLF 모두 같은 후속 지점에서 실패한다. .gitattributes는 sh를 LF로 유지한다.

원인 확정은 helper 출력과 실제 Windows 재검사로 한다. 단순 재시도나 Windows skip으로 처리하지 않는다.

GNU checksum 로컬 재현으로 H2를 확인했다. backslash가 들어 있는 정상 fixture 경로에서 macOS 기본 checksum은 PASS, GNU coreutils로 바꾸면 같은 digest 앞에 backslash가 붙어 drift로 오판했다. 출력은 `6bcb01...47dce -> \6bcb01...47dce`였다. 파일과 version은 정상 선택돼 H1 경로 접근 실패가 아니며, script 파싱도 정상이라 H3도 이 재현의 원인이 아니다.

해결: named-file checksum 출력에서 첫 단어를 파싱하지 않고, 파일을 stdin으로 공급해 filename escaping이 digest에 섞이지 않게 한다. sha256sum/shasum 두 경로에 같은 원칙을 적용했다. fixture 경로에 backslash를 넣어 POSIX의 GNU 도구에서도 회귀가 재현되게 했고 기대값/skip 조건은 유지했다. Windows 실제 결과는 최신 CI에서 확인한다.

## PR review의 runtime consumer 보완

자동 reviewer가 지적한 두 runtime 지침을 실제 source에서 확인했다. hook.ts의 AGBROWSE_SEARCH_DIRECTIVE가 예전 고정 ladder/blind start를 유지했고, idle-edit.ts가 C0/C1 모두 numbered record를 요구했다. 새 공통 정책을 주입 지침에도 적용한다. trigger·FSM·frequency·allow/deny 동작은 변경하지 않는다.

계획: (1) 기존 hook activation/idle advisory 테스트에 새 payload 계약을 넣어 RED 확인, (2) 두 지침 문구만 변경, (3) 기존 compileSource로 해당 dist 두 개 재생성, (4) targeted tests/build freshness와 최신 PR CI 확인. 추가 test case 수는 늘리지 않으므로 total2277은 유지된다. 이는 prose 파일 단어 존재 검사가 아니라 실제 hook 입력을 호출해 반환된 payload와 상태 비변경을 확인하는 기존 테스트의 확장이다.

두 지점의 RED를 확인한 뒤, source 문구와 generated dist를 맞췄다. hook.test.ts + idle-edit.test.ts는 79/79 PASS(0 skip). advisory의 allow envelope, 빈 입력/armed 상태의 무응답, frequency, trigger/dedup/phase 상태 검증은 그대로 통과했다.
