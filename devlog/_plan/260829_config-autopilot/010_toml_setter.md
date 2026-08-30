# 010 — wp2: 비-feature TOML 키 setter

## 왜 필요한가

`codex features enable`은 `[features]` 안의 boolean만 다룬다. 우리가 켜야 하는 키는 다른 테이블에 산다.
opencodex는 같은 벽을 만나 손수 줄 단위 편집기를 만들었다(`src/codex/features.ts:415`,
"the codex CLI has no persisted setter for nested feature config"). 우리도 같은 결론에 도달하지만,
그쪽 구현을 복사하지 않는다. 그쪽은 `multi_agent_v2` 한 키에 특화된 정규식 세 개(`headerRe`/`boolRe`/`inlineRe`)라
일반화가 안 되고, 인라인 테이블 형태까지 처리하려다 분기가 늘었다.

## 파일 변경 맵

| 파일 | 동작 |
|---|---|
| `plugins/codexclaw/components/config-guard/src/toml-edit.ts` | NEW — 순수 문자열 변환 계층 |
| `plugins/codexclaw/components/config-guard/src/managed-keys.ts` | NEW — 화이트리스트 |
| `plugins/codexclaw/components/config-guard/test/toml-edit.test.ts` | NEW — 케이스 테스트 |
| `plugins/codexclaw/components/config-guard/src/features.ts` | MODIFY — 상단 불변식 주석에 예외 명시 |

## 설계: 순수 변환 + 얇은 IO

핵심 결정은 **파일 IO를 함수 밖으로 밀어내는 것**이다. opencodex의 `setMaxConcurrentThreads`는
읽기·편집·쓰기를 한 함수에 묶어 테스트가 임시 파일을 필요로 한다. 우리는 문자열→문자열 순수 함수로 만들어
픽스처 문자열만으로 전 케이스를 덮는다. config-guard의 기존 규율(주입된 의존, 테스트가 실제 `~/.codex`에
닿지 않음)과도 맞는다.

```ts
// toml-edit.ts
export type TomlScalar = boolean | number | string;

export interface SetTableKeyResult {
  /** 변경된 전체 내용. 변경이 불필요하면 입력과 동일 문자열. */
  content: string;
  /** 편집 전 값. 키가 없었으면 null. 되돌리기용으로 매니페스트에 기록한다. */
  priorValue: string | null;
  /** 실제로 바뀌었는가. */
  changed: boolean;
  /** 어떤 경로로 처리했는가 — 테스트가 분기 활성화를 확인한다. */
  action: "updated" | "inserted-into-table" | "created-table" | "noop";
}

export function setTableKey(
  content: string,
  table: string,
  key: string,
  value: TomlScalar,
): SetTableKeyResult;

/** 키를 제거하거나 이전 값으로 되돌린다. wp3의 deactivate가 쓴다. */
export function restoreTableKey(
  content: string,
  table: string,
  key: string,
  priorValue: string | null,
): SetTableKeyResult;
```

### 알고리즘

1. 지배적 개행을 판정한다. `\r\n` 개수 >= 순수 `\n` 개수면 CRLF. opencodex `dominantEol`과 같은 판정식을 쓴다
   (그쪽 파일 47-52행). 출력 시 그 개행으로 통일한다.
2. `^\s*\[<table>\]\s*(?:#.*)?$` 로 테이블 헤더를 찾는다. 주석 꼬리를 허용해야 실제 config를 놓치지 않는다.
3. 헤더가 있으면 다음 `^\s*\[` 직전까지가 본문이다. 그 안에서 `^(\s*)<key>\s*=\s*(.*)$` 를 찾는다.
   - 찾으면 값만 교체하고 **꼬리 주석은 보존**한다. 값과 주석 분리는 값 파싱 후 첫 ` #` 로 자른다.
     문자열 값 안의 `#`을 오인하지 않도록, 값이 인용부호로 시작하면 닫는 인용부호 뒤에서만 주석을 찾는다.
   - 없으면 본문 끝(트레일링 빈 줄 앞)에 삽입한다. `action = "inserted-into-table"`.
4. 헤더가 없으면 파일 끝에 `[<table>]` + 키 한 줄을 붙인다. `action = "created-table"`.
   앞에 빈 줄 하나를 두고, 파일이 개행으로 끝나지 않으면 먼저 개행을 넣는다.
5. 기존 값이 요청 값과 문자열로 동일하면 `noop` — 재실행이 파일을 건드리지 않는다(멱등).

값 직렬화: boolean/number는 그대로, string은 기본 인용부호로 감싼다. 셋 외 타입은 받지 않는다(타입으로 차단).

### 원자적 쓰기

호출부(`activate.ts`)가 담당한다. 같은 디렉터리에 `config.toml.codexclaw-tmp-<pid>-<rand>` 로 쓰고
`renameSync`로 교체한다. 같은 파일시스템이므로 rename은 원자적이다. 임시 파일 잔여를 방지하려고
`try/finally`에서 존재 시 삭제한다. opencodex는 `atomicWriteFile` 헬퍼를 공유하지만 그 모듈은
Windows ACL·비밀 처리까지 얽혀 있어 그대로 끌어오지 않고 이 한 가지 용도만 지역 구현한다.

## 화이트리스트

```ts
// managed-keys.ts
export interface ManagedKey {
  table: string;
  key: string;
  /** 기본 설치에서 자동으로 켜는가. 이 유닛에서는 전부 false. */
  autoEnable: false;
  /** 켜기 전 사용자에게 알려야 하는 부수효과. */
  caution: string;
}

export const CONFIG_MANAGED_KEYS: readonly ManagedKey[] = [
  {
    table: "memories",
    key: "dedicated_tools",
    autoEnable: false,
    caution:
      "memories/{list,read,search,add_ad_hoc_note} 네 도구가 열린다. add_ad_hoc_note는 " +
      "메모리에 새 노트를 만드는 쓰기 경로이므로, 명시 요청 없는 쓰기를 막는 훅이 먼저 있어야 한다.",
  },
];
```

`autoEnable`을 타입 수준에서 `false` 리터럴로 못박는다. `features.ts:18-20`이 `multi_agent_v2`를
비선언으로 남긴 선례와 같은 판단이다 — 부수효과 있는 사용자 소유 스위치를 설치가 대신 켜지 않는다.
켜는 행위는 wp5의 `cxc config set` 명시 호출로만 일어난다.

**`DECLARED_FEATURES`에는 아무것도 추가하지 않는다.** 두 어휘는 분리된 채로 남는다:
`DECLARED_FEATURES`는 `[features]` boolean, `CONFIG_MANAGED_KEYS`는 임의 테이블 스칼라.

## 테스트 (c2 활성화 시나리오)

`test/toml-edit.test.ts`, 픽스처 문자열만 사용. 각 케이스가 `action` 값으로 어느 분기가 탔는지 증명한다.

| # | 입력 | 기대 |
|---|---|---|
| 1 | `[memories]\ngenerate_memories = true\n` | `inserted-into-table`, `priorValue=null`, 기존 줄 보존 |
| 2 | 같은 내용 + `dedicated_tools = false` | `updated`, `priorValue="false"` |
| 3 | `dedicated_tools = false  # 사용자 주석` | `updated` + 주석 문자열 그대로 남음 |
| 4 | `[memories]` 없음 | `created-table`, 파일 끝에 테이블 추가, 앞 내용 무변 |
| 5 | CRLF 전체 파일 | 출력에 순수 `\n` 0개 |
| 6 | `[memories]` 뒤에 `[features]`가 이어짐 | 삽입이 `[features]` 헤더를 넘지 않음 |
| 7 | 이미 목표 값 | `noop`, `content`가 입력과 `===` |
| 8 | 값이 `"a # b"` 문자열 | 인용부호 안 `#`을 주석으로 오인하지 않음 |
| 9 | `restoreTableKey(priorValue=null)` | 키 줄이 사라지고 테이블이 비면 헤더도 정리 |
| 10 | `restoreTableKey(priorValue="false")` | 값이 `false`로 복귀 |

## 범위 경계

IN: 위 네 파일. OUT: 실제 `~/.codex/config.toml` 쓰기(이 사이클에서는 어떤 테스트도 실제 경로를 열지 않는다),
`activate.ts`의 호출 배선(wp3에서 매니페스트와 함께), CLI 노출(wp5).

## 검증

`node --test plugins/codexclaw/components/config-guard/test/toml-edit.test.ts` 통과 후 `npm test` 전체.


## A-phase 감사 정정 (파견 감사자 Descartes, GO-WITH-FIXES blockers=5)

독립 감사가 5건을 잡았다. 전부 반영한다. 핵심은 **이미 있는 코드를 다시 쓰지 말라**는 것이었다.

### B1 (High) — 네 번째 TOML 파서를 만들지 않는다

`multi-agent-v2.ts:56` `tomlTableBody`가 이미 이 유닛이 계획한 테이블 탐색을 정확히 한다.
헤더 정규식(60행), "다음 `[`가 본문을 끝낸다"(63행), 그리고 **점 포함 헤더 이스케이프**(59행)까지.
마지막 항목은 계획이 아예 빠뜨렸다. `activate.ts:58`에도 세 번째 파서가 있다.

정정: `toml-edit.ts`가 `tomlTableBody`와 `findKeyLine`을 **소유하고 export**한다.
`multi-agent-v2.ts`는 지역 사본(56-70행)을 지우고 import로 바꾼다. 문법이 하나로 모이고,
기존 `crlf-config.test.ts`의 회귀 커버리지를 새 모듈이 그대로 물려받는다.

파일 변경 맵에 추가: `config-guard/src/multi-agent-v2.ts` MODIFY.

### B2 (High) — EOL 프리미티브는 이미 로컬에 있다

`text-lines.ts`가 `dominantEol`(26행), `withEol`(38행), `splitLines`(16행)을 이미 제공한다.
opencodex에서 다시 가져올 필요가 없다. 게다가 판정식이 다르다: 계획은 `crlf >= lf`였고
출하된 규칙은 `crlf > lf`다. 개행 없는 한 줄 파일이 `0 >= 0`에 걸려 CRLF로 나가는 버그가 된다.

정정: `import { dominantEol, withEol, splitLines } from "./text-lines.ts"`. 판정식은 손대지 않는다.
그리고 `withEol`이 **마지막 개행 유무를 보존**한다는 점을 명시한다 — 그게 그 함수의 존재 이유다.

### B3 (Medium) — 주석 분리에 명시적 포기 경로를 둔다

계획의 규칙("값이 인용부호로 시작하면 닫는 인용부호 뒤에서만")은 네 가지 형태에서 깨진다:
`"""여러 줄"""`, `'리터럴'`, `[1, 2] # c`, 그리고 공백 없는 `false#c`.

정정: 기존 값이 `"""` / `'''` / `[` / `{` 로 시작하거나 그 줄에서 인용부호가 닫히지 않으면
**쓰지 않고 `action:"noop"`로 반환**한다. 그리고 공개 setter의 값 타입을 `boolean`으로 좁힌다.
문자열 키가 실제로 필요해질 때 넓힌다.

    export type TomlScalar = boolean;   // 화이트리스트가 boolean 하나뿐인 동안

추가 테스트: `'''`, `[1, 2] # c`, `false#c`.

### B4 (Medium) — 비워진 `[memories]` 헤더는 남긴다

계획의 테스트 9번은 테이블이 비면 헤더도 지우려 했다. 취소한다.
`[memories]`는 codex 소유이고 우리 키가 아니다. "비었다"는 판정 자체가 우리 시야에서 불가능하다 —
주석만 남은 경우, 다른 writer가 그 사이에 키를 넣은 경우가 구분되지 않는다.
그리고 같은 컴포넌트의 `preserveMultiAgentV2Table`은 남의 테이블을 **복원**하려고 존재한다.
헤더를 지우는 경로는 그 태도와 정반대다. 남기는 비용은 무의미한 한 줄, 지우는 비용은 사용자 테이블과
주석의 조용한 소실이다.

정정된 테스트 9번: 키 줄만 사라지고 `[memories]` 헤더는 **항상** 남는다.
추가 케이스: 테이블에 남의 키 + 주석이 함께 있을 때 둘 다 생존.

### B5 (Low) — dist 신선도 테스트

`test/dist-freshness.test.mjs:35`가 추적된 각 `dist/*.js`를 src에서 재컴파일해 바이트 일치를 단언한다.
`features.ts` 주석만 고쳐도 `dist/features.js`가 낡는다. 손으로 dist를 고치는 건 통하지 않는다
(`compileSource`가 줄마다 `trimEnd()`한다).

정정된 검증 순서: 소스 수정 → `npm run build` → `npm test`. 신규 dist가 런타임 그래프에 들어가면
(wp3에서 `cli.js`가 import할 때) `git add -f`로 추적에 넣어야 `packaging.test.mjs`가 통과한다.
그리고 새 파일 주석에 `TODO(`/`FIXME`/`TBD` 토큰을 넣지 않는다 — `build.mjs:29`가 스캔해서 막는다.

### 확인만 하고 변경 없음

배럴 파일이 없어 깨질 export 표면이 없다. `build.mjs:32` `listTsFiles`가 재귀 탐색이라
신규 파일 등록이 필요 없다.

