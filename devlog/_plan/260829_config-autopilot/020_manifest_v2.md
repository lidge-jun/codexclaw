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

