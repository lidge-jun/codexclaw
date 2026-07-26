# 080 — manifest target 검증기 공용화 + doctor 확장

출처: `002` #13 (ADAPT / E8) · 의존: 없음 · 상태: PLANNED

## 문제 (A 단계 정정된 형태)

초기 판정은 "doctor에 runtime target 검사가 없다"였다. 리뷰어가 이를 반박했고 확인 결과
**검사는 이미 존재한다 — build 시점에.**

- `plugins/codexclaw/scripts/build.mjs:101-121` — manifest가 열거한 각 hook JSON을 열고
  `${PLUGIN_ROOT}/....js` command target의 존재를 확인한다.
- `plugins/codexclaw/scripts/build.mjs:124-139` — MCP 설정의 `.js` args target 존재를 확인한다.

진짜 gap은 두 가지다.

1. **doctor가 이 검증기를 재사용하지 않는다.** `plugins/codexclaw/components/cxc-ops/src/doctor.ts:59-113,178-209`는
   자체 검사를 하고 build 로직과 분리돼 있다. 설치된 플러그인을 진단할 때 build 시점 지식이 없다.
2. **build 검사도 불완전하다:** 비어있지 않음(0바이트), plugin root 경로 포함(심링크 이탈),
   `commandWindows` 변형을 보지 않는다.

> **정정(A 라운드 2):** 초안이 적었던 "설치본의 절대경로 materialization"은 **사실이 아니다.**
> 설치본도 `${PLUGIN_ROOT}`와 상대경로를 그대로 쓴다(근거는 아래 "설치본 실물 형태" 절).
> 따라서 이 슬라이스는 모드 분기를 만들지 않고, **호출자가 넘긴 `pluginRoot` 하나를 기준으로
> 치환·해석하는 단일 검증기**를 만든다.

따라서 이 슬라이스는 **새 파서를 만들지 않는다.** 기존 검증기를 공용화하고 확장한다.

## WP7 P 실측: 공용 모듈 위치를 바꿔야 한다

초안은 `plugins/codexclaw/scripts/lib/manifest-targets.mjs`를 만들어 build와 doctor가
공유하자고 했다. 실측 결과 **그 위치로는 doctor가 쓸 수 없다.**

### 확인한 사실

| 사실 | 근거 |
| --- | --- |
| 빌드는 `components/*/src/*.ts`만 `dist/*.js`로 컴파일한다 | `plugins/codexclaw/scripts/build.mjs:25-27`, `:70-71`, `:153-155` |
| `scripts/`는 빌드 대상이 아니다 | 같은 파일 `COMPONENTS` 배열에 없다 |
| 빌드는 `.ts` → `.js` 스펙만 재작성한다 | `build.mjs:44-52`의 `rewriteSpecifiers` |
| doctor는 `components/cxc-ops/src/doctor.ts` → `dist/doctor.js` | `ls components/cxc-ops/dist/` |
| `.ts`에서 `.mjs` import 자체는 동작한다 | `/tmp` 스크래치에서 실제 실행 확인 (`node use.ts` → `hi world`, exit 0) |

즉 `doctor.ts`가 `../../../scripts/lib/manifest-targets.mjs`를 import하면 **소스에서는
돌지만 `dist/doctor.js`에서는 경로가 깨진다** — `scripts/`가 dist로 복사되지 않기 때문이다.

### 정정된 배치 (A 감사 1라운드 반영)

공용 모듈을 **컴포넌트 안**에 둔다. 설계를 하나로 못 박는다 (블로커 1 — 초안이
`dist` 호출과 소스 import를 동시에 적어 서로 배타적이었다):

- `build.mjs`는 `components/cxc-ops/src/manifest-targets.ts`를 **동적 import**한다.
  Node 24가 `.ts`를 네이티브로 스트립하므로 플래그가 필요 없다 — 리뷰어가 실측 확인
  (`node --version` v24.17.0, 플래그 유무 모두 성공, 경고 없음). CI도 Node 24를 고정한다
  (`.github/workflows/ci.yml:25`).
- `doctor.ts`는 `./manifest-targets.ts`를 정적 import한다. 빌드의 `rewriteSpecifiers`가
  `.ts` → `.js`로 바꿔주므로 dist에서도 동작한다.
- **`dist/manifest-targets.js`를 부르지 않는다.** 그것이 부트스트랩 순환을 만든다.

| 파일 | 변경 유형 |
| --- | --- |
| `plugins/codexclaw/components/cxc-ops/src/manifest-targets.ts` | **신규** — 공용 검증기 |
| `plugins/codexclaw/scripts/build.mjs` | `:101-139` 인라인 로직 → 소스 `.ts` 동적 import 후 호출 |
| `plugins/codexclaw/components/cxc-ops/src/doctor.ts` | `./manifest-targets.ts` import, **기존 hook 검사 블록(`:77-91`, 주석 "2. each manifest-referenced hook file exists")을 이것으로 교체** (중복 방지, 블로커 7) |
| `plugins/codexclaw/components/cxc-ops/test/manifest-targets.test.ts` | 신규 테스트 |

### 보존해야 할 기존 build 오류 4종 + JSON 파싱 2경로 (블로커 2)

리뷰어가 현행 메시지를 전수 열거했다. 이 여섯 경로를 전부 회귀 테스트로 고정한다.

| # | 정확한 메시지 | 위치 |
| --- | --- | --- |
| 1 | `manifest hook file missing: ${hookRel}` | `build.mjs:105` |
| 2 | `hook references missing dist: ${m[1]}` | `build.mjs:117` |
| 3 | `manifest mcpServers file missing: ${manifest.mcpServers}` | `build.mjs:127` |
| 4 | `mcp server ${srv} references missing dist: ${arg}` | `build.mjs:134` |
| 5 | 훅 JSON 파싱 실패 → `SyntaxError` throw | `build.mjs:89` (호출 `:109`) |
| 6 | MCP JSON 파싱 실패 → `SyntaxError` throw | `build.mjs:89` (호출 `:129`) |

**malformed JSON 정책 확정:** 5·6은 **throw를 유지한다.** 매니페스트가 깨진 것은
검증 대상이 아니라 전제 붕괴이고, 지금 build가 그렇게 죽는다. 공용 모듈도 파싱 실패는
던지고, doctor 쪽에서만 `try/catch`로 감싸 FAIL 체크로 바꾼다.

**단, raw `SyntaxError`로는 던지지 않는다 (블로커 1/라운드 4).** `JSON.parse` 오류에는
파일명도 종류도 없다 — hook JSON과 MCP JSON이 똑같은 메시지를 낸다
(`Expected property name or '}' in JSON at position 1`). 그러면 doctor가 이 예외를
`hooks`로 보낼지 `mcp-targets`로 보낼지 판별할 수 없다. 그래서 출처를 부착한다:

```ts
export class TargetParseError extends SyntaxError {
  readonly kind: TargetKind;
  readonly path: string;   // 절대경로
}
```

`SyntaxError`를 상속하므로 build 쪽 동작(죽는다)과 `instanceof SyntaxError`가 그대로
유지된다 — A5/A6의 기존 계약이 깨지지 않는다. `message`도 원본 `SyntaxError`의 것을
그대로 쓰고 `cause`에 원본을 담는다.

**doctor의 예외 라우팅 (라운드 5 잔여 2 반영):** `"hook" fallback`을 쓰지 않는다.
MCP 파일의 권한 오류·I/O 오류·realpath 실패 같은 비정형 예외를 hook으로 추정하면
거짓 분류가 된다.

| `catch (e)` | 처리 |
| --- | --- |
| `e instanceof TargetParseError` | `e.kind` 체크에 FAIL, evidence에 `e.path` |
| 그 외 전부 | `name: "manifest-targets"` **generic FAIL** 하나에 `String(e)` |

**첫 throw에서 검증이 중단된다는 점도 계약이다.** 파싱 실패는 전제 붕괴이므로 나머지
검사를 이어가지 않는다. 사용자가 JSON을 고친 뒤 다시 돌리면 나머지가 드러난다.

**중단된 검사를 PASS로 표시하지 않는다 (라운드 5 잔여 1).** 실행되지 않은 것과
통과한 것은 다르다. 검증기는 abort 시 **어느 kind까지 순회했는지**를 예외에 담고
(`TargetParseError.path`로 판별 가능), doctor는 미실행 kind의 체크를 다음처럼 낸다:

```
[WARN] mcp-targets — not evaluated after hook parse failure
```

severity는 `WARN`(기존 `CheckResult` 어휘 사용). PASS도 FAIL도 아니다.

**기대값 독립성 (블로커 4):** 위 4개 메시지 문자열을 테스트에 **하드코딩**한다.
공용 모듈의 출력에서 파생시키지 않는다 (`TEST-ORACLE-INDEPENDENCE-01`).
그리고 각 검사를 하나씩 제거해 해당 테스트가 RED가 되는지 mutation으로 확인한다.

### 설치본 실물 형태 (블로커 3 — 초안 전제가 틀렸다)

초안은 설치 시 경로가 절대경로로 materialize된다고 가정했다. **아니다.** 리뷰어가
실제 설치본을 열어 확인했다:

- 훅은 여전히 `${PLUGIN_ROOT}`를 담는다 —
  `/Users/jun/.codex/plugins/cache/codexclaw/codexclaw/0.1.1/hooks/session-start-ensuring-provider-bridge.json:8`
- MCP args는 여전히 상대경로다 —
  같은 설치본 `.mcp.json:6`의 `./components/subagent-config/dist/mcp.js`

따라서 설치본과 저장소는 **같은 형태**다. 검증기는 어느 쪽이든 **전달받은 절대
`pluginRoot`를 기준으로 `${PLUGIN_ROOT}` 치환과 상대경로를 해석**하면 된다.
모드 분기가 필요 없다는 뜻이고, 그래서 `TargetMode`를 폐기한다(아래 API 절).
fixture도 합성 절대경로가 아니라 **실제 payload 트리를 임시 절대 루트로 복사**해서 만든다.

**경로 포함 판정:** 어휘적(lexical) 비교가 아니라 `realpath` 기준으로 한다 —
심링크로 밖을 가리키는 경우를 잡기 위해서다. 심링크 이탈 케이스를 테스트에 넣는다.

### `commandWindows`에 대한 정직한 기록 (WP7 P 실측 + A 라운드 2 보강)

`rg -l 'commandWindows' plugins/codexclaw/hooks/` 결과 **0건**이다. 이 저장소의 훅은
`command` 하나만 쓴다 (예: `stop-checking-pabcd-continuation.json`의
`node "${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js" hook stop`).

upstream omo 스냅샷에는 `commandWindows`가 있어서 초안이 그것을 가정했다. codexclaw에는
없으므로 이 검사는 **자기 트리의 실물 데이터로는 검증할 수 없다.** 다만 fixture를
합성하지 않는다 — vendored omo의 **실제 값을 그대로 하드코딩**한다:

```
powershell -NoProfile -ExecutionPolicy Bypass -File "${PLUGIN_ROOT}\components\bootstrap\scripts\node-dispatch.ps1" "${PLUGIN_ROOT}\components\rules\dist\cli.js" hook session-start
```

출처: `devlog/.lazycodex/plugins/omo/hooks/session-start-loading-project-rules.json:11`.
여기서 확인되는 두 가지 사실이 검증기 요구사항을 정한다.

1. **구분자가 역슬래시다.** 그러므로 `${PLUGIN_ROOT}` 뒤 경로 조각은
   `split(/[\\/]/)` 로 정규화한 뒤 `path.join(pluginRoot, ...parts)` 로 재조립한다.
   POSIX·Windows CI 양쪽에서 같은 결과가 나오는 유일한 방식이다.
   upstream 검증기도 정확히 같은 정규화를 쓴다 —
   `devlog/.lazycodex/plugins/omo/test/bootstrap-hooks.test.mjs:57-63`.
2. **한 명령 안에 target이 둘이다** — `.ps1` launcher와 `.js` 실제 진입점.
   따라서 `matchAll` 로 **모든** `${PLUGIN_ROOT}` target을 수집한다. 첫 매치만 보면
   `.ps1` 만 검사하고 `.js` 를 놓친다. 확장자를 `.js` 로 한정하지도 않는다.

처리 방식:

- 검사 자체는 구현한다 (필드가 있으면 `command`와 동일 규칙 적용). 방어적이고 비용이 없다.
- 다만 그 검사는 **fixture로만 테스트한다.** 실제 트리에서는 영원히 0건이므로
  "실제 트리에서 잡힌다"를 수용 기준으로 걸지 않는다.
- 이 사실을 코드 주석에도 남긴다 — 나중에 누가 "이 분기 죽은 코드 아닌가" 물을 때의 답.

### 신규 `manifest-targets.ts`

```ts
export type TargetKind = "hook" | "mcp";
export interface TargetIssue { kind: TargetKind; message: string; }
export class TargetParseError extends SyntaxError { kind: TargetKind; path: string; }
export function validateManifestTargets(pluginRoot: string): TargetIssue[];
```

**`TargetMode`를 폐기한다 (블로커 2/라운드 2).** 초안은 `"build" | "installed"` 분기가
경로 해석을 가른다고 적었지만, 위에서 확인했듯 두 트리의 형태가 동일하다. 현재 build도
`${PLUGIN_ROOT}`를 plugin root에 붙이고(`build.mjs:114-117`) MCP 상대경로를 같은 root에
붙인다(`:132-134`). 동작 차이가 없는 분기는 fixture가 차이를 **합성**하게 만들고,
그건 `TEST-ROW-REACHABLE-01` 위반이다. 호출자는 각자의 `pluginRoot`만 넘긴다.

**`level: "error" | "warn"`도 폐기한다.** `warn`을 생성하는 시나리오가 하나도 없다.
모든 검사는 build를 실패시켜야 하는 결함이므로 전부 error다. doctor는 이 목록이
비어있지 않으면 FAIL 체크를 만든다. 나중에 실제 warn 조건이 생기면 그때 필드를 붙인다.

**대신 `kind`를 넣는다 (블로커 1/라운드 3).** doctor는 기존에 `name: "hooks"` 체크
하나만 냈는데, 공용 검증기는 hook target과 MCP target을 함께 본다. 전부 `hooks`로
집계하면 MCP 오류가 `[FAIL] hooks`로 잘못 분류된다. `kind`로 갈라서
**두 체크로 렌더**한다 (아래 doctor 절).

검사 항목 — 기존 build 로직(존재 확인)에 네 가지를 더한다:

| 검사 | 현재 build | 신규 |
| --- | --- | --- |
| hook 파일 존재 | 있음 (`build.mjs:104-107`) | 유지 |
| hook command target 존재 | 있음 (`:112-122`) | 유지 |
| MCP args target 존재 | 있음 (`:124-139`) | 유지 |
| target 0바이트 거부 | 없음 | **추가** |
| plugin root 경로 포함 (`../` 이탈 거부) | 없음 | **추가** |
| `commandWindows` 변형도 동일 검사 | 없음 | **추가 (단 이 저장소에 실물 없음 — 위)** |

### `build.mjs`

before: `:101-139`에 hook/MCP 존재 검사가 인라인으로 있다.
after: 그 블록을 지우고 동적 import한 `validateManifestTargets(pluginRoot)`의
결과를 기존 `errors` 배열에 합친다. **동작 동등성이 수용 조건이다** — 기존에 잡던
오류를 계속 잡아야 한다.

### `doctor.ts`

before: `:77-91`(`// 2. each manifest-referenced hook file exists.`)이 manifest hook 파일
존재만 확인하고 `name: "hooks"` 체크를 push한다.
after: **그 블록을 삭제하고** `validateManifestTargets(pluginRoot)` 호출로 교체한 뒤,
반환 issue를 `kind`로 갈라 **체크 두 개**를 push한다.

| 체크 이름 | 입력 | severity |
| --- | --- | --- |
| `hooks` (**기존 이름 유지**) | `kind === "hook"` issue | 없으면 PASS, 있으면 FAIL |
| `mcp-targets` (**신규**) | `kind === "mcp"` issue | 없으면 PASS, 있으면 FAIL |

`evidence`에는 해당 kind의 issue 메시지를 합친다. 이름을 이렇게 정하는 이유:

- **`hooks`를 유지해야 기존 계약 테스트가 산다.** `components/cxc-ops/test/cxc-ops.test.ts:65-74`가
  `checks.find((c) => c.name === "hooks")`로 FAIL과 `ghost.json` evidence를 단정한다.
  이 테스트를 **수정하지 않고 통과시키는 것이 수용 조건**이다 (기존 계약 보존 증명).
- MCP 오류를 `hooks`에 섞지 않으므로 D2의 "새 항목 등장"은 `mcp-targets` 줄로 관측한다.
- hook 누락 FAIL은 여전히 **정확히 한 번만** 난다 (D3).

파싱 실패는 `try/catch`로 감싸 FAIL 체크로 바꾼다 (공용 모듈은 throw를 유지하므로 —
위 malformed JSON 정책).

## PLAN-BYPASS-NAMED-01

| 필드 | 값 |
| --- | --- |
| tier | **E8** (build/CI 시점 게이트) |
| 실행 주체 | `npm run build`, CI(`.github/workflows/ci.yml:31`이 `npm test`를 돌리고 그 안에 build 테스트가 있다), `cxc doctor` |
| 알려진 우회 | **build를 건너뛰거나 CI를 우회하고 커밋된 payload/dist를 직접 설치**하면 검사되지 않는다. doctor를 실행하지 않으면 설치본 문제도 드러나지 않는다 |
| 잔여 위험 | 매니페스트에 선언되지 않은 런타임 참조는 대상 밖이다 |
| 표현 강등 | "build는 우회 불가"는 **거짓이었다** (블로커 7). build는 호출해야 돈다. 현재 가장 강한 층은 CI다 |
| 최종 강제층 | **CI** (선언된 target에 한해). build 단독은 아니다 |

## PLAN-FIELD-CHAIN-01

신규 타입은 **셋이다** — `TargetKind`, `TargetIssue`, `TargetParseError`.
`TargetMode`는 라운드 2에서 폐기했다 (동작 차이가 없는 ghost state였다 — 위 API 절).
`WARN` severity는 `doctor.ts:14`의 기존 어휘를 그대로 쓴다 (신규 타입 아님).

**`TargetKind`** (`"hook" | "mcp"`)

| 단계 | 경로 |
| --- | --- |
| 생성 | `validateManifestTargets` 내부. hook 순회 루프는 `"hook"` 리터럴, MCP 순회 루프는 `"mcp"` 리터럴. **예외 경로도 같다** — `TargetParseError`가 던져질 때 어느 루프에서 났는지에 따라 같은 리터럴을 붙인다 |
| 직렬화 | N/A — 프로세스 내 객체 (정상 경로는 `TargetIssue.kind`, 예외 경로는 `TargetParseError.kind`) |
| 역직렬화 | N/A |
| 소비 | `doctor.ts`만 소비한다 — 정상 issue는 `hooks`/`mcp-targets` 분배, 예외는 `catch`에서 `e.kind`로 같은 두 체크 중 하나에 FAIL 배치. `build.mjs`는 무시 |

**`TargetIssue`** (`kind` 포함)

| 단계 | 경로 |
| --- | --- |
| 생성 | `validateManifestTargets` 내부 |
| 직렬화 | N/A |
| 역직렬화 | N/A |
| 소비 | `build.mjs`(`kind` 무시, `message`만 `errors` 합류), `doctor.ts`(`kind`로 `hooks`/`mcp-targets` 두 `CheckResult`로 분기 후 렌더 — `doctor.ts:255`), 신규 테스트 |

`kind`의 소비자는 doctor 하나다. build는 모든 오류를 같은 배열에 넣으므로 무시한다 —
이 비대칭을 코드 주석에 남긴다.

**`TargetParseError`**

| 단계 | 경로 |
| --- | --- |
| 생성 | `validateManifestTargets` 내부 `JSON.parse` 래핑. hook 루프는 `kind:"hook"`, MCP 루프는 `kind:"mcp"`, `path`는 실패한 파일의 절대경로, `cause`는 원본 `SyntaxError` |
| 직렬화 | N/A — 프로세스 내 예외 |
| 역직렬화 | N/A |
| 소비 | `build.mjs`는 **잡지 않고 전파**시킨다 (기존 동작 = 죽는다). `doctor.ts`는 `catch`에서 `e.kind`로 FAIL 체크를 배치하고 반대편 kind는 `WARN not evaluated`로 표시. 테스트는 A5/A6가 `instanceof` 두 개와 `.kind`를 단정 |

`pluginRoot: string`은 호출자가 만든다 — `build.mjs`는 스크립트 기준 상대 해석,
`doctor.ts`는 설치 경로. 문자열 하나이고 분기를 만들지 않으므로 별도 사슬 표가 필요 없다.

## 테스트 (accept criteria)

### A. 기존 build 가드 보존 (블로커 2·4 — 메시지를 하드코딩하고 mutation으로 증명)

| # | 시나리오 | 기대 (독립 하드코딩) | 검증 |
| --- | --- | --- | --- |
| A1 | 매니페스트가 없는 hook 파일을 선언 | issue 객체 전체가 `{ kind: "hook", message: "manifest hook file missing: <rel>" }` | 자동 |
| A2 | hook command가 없는 dist를 가리킴 | `{ kind: "hook", message: "hook references missing dist: <path>" }` | 자동 |
| A3 | 매니페스트가 없는 MCP 파일을 선언 | `{ kind: "mcp", message: "manifest mcpServers file missing: <rel>" }` | 자동 |
| A4 | MCP args가 없는 dist를 가리킴 | `{ kind: "mcp", message: "mcp server <srv> references missing dist: <arg>" }` | 자동 |
| A5 | 훅 JSON이 깨짐 | throw. `instanceof SyntaxError` **참**(기존 계약), `instanceof TargetParseError` 참, `.kind === "hook"` | 자동 |
| A6 | MCP JSON이 깨짐 | throw. `instanceof SyntaxError` 참, `.kind === "mcp"` | 자동 |

A1-A4는 **객체 전체를 단정한다** — 메시지만 보면 `kind`를 잘못 붙여도 통과한다.
메시지 문자열은 여전히 하드코딩이고 DUT 출력에서 파생시키지 않는다.
| A7 | **mutation** | A1-A4 각 검사를 하나씩 제거하면 해당 테스트가 RED, 복원하면 GREEN | **수동 (C 단계 감사 절차)** |

**A7은 자동이 아니다 (블로커 5/라운드 2).** 저장소에 mutation harness가 없고, 이 슬라이스가
그것을 도입하지도 않는다. 대신 B 구현 직후 C 단계에서 사람이 수행하는 **고정 절차**로 못 박는다:

```
for each check in {A1, A2, A3, A4}:
  1. manifest-targets.ts 에서 해당 검사의 push 한 줄을 주석 처리
  2. npm test  → 해당 테스트만 실패(RED)임을 출력으로 확인
  3. 주석 복원
  4. npm test  → exit 0 (GREEN)
  5. shasum -a 256 plugins/codexclaw/components/cxc-ops/src/manifest-targets.ts
     → mutation 이전에 기록해 둔 해시와 일치 확인
```

**5단계에 `git diff --quiet`를 쓰지 않는 이유:** mutation 시점에 파일이 아직 untracked면
diff가 항상 조용해서 복원 증거가 되지 않는다. 해시 비교는 tracked 여부와 무관하다.
절차는 **B 커밋 이후** 수행하고, mutation 전 해시를 evidence에 먼저 적는다.

C 단계 evidence에 4회의 RED 테스트 이름과 최종 GREEN exit 0을 기록한다. 절차를 돌리지
않았으면 A7은 "미수행"으로 정직하게 남긴다 — 통과로 적지 않는다.

### B. 신규 검사

| # | 시나리오 | 기대 | 검증 |
| --- | --- | --- | --- |
| B1 | target 0바이트 (hook, MCP 각각) | `error` 1건씩 | 자동 |
| B2 | target이 plugin root 밖 (`../`) | `error` 1건 | 자동 |
| B3 | 심링크로 밖을 가리킴 | `error` 1건 — realpath 기준 판정 | 자동 |
| B4a | `commandWindows` 실물 문자열(omo `session-start-loading-project-rules.json:11` 하드코딩)에서 **`.ps1` launcher만 누락** | `error` 1건, 메시지에 `node-dispatch.ps1` 포함 | 자동 (fixture) |
| B4b | 같은 문자열에서 **`.js` target만 누락** | `error` 1건, 메시지에 `rules/dist/cli.js` 포함 | 자동 (fixture) |
| B4c | 같은 문자열에서 둘 다 누락 | `error` 2건 | 자동 (fixture) |
| B4d | 둘 다 존재 | issue 0건 — 역슬래시가 POSIX에서도 올바르게 해석됨을 증명 | 자동 (fixture) |

B4 계열은 **fixture 전용**이다 — 이 저장소 훅에는 `commandWindows`가 없다.
역슬래시·다중 target·비-`.js` 확장자를 모두 실제 upstream 값으로 고정하므로 합성이 아니다.

**하드코딩 시 `String.raw`를 쓴다.** 일반 문자열 리터럴에 `\c`를 쓰면 역슬래시가
소실돼 fixture가 조용히 POSIX 경로로 바뀐다. B4d(둘 다 존재 → issue 0건)가 POSIX에서
이 실수를 잡아내지만, 애초에 `String.raw` 또는 `\\` escaping으로 방지한다.

### C. 설치본 모드 (블로커 3 — 실물 형태로)

"모드"는 폐기됐지만 **설치본 형태의 fixture 검증은 유지한다** — 실제 payload 트리로
검증기를 한 번은 돌려봐야 하기 때문이다.

| # | 시나리오 | 기대 | 검증 |
| --- | --- | --- | --- |
| C1 | 실제 payload 트리를 임시 절대 루트로 복사, `${PLUGIN_ROOT}`와 상대 MCP 경로 그대로 | issue 0건 | 자동 |
| C2 | 같은 fixture에서 `components/provider-bridge/dist/cli.js` 삭제 | `error` **정확히 1건** | 자동 |
| C2b | 같은 fixture에서 `components/pabcd-state/dist/cli.js` 삭제 | `error` **11건** (같은 target을 11개 훅이 참조) | 자동 |

**C2의 target을 이름으로 못 박는 이유 (블로커 5/라운드 2):** 훅 target은 공유된다.
실측(`grep -oh 'PLUGIN_ROOT}/[^"]*\.js' plugins/codexclaw/hooks/*.json | sort | uniq -c`):
`provider-bridge/dist/cli.js` 1회, `subagent-config/dist/spawn-attach-hook.js` 1회,
`cxc-ops/dist/cli.js` 2회, `recall/dist/cli.js` 3회, `pabcd-state/dist/cli.js` **11회**.
그래서 "1건"을 기대하려면 유일 참조 target을 지정해야 하고, 공유 target의 다중 보고는
C2b로 별도 고정한다. 참조 횟수는 fixture 생성 시 소스에서 세지 말고 **하드코딩**한다
(`TEST-ORACLE-INDEPENDENCE-01`) — 훅이 늘어 숫자가 바뀌면 테스트가 깨지는 것이 맞다.

**C3(모드 구분 fixture)는 삭제한다.** `TargetMode` 폐기와 함께 검증 대상이 사라졌다.

### D. 통합

| # | 시나리오 | 기대 | 검증 |
| --- | --- | --- | --- |
| D1 | `npm run build` | exit 0, 파일 수 111 → 112 | 자동 |
| D1b | dist 델타가 `dist/manifest-targets.js` 신규 + `dist/doctor.js` 변경 **둘뿐** | `git diff --stat 5692826e20f768b3005552f5234ff23160979644..HEAD -- plugins/codexclaw/components/` 출력의 `dist/` 항목이 정확히 그 두 파일 (기준 SHA = WP7 시작 시점 HEAD, WP6 커밋) | **수동 (C 단계 감사)** |
| D2 | doctor 스모크 | `node plugins/codexclaw/bin/cxc.mjs doctor` 출력에 `mcp-targets` 줄이 등장한다. **exit 0을 기대하지 않는다** — 현재 baseline이 이미 exit 1이다 (`goalplan`/`skill-hub` 스킬 검사 기존 실패) | 자동 |
| D3 | doctor 중복 없음 | hook 파일 하나가 없을 때 `hooks` FAIL이 **한 번만** 뜬다 (기존 블록을 교체했으므로) | 자동 |
| D5 | **기존 doctor 계약 보존** | `components/cxc-ops/test/cxc-ops.test.ts:65-74`를 **수정하지 않고** 통과 | 자동 |
| D6 | malformed **hook** JSON에서 doctor | `hooks` FAIL 1건 + `mcp-targets` severity가 **`WARN`** (`not evaluated after hook parse failure`). **PASS면 실패** | 자동 |
| D7 | malformed **MCP** JSON에서 doctor | `mcp-targets` FAIL 1건. `hooks`는 순회를 마쳤으므로 PASS 허용 — 단 evidence에 MCP 경로 문자열이 없어야 함 | 자동 |
| D8 | 비정형 예외(읽기 권한 제거된 hook 파일) | `manifest-targets` generic FAIL 1건. `hooks`/`mcp-targets`에 오분류되지 않음 | 자동 |

D6-D8이 `kind` 라우팅의 유일한 관측 지점이다 (블로커 1/라운드 4, 잔여 1·2/라운드 5).
D2는 정상 payload만
보므로 모든 MCP issue에 `kind: "hook"`을 잘못 붙여도 통과한다 — 그 구멍을 이 두 행이 막는다.
D6의 `WARN`은 "실행되지 않음"과 "통과함"을 구분하기 위한 것이다 — 미실행을 PASS로
표시하면 깨진 hook JSON 하나가 MCP 결함 전부를 가린다.
D8은 root 환경에서 `chmod 000`이 무력하므로, 그 경우 파일을 디렉터리로 대체하는
방식으로 `EISDIR`을 유발한다 (CI가 root로 도는 경우 대비).
| D4 | 전체 스위트 | 실패 0, 신규 테스트만큼 증가 | 자동 — `npm test` |

**D1b가 수동인 이유 (블로커 5/라운드 2):** 기존 자동 테스트로는 "WP7 이전 대비 델타"를
알 수 없다. `build.test.mjs:38-43`은 두 번 빌드한 결과의 **멱등성**만 보고,
`dist-freshness.test.mjs:28-53`은 **현재** source와 **현재** committed dist를 비교한다.
이전 커밋과의 비교는 git 없이는 불가능하므로 C 단계 감사 증거로 분류하고,
자동 테스트는 build idempotency와 source↔dist freshness에 한정한다.

### 검증 명령 (PLAN-VERIFIER-REAL-01)

- `npm test` — **baseline 실측**: exit 0, 1,224 pass / 0 fail.
  사슬: `package.json:24` → `components/*/test/*.ts` glob이 신규 테스트를 포함한다.
  → **이 슬라이스를 실제로 관측하는 주 검증기.**
- `npm run build` — **baseline 실측**: exit 0, 111 files compiled.
  사슬: `package.json:22` → `scripts/build.mjs`. 이 슬라이스가 그 파일을 바꾼다.
  → **관측한다.**
- `node plugins/codexclaw/bin/cxc.mjs doctor` — **baseline 실측**: exit 1
  (기존 `goalplan`/`skill-hub` 스킬 검사 실패). 새 출력 줄의 등장만 단정한다.
  → **관측한다.**
- 좁은 타입체크 — **B 완료 후** 실행할 verifier (블로커 4/라운드 2 → 라운드 3 정정,
  PLAN-VERIFIER-REAL-01):

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext \
    plugins/codexclaw/components/cxc-ops/src/manifest-targets.ts \
    plugins/codexclaw/components/cxc-ops/src/doctor.ts \
    plugins/codexclaw/components/cxc-ops/test/manifest-targets.test.ts
  ```

  세 파일은 이 슬라이스가 손대는 **TypeScript 파일 전부**다. 이 슬라이스는 그 밖에
  `scripts/build.mjs`(`.mjs`, tsc 대상 아님)를 고치고 `dist/` 2파일을 재생성한다.
  인자 없는 `npx tsc --noEmit`은 **적지 않는다** (root `tsconfig.json` 없음 — 도움말만 출력).

  **지금 이 명령을 그대로 돌리면 exit 2 / `TS6053`이다** — 신규 2파일이 아직 없다.
  B 이후에만 유효하며, 그때의 수용 조건은 exit 0이다.

  **변경 전 baseline 실측(WP7 A 라운드 2, 실제로 RUN한 명령):**

  ```
  npx tsc --noEmit --allowImportingTsExtensions --module nodenext --target es2022 \
    --moduleResolution nodenext plugins/codexclaw/components/cxc-ops/src/doctor.ts
  ```

  → exit 0, 출력 없음. 이 슬라이스가 손대는 기존 표면의 타입 오류는 **0건**이다
  (컴포넌트 전역 23건은 다른 파일들의 문제이며 범위 밖).
- `npm run gate` — **이 슬라이스를 관측하지 않는다** (블로커 5). `checkCounts`는 hook 수만
  비교한다(`gate.mjs:277-288`). **비관측 baseline 회귀 확인용으로만 분류한다** — 수용 기준의
  검증기가 아니다.

## 범위 밖

- upstream의 source cache 복구/동기화 (`002` #14 REJECT).
- LazyCodex 전용 doctor 라우팅 정책.
