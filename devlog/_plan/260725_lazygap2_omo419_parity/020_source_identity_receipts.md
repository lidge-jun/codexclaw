# 020 — 소스 정체성 영수증 모듈

출처: `001` #8/#10의 공통 기반 (A 단계 신설, 리뷰어 블로커 6) · 의존: 없음 · 상태: PLANNED

## 문제

"영수증이 비어있지 않다"는 검사는 stale 증거를 막지 못한다. 테스트를 돌린 뒤 코드를
고치거나, 리뷰를 받은 뒤 코드를 고쳐도 영수증은 그대로 유효해 보인다. 현행 리뷰어 계약은
이미 base/head anchor를 요구하는데
(`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md:401-406` — WP9 P 실측으로 정정,
초안이 적은 `:381-388`은 `REVIEW-COVERAGE-01` 블록으로 밀려 있었다),
런타임 영수증에는 그에 대응하는 값이 없다.

`030`(최종 gate 상태), `040`(gate 선행조건 가드), `070`(QA 증거 freshness)이 전부
같은 원시값을 필요로 하므로 먼저 만든다.

## 변경 파일 맵

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/pabcd-state/src/source-identity.ts` | 신규 |
| `plugins/codexclaw/components/pabcd-state/test/source-identity.test.ts` | 신규 |

## before → after

before: 소스 상태를 나타내는 공용 값이 없다. 각 훅이 각자 파일 mtime을 보거나 아무것도 안 본다.

after: `source-identity.ts`가 하나의 값을 만든다.

```ts
export interface SourceIdentity {
  kind: "resolved" | "unavailable"; // git이 없으면 "unavailable"
  commitSha: string;      // git rev-parse HEAD; unavailable이면 ""
  dirty: boolean;         // 추적 파일에 uncommitted 변경이 있는가
  treeHash?: string;      // dirty일 때만: 아래 "포함 집합"의 경로+상태+내용 SHA-256
  capturedAt: string;     // RFC3339
}

export function captureSourceIdentity(cwd: string): SourceIdentity;
/** discriminated result. boolean|string 유니온이면 `"unavailable"`이 truthy라서
 *  "판정 불가"가 "같다"로 새어 들어간다 (4라운드 감사 1). 그래서 세 경우를 각각
 *  이름 붙인 객체로 반환한다 — 소비자가 `.kind`를 명시적으로 갈라야 한다.
 *  주의: 객체 반환이 truthiness 오용을 막아주지는 '않는다' (아래 assertNever 절). */
export type SourceComparison =
  | { kind: "same" }
  | { kind: "different"; detail: string }
  | { kind: "unavailable"; reason: string };
export function compareSource(a: SourceIdentity, b: SourceIdentity): SourceComparison;
export function describeSource(id: SourceIdentity): string; // deny 메시지용 짧은 표기
```

소비자는 `switch (result.kind)`로 세 경우를 모두 처리한다. `default` 없이 exhaustive하게
쓰면 새 경우가 추가될 때 컴파일 오류로 잡힌다. 이 문서 안에서 이전에 `sameSource`라고
쓴 곳은 모두 `compareSource(...).kind === "same"`을 뜻한다.

### 포함 집합 (재감사 4 반영 — 핵심 정정)

초기 초안은 **모든 untracked 파일을 무시**했다. 이는 실제 구멍이다: 아직 `git add`하지 않은
새 `.ts` 파일은 프로덕션 코드인데도 정체성에 반영되지 않아, 리뷰·테스트 후 새 파일을
추가해도 gate가 계속 유효하다고 판정한다.

정정된 규칙 — **정확히 이 명령 하나**를 쓴다 (WP9 A 라운드 1, 실측으로 확정):

```
git status --porcelain=v1 -z --untracked-files=all
```

두 플래그가 모두 필수다. 기본 출력으로는 안전하게 파싱할 수 없다는 것을 임시
저장소에서 실측했다:

```
# 기본 --porcelain=v1
RM tracked.ts -> "renamed space.ts"
MM sub/x.ts
?? "untracked dir/"

# -z --untracked-files=all  (NUL을 개행으로 바꿔 표시)
RM  renamed space.ts \0 tracked.ts
MM  sub/x.ts
??  untracked dir/new.ts
```

- **`-z`가 없으면 경로가 C-style로 인용된다.** 공백·따옴표·탭·개행이 든 경로는
  `"..."`로 감싸이고 이스케이프된다. 공백 분리 파싱은 경로를 잘못 복원한다.
  `-z`는 raw 바이트를 NUL로 구분해 내보내므로 이스케이프가 없다.
- **`--untracked-files=all`이 없으면 untracked 디렉터리가 한 줄(`?? "untracked dir/"`)로
  뭉개진다.** 그 안의 파일 내용을 바꿔도 그 줄은 그대로다 — stale 소스를 `"same"`으로
  오판하는 직접적인 구멍이다. `all`은 하위 파일을 개별 행으로 낸다.

파싱은 문자열이 아니라 **Buffer**로 받는다(`execFileSync(..., { encoding: "buffer" })`).
각 레코드는 `XY<space><path>` 형태이고 NUL로 끝난다. **`X === "R"` 또는 `X === "C"`이면
바로 다음 NUL 필드가 원본 경로**이므로 하나 더 소비한다 (위 실측에서 `renamed space.ts`
다음에 `tracked.ts`가 따라온 것이 그것이다).

상태별 규칙 — `XY` 두 글자를 통째로 기록하고, **현재 경로에 파일이 존재하면 바이트를
해시한다.** 상태 문자로 해시 여부를 가르지 않는다.

| `XY` | 기록하는 것 |
| --- | --- |
| `_M`, `M_`, `MM` | 경로 + `XY` + **내용 해시** |
| `A_`, `AM` | 경로 + `XY` + 내용 해시 |
| `_D`, `D_` | 경로 + `XY`, 내용 없음 (파일이 없다) |
| `R_`, `RM`, `C_`, `CM` | **양쪽 경로** + `XY` + **대상 경로의 내용 해시** |
| `T_`, `_T`, `TM` (type change) | 경로 + `XY` + 내용 해시 (심링크면 링크 타깃 문자열) |
| `UU`, `AA`, `DU` 등 unmerged | 경로 + `XY` + 내용 해시 (파일이 있으면) |
| `??` (untracked, ignore 안 됨) | 경로 + `??` + 내용 해시 — 프로덕션 코드일 수 있다 |
| **그 밖의 non-clean `XY` 전부** (`MD`, `AD`, `RD`, `DM` …) | 경로 + `XY` + **현재 경로에 파일이 있으면 내용 해시, 없으면 생략** — 표에 없는 조합도 이 fallback으로 반드시 기록된다 |
| gitignore된 경로 | 제외 (`git status`가 기본적으로 안 보여준다) |

**rename도 대상 바이트를 반드시 해시한다 (라운드 1 High 2).** 초안은 R을 "양쪽 경로 +
상태"로만 적었는데, rename 후 내용을 고치면 상태는 `RM`으로 고정된 채 바이트만 바뀐다.
경로와 상태만 넣으면 그 변경이 정체성에 반영되지 않아 gate freshness가 그대로 우회된다.

canonical preimage는 경로 바이트 기준으로 정렬한 뒤 각 레코드를 `XY \0 path \0
[origPath \0] [contentHash] \0`으로 이어 붙여 해시한다 — 구분자가 NUL이므로 경로에
어떤 문자가 있어도 레코드 경계가 모호해지지 않는다.

즉 "무시 목록"은 codexclaw이 임의로 정하지 않고 **저장소의 `.gitignore`를 신뢰한다.**
`devlog/.lazycodex/`(`.gitignore:8`)와 evidence 산출물이 ignore되어 있으면 자동으로 제외되고,
ignore되지 않은 devlog 문서를 새로 쓰면 정체성이 바뀐다. 후자는 의도한 동작이다 —
문서를 쓰는 것도 트리 변경이고, gate를 다시 통과하는 비용은 캡처 한 번이다.

### 축약 금지 (3라운드 감사 3)

초기 초안은 포함 집합이 임계치를 넘으면 `path+size+mtime` 해시로 축약했다. 이는 정체성을
깨뜨린다 — 같은 크기의 내용 변경이나 복원된/저해상도 mtime이 "같은 소스"로 오판된다.

정정: **metadata-only 축약을 하지 않는다.** 항상 내용을 해시하되 스트리밍으로 읽어
메모리를 제한한다 (파일을 통째로 버퍼에 담지 않고 청크 단위로 해시에 흘린다).
포함 집합이 비정상적으로 크면(예: ignore되지 않은 빌드 산출물 디렉터리) 그것은
`.gitignore`가 잘못됐다는 신호다. 축약하지 말고 **경고를 남기고 그대로 해시한다.**
비용이 문제되면 해결책은 `.gitignore` 수정이지 정체성 약화가 아니다.

### git 부재 정책 (3라운드 감사 3)

`kind: "unavailable"`을 반환하고 `compareSource`는 `{ kind: "unavailable", reason }`을
반환한다.
소비자별 처리를 여기서 못 박는다.

| 소비자 | `kind: "unavailable"` 처리 |
| --- | --- |
| `030` 최종 gate 승인 / 완료 검증 | **거부** — 소스를 특정할 수 없으면 gate가 무의미하다. 메시지에 `schemaVersion: 1` 흐름 안내 |
| `040` spawn 가드 | **allow (비무장)** — 우회 가능한 조기 경고 층이므로 막지 않는다 |
| `070` QA 증거 | 경고 기록, PASS 자체는 막지 않는다 |

이전 초안이 "fail-open"이라고만 적어 `030`의 거부 동작과 모순됐던 부분을 이렇게 해소한다.
`{kind:"different"}`(다르다)와 `{kind:"unavailable"}`(판정 불가)이 타입 수준에서
갈리므로 소비자가 뭉갤 수 없다.

**WP9 P 실측 — "객체 반환이면 truthiness 오용 불가"는 절반만 맞다.** 기록된 결함대로
`strict` tsc에서 `if (compareSource(a, b))`는 **오류 없이 통과한다**(exit 0 실측).
객체는 항상 truthy이므로 그 조건문은 늘 참이고, 컴파일러가 잡아주지 않는다.
따라서 타입만으로는 부족하고 **명시 장치**가 필요하다:

- `compareSource`의 반환 타입에 `kind`를 필수로 두고, 소비자는 `switch (r.kind)`를
  `default` 없이 쓴다. 미처리 분기는 `assertNever(r)` 헬퍼로 컴파일 오류가 된다.
- `assertNever`를 이 모듈에서 export해 `030`/`040`/`070`이 재사용한다.
- 테스트는 "if 오용이 불가능하다"를 단정하지 않는다 — 그건 거짓이다. 대신 세 `kind`
  각각에 대해 소비자 분기가 실제로 갈리는지를 단정한다.

### 기타 설계 결정

- **dirty 트리를 지원해야 한다.** 개발 중 대부분의 C 단계는 커밋 전이다. `commitSha`만으로는
  구분이 안 되므로 위 포함 집합을 해시한다.
- **성능:** 해시는 위 포함 집합에만 적용한다. 전체 트리를 읽지 않으며, 파일은 스트리밍으로 읽는다.

## 테스트 (accept criteria)

각 케이스는 `git init`한 임시 디렉터리를 fixture로 쓴다. 기대값은 하드코딩하고 DUT
출력에서 파생시키지 않는다 (`TEST-ORACLE-INDEPENDENCE-01`).

| # | 시나리오 | 기대 |
| --- | --- | --- |
| T1 | clean 트리에서 두 번 캡처 | `compareSource(...).kind === "same"` |
| T2 | 캡처 후 추적 파일 수정 | `"different"`, `dirty === true` |
| T3 | 캡처 후 ignore되지 않은 untracked 파일 추가 | `"different"` (재감사 4) |
| T4 | 캡처 후 gitignore된 경로에 파일 추가 | `"same"` (ignore 신뢰) |
| T5 | 캡처 후 추적 파일 삭제 | `"different"` |
| T6 | 캡처 후 rename | `"different"` |
| T7 | 캡처 후 staged만 하고 커밋 안 함 | `"different"` |
| T8 | untracked 파일을 추가했다가 다시 삭제 | `"same"` (복원) |
| T9 | 캡처 후 커밋 (내용 동일) | `commitSha` 변경 → `"different"` |
| T10 | dirty 상태에서 변경을 되돌림 | `"same"` (treeHash 복원) |
| T11 | git 아닌 디렉터리 | `kind === "unavailable"` 양쪽, 비교도 `"unavailable"` |
| T12 | 한쪽만 `unavailable` | 비교가 `"unavailable"` — `"different"`로 뭉개지 않는다 |
| T13 | `describeSource` 출력 | SHA 앞 7자 + dirty 표시 포함 |
| T14 | 같은 크기·같은 mtime으로 내용만 변경 | `"different"` — 축약 금지의 핵심 회귀 |
| T15 | `assertNever` | 세 `kind`를 모두 처리하는 switch는 컴파일되고, **하나를 뺀 switch에 `@ts-expect-error`를 붙인 fixture**가 테스트 파일에 있다. 좁은 tsc에 `--strict`를 붙여 돌리므로, 그 자리에서 오류가 안 나면 `@ts-expect-error`가 미사용으로 판정돼 컴파일이 실패한다 — 주석 선언이 아니라 실제 관측이다 |
| T16 | 공백·따옴표·탭이 든 경로 (`untracked "quote".ts`) | 경로가 온전히 복원되고 `"different"` — `-z` 없이 파싱했다면 실패한다 |
| T17 | untracked **디렉터리** 안의 파일 내용 변경 | `"different"` — `--untracked-files=all` 없이는 `?? dir/` 한 줄이 그대로라 실패한다 |
| T18 | `RM` 상태 유지한 채 내용만 재변경 | `"different"` — rename 대상 바이트를 해시하지 않으면 실패한다 (라운드 1 High 2) |
| T19 | `MM` 상태 유지한 채 내용만 재변경 | `"different"` |
| T20 | rename 원본/대상 경로가 서로 뒤바뀐 두 트리 | `"different"` — 양쪽 경로를 모두 기록하는지 확인 |
| T21 | `MD`(추적 파일 staged 수정 후 작업트리에서 삭제), `AD`(추가 후 삭제) | 각각 기록되고 `"different"` — 표에 없는 `XY` fallback 회귀 |

**소비자 분기 테스트는 여기 없다.** `030`/`040`/`070`이 아직 없으므로 그 케이스는
해당 슬라이스의 몫이다 — 없는 소비자를 fixture로 합성하지 않는다.
**"큰 포함 집합 경고" 케이스도 넣지 않는다** — 임계치를 정하면 그게 곧 축약 정책의
씨앗이 된다. 경고는 남기되 수용 기준으로 걸지 않는다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — baseline 실측 exit 0, 1,243 pass. 사슬: `package.json:24` glob이
  `components/pabcd-state/test/*.ts`를 포함한다. → **주 검증기.**
- 좁은 타입체크 (**B 이후 유효**, 신규 파일이라 지금은 `TS6053`):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext --strict \
    plugins/codexclaw/components/pabcd-state/src/source-identity.ts \
    plugins/codexclaw/components/pabcd-state/test/source-identity.test.ts
  ```

  두 파일 다 신규이므로 baseline 오류가 없다 — 수용 조건은 **exit 0**이다.
  `--strict`가 필수다: T15의 `@ts-expect-error` fixture가 실제로 오류를 잡는지는
  strict 모드에서만 의미가 있다.
  인자 없는 `npx tsc --noEmit`은 적지 않는다 (root `tsconfig.json` 없음).
- `npm run build` — 신규 `.ts`가 dist로 컴파일되어야 한다(파일 수 +1). → 관측한다.
- `npm run gate` — 이 슬라이스를 **관측하지 않는다** (`walkSkillMds`는 `SKILL.md`만
  읽는다). 비관측 baseline 회귀 확인용.

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **없음** — 이 슬라이스는 게이트가 아니라 **라이브러리**다 |
| 실행 주체 | 없음. 아무도 아직 호출하지 않는다 (`030`/`040`/`070`이 소비자) |
| 알려진 우회 | N/A — 강제하는 것이 없으므로 우회 대상도 없다 |
| 잔여 위험 | 소비자가 붙기 전까지는 순수 dead code다. 소비 슬라이스가 전부 지연되면 이 모듈도 가치를 못 낸다 |
| 표현 강등 | "stale 증거를 막는다"가 아니라 **"stale을 판별할 원시값을 제공한다"** |
| 최종 강제층 | 없음 (`final layer: none`) |

## PLAN-FIELD-CHAIN-01

| 타입 | 생성 | 직렬화 | 역직렬화 | 소비 |
| --- | --- | --- | --- | --- |
| `SourceIdentity` | `captureSourceIdentity(cwd)` — `git rev-parse HEAD` + `git status --porcelain=v1 -z --untracked-files=all` (Buffer 수신) | **아직 없다.** 이 슬라이스는 파일에 쓰지 않는다 — 영수증에 넣는 것은 `070`의 몫 | N/A | `compareSource`, `describeSource` |
| `SourceComparison` | `compareSource` 내부 | N/A (프로세스 내) | N/A | 지금은 테스트뿐. 실사용은 `030`/`040`/`070` |

직렬화 단계가 비어 있다는 것이 이 슬라이스의 한계이자 범위다 — 소비 슬라이스가
영수증 스키마를 정할 때 그 자리에서 채운다.

## 범위 밖

- 이 모듈을 소비하는 게이트 로직 (`030`, `040`, `070`의 몫).
- 원격 SHA 비교 / CI 연동.
