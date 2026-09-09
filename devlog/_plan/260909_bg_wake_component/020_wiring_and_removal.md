# 020 — 배선과 제거 증명 (wp3)

## 배선한 것

| 접점 | 변경 |
|---|---|
| `plugins/codexclaw/hooks/` | 훅 파일 3개 신설 (stop / user-prompt-submit / session-start) |
| `.codex-plugin/plugin.json` | `hooks[]` 24 → 27, append만. 기존 항목 순서 불변 |
| `scripts/build.mjs` | `REQUIRED_COMPONENTS` + `OPTIONAL_COMPONENTS` 분리. 선택 컴포넌트만 `existsSync`로 거른다 |
| `package.json` | test glob 1줄 |
| `plugins/codexclaw/bin/cxc.mjs` | `COMMAND_TABLE`의 `bg`, HELP 줄, slice(3) 분기 |
| `bin/codexclaw.mjs` | `case "bg"`, `runBgWake()`, HELP 줄 |
| `inventory.json` + README 3종 | `inventory.mjs --write`로 뱃지 24 → 27 |

기존 컴포넌트 `src/`는 한 줄도 건드리지 않았다. 리뷰어가 `git diff --cached --name-only`로 독립 확인했다.

개수를 하드코딩하던 테스트 두 개는 **개수 무관으로 바꿨다.** `test/hook-e2e.test.mjs`의 `length === 24`를 `length > 0`으로, `test/inventory.test.mjs`의 뱃지 숫자를 README에서 파생하도록. 그래서 이 둘은 제거 접점이 아니다. 선택 컴포넌트가 붙었다 떨어질 때마다 테스트를 고치게 두면 "쉽게 끈다"가 거짓말이 된다.

## 제거 증명

체크리스트 8단계를 실제로 적용했다. 디렉터리 삭제, 훅 파일 3개 삭제, 매니페스트 3줄 제거, `OPTIONAL_COMPONENTS` 비우기, test glob 제거, 디스패처 양쪽 정리, `inventory.mjs --write` 재실행.

결과:

```
[codexclaw inventory] wrote inventory.json (28 skills, 24 hooks, 8 components)
[codexclaw] build OK — 167 files compiled, layout validated.
[codexclaw gate] OK — no status drift, false-enforcement prose, count mismatch, or inventory drift.
npm test EXIT=0
```

그 뒤 `git checkout -- .`로 복원하고 다시 확인했다.

```
[codexclaw inventory] wrote inventory.json (28 skills, 27 hooks, 9 components)
[codexclaw gate] OK
npm test EXIT=0
```

즉 체크리스트는 완전하다. 빠뜨린 접점이 있었다면 제거 후 build나 gate나 test 중 하나가 깨졌을 것이다.

## 감사에서 잡힌 것

1라운드 fail이 실제로 중요한 걸 잡았다. `bin/codexclaw.mjs`의 `runBgWake` 경로에 `..`가 하나 부족해서 `components/provider-bridge/bg-wake/dist/cli.js`를 가리키고 있었다. 루트 `cxc bg`가 전부 spawn 실패했고, **그건 곧 끄는 스위치가 안 된다는 뜻이었다.** 사용자 요구의 핵심이 조용히 깨져 있었던 셈이다.
같이 잡힌 것: payload 디스패처가 `["bg","off"]`를 넘겨 verb 파싱이 한 칸 밀렸고, `existsSync` 필터가 필수 컴포넌트 누락까지 조용히 삼켰다.

지금은 루트와 payload 양쪽에서 `cxc bg status / off / on`이 실제로 동작하는 것을 실행으로 확인했다.

## 남은 것

`package-lock.json`에 `@codexclaw/bg-wake` 항목이 없다. 형제 컴포넌트들과 다르지만 워크스페이스 glob이 `components/*`라 런타임에는 영향이 없고, 훅과 CLI는 `dist/cli.js` 경로로 직접 간다. 체크리스트 7단계가 이미 조건부로 적어 두었다.

Windows 실행 경로는 이 머신에서 검증하지 못했다. 컴포넌트 README의 "알려진 한계"에 적어 두었다.

