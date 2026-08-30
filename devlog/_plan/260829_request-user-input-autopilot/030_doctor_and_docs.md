# 030 — wp4: doctor 체크 + 문서 정정

## 문제

wp2가 실패를 말하게 만들고 wp3가 자동 복구를 붙였지만, 두 경로 다 **세션 시작 시점의
일회성 출력**이다. 사용자가 나중에 "지금 질문선택지가 왜 안 뜨지"를 물을 때 확인할
상시 표면이 없다.

그리고 문서가 틀렸다. `installation.md:19`의 마켓플레이스 트랙은 `cxc enable`을
언급하지 않고, :71은 소스 체크아웃 트랙에서만 대안으로 소개한다. self-heal이 붙으면
그 서술 자체가 낡는다.

## Diff-level

### `cxc-ops/src/doctor.ts` — `features` 체크 추가

현재 doctor의 체크 목록: `manifest`, `skills`, `agents`, `drift:version`,
`drift:mcp`, `hook-trust`, `ast-grep`, `install-root`, `known-issues`, `wsl`,
PABCD health. 선언한 codex 플래그의 실제 상태를 보는 체크가 없다.

```ts
function runDeclaredFeaturesCheck(deps: { run: CodexRunner }): CheckResult {
  // codex 를 부를 수 없으면 WARN (진단이 실패를 만들어내면 안 된다)
  // 전부 켜짐 -> PASS, evidence 에 "4/4 enabled"
  // 소프트 플래그만 꺼짐 -> WARN, 무엇을 잃는지 + 복구 명령
  // 하드 플래그가 꺼짐 -> FAIL, "run cxc enable"
}
```

`checks.push(runDeclaredFeaturesCheck(...))`를 `runDriftCheck` 옆에 넣는다.
러너는 `codex-bin.ts`가 이미 해석한 경로를 재사용한다 — doctor가 자체적으로
`codex`를 찾는 로직을 새로 만들지 않는다.

severity 배치 근거: 소프트 플래그 부재는 기능 축소지 고장이 아니므로 WARN이다.
FAIL로 올리면 Plan 모드만 쓰는 사용자의 doctor가 영구 빨강이 된다.

### `installation.md` — 두 트랙 서술 정정

마켓플레이스 트랙에 한 문단을 넣는다. 요지: 별도 활성화 명령이 필요 없고, 첫 세션에서
codexclaw가 선언된 플래그를 스스로 확인해 켜며, 그 결과를 `cxc doctor`의 `features`
줄에서 언제든 볼 수 있다. `cxc enable`은 소스 체크아웃과 명시적 재설정용으로 남는다.

### `docs-site/.../reference/commands.md` — `cxc enable` 설명 정정

현재 :24는 "Register skills, hooks, and MCP with Codex."라고 적었는데, 실제로는
codex 기능 플래그를 켜고 매니페스트를 쓰는 일이 본체다. skills/hooks/MCP 등록은
`plugin.json`이 하는 일이라 서술이 아예 다른 층을 가리킨다. 정정한다.

### `structure/INDEX.md` — 새 파일 등재

:244에 `cxc enable` 매핑이 있다. `self-heal.ts`와 새 훅 파일을 같은 표에 추가한다.

## SoT sync (SOT-SYNC-01)

`managed-keys.ts:10-14`가 "설치는 사용자 소유 스위치를 대신 켜지 않는다"고 선언한다.
이 유닛은 `[features]` boolean에 대해 그 반대를 한다. 두 진술이 공존하려면 경계를
명시해야 한다 — 렌즈가 C4/C2로 지적한 바로 그 모순이다.

같은 사이클의 C에서 `managed-keys.ts` 주석을 이렇게 좁힌다:

```diff
- * 설치는 사용자가 소유한 부수효과 있는 스위치를 절대 대신 켜지 않는다.
+ * 설치는 CONFIG_MANAGED_KEYS 의 키를 절대 대신 켜지 않는다. 이 목록은 codex 가
+ * 공식 setter 를 제공하지 않는 비-feature 테이블 키만 담으며, 값을 바꾸면 codexclaw
+ * 범위를 넘는 결과를 낳는다(memories.dedicated_tools 는 메모리 파이프라인 전체를 바꾼다).
+ * 대조: DECLARED_FEATURES(features.ts)는 codexclaw 가 동작하기 위해 필요하다고
+ * 선언한 [features] boolean 이고, 그건 설치와 self-heal 이 켠다. 두 어휘의 차이는
+ * TOML 테이블 이름이 아니라 "codexclaw 없이도 의미가 있는 스위치인가"다.
```

`cli.ts:24`의 `CONFIG_USAGE` 문구도 같이 좁힌다 — "Installation never enables one on
its own"의 "one"이 지금은 무한정으로 읽힌다.

## 테스트

| 테스트 | 위치 | 검증 |
|---|---|---|
| `features check passes when all declared flags are on` | `cxc-ops/test/doctor*.test.*` | 페이크 러너, PASS + evidence |
| `features check warns on a missing soft flag` | 동일 | WARN, 복구 명령 포함 |
| `features check fails on a missing hard flag` | 동일 | FAIL, "cxc enable" 포함 |
| `features check warns when codex is unavailable` | 동일 | 러너 exit != 0 → WARN, FAIL 아님 |
| 패키징 인벤토리 | 기존 패키징 테스트 | 새 훅 파일이 `plugin.json`과 디스크에 동시 존재 |

## Accept

c5. `cxc doctor` overall PASS(이 머신은 플래그가 이미 켜져 있으므로 새 체크가 PASS여야 한다).

## 독립 리뷰 정정

### 신뢰 회귀 — c5의 PASS 주장이 성립하지 않는다

새 훅 파일을 `plugin.json`에 넣으면 신뢰 표면이 바뀐다. `runHookTrustCheck`는
`actual === null`인 훅에 `FAIL`을 주고(`doctor.ts:389`) rollup은 worst-wins(:64)다.
즉 새 훅이 승인되기 전에는 **이 머신에서도** overall이 FAIL이다. 위 Accept 문장은
새 `features` 체크만 보고 그 회귀를 놓쳤다.

정정된 c5 검증 절차:

1. 빌드 → `git add -f`로 새 dist 산출물 추적.
2. `npm test` 전체 초록.
3. `cxc doctor`를 돌려 `features` 체크가 PASS인지 본다.
4. `hook-trust`가 새 훅 때문에 FAIL이면 그건 **예상된 상태**이고, 사용자가 훅을
   재승인(또는 `cxc hooks retrust`)해야 해소된다. 그 사실을 근거와 함께 기록한다 —
   overall PASS를 c5의 조건으로 요구하지 않는다. 요구하면 codexclaw가 자기 신뢰
   상태를 위조해야 하고, `doctor.ts:374`가 명시적으로 금지한 일이다.

c5를 이렇게 다시 쓴다: `npm test` 전체 통과 + `features` 체크 PASS +
`hook-trust` FAIL이 새 훅 하나로만 설명되고 다른 체크에 회귀가 없음.

### 문서에 두 세션 사실을 넣는다

`installation.md`의 마켓플레이스 트랙 문단에 훅 승인 의존을 명시한다. 요지: 훅을
승인하면 codexclaw가 첫 세션에서 선언된 플래그를 확인해 켜고, 도구 목록은 세션 시작
시점에 확정되므로 질문선택지 UI는 그 다음 세션부터 나타난다. 이걸 안 쓰면 사용자가
"깔았는데 안 뜬다"로 시간을 잃는다.

## wp4 실행 기록

### 구현된 것

| 대상 | 내용 |
|---|---|
| `cxc-ops/src/doctor.ts` | `buildDeclaredFeaturesCheck` + `parseDoctorFeatures` + `DOCTOR_DECLARED_FEATURES`/`DOCTOR_SOFT_FEATURES`. 체크는 `checkPabcdHealth` 뒤 8b로 들어가고 주입된 `agRunner`를 재사용한다 |
| `cxc-ops/test/doctor-features.test.ts` | 9개. severity 분기 3종, codex 미도달 2종(exit code / status null), 첫 필드 정확 매칭, 파싱 불가 토큰의 안전 기본값, 그리고 config-guard와의 어휘 드리프트 가드 |
| `installation.md` | 트랙 1에 훅 승인 의존 + 다음 세션 반영 명시 |
| `reference/commands.md` | `enable`/`disable`/`status` 세 줄 정정 |
| `structure/INDEX.md` | self-heal 훅 행 추가 + 컴포넌트 서술에 두 어휘 경계 |
| `managed-keys.ts`, `cli.ts` | 불변식 서술을 실제 동작에 맞게 좁힘 (SOT-SYNC-01) |

### 감사에서 잡은 결함

`cxc-ops.test.ts:111`의 healthy-report 픽스처 러너가 **인자를 무시하고** 항상 ast-grep
출력을 반환했다. 새 체크가 그걸 features 목록으로 읽어 "전부 꺼짐"으로 판정했고
healthy 단정이 FAIL로 깨졌다. 러너를 명령별 분기로 고쳤다.

이건 새 체크가 잘못됐다는 신호가 아니라, 픽스처가 러너를 상수처럼 다뤄서 지금까지
운이 좋았다는 신호다. `detectCodexVersion`도 같은 러너를 쓰는데 그 테스트들은
`codexVersion`만 단정하고 overall은 보지 않아 드러나지 않았다.

### c5 최종 판정

정정된 기준대로 검증했다.

| 항목 | 결과 |
|---|---|
| `npm test` | 2138 pass / 0 fail |
| `features` 체크 | `[PASS] features: 4/4 declared flag(s) enabled` |
| `hook-trust` | 23/23 trusted. wp3에서 새 훅이 FAIL을 냈고 `cxc hooks retrust`(updated=22 appended=1)로 해소했다 — 예고된 회귀였고 `[hooks.state.*]`를 위조하지 않았다 |
| `cxc doctor` | overall PASS |
