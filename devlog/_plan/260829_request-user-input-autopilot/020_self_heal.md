# 020 — wp3: SessionStart self-heal

## 문제

G1이 이 유닛의 본체다. `cxc enable`은 게이트 2를 켤 능력이 있는데, 마켓플레이스
설치 경로에서 아무도 그걸 부르지 않는다.

| 설치 트랙 | 명령 | `cxc enable` 실행? |
|---|---|---|
| 1 — 마켓플레이스 | `codex plugin marketplace add` + `codex plugin add` (`installation.md:19`) | **아니오** |
| 2 — 소스 체크아웃 | `bin/codexclaw.mjs enable` 또는 `cxc enable` (`installation.md:71`) | 예, 수동 |

`plugin.json`에 활성화 훅 슬롯이 없다(`hooks[]`는 SessionStart/PreToolUse 등 런타임
이벤트뿐). 루트 `package.json`에 `postinstall`도 없다. codex 플러그인 규격에
"설치 직후 1회" 훅이 없으므로 **설치 시점에 걸 곳이 없다.**

## 선택한 진입점: SessionStart

설치 경로와 무관하게 반드시 도는 지점은 SessionStart 훅이다. 이미 6개가 등록돼 있고
그중 `session-start-ensuring-provider-bridge`가 선례다 — 다만 그건 detect-only를
의도적으로 선택했다(`provider-bridge/src/cli.ts:6-10` "never mutates codex config").

이 유닛은 반대 결정을 내린다. 근거: provider-bridge는 `ocx ensure`가 사용자의 모델
라우팅 전체를 바꾸는 광범위 부수효과라 피한 것이고, 여기는 codexclaw가 이미
`DECLARED_FEATURES`로 소유권을 선언한 boolean 하나다. 같은 write를 `cxc enable`이
이미 하고 있으므로 새 권한이 아니라 **누락된 호출의 복구**다.

### 왜 새 훅 파일이 아니라 기존 config-guard에 붙이는가

SessionStart 훅은 이미 6개다. 하나 더 늘리면 매 세션 프로세스 spawn이 하나 늘어난다.
대신 `config-guard`에 `hook session-start` 서브커맨드를 추가하고 **새 훅 파일 1개**를
등록한다 — config-guard는 지금 SessionStart 훅이 없어서 붙일 기존 자리가 없다.
비용은 spawn 1회지만, 캐시 히트 시 파일 stat 2번으로 끝난다(아래).

## Diff-level

### 새 파일 `config-guard/src/self-heal.ts`

순수 로직. 파일 IO와 러너는 전부 주입.

```ts
export interface SelfHealDeps {
  codexHome: string;
  run: CodexRunner;
  readFile: (p: string) => string | null;   // 없으면 null
  writeFile: (p: string, s: string) => void;
  statMtimeMs: (p: string) => number | null;
  now: () => string;
}

export type SelfHealOutcome =
  | { action: "skipped"; reason: "cached" | "opted-out" | "already-enabled" }
  | { action: "healed"; key: string }
  | { action: "failed"; key: string; exitCode: number; message: string };

export function selfHealDeclaredFeatures(deps: SelfHealDeps): SelfHealOutcome[];
```

알고리즘:

1. **옵트아웃 확인.** `<codexHome>/codexclaw-self-heal.json`의 `optedOut: true`면 즉시 skip.
   이 마커는 `cxc disable`이 쓴다(아래).
2. **캐시 확인.** 같은 파일의 `{ configMtimeMs, checkedAt, allEnabled }`. `config.toml`
   mtime이 변하지 않았고 `allEnabled`가 true면 skip. → 정상 세션의 비용은 stat 1 + read 1.
3. `readDeclaredState(run)`로 실제 상태를 읽는다(`codex features list` 1회).
4. 꺼진 소프트 플래그마다 `run(["features","enable",key])`. 성공/실패를 결과에 담는다.
5. 캐시 갱신. 전부 켜졌으면 `allEnabled: true`.

**하드 플래그는 여기서 켜지 않는다.** `multi_agent`/`goals`/`hooks`가 꺼져 있다는 건
`cxc enable`을 아예 안 돌렸다는 뜻이고, 그건 self-heal이 조용히 메울 상황이 아니라
사용자에게 `cxc enable`을 안내할 상황이다(아래 출력).

### 옵트아웃: `deactivate.ts`

`cxc disable`이 게이트 2를 되끄는데(`deactivate.ts:165`) self-heal이 다음 세션에
되켜면 사용자 의도를 무시하는 무한 왕복이 된다.

```diff
   writeFileSync(manifestPath(codexHome), ...);
+  // self-heal 옵트아웃: 사용자가 명시적으로 껐으므로 다음 세션이 되켜서는 안 된다.
+  writeSelfHealMarker(codexHome, { optedOut: true, optedOutAt: now() });
```

`cxc enable`은 대칭으로 마커를 지운다(`optedOut: false`).

### 새 훅 `hooks/session-start-healing-declared-features.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/components/config-guard/dist/cli.js\" hook session-start",
            "timeout": 20,
            "statusMessage": "(codexclaw) Ensuring declared codex features"
          }
        ]
      }
    ]
  }
}
```

`plugin.json`의 `hooks[]`에 이 경로를 추가한다. `manifestTargetChecks`
(`cxc-ops/src/manifest-targets.ts`)가 선언된 훅 파일의 존재를 검사하므로 doctor가
자동으로 커버한다.

### `cli.ts` — `hook session-start` 브랜치

```ts
if (cmd === "hook" && argv[1] === "session-start") {
  try {
    const outcomes = selfHealDeclaredFeatures(realDeps());
    const ctx = renderSelfHealContext(outcomes);   // 순수 함수, 조용하면 ""
    if (ctx) process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx },
    }) + "\n");
  } catch { /* FAIL-OPEN: 세션을 절대 막지 않는다 */ }
  return 0;
}
```

`renderSelfHealContext`는 `healed`/`failed`가 있을 때만 문장을 낸다. 조용한 세션에는
컨텍스트를 한 글자도 추가하지 않는다 — `activation-trace.ts:11`의
"ordinary sessions receive no additional context" 규범과 같은 태도.

`healed`일 때 문장은 무엇을 켰는지와 **다음 세션부터** 유효하다는 사실을 말한다. 도구
목록은 세션 시작 시점에 확정되므로 이번 턴에는 아직 안 보인다. 이걸 명시하지 않으면
사용자가 "켰다는데 왜 없냐"로 혼란한다.

## 테스트 (새 파일 `config-guard/test/self-heal.test.ts`)

| 테스트 | 검증 |
|---|---|
| `enables a missing soft flag` | 페이크가 `false` 보고 → `enable` 호출됨, outcome `healed` |
| `is idempotent via the mtime cache` | 두 번 호출하면 두 번째는 `skipped/cached`, 러너 호출 0회 |
| `re-checks when config.toml mtime changes` | mtime 변경 후 러너가 다시 호출됨 |
| `respects the opt-out marker` | `optedOut:true`면 러너 호출 0회 |
| `does not enable hard flags` | `goals`가 false여도 `enable goals` 미호출 |
| `never throws when the runner explodes` | 러너가 throw → CLI 브랜치 exit 0, stdout 무출력 |
| `renders nothing on a quiet session` | 전부 켜진 상태 → `renderSelfHealContext` `""` |

goal 억제 회귀: `pabcd-state/test/goal-gate*.test.ts`를 수정하지 않는다. 그대로 초록이면
c4의 절반이 증명된다 — self-heal은 config 층이고 goal-gate는 PreToolUse 층이라 교차점이 없다.

## Accept

c3, c4.

## A 감사 정정 (wp3 사이클)

### A3 — `readDeclaredState`가 throw한다

`features.ts:63-66`:

```ts
const res = run(["features", "list"]);
if (res.exitCode !== 0) {
  throw new Error(\`codex features list failed (exit \${res.exitCode}): ...\`);
}
```

020 본문은 이걸 그대로 쓰라고 적었다. SessionStart 훅에서 `codex`를 찾지 못하면
(PATH가 다른 셸, 설치 직후) 매 세션 throw가 난다. CLI 브랜치의 `catch`가 삼키니
세션은 안전하지만, `selfHealDeclaredFeatures` 자체는 순수 결과 반환을 계약으로 삼았는데
throw가 그 계약을 깬다. 테스트도 outcome이 아니라 예외를 검사하게 된다.

정정: self-heal 안에서 `readDeclaredState`를 try로 감싸고 실패를 outcome으로 바꾼다.

```diff
 export type SelfHealOutcome =
   | { action: "skipped"; reason: "cached" | "opted-out" | "already-enabled" }
+  | { action: "unavailable"; message: string }
   | { action: "healed"; key: string }
   | { action: "failed"; key: string; exitCode: number; message: string };
```

`unavailable`은 캐시를 갱신하지 않는다 — codex를 못 찾은 건 상태가 아니라 측정 실패이고,
`allEnabled: true`로 기록하면 진짜로 꺼진 플래그를 영구히 놓친다.
`renderSelfHealContext`는 `unavailable`에 아무 문장도 내지 않는다. codex 바이너리가
없는 세션에 그 얘기를 하는 건 잡음이고, 그건 `cxc doctor`(wp4)가 다룰 영역이다.

추가 테스트: `reports unavailable instead of throwing when features list fails`,
`does not cache after an unavailable probe`.

### A4 — 하드 플래그 안내를 실제로 어디에 내는가

020 본문은 하드 플래그가 꺼졌으면 "`cxc enable`을 안내한다(아래 출력)"고 썼는데
아래에 그 출력 정의가 없다. 미해결 참조다.

정정: self-heal은 하드 플래그를 **켜지도, 안내하지도 않는다.** 결과에 담지 않는다.
근거: 하드 플래그가 꺼진 채 세션이 돌고 있다는 건 애초에 codexclaw 훅 자체가
등록됐는데 활성화는 안 됐다는 모순 상태이고, 그 진단은 상시 표면인 `cxc doctor`의
`features` 체크(030 wp4)가 FAIL로 잡는 게 맞다. SessionStart 컨텍스트는 사용자가
매 세션 읽어야 하는 자리라 항구적 상태 보고를 넣을 곳이 아니다.

따라서 020의 알고리즘 4단계를 "`SOFT_FEATURES`에 속하고 꺼진 플래그만 순회"로 확정한다.

### A5 — 캐시 파일과 매니페스트를 합치지 않는 이유

`.codexclaw-install.json`에 캐시를 넣는 게 파일 수를 줄이지만, `parseInstallManifest`가
엄격 검사를 하고 실패 시 전체를 absent로 취급한다. 캐시 쓰기가 매 세션 일어나므로
거기에 결함이 생기면 되돌리기 능력까지 잃는다. 별 파일 `codexclaw-self-heal.json`을
유지한다 — 손상되면 캐시 미스로 퇴화할 뿐이다.

## 독립 리뷰 정정 (B2·B3·B4)

### B2 — 옵트아웃 diff의 앵커가 존재하지 않는다

위 §옵트아웃 diff는 `deactivate.ts`에 `writeFileSync(manifestPath(codexHome), ...)`가
있다고 가정했다. **없다.** `deactivate`는 매니페스트를 읽기만 하고(:101 존재 확인),
유일한 `writeFileSync`는 :142의 `writeFileSync(configPath, content, "utf8")`이며
그건 `if (Object.keys(tableKeys).length > 0)` 안의 `if (changed)` 아래다.

그 자리에 마커 쓰기를 넣으면 관리 키가 없는 평범한 해제(=`tableKeys` 빈 객체)에서
분기 자체를 타지 않아 옵트아웃이 영구히 기록되지 않는다. 그러면 다음 세션 self-heal이
플래그를 되켜서, 000이 완화한다고 적은 무한 왕복이 정확히 발생한다.

정정: 앵커는 함수 끝의 `return { disabled, ... }` 블록(:175) **직전**이다. 조건 없이,
두 pass가 모두 끝난 뒤 실행된다.

### B3 — `deactivate`에는 FS 주입 경로가 없다

`DeactivateDeps`는 `run`/`codexHome`/`configPath`뿐이고 `deactivate.ts`는
`node:fs`를 직접 import한다. `writeSelfHealMarker(codexHome, ...)`를 그냥 부르면
기존 `deactivate` 테스트가 실제 FS에 쓰게 된다.

정정: 그 테스트들은 이미 `mkdtempSync`로 만든 임시 `codexHome`을 주입하므로 실제
`~/.codex`에 닿지 않는다(`activate.test.ts:111` 등이 같은 패턴). 따라서 실제 FS 쓰기는
허용되고, 새 주입 축을 만들지 않는다. 대신 소유 경계를 이렇게 확정한다:

| 심볼 | 위치 | 성격 |
|---|---|---|
| `selfHealMarkerPath(codexHome)` | `self-heal.ts` | 순수 경로 계산 |
| `readSelfHealMarker(codexHome)` | `self-heal.ts` | 실제 FS 읽기, 손상/부재는 null |
| `writeSelfHealMarker(codexHome, marker)` | `self-heal.ts` | 실제 FS 쓰기, 원자적 |
| `selfHealDeclaredFeatures(deps)` | `self-heal.ts` | 순수 로직, IO는 `SelfHealDeps` 주입 |

`deactivate.ts`는 `writeSelfHealMarker`만 import한다 — `SelfHealDeps`를 건드리지 않는다.
주입형 순수 코어와 실 FS 래퍼를 같은 모듈에서 분리하는 건 이 컴포넌트의 기존 패턴이다
(`cli.ts`가 `makeRealRunner`로 실 러너를 만들고 lib은 주입만 받는 구조).

새 테스트: `deactivate writes the self-heal opt-out marker`,
`the marker is written even when no table keys were managed` — B2가 만들려던 정확한 버그를
빨강으로 세우는 테스트다.

### B4 — 훅 신뢰 게이트를 사용자에게 말한다

000의 목표 서술 정정과 같은 사실이다. 여기서는 출력 문구에 반영한다.
`renderSelfHealContext`의 `healed` 문장은 다음을 담는다: 무엇을 켰는지, 도구 목록은
세션 시작 시점에 확정되므로 **다음 세션부터** 보인다는 것.

훅 승인 자체는 codexclaw가 말할 수 있는 시점이 아니다 — 승인 전에는 이 훅이 아예 안 돈다.
그건 문서(wp4)가 다룬다.

### B5 — `dist/self-heal.js`는 force-add가 필요하다

`.gitignore`가 bare `dist/`이고 기존 config-guard dist 9개는 force-add로만 추적된다.
`build.mjs`가 빌드마다 dist를 `rmSync`하므로, 빌드 후 `git add -f`로 새 산출물을
넣어야 `dist-freshness.test.mjs`와 패키징 테스트가 통과한다. C 단계 체크리스트에 넣는다.
