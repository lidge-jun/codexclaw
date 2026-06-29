# 130 — 코드 인텔리전스 (lsp / codegraph / ast-grep)

Status: RESEARCH COMPLETE (J5 실측 반영) · work-phase 130

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표
omo의 코드 인텔리전스 컴포넌트를 codexclaw에 도입할지/어떻게 도입할지 조사한다.
codexclaw 완전 미계획 영역 — 도입 가치와 codex 네이티브 대체 가능성을 먼저 판단.

## 조사 대상 (omo 컴포넌트)
- lsp / lsp-daemon / lsp-tools-mcp — LSP 통합 (정의 점프, 진단, 심볼 검색).
- codegraph — 코드 그래프 분석.
- ast-grep 스킬 — 구조적 코드 검색/치환.

## J5 조사 산출물 (채울 항목)
### 결론

- **MVP 기본 포함 비권고**: `lsp`/`codegraph`는 MCP 서버, 별도 프로세스, 외부 언어 서버/바이너리 설치가 얽혀 있어 codexclaw MVP의 dev-skill/PABCD/subagent 핵심 경로보다 통합 리스크가 크다.
- **MVP 후보는 ast-grep 스킬만 선택적 포함**: ast-grep은 MCP가 아니라 스킬+Python helper+외부 `sg` 바이너리 구조라 이식 난도가 낮고, 구조적 검색/치환이라는 명확한 효용이 있다. 단, 바이너리 자동 설치/런타임 번들 정책을 먼저 정해야 한다.
- **권고 우선순위**: P2 `ast-grep` 스킬 포팅 → P3 `lsp` 선택 MCP/Hook → P4 `codegraph` 선택 MCP. MVP에는 문서화된 optional 조사 결과만 남기고 기본 manifest에는 넣지 않는다.

### 1. lsp / lsp-daemon / lsp-tools-mcp 실제 구조

- `omo` plugin manifest는 `mcpServers`를 `./.mcp.json`로 위임하고, root `.mcp.json`에서 `lsp` 서버를 `node ./components/lsp-daemon/dist/cli.js mcp`로 연결한다. `codegraph`도 같은 root `.mcp.json`에 optional MCP로 등록되어 있다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/.codex-plugin/plugin.json:45`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/.mcp.json:9`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/.mcp.json:25`
- `components/lsp` 자체는 Codex 전용 래퍼다. README가 `codex-lsp`는 post-tool-use hook/metadata/package wiring만 유지하고, `lsp-tools-mcp`가 MCP runtime/LSP manager/tool implementations를 소유한다고 설명한다. CLI도 `mcp` 명령을 `@code-yeongyu/lsp-daemon/dist/cli.js`로 spawn 위임한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/README.md:9`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/README.md:11`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/src/cli.ts:9`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/src/cli.ts:23`
- post-edit diagnostics hook은 `apply_patch`/Write/Edit/MultiEdit 계열 성공 후 파일을 추출해서 daemon diagnostics를 호출하고, 오류 diagnostics가 있으면 `decision: "block"`으로 Codex에 추가 컨텍스트를 주는 구조다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/hooks/hooks.json:3`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/src/codex-hook.ts:62`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/src/codex-hook.ts:72`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/src/codex-hook.ts:95`
- `lsp-daemon`은 독립 CLI이면서 daemon/proxy를 동시에 제공한다. `cli.js`는 `daemon`이면 socket server를 시작하고, `mcp`이면 stdio MCP proxy를 실행한다. proxy는 `tools/list` 같은 비-tool call은 in-process handler로 처리하지만, 실제 `tools/call`은 `callToolViaDaemon(...)`으로 daemon에 전달한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:3881`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:3887`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:3729`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:3746`
- daemon은 on-demand 자동 시작된다. `ensureDaemonRunning`은 socket probe → lock 획득 → detached `node cli.js daemon` spawn → reachable 대기 순서이고, daemon 경로는 `CODEX_LSP_DAEMON_DIR`, `PLUGIN_DATA/daemon`, 또는 `~/.codex/codex-lsp/daemon` 아래 버전별 디렉토리로 잡힌다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/ensure-daemon.js:17`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/ensure-daemon.js:67`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/paths.js:18`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/paths.js:29`
- 실제 제공 기능은 `lsp.status`, `lsp.diagnostics`, `lsp.goto_definition`, `lsp.find_references`, `lsp.symbols`, `lsp.prepare_rename`, `lsp.rename`이다. `lsp.rename`은 workspace edit를 파일에 적용하므로 단순 읽기 도구가 아니다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lsp/SKILL.md:10`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lsp/SKILL.md:18`
- 설치 요구사항은 Node >=20 외에 각 언어 서버 바이너리다. builtin server table은 TypeScript(`typescript-language-server --stdio`), Python(`basedpyright`/`pyright`/`ruff`), Rust(`rust-analyzer`), clangd 등 외부 실행 파일을 전제로 한다. `lsp-setup`도 detect → install → configure → verify workflow를 요구한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp/package.json:61`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:1686`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/lsp-daemon/dist/cli.js:1730`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/lsp-setup/SKILL.md:49`

### 2. codegraph 분석 방식

- `codegraph` 컴포넌트는 자체 분석 엔진이 아니라 `@colbymchenry/codegraph` optional dependency / 외부 `codegraph` binary를 감싸는 MCP wrapper다. package script는 Bun으로 `src/serve.ts`와 `src/cli.ts`를 dist로 빌드한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/package.json:16`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/package.json:27`
- MCP serve 경로는 config에서 disabled 여부를 보고, binary resolution 또는 auto provision을 시도한 뒤 `codegraph serve --mcp`를 child process로 실행한다. 바이너리가 없으면 빈 tools list를 제공하는 unavailable MCP server로 degrade한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/serve.ts:85`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/serve.ts:100`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/serve.ts:129`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/mcp-unavailable.ts:58`
- session-start hook은 detached worker를 띄우고, worker가 workspace를 준비한 뒤 `codegraph status --json` 결과에 따라 `codegraph init` 또는 `codegraph sync`를 실행한다. 즉 분석은 세션 시작 시 index/init/sync를 미리 수행하고 MCP query는 외부 codegraph server에 맡기는 모델이다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/hook.ts:50`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/hook.ts:61`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/session-start-worker.ts:80`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/components/codegraph/src/session-start-worker.ts:87`
- codexclaw 관점의 리스크: 외부 binary/provisioning, Node version support, workspace side-effect(`.gitignore`/workspace prepare), session-start background 작업, MCP server optional degrade까지 모두 가져와야 하므로 MVP 기본값으로는 과하다.

### 3. ast-grep 스킬 동작

- ast-grep은 MCP가 아니라 Codex skill이다. 스킬 설명은 25개 언어 AST-aware search/rewrite를 제공하고, 텍스트/regex/파일명 검색은 `rg`로 돌리라고 명시한다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md:1`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md:8`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md:27`
- 핵심 구현은 `scripts/ast_grep_helper.py` Python stdlib wrapper다. 기능은 binary auto-resolution, regex 오용/언어별 패턴 힌트 검증, JSON preview 후 `--update-all` 적용의 two-pass replace, 안정적 JSON normalization이다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:1`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:6`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md:50`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/SKILL.md:91`
- 외부 바이너리 의존은 명확하다. helper는 `OMO_AST_GREP_SG_PATH`, `CODEX_HOME/runtime/ast-grep/...`, `~/.omo/runtime/ast-grep/...`, skill-local `bin/`, PATH, Homebrew 순서로 `sg`/`ast-grep`를 찾고, 없으면 install hint와 함께 exit 3이다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:230`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:246`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/scripts/ast_grep_helper.py:262`
- 설치 스크립트는 Homebrew/npm/cargo/pip/Scoop/Winget 등 다양한 경로와 GitHub release fallback을 문서화한다. 따라서 codexclaw에 넣는다면 `skills/ast-grep` + helper + install scripts를 그대로 포팅하되, binary 자동 다운로드를 기본 활성화할지 여부는 별도 보안/UX 결정을 둔다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/references/install.md:3`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/references/install.md:14`, `/Users/jun/Developer/new/700_projects/codexclaw/devlog/.lazycodex/plugins/omo/skills/ast-grep/references/install.md:108`

### 4. codex 네이티브 대체 가능성

- Codex 기본 지침은 file/text 검색에 `rg` 또는 `rg --files`를 우선 사용하라고 안내한다. 즉 filename 탐색, literal/regex grep, 단순 callsite 후보 수집은 네이티브 shell 경로로 충분하다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/protocol/src/prompts/base_instructions/default.md:262`
- codex-rs 내부에서도 sandbox unreadable glob expansion에 `rg --files --hidden --no-ignore --glob ...`를 선호하고, `rg` 미설치 시 internal globset walker로 fallback한다. 이는 Codex 런타임이 파일 목록/grep 계열을 별도 MCP 없이도 shell+rg 중심으로 처리한다는 근거다. 근거: `/Users/jun/Developer/codex/121_openai-codex/codex-rs/linux-sandbox/README.md:62`, `/Users/jun/Developer/codex/121_openai-codex/codex-rs/linux-sandbox/src/bwrap.rs:815`
- 대체 가능: 파일명/확장자 탐색, 문자열 검색, regex 검색, import/callsite의 텍스트 후보 수집, 단순 변경 후 프로젝트 테스트/타입체크.
- ast-grep 필요 영역: regex로 안전하게 표현하기 어려운 AST shape 검색, 대량 deterministic codemod, YAML rule scan/apply.
- LSP 필요 영역: 타입/프로젝트 해석이 필요한 diagnostics, 정확한 definition/reference, workspace/document symbols, rename safety/workspace edit. 이 영역은 `rg`로 근사 가능하지만 정확도와 rename 안전성은 대체 불가다.
- codegraph 필요 영역: 사전 index 기반의 구조/관계 그래프 query가 필요한 대형 repo 탐색. 다만 MVP에서 codexclaw의 핵심 가치가 workflow/skills/subagents라면 기본 포함 가치가 LSP보다도 낮다.

### 5. codexclaw manifest 연결 방법

- codexclaw는 이미 plugin manifest에서 `mcpServers`를 `./.mcp.json`로 연결하고 있다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/.codex-plugin/plugin.json:25`
- 현재 codexclaw `.mcp.json`에는 `codexclaw` MCP 하나만 있고 `required: false`다. LSP/codegraph를 도입한다면 같은 파일의 `mcpServers`에 아래처럼 optional 서버를 추가하는 방식이 맞다. 근거: `/Users/jun/Developer/new/700_projects/codexclaw/plugins/codexclaw/.mcp.json:1`

```jsonc
{
  "mcpServers": {
    "codexclaw": {
      "command": "node",
      "args": ["./components/subagent-config/dist/mcp.js"],
      "cwd": ".",
      "required": false
    },
    "lsp": {
      "command": "node",
      "args": ["./components/lsp-daemon/dist/cli.js", "mcp"],
      "cwd": ".",
      "required": false
    },
    "codegraph": {
      "command": "node",
      "args": ["./components/codegraph/dist/serve.js"],
      "cwd": ".",
      "required": false
    }
  }
}
```

- 단, 위 manifest만으로는 충분하지 않다. `components/lsp-daemon/dist/*`, LSP core 번들/의존, `components/lsp` hook JSON, `skills/lsp`, `skills/lsp-setup`, 그리고 언어 서버 설치 문서까지 같이 패키징해야 실제 사용 가능하다. codegraph도 `dist/serve.js`, provisioning 유틸, optional binary/runtime 정책, session-start hook이 함께 필요하다.

### 6. MVP 포함 여부 권고

| 항목 | MVP 판단 | 이유 |
|---|---:|---|
| `ast-grep` skill | **선택 포함(P2)** | MCP/daemon 없이 skill 포팅 가능. 구조적 검색/치환은 `rg`와 차별화됨. 외부 `sg` 설치 UX만 정하면 됨. |
| `lsp` MCP + hook | **MVP 제외, P3 optional** | 가치가 높지만 daemon/socket/proxy/hook/언어 서버 설치/rename mutation까지 한 번에 들어옴. 기본 설치 실패면 첫인상이 나빠질 수 있음. |
| `codegraph` MCP | **MVP 제외, P4 optional** | 외부 codegraph binary/provisioning/session-start init-sync가 필요하고, MVP 핵심 기능과 직접 연결이 약함. |

권고 실행안:

1. MVP에는 이 조사 결과와 “native `rg` 우선, 구조 검색은 optional ast-grep, semantic IDE 기능은 future LSP” 원칙만 반영한다.
2. `ast-grep`은 별도 작업으로 `plugins/codexclaw/skills/ast-grep` 포팅 후보를 만든다. binary 자동 설치는 opt-in으로 둔다.
3. `lsp`는 `required: false` MCP + hook disabled-by-default 실험 브랜치에서 먼저 검증한다. 성공 기준은 TypeScript와 Python 각 1개 repo에서 `lsp.status`, `diagnostics`, `goto_definition`, `rename` roundtrip.
4. `codegraph`는 대형 repo 탐색 UX가 실제 병목이라는 근거가 생긴 뒤 도입한다.
