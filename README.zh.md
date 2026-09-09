[English](README.md) | [한국어](README.ko.md) | **中文**

<p align="center">
  <img src="docs-site/public/logo.png" alt="codexclaw" width="140" />
</p>

<h1 align="center">codexclaw</h1>

<p align="center">
  面向 <strong>OpenAI Codex</strong> 的开发规范与多模型子代理，<br>
  以单个插件的形式提供。
</p>

<p align="center">
  <a href="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml"><img src="https://github.com/lidge-jun/codexclaw/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-2%2C826_passing-brightgreen" alt="2,826 tests passing">
  <img src="https://img.shields.io/badge/skills-29-blue" alt="29 skills">
  <img src="https://img.shields.io/badge/hooks-24-blue" alt="24 hooks">
  <a href="https://lidge-jun.github.io/codexclaw/"><img src="https://img.shields.io/badge/docs-codexclaw-black" alt="Documentation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT"></a>
</p>

工作流设计参考了 [OMO / oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)。部分组件改编自历史上以 MIT 许可发布的 LazyCodex/OMO；[版权、原始提交及修改记录](NOTICE.md)已保留。CodexClaw 是独立项目，并非 OMO 官方发行版。

---

codexclaw 将 Codex 运行时转变为规范化的开发环境。它不提供独立的代理框架，而是直接在 `codex` 上叠加 skills、hooks 和 components，为基础运行时补充结构化工作流、编码规范和多模型编排能力。

## 功能

**Dev Skill Family** — 由规范父级 `dev` 统一管理的 12 个特定领域路由器（`dev-architecture`、`dev-backend`、`dev-frontend`、`dev-testing`、`dev-security`、`dev-debugging`、`dev-data`、`dev-devops`、`dev-code-reviewer`、`dev-scaffolding`、`dev-visualizer`、`dev-uiux-design`）。所有路由器都继承父级的规则分类、验证门和安全规则。共包含 155 个唯一规则 ID。

**PABCD Workflow** — Plan / Audit / Build / Check / Done，基于文件驱动的 FSM 实现，并通过证明材料控制阶段转换。各阶段通过 `cxc orchestrate` 命令推进，每次转换都携带结构化证据。持久化 goalplan 账本可跨多个周期跟踪工作阶段、成功标准和已收集的证据。

```
IDLE ── P ── A ── B ── C ── D ── IDLE
       │    │    │
      gate  gate gate
       └────┴────┴──── I (Interview, context preserved)
```

**Multi-Model Subagents** — 基于角色的调度机制（explorer / reviewer / executor / architect），支持按角色覆盖模型和提示词。配置会跨会话持久保存，并通过 spawn-wrapper hook 自动应用。本地 GUI（Vite + React）提供可视化配置；检测到 opencodex 时，还会显示 provider 快捷链接栏。（仪表盘目前需从仓库检出构建，后续版本将随插件打包。）

Architect 在每个正式 P 阶段提出设计，并检查主代理的执行计划是否与设计一致。主代理负责执行计划和最终决策，独立 reviewer 负责 A 审核。同一计划复用上下文，仅在已记录的设计决策发生变化时重新检查。这是代理遵循的指导，不是运行时强制检查。参见[规划流程](plugins/codexclaw/skills/pabcd/references/phase-plan.md)。

Architect 使用独立的 `agent_type: "architect"`。首次使用前，显式运行 `cxc subagents register architect`，启动新的 Codex 会话，并确认生成工具的角色列表中出现 architect。它使用 architect 专属配置，不回退到 explorer/reviewer。角色注册与插件安装分开，调度不会自动执行注册。

**Recall** — 在向用户提问前，先从磁盘产物中搜索历史 Codex 对话和 memory store，使上下文在跨会话及压缩后仍可恢复。

**Repo Map** — `cxc map <dir>` 结合 tree-sitter 解析与 PageRank 排名，为陌生代码库生成结构概览，帮助代理在深入使用 `rg` 前快速建立整体认知。（仅限仓库检出——需要内置的 Python 工具链。）

**Skill Search** — `cxc skill search <query>` 可从 cli-jaw-skills（主要来源）、ClawHub 和 Hermes 目录中发现未加载的 skills。使用 `cxc skill show <id>` 可按需加载。

## 安装

两行命令即可完成安装。无需构建、无需 npm install、无需修改配置文件。

```bash
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
codex plugin add codexclaw@codexclaw
```

然后重启 Codex，并在弹出的审批中批准 24 个 hooks（升级后需再次批准——内容哈希信任模型）。既可以直接在聊天中使用，终端界面也随包提供——payload 自带 `cxc` 调度器，代理的 `cxc orchestrate` 命令在任何安装方式下都能运行：

- `orchestrate status` — 查看 PABCD 状态机
- "Interview me first, then draft a diff-level plan."
- "Plan this with codexclaw PABCD and use multi-model subagents."

<details>
<summary><b>更新 / 卸载 / 可选 CLI</b></summary>

```bash
codex plugin marketplace upgrade codexclaw   # 更新
codex plugin remove codexclaw@codexclaw      # 卸载
```

升级后 Codex 会将 hooks 标记为 **Modified**，需要重新批准才能激活。
升级到 0.1.1 及以上版本会同时提供 payload CLI（`bin/cxc.mjs`）；已有安装需升级（或重新添加）才能获得新的顶层目录。

CLI 分两层。每个安装都自带 payload 调度器，无需配置 PATH；当 `cxc` 不在 PATH 上时，会话启动横幅会给出准确的调用命令：

```bash
node "<plugin-root>/bin/cxc.mjs" orchestrate status --session <id>
```

PATH 级 `cxc` 是仓库检出下的可选便利方式（`cxc map` 和 `cxc gui` 也需要它）：

```bash
git clone https://github.com/lidge-jun/codexclaw
alias cxc='node /path/to/codexclaw/bin/codexclaw.mjs'   # 或者：npm link
```

</details>

## 开发安装（dogfooding）

若要一边在 Codex 中运行 codexclaw 一边修改它，请把当前检出以**真实副本**的方式，从以仓库自身为根的
本地 marketplace 安装：

```bash
scripts/dev-install.sh
```

这就是全部配置。脚本会自行把 `codexclaw` marketplace 指向你的检出，即使已发布的 git marketplace
已占用同一名称也是如此——手动添加会失败并提示
`marketplace 'codexclaw' is already added from a different source`。

git 源的 marketplace 会锁定某个提交，因此正在开发中的检出必须使用本地源；否则无论你改动什么，
Codex 都只会加载那个被锁定的快照。

### 为什么不用 symlink

早期的 `scripts/dev-symlink.sh` 会把插件缓存版本目录下的每个子项替换为指向仓库的 symlink，这样无需
重装即可让改动生效。但 Codex 无法可靠地解析这些 symlink 条目，插件可能悄无声息地加载失败，因此该
方式已废弃。当 `dev-install.sh` 在插件缓存中发现任何 symlink 时，会清空整个缓存目录并重新安装。

### 安装实际做了什么

`codex plugin add codexclaw@codexclaw` 会把 payload 复制到
`~/.codex/plugins/cache/codexclaw/codexclaw/<version>/`，并**删除源中已不存在的文件**。因此以相同
版本重新安装是一次真正的重新同步，而不是空操作；这也是为什么重跑脚本就是完整的更新循环，无需提升
manifest 版本号。

| 命令 | 作用 |
|---|---|
| `scripts/dev-install.sh` | 构建组件、必要时重新指向 marketplace、清除残留 symlink、重新安装、清理旧版本目录、运行 doctor |
| `scripts/dev-install.sh --no-build` | 同上但跳过 `npm run build`，适用于仅修改 skills、hooks 或文档 |
| `scripts/dev-install.sh --status` | 报告源、manifest 版本、marketplace 根、缓存根与 symlink 数量，不做任何改动 |

### 更新循环

修改 -> `scripts/dev-install.sh` -> **打开新的 Codex 线程**。skills、hooks 与 MCP 工具在会话启动时读取，
因此当前线程不会拾取这些改动。

hook 信任的哈希覆盖的是 hook **声明**——事件、matcher、command、timeout、async 与状态消息——而不是
hook 所运行的文件。因此修改 `hooks/*.json` 中的 matcher 或 command 会破坏信任，Codex 将其标记为
**Modified**，在你重新批准之前该 hook 不会运行；而重新构建 hook 所调用的组件 `dist/` 即便改动大量
字节，信任依然保持。`cxc doctor` 的 `hook-trust` 一行会告诉你属于哪种情况。codexclaw 从不自行
写入信任状态。

### 验证安装

```bash
VER=$(python3 -c "import json;print(json.load(open('plugins/codexclaw/.codex-plugin/plugin.json'))['version'])")
CACHE=~/.codex/plugins/cache/codexclaw/codexclaw

diff -rq plugins/codexclaw "$CACHE/$VER"   # 安装的 payload 与检出一致
find "$CACHE" -type l | wc -l              # 预期为 0 —— 没有 symlink 残留
node "$CACHE/$VER/bin/cxc.mjs" doctor       # 预期：overall: PASS
                                            # 仅 hook-trust 为 FAIL 表示 hooks 待重新批准
```

若要回到发布轨道，移除本地 marketplace 并重新添加 git URL：

```bash
codex plugin remove codexclaw@codexclaw
codex plugin marketplace remove codexclaw
codex plugin marketplace add https://github.com/lidge-jun/codexclaw
```

## 架构

```
plugins/codexclaw/
│
├── bin/cxc.mjs                  payload CLI dispatcher (ships with every install)
│
├── skills/                      28 skills
│   ├── dev/                     canonical parent — work classifier, routing, verification gate
│   ├── dev-*/                   12 surface routers (architecture → uiux-design)
│   ├── pabcd/                   PABCD workflow phases + attestation
│   ├── loop/                    durable goalplan + Stop-continuation contract
│   ├── interview/               IPABCD requirements discovery
│   ├── search/                  web search + evidence routing ladder
│   ├── recall/                  past-session + memory store search
│   └── repo-map/                tree-sitter + PageRank structure map
│
├── hooks/                       24 active hooks across the session lifecycle
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

_PATH 级 `cxc` 入口（`bin/codexclaw.mjs` + `cli/` 工作区）位于仓库根目录；payload 内的 `bin/cxc.mjs` 调度器在 marketplace 安装中承担同样的命令（`map`/`gui` 除外）。_

## Dev Skill Family

每个编码任务都会先划分为 C0-C5，再确定流程深度。父级 `dev` skill 会根据变更领域，将任务路由到对应的特定领域路由器：

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
| Diagrams | `dev-visualizer` | — |

每个路由器都有独立的模块化参考资料，仅在需要时加载，不会预加载；同时继承父级的验证门、规则分类和安全规则。

## CLI

```bash
cxc orchestrate P|A|B|C|D|status|reset   # PABCD phase control
cxc loop init|show|validate               # durable goalplan management
cxc scan record --session <id>            # record an interview contradiction-scan round
cxc map <dir>                             # tree-sitter structure map (repo checkout only)
cxc skill search <query>                  # remote skill discovery
cxc skill show <id>                       # load a discovered skill
cxc help                                  # command reference
```

在没有 PATH 级 `cxc` 的 marketplace 安装中，同样的命令通过 `node "<plugin-root>/bin/cxc.mjs" <verb>` 运行——会话启动横幅会给出准确路径。

## 生态系统

codexclaw 是参考实现。其方法论和 skills 已移植到以下项目中；这些版本与代理无关，也不依赖插件：

| Repo | Role |
|------|------|
| [pabcd_initiative](https://github.com/lidge-jun/pabcd_initiative) | Methodology spec + docs-site + agent-neutral skill set |
| [cli-jaw](https://github.com/lidge-jun/cli-jaw) | Boss/employee agent harness with skills_ref submodule |
| [ima2-gen](https://github.com/lidge-jun/ima2-gen) | Image generation tool with ima2-front/ima2-uiux skills |

## 文档

插件文档：**[lidge-jun.github.io/codexclaw](https://lidge-jun.github.io/codexclaw/)**

开发安装与 dogfooding 循环：**[Dogfood & Dev Install](https://lidge-jun.github.io/codexclaw/development/dogfood-dev-install/)**

方法论与研究来源见 **[lidge-jun.github.io/pabcd_initiative](https://lidge-jun.github.io/pabcd_initiative/)**，涵盖 skill 架构、委派经济性、循环契约、devlog 记录，以及由 arXiv 论文支持的主张账本。

## 贡献

Pull request 请提交到 `dev` 集成分支；`main` 仅通过维护者提升更新，并承载正式发布。

## 许可证

[MIT](LICENSE)。版权、上游来源及第三方代码范围见 [NOTICE.md](NOTICE.md)。

第三方组件：RepoMapper（MIT，Pete Davis）和 Aider tree-sitter queries（Apache-2.0）。详见 [`NOTICE.md`](plugins/codexclaw/skills/repo-map/scripts/NOTICE.md)。
