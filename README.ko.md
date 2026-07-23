[English](README.md) | **한국어** | [中文](README.zh.md)

<p align="center">
  <img src="docs-site/public/logo.png" alt="codexclaw" width="140" />
</p>

<h1 align="center">codexclaw</h1>

<p align="center">
  <strong>OpenAI Codex</strong>에 개발 원칙과 멀티 모델 서브에이전트를 더하는<br>
  올인원 플러그인
</p>

<p align="center">
  <a href="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml"><img src="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-1%2C201_passing-brightgreen" alt="1,201 tests passing">
  <img src="https://img.shields.io/badge/skills-27-blue" alt="27 skills">
  <img src="https://img.shields.io/badge/hooks-18-blue" alt="18 hooks">
  <a href="https://lidge-jun.github.io/codexclaw/"><img src="https://img.shields.io/badge/docs-codexclaw-black" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT"></a>
</p>

---

codexclaw는 Codex 런타임을 체계적인 개발 환경으로 바꾼다. 별도의 에이전트 하네스를 제공하지 않고 스킬, 훅, 컴포넌트를 `codex`에 직접 얹는다. 기본 런타임에 없는 구조화된 워크플로, 코딩 원칙, 멀티 모델 오케스트레이션을 이 방식으로 추가한다.

## 주요 기능

**Dev Skill Family** — 표준 부모 스킬(`dev`)이 관리하는 12개 작업 영역별 라우터(`dev-architecture`, `dev-backend`, `dev-frontend`, `dev-testing`, `dev-security`, `dev-debugging`, `dev-data`, `dev-devops`, `dev-code-reviewer`, `dev-scaffolding`, `dev-diagram-viewer`, `dev-uiux-design`)로 구성된다. 모든 라우터는 부모 스킬의 규칙 등급, 검증 게이트, 안전 규칙을 물려받는다. 고유 규칙 ID는 155개다.

**PABCD Workflow** — Plan / Audit / Build / Check / Done을 증명 기반 전환 게이트가 있는 파일 기반 FSM으로 구현했다. `cxc orchestrate` 명령으로 단계를 진행하며, 각 전환에는 구조화된 근거가 붙는다. 영속적인 goalplan 원장이 여러 사이클에 걸쳐 작업 단계, 성공 기준, 수집한 증거를 추적한다.

```
IDLE ── P ── A ── B ── C ── D ── IDLE
       │    │    │
      gate  gate gate
       └────┴────┴──── I (Interview, context preserved)
```

**Multi-Model Subagents** — 역할 기반 디스패치(explorer / reviewer / executor)를 제공하며 역할마다 모델과 프롬프트를 따로 지정할 수 있다. 설정은 세션이 끝나도 유지되며 spawn-wrapper 훅이 자동으로 적용한다. 로컬 GUI(Vite + React)에서 설정을 시각적으로 관리할 수 있고, opencodex를 감지하면 프로바이더 링크 바도 표시한다. (대시보드는 지금은 리포 체크아웃에서 빌드해 쓰고, 후속 릴리스에 번들한다.)

**Recall** — 사용자에게 다시 묻기 전에 디스크 아티팩트에서 과거 Codex 대화와 메모리 저장소를 검색한다. 세션이 바뀌거나 컨텍스트가 압축돼도 이전 맥락을 이어 간다.

**Repo Map** — `cxc map <dir>`는 tree-sitter 파싱과 PageRank 순위 계산으로 낯선 코드베이스의 구조 개요를 만든다. 에이전트가 `rg`로 깊이 파고들기 전에 전체 구조를 파악할 수 있다.

**Skill Search** — `cxc skill search <query>`는 cli-jaw-skills(기본), ClawHub, Hermes 카탈로그에서 비활성 스킬을 찾는다. `cxc skill show <id>`로 필요한 스킬을 불러온다.

## 설치

두 줄이면 설치 끝. 빌드도, npm install도, 설정 파일 수정도 없다.

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

설치 후 Codex를 재시작하고 뜨는 승인 창에서 18개 훅을 승인하면 된다(업그레이드 후에도 다시 승인 — 콘텐츠 해시 신뢰 모델). CLI 없이 채팅에서 바로 쓸 수 있다:

- `orchestrate status` — PABCD 상태 머신 확인
- "Interview me first, then draft a diff-level plan."
- "Plan this with codexclaw PABCD and use multi-model subagents."

<details>
<summary><b>업데이트 / 제거 / 선택적 CLI</b></summary>

```bash
codex plugin marketplace upgrade codexclaw   # 업데이트
codex plugin remove codexclaw@codexclaw      # 제거
```

업그레이드 후에는 Codex가 훅을 **Modified**로 표시한다. 다시 승인해야 활성화된다.

`cxc` CLI는 리포 체크아웃에 들어 있다(마켓플레이스 설치는 이 없이 스킬·훅·MCP를 활성화한다):

```bash
git clone https://github.com/lidge-jun/codexclaw
alias cxc='node /path/to/codexclaw/bin/codexclaw.mjs'   # 또는: npm link
```

</details>

## 아키텍처

```
plugins/codexclaw/
│
├── skills/                      27 skills
│   ├── dev/                     canonical parent — work classifier, routing, verification gate
│   ├── dev-*/                   12 surface routers (architecture → uiux-design)
│   ├── pabcd/                   PABCD workflow phases + attestation
│   ├── loop/                    durable goalplan + Stop-continuation contract
│   ├── interview/               IPABCD requirements discovery
│   ├── search/                  web search + evidence routing ladder
│   ├── recall/                  past-session + memory store search
│   └── repo-map/                tree-sitter + PageRank structure map
│
├── hooks/                       18 active hooks across the session lifecycle
│   ├── session-start-*          provider bridge, PABCD bootstrap, map affordance, recall context
│   ├── user-prompt-submit-*     PABCD trigger detection, recall intent
│   ├── pre-tool-use-*           skill attach, goal guards, patch lint, interview guard
│   ├── post-tool-use-*          interview capture, render observation
│   ├── stop-*                   PABCD continuation under active goals
│   ├── subagent-stop-*          evidence verification for worker dispatches
│   └── post-compact-*           cursor reinject, recall context, bg-terminal affordance
│
├── components/                  8 isolated feature modules (src + dist)
│   ├── pabcd-state/             FSM engine, session files, orchestrate CLI, attest gates
│   ├── subagent-config/         per-role model/prompt store + MCP surface
│   ├── recall/                  disk-artifact search across sessions + memory
│   ├── skill-search/            remote catalog query (jaw / clawhub / hermes)
│   ├── provider-bridge/         read-only opencodex detection
│   ├── messenger-bridge/        Telegram/Discord adapter (cxc serve)
│   ├── config-guard/            plugin enable/disable/status
│   └── cxc-ops/                 doctor + reset utilities
│
└── gui/                         local dashboard (Vite + React, build from source)
```

_`cxc` CLI(`bin/codexclaw.mjs` + `cli/` 워크스페이스)는 플러그인 페이로드 바깥, 리포 루트에 있다._

## Dev Skill Family

모든 코딩 작업은 작업 절차의 깊이를 정하기 전에 C0-C5 등급으로 분류한다. 부모 `dev` 스킬은 변경 영역에 맞는 라우터로 작업을 연결한다.

| Surface | Router | Also loads |
|---------|--------|------------|
| Backend / API | `dev-backend` | `dev-security` for auth |
| Frontend / UI | `dev-frontend` | `dev-uiux-design` for direction |
| Database / data | `dev-data` | `dev-backend` for migrations |
| Tests / QA | `dev-testing` | `dev-frontend` for browser QA |
| Security | `dev-security` | surface-specific router |
| Architecture | `dev-architecture` | `dev-scaffolding` for structure |
| Debugging | `dev-debugging` | surface-specific router |
| DevOps / infra | `dev-devops` | `dev-security` for credentials |
| Scaffolding | `dev-scaffolding` | `dev-architecture` for boundaries |
| Code review | `dev-code-reviewer` | `dev-security` + `dev-testing` |
| Diagrams | `dev-diagram-viewer` | — |

각 라우터는 필요할 때만 불러오는 자체 모듈형 참고 자료를 갖추고 있으며, 부모 스킬의 검증 게이트, 규칙 등급, 안전 규칙을 물려받는다.

## CLI

```bash
cxc orchestrate P|A|B|C|D|status|reset   # PABCD phase control
cxc loop init|show|validate               # durable goalplan management
cxc map <dir>                             # tree-sitter structure map
cxc skill search <query>                  # remote skill discovery
cxc skill show <id>                       # load a discovered skill
cxc help                                  # command reference
```

## 생태계

codexclaw는 참조 구현이다. 방법론과 스킬은 에이전트에 종속되지 않고 플러그인 의존성도 없는 형태로 다음 프로젝트에 이식됐다.

| Repo | Role |
|------|------|
| [pabcd_initiative](https://github.com/lidge-jun/pabcd_initiative) | Methodology spec + docs-site + agent-neutral skill set |
| [cli-jaw](https://github.com/lidge-jun/cli-jaw) | Boss/employee agent harness with skills_ref submodule |
| [ima2-gen](https://github.com/lidge-jun/ima2-gen) | Image generation tool with ima2-front/ima2-uiux skills |

## 문서

플러그인 문서: **[lidge-jun.github.io/codexclaw](https://lidge-jun.github.io/codexclaw/)**

방법론과 연구 출처는 **[lidge-jun.github.io/pabcd_initiative](https://lidge-jun.github.io/pabcd_initiative/)**에서 다룬다 — 스킬 아키텍처, 위임 비용, 루프 계약, devlog 기록, arXiv 근거가 있는 주장 원장.

## 라이선스

[MIT](LICENSE)

서드파티: RepoMapper(MIT, Pete Davis), Aider tree-sitter 쿼리(Apache-2.0). 자세한 내용은 [`NOTICE.md`](plugins/codexclaw/skills/repo-map/scripts/NOTICE.md)를 참고한다.
