---
created: 2026-08-17
status: design
workPhase: wp5
tags: [codexclaw, release, ci, local-install]
---

# 040 — 검증, dev 푸시, 정식 릴리스, 로컬 설치본 갱신

구현(337add01)과 버전 범프(39526dde)는 이미 dev에 있다. 이 문서는 남은
배포 경로만 다룬다. 새 코드 변경은 이 phase의 산출물이 아니다 — 단
CI가 되돌려준 결함 하나는 예외다.

## 되돌아온 결함 — Windows 경로 구분자

39526dde의 CI는 ubuntu/macos는 통과하고 **windows-latest만** 실패했다.
원인은 내가 wp1에서 쓴 회귀 테스트다:

```ts
assert.equal(st.planUnit, "devlog/_plan/260817_probe");
```

`plan-gate`는 `path.relative()`로 정규화하고, 그 함수는 플랫폼 구분자를
낸다. Windows에서는 백슬래시로 구분된 경로가 나오므로 리터럴 비교가
깨진다. 프로덕션 코드의 결함이 아니라 테스트의 이식성 결함이다.

처방은 구분자 비의존 비교다:

```ts
assert.deepEqual(st.planUnit?.split(/[\\/]/), ["devlog", "_plan", "260817_probe"]);
```

`planUnit`의 저장 표현을 posix로 강제하지 않는 이유: 그 값은 세션 state의
비교 키로만 쓰이고 같은 머신 안에서만 왕복한다. 표현을 바꾸면 기존 세션의
결속이 전부 깨진다. 테스트가 플랫폼을 가정한 쪽이 틀렸다.

커밋: 95c07c0d.

## 배포 순서

각 단계는 앞 단계의 실물 증거가 있어야 다음으로 간다. **SHA는 고정된 값이
아니라 "현재 dev head"다** — 감사 r8이 잡았듯이 문서가 옛 SHA를 못박으면
그 사이에 쌓인 커밋이 검증 없이 승격된다.

1. 루트 `npm test` 전체 통과 (현재 1714/1714).
2. dev를 원격에 푸시하고, **그 head SHA**에 대해 CI + Packed install
   lifecycle 두 워크플로가 모두 success인지 확인한다. 문서에 SHA를 적지
   않는다 — 적는 순간 낡는다(감사 r9가 바로 이 재발을 잡았다). 확인은
   `git rev-parse HEAD`와 `gh run list --branch dev`의 headSha를 대조하는
   것이지, 문서에 박힌 값을 믿는 것이 아니다.
3. `git push origin dev:main` — 룰셋이 정확한 SHA의 필수 체크를 요구하므로
   2가 끝나기 전에는 거부된다.
4. main 승격이 **재발화시킨** CI를 다시 기다린다. 릴리스 워크플로는 자신의
   `GITHUB_SHA`에 대한 CI/packed 결론을 읽고(release.yml:128), 게이트는 다른
   SHA의 영수증을 거부한다. 성급하게 릴리스하면 `platform-ci is missing`으로
   실패한다 (v0.2.2에서 겪은 그대로다).
5. `gh workflow run release.yml --ref main -f version=0.2.3 -f prerelease=false
   -f dry_run=false` — OIDC 워크플로만 쓴다. `npm publish` 직접 실행 금지.
6. 검증: run conclusion success, `gh release list`에서 v0.2.3이 Latest,
   태그가 승격된 SHA를 가리킴, 릴리스에 에셋 3개 이상(payload tar.gz,
   SHA256SUMS, candidate manifest).

### 배포 채널을 npm으로 착각하지 않는다 (감사 r6 High 지적)

초안은 6단계에 "npm dist-tag latest=0.2.3"을 적었다. 틀렸다. 근거:

- `package.json`이 `"private": true`다. npm이 발행 자체를 거부한다.
- `.github/workflows/release.yml` 어디에도 `npm publish`도 NPM 토큰도 없다.
  실제로 하는 일은 `gh release create` + `gh release upload dist-artifacts/*`
  뿐이고, 사후 검증도 `gh release view`로 에셋 개수만 센다(:216-223).
- README의 설치 경로는 `codex plugin marketplace add` + `codex plugin add
  codexclaw@codexclaw`다. 배포 채널은 Codex 플러그인 마켓플레이스다.

다른 저장소의 릴리스 습관을 여기에 옮겨 적은 것이다. 존재하지 않는 검증을
통과했다고 쓸 뻔했으므로 감사가 잡은 것이 맞다.

## 로컬 설치본

로컬 마켓플레이스 `codexclaw`는 이 저장소 체크아웃 자체를 소스로 가리킨다
(`~/.codex/config.toml`의 `source = /Users/jun/Developer/new/700_projects/codexclaw`).
즉 설치본은 레지스트리가 아니라 작업 트리에서 온다. 그래서 코드를 고쳐도
**설치본은 자동으로 따라오지 않는다** — 캐시 디렉터리에 복사된 판본이 계속
실행된다. 갱신은 매니페스트 캐시버스터를 올리고 재설치하는 것이다:

```
python3 <plugin-creator>/scripts/update_plugin_cachebuster.py plugins/codexclaw
codex plugin add codexclaw@codexclaw
```

이번 사이클에서 실제로 밟은 경로다: `0.2.3+codex.20260817035223` ->
`0.2.3+codex.20260817044718`. 재설치 후 캐시본의 matcher가
`^(explorer)?$`로, dist가 신원 결속 코드로 바뀐 것을 확인했다.

따라서 릴리스 후에 할 일은 재설치가 아니라 **정합성 확인**이다: 설치된
플러그인 버전이 main에 승격된 커밋의 payload와 같은 판본인지, 새 훅
(observer 기록 경로)이 실제로 발화하는지 본다.

### 훅 재신뢰가 선행 조건이다 (감사 r7 지적)

050이 `subagent-stop-observing-review.json`의 matcher를 바꾼다. matcher는
훅 identity 해시에 들어가므로(`cxc-ops/src/hook-trust.ts`), 바뀐 훅은
`~/.codex/config.toml`의 `trusted_hash`와 어긋나 **발화하지 않는다.**
새 observer가 동작한다고 주장하기 전에 신뢰를 갱신해야 한다:

**어느 payload를 신뢰시키는지가 중요하다** (감사 r9 지적). `retrustHooks`는
`pluginRootFrom()`으로 **자기 자신이 실행된 CLI 파일 위치**에서 루트를
구한다(`cxc-ops/src/cli.ts:27`). 개발 체크아웃에서 PATH의 `cxc`는 이
저장소의 `bin/codexclaw.mjs`를 가리키므로 작업 트리 payload를 신뢰시키고,
캐시 설치본의 dispatcher(`plugins/codexclaw/bin/cxc.mjs`)는 자기 캐시
payload를 신뢰시킨다. 실제로 발화하는 것은 후자다.

그래서 순서와 대상을 함께 못박는다:

```
# 1) 캐시버스터 + 재설치 (설치본을 새 코드로)
codex plugin add codexclaw@codexclaw

# 2) 설치본 payload를 대상으로 재신뢰
node ~/.codex/plugins/cache/codexclaw/codexclaw/<version>/components/cxc-ops/dist/cli.js \\
  hooks retrust
```

재설치보다 먼저 retrust하면 옛 캐시본 해시를 신뢰시키는 셈이라 아무것도
달라지지 않는다. 이 명령은 안전핀이 있다 — 기존 항목 중 재계산 해시가
하나도 안 맞으면 거부하고, 쓰기 전 백업을 남기고, 쓴 뒤 재검증해 실패하면
되돌린다.

**관측된 동작**(소스로 증명한 것이 아니라 이번 사이클에서 본 것): 재설치와
retrust를 마친 뒤에도 현재 세션의 SubagentStop은 옛 matcher로 계속
동작했다. 실행 중인 Codex가 시작 시점 훅 설정을 들고 있는 것으로 보이며,
README도 업그레이드 후 재시작을 요구한다. 새 훅이 실제로 발화하는지는 새
세션에서 확인해야 한다. 이 사이클에서는 대신 설치본 `cli.js`에 v1 payload를
직접 넣어 동작을 확인했다(라운드 approved, bystander 서명 거부 + ledger 기록).

"로컬에도 업데이트"의 마지막 조각이 이것이다. 파일만 새것이고 신뢰가
옛것이면 업데이트는 끝난 것이 아니다.

## 이 phase가 하지 않는 것

- 결속 정책 변경, 새 기능, 스코프 확장
- 사용자의 미커밋 untracked 작업(260722_*, 260814_*, mktemp:) 건드리기
- CI 실패를 우회하는 플래그나 체크 비활성화
