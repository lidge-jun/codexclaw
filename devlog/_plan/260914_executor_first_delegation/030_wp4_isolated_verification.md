# 030 wp4 — 격리 검증과 로컬 커밋

설치된 payload에서 새 문자열이 실제로 전달되는지 확인한다. 실제 설치본
`/home/jun/.codex/plugins/cache/codexclaw`는 건드리지 않는다.

## Owner

main. 호스트 환경 조작과 증거 판정이 필요하다.

## 경로 변수

```bash
CXC_WT=/home/jun/code-worktrees/codexclaw/executor-first-delegation
CXC_TEST_HOME=/home/jun/tmp/cxc-exec-first-home-01a09f4f
CXC_WS=/home/jun/tmp/cxc-exec-first-ws-01a09f4f
CXC_REAL=/home/jun/.codex/plugins/cache/codexclaw
```

모든 명령은 `git -C "$CXC_WT"` 또는 `cd "$CXC_WT"` 형태로 대상을 명시한다.
임시 작업 디렉터리로 이동한 상태에서 커밋하지 않는다.

## Step 1 — 빌드와 전체 테스트 (워크트리)

```bash
cd "$CXC_WT" && node plugins/codexclaw/scripts/build.mjs && npm test
```

tail 출력과 exit code를 증거로 남기고 실패 수를 직접 읽는다.
`rg -n 'implementation ownership' plugins/codexclaw/components/pabcd-state/dist/*.js`로
빌드 산출물에 새 문자열이 들어갔는지 확인한다(설치본은 `src`가 아니라 `dist`를 쓴다).

## Step 2 — 실제 설치본 지문 + 격리 설치

설치 전후로 재귀 내용 지문을 뜬다. 최상위 `ls`는 버전 디렉터리 안의 덮어쓰기를 못 잡는다.

```bash
find "$CXC_REAL" -type f -exec sha256sum {} + | sort | sha256sum   # BEFORE
mkdir -p "$CXC_TEST_HOME"
cd "$CXC_WT" && CODEX_HOME="$CXC_TEST_HOME" scripts/dev-install.sh
CODEX_HOME="$CXC_TEST_HOME" scripts/dev-install.sh --status
find "$CXC_REAL" -type f -exec sha256sum {} + | sort | sha256sum   # AFTER, BEFORE와 동일해야 함
```

두 지문이 다르면 즉시 중단하고 원인을 기록한다(실제 설치본 변경은 범위 밖).
설치본 루트를 확정한다.

```bash
INSTALLED_ROOT="$(ls -d "$CXC_TEST_HOME"/plugins/cache/codexclaw/codexclaw/*/ | tail -1)"
rg -n 'implementation ownership' "${INSTALLED_ROOT}components/pabcd-state/dist/"*.js | head
```

이후 모든 실행은 `CODEX_HOME="$CXC_TEST_HOME"`를 붙이고 `$INSTALLED_ROOT`의 파일을
절대경로로 직접 호출한다. PATH의 `cxc`나 전역 설치본을 부르지 않는다.

## Step 3 — 픽스처 준비

```bash
mkdir -p "$CXC_WS" && cd "$CXC_WS"
git init -q && git commit -q --allow-empty -m "fixture"
mkdir -p devlog/_plan/000000_isolated-check
printf '# 000 isolated check\n' > devlog/_plan/000000_isolated-check/000_plan.md
```

B 진입은 소스 정체성을 스냅샷하므로 픽스처는 커밋이 있는 git 저장소여야 한다.
세션 키는 예약된 터미널 키 `cli`를 쓴다. 이 세션의 실제 id를 쓰지 않는다.

## Step 4 — 훅 주입 경로 관측 (UserPromptSubmit)

`cxc hook` 서브커맨드는 존재하지 않는다. 훅 매니페스트가 실제로 부르는 진입점은
`components/pabcd-state/dist/cli.js hook user-prompt-submit`이고, 페이로드는 stdin JSON이다.
채팅 표면은 사람 free-pass이므로 인접 단계 이동에 attest가 필요 없다.

페이로드 형태는 `{hook_event_name, session_id, cwd, prompt, transcript_path, turn_id}`다.
`turn_id`는 호출마다 달라야 한다. 훅은 이미 주입한 turn을 `injectedTurns`로 기억하고
같은 값이 다시 오면 명령 파싱 전에 빈 문자열을 반환한다(hook.ts:651). 같은 `t1`을 세 번 쓰면
A와 B는 아예 실행되지 않고, 빈 A 출력이 음성 검증을 거짓 통과시킨다.

```bash
hookrun() {  # $1 = prompt, $2 = turn id (호출마다 달라야 함)
  printf '%s' "{\"hook_event_name\":\"UserPromptSubmit\",\"session_id\":\"cli\",\"cwd\":\"$CXC_WS\",\"prompt\":\"$1\",\"transcript_path\":null,\"turn_id\":\"$2\"}" \
  | CODEX_HOME="$CXC_TEST_HOME" node "${INSTALLED_ROOT}components/pabcd-state/dist/cli.js" hook user-prompt-submit
}
hookrun "orchestrate P" t1   # 기대: [codexclaw: PLAN] + Record implementation ownership
hookrun "orchestrate A" t2   # 기대: [codexclaw: AUDIT] + 해당 문장 없음
hookrun "orchestrate B" t3   # 기대: [codexclaw: BUILD] + recorded implementation ownership
```

세 출력을 모두 직접 읽고 증거에 붙인다. 생성만 하고 읽지 않은 출력은 관측이 아니다.
각 출력마다 단계 헤더(`[codexclaw: PLAN]` / `AUDIT` / `BUILD`)가 실제로 있는지 먼저 확인한다.
헤더가 없거나 출력이 비어 있으면 그 단계는 실행되지 않은 것이므로, 포인터 미포함을
음성 증거로 쓸 수 없다. 기존 테스트도 같은 흐름에 `t1/t2/t3`을 쓴다(hook.test.ts:727-731).

## Step 5 — CLI 경로 관측 (같은 턴 진행)

훅과 별개 경로다. Step 4가 픽스처 상태를 이미 움직였으므로 새 픽스처에서 시작한다.

```bash
CXC_WS2="${CXC_WS}-cli"
mkdir -p "$CXC_WS2" && cd "$CXC_WS2" && git init -q && git commit -q --allow-empty -m fixture
mkdir -p devlog/_plan/000000_isolated-check
printf '# 000 isolated check\n' > devlog/_plan/000000_isolated-check/000_plan.md
CXCRUN() { CODEX_HOME="$CXC_TEST_HOME" node "${INSTALLED_ROOT}bin/cxc.mjs" "$@"; }
CXCRUN orchestrate P --session cli --cwd "$CXC_WS2"
printf '%s' '{"from":"P","to":"A","did":"isolated fixture plan","planUnit":"devlog/_plan/000000_isolated-check"}' > "$CXC_WS2/pa.json"
CXCRUN orchestrate A --session cli --cwd "$CXC_WS2" --attest-file "$CXC_WS2/pa.json"
printf '%s' '{"from":"A","to":"B","did":"isolated fixture audit","auditOutput":"VERDICT: PASS","auditVerdict":"pass"}' > "$CXC_WS2/ab.json"
CXCRUN orchestrate B --session cli --cwd "$CXC_WS2" --attest-file "$CXC_WS2/ab.json"
```

기대: P와 B 출력에 `[implementation ownership: ...]`가 있고 A 출력에는 없다. 모두 exit 0.
attest가 거부되면 거부 사유를 그대로 증거에 남기고, 통과했다고 쓰지 않는다.

## Step 6 — 커밋 (워크트리)

```bash
git -C "$CXC_WT" status --short --branch
git -C "$CXC_WT" add -A
git -C "$CXC_WT" commit -m "<범위에 맞는 메시지>"
git -C "$CXC_WT" log --oneline -3
```

임시 픽스처는 워크트리 밖(`/home/jun/tmp`)에 있으므로 커밋 대상이 아니다.
`git -C`로 대상을 고정해 임시 저장소에 커밋되는 사고를 막는다.
push 하지 않는다(DEV-GIT-PUSH-01). PR은 사용자 승인 후 별도 단계.

## Step 7 — 정리

증거를 남긴 뒤 `$CXC_TEST_HOME`과 `$CXC_WS`, `$CXC_WS2`만 정리한다. 셋 다 이 작업이 만든 것이다.
워크트리와 브랜치는 다음 PR 단계의 입력이므로 남긴다.

## Accept criteria (wp4)

- build exit 0, `npm test` 0 failures의 실제 tail 출력.
- 실제 설치본 재귀 지문이 설치 전후 동일.
- 훅 경로에서 P/B 포함, A 미포함이 같은 증거에 기록되고, 세 출력 모두 자기 단계 헤더를 갖는다
  (빈 출력이나 헤더 없는 출력은 음성 증거로 인정하지 않는다).
- CLI 경로에서 P/B 포함, A 미포함이 exit 0과 함께 기록됨.
- `git -C "$CXC_WT" log`에 커밋 존재, 원격 push 없음.

## 이 유닛이 증명하지 않는 것

실제 비용 절감. Astra/Opus 동일 조건 비교와 메인+executor 합산 비용 측정이 필요하며
이 유닛의 범위 밖이다. 여기서 증명하는 것은 지침과 안내가 실제로 전달된다는 사실까지다.
