# 010 — wp1 정찰: W2 승인 게이트 훅 + dedicated_tools 자동 활성화

범위: 훅 인프라(등록→실행→거부), config-guard의 `cxc enable` / `cxc config set` 경로,
PreToolUse payload 스키마, 그리고 managed-keys.ts가 선언한 분리 기준을 W2 훅이 무력화하는지.
근거는 전부 파일경로:라인. 추측은 (추정).
기존 조사 `research/01~08`은 재조사하지 않고 인용만 한다.

워크트리 `/Users/jun/.codex/worktrees/1fa9/codexclaw`, 브랜치 `codex/memory-upgrade-l0`,
`origin/dev 6e97e73d` 기준. 코드는 건드리지 않았다(P 페이즈).

---

## 1. 훅 인프라 지도

### 1.1 등록

훅은 세 단계로 등록된다.

**(a) 훅 JSON 파일.** `plugins/codexclaw/hooks/<event>-<gerund>-<object>.json` 한 파일이 한 훅이다.
구조는 `{ "hooks": { "<EventName>": [ { "hooks": [ {type, command, timeout, statusMessage} ], "matcher": "<regex>" } ] } }`.
실제 예(`hooks/pre-tool-use-linting-apply-patch.json:1-16`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js\" hook pre-tool-use-edit",
            "timeout": 10,
            "statusMessage": "(codexclaw) Checking structured edit"
          }
        ],
        "matcher": "^(apply_patch|Write|Edit)$"
      }
    ]
  }
}
```

**(b) plugin.json의 `hooks` 배열.** `.codex-plugin/plugin.json:29-53`이 23개 파일을 상대경로로 나열한다.
배열에 없는 JSON 파일은 로드되지 않는다(`hooks/_deprecated/`가 그 증거).

**(c) matcher 해석.** 코드는 codex-rs `hooks/src/events/common.rs:137-173`.
matcher가 없으면 무조건 매치, `""`/`"*"`면 전체 매치,
영숫자·`_`·`|`만으로 이뤄지면 **정확 일치**(파이프 분리 후보 비교),
그 외에는 `regex::Regex::new(matcher).is_match(input)`.
`^create_goal$`처럼 앵커가 있으면 세 번째 분기(정규식)로 간다.
matcher가 의미 있는 이벤트는 9종뿐이고 PreToolUse는 그중 하나다(`hooks/src/lib.rs:43-56`).

matcher가 보는 입력은 canonical tool_name 하나가 아니라 **canonical + 별칭 배열**이다
(`hooks/src/events/common.rs:154-163` `matcher_inputs`). 별칭은 `apply_patch`에 붙은
`Write`/`Edit`, `spawn_agent`에 붙은 `Agent`뿐이고(`core/src/tools/hook_names.rs:33-50`),
stdin에 직렬화되는 이름은 언제나 canonical이다.

### 1.2 실행

훅 프로세스는 `node <dist/cli.js> hook <event-slug>`로 spawn되고 payload는 **stdin JSON**이다.
event-slug는 codex의 이벤트 이름이 아니라 codexclaw가 정한 라우팅 키다 —
같은 `PreToolUse` 이벤트라도 `pre-tool-use`(goal 3종), `pre-tool-use-edit`(린트),
`worktree-guard-pretool`(워크트리)로 갈린다(`components/pabcd-state/src/cli.ts:110-181`).

dispatch 순서가 중요하다. `cli.ts`(sed 오프셋 300 기준 실제 줄):

1. stdin 4MB 초과 → `oversizedHookOutput`이 `pre-tool-use` 접두 이벤트에 대해 **deny 봉투**를 낸다(`cli.ts:90-101`, 표시상 92-107). "정책 우회를 거부한다"가 이유.
2. `worktree-guard-pretool`은 subagent early-exit **위**에서 처리된다. 자식 턴도 막기 위해서다(`cli.ts:328-334`).
3. `agent_id`/`agent_type`가 있는 subagent payload는 여기서 exit(`cli.ts:339-341`).
4. `pre-tool-use`는 전용 **fail-closed** dispatcher로 간다(`cli.ts:347-350`).
5. 나머지는 전부 하나의 `try`로 감싸인 **fail-open** 경로다(`cli.ts:355-...`).

### 1.3 거부 프로토콜 (정확한 형태)

두 가지 경로가 있고 codexclaw는 전자만 쓴다.

**경로 A — exit 0 + stdout JSON.** codex-rs `hooks/src/events/pre_tool_use.rs:213-253`이
exit 0일 때 stdout을 파싱한다. `permissionDecision: "deny"`이고 `permissionDecisionReason`이
비어있지 않으면 `should_block = true`(`pre_tool_use.rs:241-248`, `output_parser.rs:144-161`).

codexclaw의 실제 봉투(`components/pabcd-state/src/goal-gate.ts:116-124`):

```ts
return \`\${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: CREATE_GOAL_WARNING,
    additionalContext: CREATE_GOAL_WARNING,
  },
})}\\n\`;
```

통과는 빈 문자열 `""`이고 exit code는 언제나 0이다.
와이어 스키마는 camelCase, `deny_unknown_fields`이며 필드는
`hookEventName / permissionDecision("allow"|"deny"|"ask") / permissionDecisionReason /
updatedInput / additionalContext`뿐이다(`hooks/src/schema.rs:243-256, 258-266`).

**경로 B — exit 2 + stderr.** `pre_tool_use.rs:261-277`. exit 2이고 stderr가 비어있지 않으면
그 텍스트가 block reason이 된다. stderr가 비면 실패로 처리되고 **차단되지 않는다**.
codexclaw는 이 경로를 쓰지 않는다. (일관성 유지 차원에서 W2도 경로 A를 써야 한다.)

**주의 — non-deny 결정은 모델에게 안 보인다.** `idle-edit.ts:10-12`가 감사로 못박은 사실:
"only `additionalContext` reaches the model on a non-deny decision — allow +
permissionDecisionReason (friction-gate shape) is model-invisible."
즉 "경고하되 통과"를 하려면 `additionalContext`에 넣어야 하고 `permissionDecisionReason`은
deny일 때만 의미가 있다.

**모델이 실제로 보는 문장.** deny가 확정되면 codex가 이유를 감싼다(`core/src/hook_runtime.rs:230-241`):
tool_name이 `Bash`나 `apply_patch`이고 `tool_input.command`가 문자열이면
`"Command blocked by PreToolUse hook: {reason}. Command: {command}"`,
그 외에는 `"Tool call blocked by PreToolUse hook: {reason}. Tool: {tool_name}"`.
W2가 막을 `memories.add_ad_hoc_note`는 후자 형태다.

**여러 훅이 같은 도구에 걸릴 때.** `pre_tool_use.rs:115-118`: `should_block`은
**any**이고 `block_reason`은 **처음 발견된 것**이다. 즉 하나만 거부해도 차단되며,
차단 시 `updated_input`은 버려진다(`:129-131`). W2를 새 파일로 추가해도 기존
PreToolUse 훅과 안전하게 공존한다.

### 1.4 fail-open / fail-closed 규율

이 레포는 훅마다 실패 방향을 **명시적으로 선언**하고 주석에 이유를 남긴다.

| 훅 | 방향 | 근거 |
|---|---|---|
| `request_user_input` goal 차단 | fail-CLOSED | `goal-gate.ts:313-321` — 파싱이 터져도 raw 문자열을 보고 deny |
| apply_patch 린트 | fail-OPEN | `comment-lint.ts:9-11` "This is the ONE PreToolUse branch that is fail-open" |
| worktree 삭제 가드 | fail-OPEN | `cli.ts:330-333` "a guard crash must never block an unrelated command" |
| goal-complete 게이트 | fail-OPEN | `goal-gate.ts:299-301` "never trap update_goal on gate IO errors" |
| config-guard SessionStart | fail-OPEN(무조건) | `config-guard/src/cli.ts:146-148, 162-165` |
| stdin 4MB 초과 | fail-CLOSED | `cli.ts:92-107` |

W2는 이 표에 한 줄을 추가하는 일이고, 방향 선택의 근거를 코드 주석에 남겨야 한다(§2.4).

---

## 2. W2 훅을 어디에 어떻게 추가하는가

### 2.1 대상 도구의 hook-facing 이름 — 여기가 가장 큰 함정이다

메모리 툴은 MCP가 아니라 **extension 툴**이고, `memories` 네임스페이스를 쓴다
(`ext/memories/src/lib.rs:18` `MEMORY_TOOLS_NAMESPACE = "memories"`,
`ext/memories/src/tools/mod.rs:55-57` `ToolName::namespaced(MEMORY_TOOLS_NAMESPACE, name)`).

extension 툴은 `ExtensionToolAdapter`를 타고, 그 어댑터는 `pre_tool_use_payload`를
**재정의하지 않는다** — `core/src/tools/handlers/extension_tools.rs:72-96`에는
`is_builtin_control_tool`과 `matches_kind`만 있다. 따라서 기본 구현
`core/src/tools/registry.rs:129-139`가 쓰이고, 그것은
`function_hook_tool_name(invocation)` → `flat_tool_name(&invocation.tool_name)`으로 간다
(`registry.rs:801-808`).

`flat_tool_name`은 **구분자 없이 이어붙인다**(`core/src/tools/mod.rs:40-54`):

```rust
Some(namespace) => {
    let mut name = String::with_capacity(namespace.len() + tool_name.name.len());
    name.push_str(namespace);
    name.push_str(&tool_name.name);
    Cow::Owned(name)
}
```

`memories`는 default namespace(`None | "" | "functions"`, `protocol/src/tool_name.rs:46-51`)가
아니므로 이 분기를 탄다. 결과적으로 hook-facing 이름은

> **`memoriesadd_ad_hoc_note`** (구분자 없음)

이다. 이는 codexclaw가 이미 겪은 것과 같은 현상이다 —
`subagent-config/src/spawn-attach-hook.ts:5-8`이 정확히 같은 근거로
`collaborationspawn_agent`를 다룬다: "codex-rs flat_tool_name concatenates the
`collaboration` namespace and the child name without punctuation".
그 파일은 방어적으로 점/언더바 변형도 받아둔다(`spawn-attach-hook.ts:483-488`).

**직접 실행으로 확인하지는 못했다.** 소스 추론(어댑터가 재정의 없음 → 기본 payload →
`flat_tool_name`)과 `collaborationspawn_agent` 선례의 결합이 근거이고,
`memoriesadd_ad_hoc_note` 문자열 자체는 코드베이스에 리터럴로 없다. **(추정)**
실측은 `dedicated_tools`를 켠 세션에서 훅 stdin을 덤프해야 가능하다.

따라서 W2 matcher는 선례와 같은 방어적 형태를 쓴다:

```
"matcher": "^memories[._]?add_ad_hoc_note$"
```

`spawn-attach-hook`의 matcher `^(collaboration[._]?)?spawn_agent$`와 같은 문법이고,
matcher 판정이 정규식 분기를 타는지 확인했다(`^`가 있으니 `is_exact_matcher`가 아니다).

### 2.2 payload에서 인자를 얻는 법

PreToolUse stdin 스키마는 `hooks/src/schema.rs:278-296`이 확정한다
(snake_case, `deny_unknown_fields`): `session_id, turn_id, agent_id?, agent_type?,
transcript_path, cwd, hook_event_name, model, permission_mode, tool_name, tool_input, tool_use_id`.
codexclaw쪽 대응 타입은 `goal-gate.ts:17-28`이 이미 갖고 있다.

`tool_input`의 모양은 도구마다 다르다.

| 도구 종류 | tool_input | 근거 |
|---|---|---|
| `apply_patch` | `{ "command": "<패치 전문>" }` | `core/src/tools/handlers/apply_patch.rs:458-463` |
| `Bash`류 exec | `{ "command": ... }` | `registry.rs:159-163` 주석 + `worktree-guard.ts:575-580` 실사용 |
| MCP 툴 | 해석된 JSON 인자 그대로, 이름은 `mcp__<server>__<tool>` | `handlers/mcp.rs:412-420`, 테스트 `mcp.rs:575-611` |
| extension/function 툴 | 함수 인자 JSON 그대로 | `registry.rs:129-139` + `function_hook_tool_input`(`registry.rs:810-817`) |

`memories.add_ad_hoc_note`는 마지막 줄이다. 인자 스키마는
`ext/memories/src/tools/ad_hoc_note.rs:22-36`:

```rust
struct AddAdHocNoteArgs {
    filename: String,  // ^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{0,79}\.md$
    note: String,      // length(min = 1)
}
```

그러므로 W2 훅이 읽을 값은 `tool_input.filename`과 `tool_input.note`다.
빈 인자는 `{}`로 정규화된다(`registry.rs:810-814`), 파싱 실패 시에는
**인자 문자열이 통째로 JSON string이 되어** 들어온다(`registry.rs:815-816`) —
객체가 아닐 수 있다는 뜻이고, `isRecord` 검사가 필요하다.

참고로 파일 쓰기 위치는 `~/.codex/memories/extensions/ad_hoc/notes/<filename>`이고
`create_new(true)`라 덮어쓰기는 불가능하다(`ext/memories/src/local/ad_hoc_note.rs:12, 28-38`).
즉 W2가 막아야 할 위험은 "기존 노트 훼손"이 아니라 **원치 않는 새 노트 생성**이다.

### 2.3 파일 배치 — 기존 패턴대로

W2는 config-guard가 아니라 **pabcd-state**에 넣는 게 패턴에 맞다.
`config-guard`는 config.toml 문법과 feature CLI 위임만 담당하고
(`features.ts:1-11`, `toml-edit.ts:10-16` 둘 다 스코프를 명시적으로 좁혀놨다),
런타임 도구 게이트는 전부 pabcd-state가 갖고 있다.

추가할 것:

1. `components/pabcd-state/src/memory-write-gate.ts` (신규) — 순수 판정 + 봉투 생성.
2. `components/pabcd-state/src/cli.ts` — 새 event-slug 분기 한 줄.
3. `plugins/codexclaw/hooks/pre-tool-use-guarding-memory-write.json` (신규).
4. `plugins/codexclaw/.codex-plugin/plugin.json` — `hooks` 배열에 한 줄.

**cli.ts 분기 위치가 설계 결정이다.** `pre-tool-use`(fail-closed) 안에 합칠지,
새 slug로 뺄지. 새 slug 권장 — `pre-tool-use`는 `handlePreToolUseFailClosed`가
세 게이트를 순차 OR로 묶고 있고(`goal-gate.ts:318`), 거기에 네 번째를 넣으면
goal-mode 전용 fail-closed 규율이 메모리 게이트에까지 번진다.
`worktree-guard-pretool`처럼 독립 slug + 자기 실패 방향을 갖는 편이 낫다.

### 2.4 실패 방향

**fail-open을 권한다.** 근거: 이 게이트가 크래시했을 때 잃는 것은 "원치 않는 메모리 노트
한 개"이고, fail-closed로 하면 잃는 것은 "사용자가 명시적으로 요청한 기억하기가
훅 버그로 영영 막힘"이다. `comment-lint.ts:9-11`이 편집 린트에 대해 편 논리와 같다.

단, 이 판단은 §3에서 "명시 요청 판정"이 필연적으로 휴리스틱이라는 결론과 맞물린다 —
휴리스틱 게이트를 fail-closed로 걸면 오탐이 곧 기능 상실이다.

---

## 3. '명시 요청'을 훅이 판정할 수 있는가

### 3.1 PreToolUse 훅 단독으로는 못 한다

PreToolUse payload에는 사용자 프롬프트가 **없다**(`schema.rs:278-296` 필드 목록 전체 확인).
있는 것은 `session_id / turn_id / cwd / model / permission_mode / tool_name / tool_input /
tool_use_id / transcript_path`뿐이다.

`permission_mode`도 답이 아니다. 그것은 승인 정책(Default/Plan 등)이지 "이번 턴에
사용자가 기억을 요청했는가"와 무관하다.

### 3.2 쓸 수 있는 신호 세 가지 — 코드 근거와 함께

**신호 A — UserPromptSubmit에서 의도를 잡아 세션 상태에 기록한다. 이 레포의 확립된 패턴이다.**

`UserPromptSubmitCommandInput`에는 `prompt`가 있다(`hooks/src/schema.rs:567-582`).
codexclaw는 이미 프롬프트에서 의도를 읽어 상태로 남기는 코드를 세 곳에서 돌리고 있다:

- `hook.ts:271` `detectLoopArmRequest(prompt)` → `state.loopArmSeen = true`(`hook.ts:675-679`),
  그리고 그 플래그를 **다른 PreToolUse 훅이 읽는다**(`idle-edit.ts:90` `state.loopArmSeen`).
  이것이 W2에 정확히 필요한 회로다 — 프롬프트에서 판정, 상태에 기록, 도구 시점에 조회.
- `recall/src/hook.ts:61-91` `RECALL_PATTERNS` 15종 + `ALREADY_RECALLING` 억제.
  한국어/영어 관용구를 정규식으로 잡는 실동작 예다.
- `worktree-guard.ts:552-559` rename 의도 감지 + 세션당 1회 마커.

상태 파일은 `.codixclaw`가 아니라 `<cwd>/.codexclaw/sessions/<sessionId>.json`이고
(`state.ts:220, 300-306`), 키는 `sanitizeKey`로 정규화된다(`state.ts:226`).
`State`에 boolean 하나를 더하는 비용은 `loopArmSeen` 선례와 같다(`state.ts:141, 288, 540`).

**한계 두 개를 정직하게 적는다.**
- UserPromptSubmit 훅은 subagent 턴에서 early-exit된다(`cli.ts:339-341`). 자식이 메모리에
  쓰려 하면 상태에 플래그가 없어 항상 차단된다. 이건 사실 바람직한 성질이다.
- `state.injectedTurns` 중복 방지 로직(`hook.ts:629`)이 turn 단위로 조기 return한다.
  `loopArmSeen` 기록이 **그 가드 바깥**에 놓인 이유가 정확히 이것이고(`hook.ts:675-679`
  주석: "persist loopArmSeen OUTSIDE the turn guard"), W2 플래그도 같은 위치여야 한다.

**신호 B — transcript tail 읽기. 이미 있고, 이미 한계가 알려져 있다.**

`transcript_path`는 PreToolUse payload에 있고(`schema.rs:285`), rollout JSONL 경로다
(`core/src/session/mod.rs:4657-4669`). codexclaw는 `readTranscriptTail`로 마지막 64KB를
읽는 유틸을 이미 갖고 있다(`transcript.ts:19, 39-50`).

원리적으로는 "직전 사용자 메시지에 기억 요청이 있었나"를 여기서 볼 수 있다.
하지만 `transcript.ts:7-11`이 스스로 적어둔 대로 이 읽기는 마커 탐지용 근사이고,
파싱 없는 문자열 포함 검사다. 사용자 메시지와 모델 출력을 구분하려면 JSONL을
제대로 파싱해야 하는데 그건 `recall/src/rollout.ts:214-239`급 작업이고
PreToolUse 핫패스에 넣을 비용이 아니다. **A의 보조로만 쓸 것.**

**신호 C — 환경변수. 이 레포에서는 테스트 seam 용도로만 쓴다.**

`CODEXCLAW_CXC`(`goal-gate.test.ts:10`), `CODEXCLAW_WORKTREE_ROOTS`(`worktree-guard.ts:42`).
사용자 의도 신호로 쓴 전례는 없다. 세션 단위로 켜고 끄기 어렵고 되돌리기 보장도 없다.
**부적합.**

### 3.3 권고 설계

3단 판정, 위에서부터 통과하면 허용:

1. **세션 마커** — 같은 세션의 UserPromptSubmit에서 기억 요청 관용구가 감지됐고
   아직 소비되지 않았다. `recall/src/hook.ts:61-77` 스타일 정규식(한/영),
   예: `기억해` / `기억해둬` / `메모리에 (남겨|기록|추가)` / `remember (this|that)` /
   `(add|save|write).{0,12}(to )?memory` / `잊지 마`.
2. **CLI 승인** — `cxc memory allow-write --session <id>` 같은 명시 승인.
   `cxc evidence resolve` 선례(`goal-gate.ts:262`)가 같은 모양이다. 자동화·재현에 필요하다.
3. 둘 다 없으면 **deny**, 이유에 두 가지 해소법을 모두 적는다.

마커는 **1회용**으로 하는 게 안전하다(worktree-guard의 `alreadyInjected`/`markInjected`
마커 패턴, `worktree-guard.ts:512-536`). 한 번 "기억해"라고 한 세션에서 이후 모든
메모리 쓰기가 무제한 허용되면 게이트의 의미가 없다.
다만 노트 하나를 여러 번 시도하는 정상 재시도를 막지 않도록, 소비 단위는
`(session, filename)`이 아니라 `(session, turn)`이 적절하다. **(추정 — 실사용 관찰 전)**

### 3.4 이 게이트가 방어하지 못하는 것 (정직한 한계)

- 사용자가 "기억해"라고 말한 턴에 모델이 **엉뚱한 내용**을 노트에 쓰는 경우. 훅은 내용을
  판정하지 않는다. §5.3(research/08:356-358)이 요구한 "어디에 무엇을 썼는지 보고"는
  훅이 아니라 PostToolUse 관측이나 스킬 프롬프트의 몫이다.
- 사용자가 관용구를 쓰지 않고 의도를 표현하는 경우(오탐 아닌 미탐). fail-open 선택과
  CLI 승인 경로가 이 비용을 상쇄한다.
- `memories.list/read/search` 세 읽기 도구는 게이트 대상이 아니다. W2는 쓰기 하나만 본다.

---

## 4. dedicated_tools를 `cxc enable`로 옮기는 문제

### 4.1 주석이 실제로 선언한 기준

`managed-keys.ts:14-27`은 2026-08-29에 이미 한 번 자기 근거를 **정정**했다.
초고의 근거("사용자가 소유한 부수효과 있는 스위치를 절대 대신 켜지 않는다")가
실제 동작과 모순이라고 스스로 적었다 — `cxc enable`은 `[features]` boolean 네 개를 켜고
SessionStart self-heal도 소프트 플래그를 켜기 때문이다.

정정된 기준은 TOML 테이블 이름이 아니다:

> - DECLARED_FEATURES: codexclaw 가 동작하기 위해 필요하다고 선언한 플래그. 효과가
>   codexclaw 안에서 끝나고, 되돌리기는 매니페스트가 보장한다. 설치가 켠다.
> - CONFIG_MANAGED_KEYS: 효과가 codexclaw 밖까지 미치는 스위치.
>   `memories.dedicated_tools` 는 메모리 파이프라인 전체를 바꾸고, 그건 codexclaw 를
>   지우더라도 사용자가 계속 안고 가는 결과다. 그래서 자동으로 켜지 않는다.
> (`managed-keys.ts:20-24`)

즉 판별식은 두 개의 곱이다: **(i) 효과가 codexclaw 안에서 끝나는가**, 그리고
**(ii) 되돌리기를 매니페스트가 보장하는가**.
타입 시스템에도 박아뒀다 — `autoEnable: false`가 리터럴 타입이다(`managed-keys.ts:33-34`).

### 4.2 W2 훅이 (i)을 무력화하는가 — 부분적으로만

**"효과가 밖까지 미친다"를 두 성분으로 나눠야 정확하다.**

*쓰기 성분.* `dedicated_tools`가 켜지면 열리는 네 도구 중 `add_ad_hoc_note`만이
`~/.codex/memories/extensions/ad_hoc/notes/`에 파일을 만든다(`ad_hoc_note.rs:12, 28-38`).
그 파일은 codexclaw를 지워도 남고, Codex의 memory phase2 통합 대상이 되어
이후 모든 세션의 `memory_summary.md`에 영향을 줄 수 있다. 이게 주석이 말한
"사용자가 계속 안고 가는 결과"의 실체다.

**W2는 정확히 이 성분을 겨냥한다.** 게이트가 있으면 명시 요청 없는 노트는 생성되지 않고,
생성되지 않은 파일은 잔존물이 없다. `caution` 문구 자체가 이 조건을 선행 요구로
명시하고 있다는 점이 결정적이다(`managed-keys.ts:44-47`):

> "add_ad_hoc_note는 메모리에 새 노트를 만드는 쓰기 경로이므로,
> **명시 요청 없는 쓰기를 막는 장치를 먼저 확인하세요.**"

주석 작성자는 이 게이트가 생기는 미래를 예상하고 조건을 적어둔 것이다.
W2는 그 조건의 충족이지 무력화가 아니다.

*읽기 성분.* `list/read/search` 세 도구는 읽기 전용이고
(`ext/memories/src/tools/mod.rs:35-52`), 켜졌다가 꺼지면 흔적이 없다.
또한 이 도구들은 `memories` feature와 `use_memories`가 모두 참일 때만 의미가 있고
(`ext/memories/src/extension.rs:45-47`), 그 둘은 이 환경에서 이미 켜져 있다
(`~/.codex/config.toml:78` `memories = true`, `:590` `use_memories = true`; 실측).
`dedicated_tools`는 **이미 켜져 있는 파이프라인을 모델에게 노출하느냐**의 스위치이지
파이프라인을 새로 켜는 스위치가 아니다.

정리하면 (i)의 위반은 쓰기 성분에 집중돼 있고, W2가 그걸 닫는다.

**반론도 적어둔다.** W2는 codexclaw가 설치돼 있을 때만 동작한다.
codexclaw를 지우면 게이트도 사라지고 `dedicated_tools`만 남을 수 있다 —
게이트가 아니라 그 잔존이 (i) 위반의 잔재다. 이것이 §4.4 원복 설계가
선택이 아니라 **필수**인 이유다. 게이트 논증과 원복 논증은 하나의 세트다.

### 4.3 (ii)는 이미 만족돼 있다 — 이 부분은 논쟁의 여지가 없다

매니페스트 기구는 완성돼 있고 테스트도 있다.

- `applyManagedKey`가 백업·쓰기·기록을 **한 함수**에 묶는다. 이유가 명시돼 있다
  (`config-set.ts:3-8`): 매니페스트를 건너뛴 쓰기는 영원히 원복 불가가 되기 때문.
- `priorValue` 보존 규칙: 이미 기록이 있으면 원래 값을 유지해서
  "이전 값이 우리 값이었다"로 역사가 덮이지 않게 한다(`config-set.ts:139-141`).
- `deactivate`는 키별로 판단한다(`deactivate.ts:72-90` `decideKeyRestore`).
  우리 값이 그대로면 복원, 남이 바꿨으면 놔둔다. `priorValue === null`인 **삭제** 케이스는
  파일이 드리프트했을 때 백업이 동의해야만 실행한다(`deactivate.ts:84-88`).
- 실행 순서가 load-bearing이다: table-key 복원이 먼저, `codex features disable`이 나중.
  후자가 config.toml을 새로 읽어 쓰기 때문에 순서가 반대면 우리 쓰기가 날아간다
  (`deactivate.ts:15-19`).
- end-to-end 테스트가 이미 있다(`config-guard/test/config-set.test.ts:36-60`):
  set → 매니페스트 기록 확인 → `deactivate` → 키 소멸 + 외부 키 생존.
  드리프트 4케이스도 커버된다(`deactivate-drift.test.ts:76-137`).

### 4.4 원복 보장 설계 — 무엇을 바꿔야 하는가

**설계 A — CONFIG_MANAGED_KEYS에 두고 `activate`가 호출만 한다. 이걸 권한다.**

`activate.ts:236-239`가 현재 `tableKeys: {}`로 초기화하며 주석에 이유를 적고 있다:
"Installation never writes a managed key: every CONFIG_MANAGED_KEYS entry is
autoEnable:false". 여기를 바꾼다.

구체적으로:

1. `ManagedKey.autoEnable` 타입을 `false`에서 `boolean`으로 넓히고,
   `memories.dedicated_tools`만 `true`로 한다. 타입이 리터럴 `false`인 것이
   현재의 컴파일타임 불변식이므로(`managed-keys.ts:33-34`) 여기를 손대는 것이
   변경의 핵심 선언이 된다.
2. `ManagedKey`에 자동 활성화 전제조건을 명시하는 필드를 추가한다 —
   예를 들어 어떤 게이트가 이 키의 부수효과를 닫는지 가리키는 값.
   그래야 다음 사람이 "왜 이건 자동인가"를 코드에서 읽는다.
3. `activate()`에서 `autoEnable: true`인 키에 대해 `applyManagedKey(deps, id, true)`를
   호출한다. **매니페스트를 쓴 뒤에** 호출해야 한다 —
   `applyManagedKey`는 매니페스트가 없으면 거부하기 때문이다(`config-set.ts:77-85`).
   현재 `activate`는 `writeFileSync(manifestPath...)`가 마지막 줄이므로
   (`activate.ts:241`), 자동 활성화는 그 다음이다.
4. 원복은 **수정이 필요 없다**. `deactivate`가 `manifest.tableKeys`를 순회하므로
   (`deactivate.ts:130-157`) 매니페스트에 들어가는 순간 자동으로 커버된다.
   `setByCodexclaw`가 참이고 현재 값이 우리 값이면 복원, 아니면 스킵.

**설계 B — DECLARED_FEATURES로 옮긴다. 이건 불가능하다.**
`codex features enable`은 `[features]` 안의 boolean에만 도달한다
(`features.ts:6-9`, `toml-edit.ts:5-8`). `memories.dedicated_tools`는 `[memories]`
테이블이고 지속형 CLI setter가 없다. 기각.

**self-heal은 어떻게 할 것인가.** `selfHealableFeatures()`는 `SOFT_FEATURES` 교집합만
반환한다(`self-heal.ts:147-149`). 마켓플레이스 설치 경로에는 `cxc enable`이 안 돌기 때문에
(`self-heal.ts:4-7`) 자동 활성화를 SessionStart에도 태울지가 별도 결정이다.

태운다면 `healedKeys` 합의 기록을 그대로 따라야 한다(`self-heal.ts:36-45`):
한 번 켰던 키를 사용자가 끄면 다시 켜지 않는다. 이 성질이 없으면
`cxc config unset memories.dedicated_tools`가 다음 세션에 무효화되고,
그건 §4.2의 논증을 통째로 무너뜨린다. `markSelfHealOptedOut`이 `cxc disable`
시점에 걸리는 것도 마찬가지로 필요하다(`deactivate.ts:99-103`).

**self-heal 확장은 wp1 범위에서 빼는 것을 권한다.** `cxc enable` 경로만 먼저 바꾸고,
마켓플레이스 경로는 별도 작업 단위로. 이유는 `healedKeys`가 현재 feature 키 전용
어휘라서 table-key까지 담으려면 마커 스키마를 넓혀야 하고, 그건 독립적으로
되돌릴 수 있는 변경이어야 하기 때문이다.

### 4.5 검증해야 할 명제

| 명제 | 검증 방법 |
|---|---|
| `cxc enable` 후 config.toml에 `dedicated_tools = true`가 있고 매니페스트 `tableKeys`에 기록됨 | `config-set.test.ts:36-60` 패턴을 `activate`에 대해 반복 |
| `cxc disable` 후 키가 사라지고 다른 `[memories]` 키는 생존 | 같은 테스트가 이미 그 assertion을 갖고 있음(`:57-59`) |
| 사용자가 이미 `false`로 켜둔 경우 우리 값이 덮지 않거나, 덮되 원복됨 | `deactivate-drift.test.ts:105-108` `ours("false")` 케이스 참고 |
| 매니페스트가 없는 상태에서 자동 활성화가 거부됨 | `config-set.test.ts:72-79` |
| W2 훅이 게이트를 통과/차단하는 두 경로 | 신규 `memory-write-gate.test.ts` |

---

## 5. 테스트 관행

### 5.1 컴포넌트 단위 테스트

`node:test` + `node:assert/strict`, 파일은 `components/<name>/test/*.test.ts`.
루트 `package.json:24`가 8개 컴포넌트의 테스트를 전부 나열하고,
`inventory.mjs:178-186`이 **테스트 디렉터리가 있는데 스크립트에 없으면 위반**으로 잡는다.
새 컴포넌트를 만들지 않으므로 이 검사에는 걸리지 않는다.

훅 테스트의 실제 모양(`comment-lint.test.ts:32-40`):

```ts
const raw = JSON.stringify({
  hook_event_name: "PreToolUse", session_id: "s", cwd: "/tmp",
  tool_name: "apply_patch", tool_input: { command: "..." },
});
const out = JSON.parse(handleApplyPatchLint(raw).trim());
assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
assert.match(out.hookSpecificOutput.permissionDecisionReason, /comment-lint/);
```

즉 **raw stdin 문자열을 만들어 핸들러에 직접 넣고 봉투를 파싱해 검사**한다.
`goal-gate.test.ts:25-39`는 payload 빌더 헬퍼(`ptu`, `ptuAt`)를 두는 변형이다.
IO가 필요한 테스트는 `mkdtempSync(join(tmpdir(), "cxc-..."))`로 임시 홈을 만든다
(`config-set.test.ts:15-32`).

### 5.2 매니페스트/E2E 테스트 — W2가 반드시 건드리는 곳

**`test/hook-e2e.test.mjs:132`**:

```js
assert.ok(Array.isArray(manifest.hooks) && manifest.hooks.length === 23, "expected 23 declared hooks");
```

**하드코딩 상수다. 24로 바꿔야 한다.** 이 테스트는 각 훅의 command 문자열을
파싱해 dist 진입점이 실존하는지 확인하고(`:81-89, 127-142`), 실제로 프로세스를
spawn해 봉투를 검사한다(`:91-102`).

**`test/manifest-policy.test.mjs:78-89`**는 goal-budget 훅의 matcher가
`^create_goal$`인지 정확히 검사한다. W2도 같은 형태의 matcher 고정 테스트를
추가하는 게 이 파일의 관행에 맞다.

### 5.3 dist 동기화 — 잊으면 CI가 잡는다

`test/dist-freshness.test.mjs:29-53`이 **git-tracked dist 파일이 src와 바이트 일치**하는지
빌드 없이 검사한다. TypeScript 소스를 고치면 `npm run build` 후 dist를 커밋해야 한다.
`.ts` → `.js` 상대 import 재작성이 빌드의 실체다(`scripts/build.mjs:42` 부근).

### 5.4 인벤토리와 배지

`inventory.mjs:58-68`이 훅 파일을 읽어 event/component/matcher를 추출하고
`plugins/codexclaw/inventory.json`에 기록한다.
README 3종의 배지가 `hooks-23`으로 하드코딩돼 있고(`README.md:18`, `README.ko.md:18`,
`README.zh.md:18`), `inventory.test.mjs:149-154`가 이 값을 검사한다.
`inventory.mjs:250-255`에 재작성 함수가 있으므로 수동 편집 대신 그 경로를 쓴다.

문서도 개수를 적고 있다: `docs-site/src/content/docs/reference/hooks.md:3-6`
("23 hook files with 24 event handlers")와 훅 표.

---

## 6. 예상 변경 파일과 규모

### wp1-A: W2 승인 게이트 훅

| 파일 | 상태 | 규모 | 내용 |
|---|---|---|---|
| `components/pabcd-state/src/memory-write-gate.ts` | 신규 | 120~180줄 | 관용구 정규식, 마커 read/consume, 판정, deny 봉투. `comment-lint.ts` 구조를 따름 |
| `components/pabcd-state/src/state.ts` | 수정 | 4~6줄 | `State`에 플래그 1개 + `defaultState` + 역직렬화 (`loopArmSeen` 선례: `:141, 288, 540`) |
| `components/pabcd-state/src/hook.ts` | 수정 | 10~15줄 | 기억 요청 감지 함수 + turn 가드 **바깥** 기록(`:675-679` 위치) |
| `components/pabcd-state/src/cli.ts` | 수정 | 4~6줄 | 새 event-slug 분기 |
| `hooks/pre-tool-use-guarding-memory-write.json` | 신규 | 16줄 | matcher `^memories[._]?add_ad_hoc_note$` |
| `.codex-plugin/plugin.json` | 수정 | 1줄 | hooks 배열 |
| `components/pabcd-state/test/memory-write-gate.test.ts` | 신규 | 100~150줄 | 통과/차단/오염입력/fail-open |
| `test/hook-e2e.test.mjs` | 수정 | 1줄 | 23 → 24 |
| `test/manifest-policy.test.mjs` | 수정 | 10~12줄 | matcher 고정 |
| dist(2~4개 `.js`) | 생성 | — | `npm run build` 후 커밋 |
| README ×3 배지, `inventory.json`, `docs-site/.../hooks.md` | 수정 | 각 1~5줄 | 개수/표 갱신 |

**CLI 승인 경로(`cxc memory allow-write`)를 넣으면** `bin/codexclaw.mjs`에 case 하나와
pabcd-state CLI 서브커맨드가 추가돼 +40~60줄. 3.3의 신호 2를 wp1에 포함할지는
범위 결정 사항이다. **(사용자 확인 필요)**

### wp1-B: dedicated_tools 자동 활성화

| 파일 | 상태 | 규모 | 내용 |
|---|---|---|---|
| `components/config-guard/src/managed-keys.ts` | 수정 | 25~40줄 | `autoEnable` 타입 확대, 엔트리 `true`, 그리고 **주석 20-24행 전면 재작성** — 새 기준과 W2 의존을 명시 |
| `components/config-guard/src/activate.ts` | 수정 | 20~30줄 | 매니페스트 기록 후 auto-enable 루프, `:236-239` 주석 교체 |
| `components/config-guard/src/cli.ts` | 수정 | 5~10줄 | `enable` 출력에 켜진 managed key 표시, `CONFIG_USAGE:30-33` 문구 정정 |
| `components/config-guard/src/features.ts` | 수정 | 3~5줄 | `:6-11` 경계 주석이 "nothing on that list is auto-enabled"라고 단언 — 정정 필요 |
| `components/config-guard/test/activate.test.ts` | 수정 | 40~60줄 | 자동 활성화 + 원복 왕복 |
| `components/cxc-ops/src/doctor.ts` | 수정(선택) | 10~15줄 | managed key 상태 체크 추가 |
| `docs-site/.../guides/native-tools.md`, `reference/commands.md` | 수정 | 각 5~15줄 | 설치가 이 키를 켠다는 사실 |
| dist | 생성 | — | 빌드 |

### 두 작업의 결합

**분리 커밋으로 가야 한다.** wp1-A(게이트)와 wp1-B(자동 활성화)는 독립적으로 되돌릴 수
있어야 한다 — 게이트에 문제가 생기면 게이트만 되돌리는 게 아니라 **자동 활성화를**
먼저 되돌려야 하기 때문이다. 순서도 이 방향이다: A가 먼저 머지되고 검증된 다음 B.
B의 정당화가 A의 존재에 의존하므로(§4.2), 역순은 논증이 성립하지 않는 기간을 만든다.

---

## 7. 확인하지 못한 것

- **`memoriesadd_ad_hoc_note` 실측.** §2.1의 추론은 소스 3단계(어댑터 미재정의 →
  기본 payload → `flat_tool_name`)와 `collaborationspawn_agent` 선례에 근거하지만,
  `dedicated_tools`를 켠 세션에서 훅 stdin을 덤프해 확인하지 않았다.
  B 페이즈 착수 전 첫 검증 항목으로 둘 것.
- **세션 마커 소비 단위.** `(session, turn)`이 적절하다고 적었으나 실사용 관찰이 없다.
- **self-heal 경로에 table-key를 태울 때의 `healedKeys` 스키마 확장.** §4.4에서 범위 밖으로
  뺐으므로 설계하지 않았다.
- **자동 활성화 후 모델이 실제로 `memories.search`를 호출하는 빈도.**
  research/08:404가 남긴 unknown 그대로다.
- **PermissionRequest 이벤트를 W2에 쓸 수 있는지.** `hooks/src/lib.rs:43-56`에 matcher를
  갖는 이벤트로 등재돼 있고 `hook_runtime.rs:246-...`에 러너가 있지만,
  codexclaw에 전례가 없고 PreToolUse로 충분해 보여 조사하지 않았다.
