# 010 — wp2: SOFT 침묵 제거

## 문제

`config-guard/src/features.ts:27`:

```ts
export const SOFT_FEATURES: ReadonlySet<string> = new Set(["default_mode_request_user_input"]);
```

`activate.ts:188-200`이 그 집합에 속한 키의 실패를 `enableFailed: true`로만 기록하고 계속 간다.
`cli.ts:120-131`은 그것을 `(soft-failed: default_mode_request_user_input)` 괄호 한 조각으로
출력하고 exit 0을 반환한다. 사용자가 원하는 단 하나의 플래그가, 실패해도 아무 일 없는 유일한 플래그다.

## SOFT를 유지하되 목소리를 준다

throw로 바꾸지 않는다. 근거: 플러그인 활성화가 upstream 플래그 하나 때문에 통째로 실패하면
skills/hooks/MCP 등록까지 날아간다. 부수 피해가 이득보다 크다.
대신 실패를 **stderr에 눈에 띄게** 쓰고, 무엇이 안 되는지와 어떻게 복구하는지를 말한다.

## Diff-level

### `features.ts` — 근거 주석 정정 + 사유 표

```diff
-// Flags that are OFF by default in codex and that codexclaw must turn on. Soft flags may
-// fail to enable (e.g. under-development / unavailable in this build) without failing activation.
+// Flags that are OFF by default in codex and that codexclaw must turn on. A soft flag's
+// enable failure does not fail activation — but it is NOT silent (see SOFT_FEATURE_IMPACT).
+//
+// 260829 정정: 이전 주석은 "under-development라 실패할 수 있다"고 적었으나 그건 사실이
+// 아니다. codex-rs cli/src/main.rs:915 validate_feature 는 is_known_feature_key 만 보고
+// stage 를 보지 않으며, under-development 는 성공적 쓰기 후 stderr 경고만 낸다(실측 exit 0).
+// 따라서 실제 실패 원인은 딱 하나로 좁혀진다: 이 codex 빌드가 그 키를 모른다(rename/retire).
+// 그건 조용히 넘길 사안이 아니라 정확히 사용자에게 알려야 하는 사안이다.
 export const SOFT_FEATURES: ReadonlySet<string> = new Set(["default_mode_request_user_input"]);
+
+// 소프트 플래그가 켜지지 않았을 때 사용자가 잃는 기능. cli 가 경고문을 만들 때 쓴다.
+export const SOFT_FEATURE_IMPACT: Readonly<Record<string, string>> = {
+  default_mode_request_user_input:
+    "Default 모드에서 질문선택지 UI(request_user_input)가 모델에게 노출되지 않는다. " +
+    "Plan 모드에서는 계속 동작한다(codex-rs protocol/src/config_types.rs:658 allows_request_user_input).",
+};
```

### `activate.ts` — 실패 사유를 매니페스트에 보존

현재 `FlagRecord`는 `enableFailed: boolean`만 갖는다. 왜 실패했는지가 사라져서
사용자에게도, 다음 진단에도 아무 정보가 없다.

```diff
 export interface FlagRecord {
   priorEnabled: boolean;
   enabledByCodexclaw: boolean;
   enableFailed: boolean;
+  /** 실패 시 exit code + stderr 앞부분. 성공/미시도면 부재. */
+  failure?: { exitCode: number; message: string };
 }
```

```diff
     } else {
       flags[key].enableFailed = true;
+      flags[key].failure = {
+        exitCode: res.exitCode,
+        message: res.stderr.trim().slice(0, 500),
+      };
       if (!SOFT_FEATURES.has(key)) {
```

매니페스트 스키마는 이미 v2다. 옵셔널 필드 추가라 버전을 올리지 않는다 —
v1→v2 때처럼 읽기 경로가 깨지는 변경이 아니다. `deactivate.ts`는 `failure`를 읽지 않으므로 무영향.

### `cli.ts` — 괄호 대신 stderr 블록

```diff
       process.stdout.write(
-        \`codexclaw: enabled [\${turnedOn.join(", ") || "none"}]\` +
-          (failed.length ? \` (soft-failed: \${failed.join(", ")})\` : "") +
+        \`codexclaw: enabled [\${turnedOn.join(", ") || "none"}]\` +
           (m.backupPath ? \`\\nbackup: \${m.backupPath}\` : "") +
           "\\n",
       );
+      for (const key of failed) {
+        const rec = m.flags[key];
+        const impact = SOFT_FEATURE_IMPACT[key] ?? "이 플래그에 의존하는 기능이 비활성화된다.";
+        process.stderr.write(
+          \`codexclaw: 경고 — '\${key}' 를 켤 수 없었다\` +
+            (rec?.failure ? \` (exit \${rec.failure.exitCode})\` : "") +
+            "\\n" +
+            \`  영향: \${impact}\\n\` +
+            (rec?.failure?.message ? \`  codex: \${rec.failure.message}\\n\` : "") +
+            \`  확인: codex features list | grep \${key}\\n\` +
+            \`  수동: codex features enable \${key}\\n\`,
+        );
+      }
       return 0;
```

exit code는 0을 유지한다. 활성화는 성공했고, 이건 경고다.

## 테스트 (`config-guard/test/activate.test.ts`에 추가)

| 테스트 | 검증 |
|---|---|
| `soft failure records exitCode and stderr in the manifest` | 페이크 러너가 그 키에만 `{exitCode:2, stderr:"unknown feature"}` → 매니페스트 `flags[key].failure`가 채워지고 다른 플래그는 정상 |
| `soft failure does not throw and other flags still enable` | 같은 조건에서 `activate()`가 반환하고 `multi_agent`/`goals`/`hooks`가 `enabledByCodexclaw:true` |
| `hard failure still throws` | 회귀 방지 — `goals`에 exit 1을 주면 throw |
| `SOFT_FEATURE_IMPACT covers every soft flag` | `SOFT_FEATURES`의 모든 원소가 impact 문장을 갖는다(집합이 커질 때 침묵 재발 방지) |

CLI stderr 출력은 순수 함수가 아니라 `main()` 안에 있다. 문장 조립을 순수 함수
`renderSoftFailureWarning(key, rec): string`로 빼서 테스트하고, `main()`은 그걸 write만 한다.

## Accept

c2. `npm test` 초록. 매니페스트 v2 파싱 회귀 없음(`deactivate-drift.test.ts` 그대로 통과).

## A 감사 정정 (wp2 사이클)

### A1 — `parseInstallManifest`가 새 필드를 버린다

`activate.ts:71-81`의 파서는 `FlagRecord`를 필드별로 재구성한다:

```ts
flags[key] = {
  priorEnabled: rec.priorEnabled === true,
  enabledByCodexclaw: rec.enabledByCodexclaw === true,
  enableFailed: rec.enableFailed === true,
};
```

`failure`를 여기 추가하지 않으면 매니페스트에 써도 **읽을 때 사라진다**. 010 본문은
쓰는 쪽만 다뤘다. 파서에 다음을 더한다:

```diff
       enableFailed: rec.enableFailed === true,
+      ...(isRecord(rec.failure) && typeof rec.failure.exitCode === "number"
+        ? {
+            failure: {
+              exitCode: rec.failure.exitCode,
+              message: typeof rec.failure.message === "string" ? rec.failure.message : "",
+            },
+          }
+        : {}),
     };
```

옵셔널이므로 형태가 어긋난 `failure`는 매니페스트 전체를 거부하지 않고 그 필드만 버린다.
파서의 기존 계약이 "malformed = absent(안전한 no-op)"인데, 경고 메타데이터 하나 때문에
전체를 무효화하면 그 계약보다 엄격해져서 되돌리기 능력을 잃는다.

독립 리뷰 정정: `isRecord`는 config-guard에 없다(`pabcd-state/src/goal-gate.ts:65`에만
존재). 인라인으로 쓴다:

```ts
const f = rec.failure;
const hasFailure = typeof f === "object" && f !== null && !Array.isArray(f)
  && typeof (f as Record<string, unknown>).exitCode === "number";
```

추가 테스트: `round-trips the failure field through the manifest parser`,
`ignores a malformed failure field without rejecting the manifest`.

### A2 — `enableFailed`가 그대로 남는지 확인

`deactivate.ts`가 `enabledByCodexclaw`만 보고 되끄는지 재확인했다(:165). `failure`는
읽지 않으므로 해제 경로 무영향이 맞다. 010 본문의 주장 유지.
