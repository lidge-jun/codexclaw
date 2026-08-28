# 020 — wp3: 설치 매니페스트 v2 + 키 단위 해제 대칭

## 지금 무엇이 깨져 있는가

`deactivate.ts:41-45`는 config.toml **전체 파일 sha256**을 활성화 시점 스냅샷과 비교한다.
다르면 아무것도 되돌리지 않고 안전 무동작으로 빠진다.

    const currentHash = hashOrNull(configPath);
    if (manifest.postActivateHash !== null && currentHash !== manifest.postActivateHash) {
      return { disabled: [], skippedPreExisting: [], skippedDrift: true, noManifest: false };
    }

이 설계는 codexclaw가 그 파일의 유일한 writer일 때만 성립한다. 실제 환경은 그렇지 않다.
사용자가 직접 편집하고(현재 `~/.codex/config.toml` 636행 대부분이 손으로 쓴 항목),
`codex` 자신이 다른 설정을 쓰고, 옆 저장소 opencodex가 같은 파일을 쓴다
(`src/codex/sync.ts`, `src/codex/features.ts:415`).

즉 **설치 직후 단 한 번의 무관한 편집으로 `cxc disable`이 영구 무력화**된다. 이 유닛이 두 번째 writer를
추가하면 그 확률은 사실상 1이 된다. 자기가 켠 키조차 되돌릴 수 없는 uninstall은 uninstall이 아니다.

## 파일 변경 맵

| 파일 | 동작 |
|---|---|
| `config-guard/src/activate.ts` | MODIFY — `InstallManifest` v2, `tableKeys` 기록, setter 배선 |
| `config-guard/src/deactivate.ts` | MODIFY — 전체 해시 가드를 키 단위 대조로 교체 |
| `config-guard/test/activate.test.ts` | MODIFY — v2 필드 단언 추가 |
| `config-guard/test/deactivate-drift.test.ts` | NEW — 외부 드리프트 시나리오 |

## 매니페스트 v2

    export interface TableKeyRecord {
      table: string;
      key: string;
      priorValue: string | null;   // 우리가 쓰기 전 값. 키가 없었으면 null
      appliedValue: string;        // 우리가 실제로 쓴 값(직렬화 형태)
      setByCodexclaw: boolean;     // false면 이미 목표 값이라 손대지 않았다는 뜻
    }

    export interface InstallManifest {
      version: 2;
      activatedAt: string;
      configPath: string;
      backupPath: string | null;
      postActivateHash: string | null;   // v1 호환으로 계속 기록, 게이트 판단에는 미사용
      flags: Record<string, FlagRecord>;
      tableKeys: Record<string, TableKeyRecord>;   // 키는 "<table>.<key>"
    }

v1 매니페스트 읽기는 유지한다. `version`이 1이거나 `tableKeys`가 없으면 빈 객체로 채워 읽고
플래그 되돌리기는 기존 경로로 처리한다. 마이그레이션 쓰기는 하지 않는다 — 다음 `enable`이 v2를 낳는다.

## 키 단위 드리프트 가드

전체 파일 해시를 버리고 키별로 판정한다.

    각 tableKeys 항목에 대해:
      live = readTableKey(현재 내용, table, key)
      if !rec.setByCodexclaw            -> skip (우리가 안 건드림)
      else if live === null             -> skip: missing (누군가 지웠다)
      else if live !== rec.appliedValue -> skip: changed (외부가 값을 바꿨다)
      else                              -> restoreTableKey(priorValue) 로 되돌린다

플래그 쪽도 같은 원칙으로 옮긴다. `codex features list`가 현재 상태를 알려주므로
`priorEnabled=false && enabledByCodexclaw && 지금도 enabled` 일 때만 `features disable`을 부른다.
그러면 전체 파일 해시는 판단에서 완전히 빠지고, `skippedDrift` 대신 항목별 사유가 남는다.

반환 shape을 넓힌다. 기존 필드는 호출부 호환으로 유지한다.

    export interface DeactivateResult {
      disabled: string[];
      skippedPreExisting: string[];
      skippedDrift: boolean;          // v2에서는 항상 false (전체 파일 가드 제거)
      noManifest: boolean;
      restoredKeys: string[];                                        // 신규
      skippedExternal: { target: string; reason: "missing" | "changed" }[];  // 신규
    }

## 왜 이게 더 안전한가

전체 해시 가드는 "무언가 달라졌으니 전부 포기"였다. 보수적으로 보이지만 실제 결과는
**사용자가 켠 적 없는 설정이 영구히 남는 것**이다. 키 단위 대조는 각 키에 대해
"내가 쓴 값이 지금도 그대로인가"만 묻는다. 그대로면 내 것이 확실하니 되돌리고,
아니면 남이 손댄 것이니 둔다. 남의 변경을 밟을 위험은 오히려 줄어든다.

백업 파일은 계속 만든다(`activate.ts:99-102`). 되돌리기가 실패해도 복구 경로가 남는다.

## 테스트 (c3 활성화 시나리오)

`test/deactivate-drift.test.ts` — 주입된 임시 디렉터리와 가짜 runner만 사용한다.

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | v2 매니페스트 + 무관한 줄이 파일 앞에 삽입됨 | 우리 키는 되돌려지고 삽입된 줄은 남음 |
| 2 | 외부가 우리 키 값을 바꿈 | `skippedExternal` 에 `changed`, 파일 무변 |
| 3 | 외부가 우리 키를 삭제 | `missing`, 오류 없이 통과 |
| 4 | `priorValue=null` | 키 줄 제거, 다른 키 보존 |
| 5 | `priorValue="false"` | 값이 false로 복귀 |
| 6 | v1 매니페스트 | 예외 없이 플래그만 처리 |
| 7 | `setByCodexclaw=false` | 손대지 않음 |

## 범위 경계

IN: 위 네 파일. OUT: CLI 출력 문구(wp5에서 새 필드를 함께 렌더), 실제 사용자 config.toml.

## 검증

`node --test` 신규/수정 테스트 + `npm test` 전체.


## A-phase 감사 정정 (파견 감사자 Darwin, GO-WITH-FIXES blockers=6)

### B1 (High) — 두 writer 사이의 lost update, 순서를 못박는다

`codex features disable`은 toml_edit로 파일 전체를 다시 쓰고, `tableKeys` 패스는 문자열
read-modify-write다. 순서를 정하지 않으면 한쪽이 다른 쪽을 덮는다.

채택 순서: **`tableKeys` 복원을 먼저, 플래그 패스를 나중에.** 감사자는 반대 순서를 제안했지만
이쪽이 두 블로커를 동시에 만족한다. 플래그 패스는 **서브프로세스**라 실행 시점에 디스크를 새로 읽으므로
우리가 먼저 쓴 내용을 그대로 보고 보존한다. 반대로 하면 우리 쪽이 CLI 결과를 다시 읽어야 하는 의존이 생기고,
B2의 "깨진 codex가 우리 키를 방치하는" 문제가 남는다.

    1. config.toml 한 번 읽기
    2. 모든 restoreTableKey 변환을 그 내용에 누적 적용
    3. 한 번 쓰기 (writeFileSync)
    4. 그 다음 플래그 패스 (codex features disable 서브프로세스)

테스트 추가: 플래그와 tableKey를 한 번의 호출로 되돌리고 **둘 다 생존**을 단언한다.

### B2 (High) — uninstall이 실패하지 않게 fail-open

`readDeclaredState`는 종료코드가 0이 아니면 **throw**한다(`features.ts:63`). 지금 `deactivate`는
그 함수를 아예 부르지 않아서 codex가 없거나 낡아도 완주한다. 새 의존을 그대로 넣으면 uninstall이
throw로 죽는다.

정정: `try/catch`로 감싸고 실패 시 **매니페스트 기반 경로로 후퇴**하며 결과에 기록한다
(`featuresStateUnavailable: boolean`). B1의 순서 덕분에 우리 키는 이미 복원된 뒤라
깨진 codex가 `dedicated_tools = true`를 방치할 수 없다.

### B3 (High) — 삭제되는 테스트를 명시한다

`activate.test.ts:150` "deactivate detects config drift and refuses to revert"는 이 유닛이 없애는
동작을 단언한다. 두 단언 모두 뒤집힌다. 파일 맵을 고친다.

정정된 행: `activate.test.ts` MODIFY — 해당 테스트를
**"deactivate reverts our keys and preserves unrelated edits"로 교체**한다. 새 단언은 느슨해지지 않고
더 강해야 한다: `disabled`가 비어 있지 않고, **주입된 `# user edit` 줄이 바이트 그대로 살아 있다.**

### B4 (Medium) — 죽은 `skippedDrift`를 남기지 않는다

`cli.ts:56`이 유일한 프로덕션 독자다. 영구 false로 두면 그 분기가 도달 불가가 되고 메시지는 거짓이 된다.
wp5로 미루면 그 사이 트리가 거짓을 출하한다.

정정: `DeactivateResult`에서 `skippedDrift`를 **제거**하고 `cli.ts`의 해당 분기도 이 사이클에서 지운다.
컴포넌트 밖에서 `DeactivateResult`를 읽는 곳이 없으므로 API 파손이 아니다.
`structure/INDEX.md:104`의 "refuses blind revert if the config hash drifted" 서술도 같은 사이클에서 갱신한다.

### B5 (Medium) — 값 일치는 출처 증명이 아니다

boolean 값이 같다는 건 1비트뿐이다. `appliedValue="true"` == live `true`가 "우리가 썼다"를 증명하지 못한다.
dotfile 동기화나 다른 머신 복원으로 파일이 통째로 바뀌었고 그쪽 주인이 독립적으로 같은 값을 넣었다면,
새 로직은 **우리가 쓴 적 없는 키를 지운다.** 전체 해시 가드가 잡던 게 정확히 이 경우다.

정정: 해시를 판단에서 빼지 말고 **신호로 격하해 보고**한다.

    fileDrifted: boolean            // postActivateHash 불일치 여부. CLI가 출력한다

그리고 파괴적 하위 경우에만 게이트를 둔다: `fileDrifted && rec.priorValue === null` 이면
**활성화 시점 백업이 뒷받침할 때만** 키를 지운다(`readTableKey(backupContent, table, key) === null`).
뒷받침이 없으면 지우지 않고 `skippedExternal`에 새 사유 `unverifiable`로 보고한다.

플래그 쪽도 같은 1비트 문제를 갖지만 여기서는 **받아들인다**: 플래그 되돌리기는 값 삭제가 아니라
`codex features disable` 호출이고, 사용자가 다시 켜면 원상복구가 한 번의 명령이다. 파괴성이 다르다.

### B6 (Medium) — 버전 타입과 파싱 검증

이 저장소에는 `tsc` 단계가 없다(루트 `test`는 `node --test`뿐). 타입만으로는 아무것도 못 막는다.

정정: `version`을 `1 | 2`로 넓히고, `deactivate.ts:36`의 `JSON.parse(...) as InstallManifest`를
**런타임 형태 검사**로 바꾼다. 형태가 어긋나면 `noManifest`처럼 안전 무동작으로 처리한다.
v1 매니페스트 파싱 테스트를 별도로 추가한다(기존 시나리오 6은 동작만 덮고 파싱은 안 덮는다).

### 파일 맵 갱신

| 파일 | 동작 |
|---|---|
| `config-guard/src/activate.ts` | MODIFY — v2 매니페스트, `tableKeys`, `version: 1 \| 2` |
| `config-guard/src/deactivate.ts` | MODIFY — 키 단위 복원, fail-open, 런타임 검증, `fileDrifted` |
| `config-guard/src/cli.ts` | MODIFY — `skippedDrift` 분기 삭제, 새 필드 출력 (wp5에서 앞당김) |
| `config-guard/test/activate.test.ts` | MODIFY — 드리프트 테스트 교체 |
| `config-guard/test/deactivate-drift.test.ts` | NEW |
| `structure/INDEX.md` | MODIFY — 해시 가드 서술 갱신 |

