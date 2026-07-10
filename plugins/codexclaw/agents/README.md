# codexclaw subagent roles

These `.toml` files define codexclaw's subagent roles — the Codex equivalent of orchestrated
"employees". Each role pairs a built-in Codex `agent_type` with a developer prompt that routes
through the `dev-*` skills for its surface.

## Roles

| Role | agent_type | Writes | References (dev-* routers) |
|------|------------|--------|----------------------------|
| `explorer` | `explorer` | no | dev-architecture, dev-debugging, dev-backend/frontend |
| `reviewer` | `explorer` | no | dev-code-reviewer, dev-security, dev-architecture, dev-testing |
| `executor` | `worker` | yes (scoped) | dev (classifier) + surface router (frontend/backend/testing/scaffolding) |

Built-in `agent_type` values are codex-native (`core/src/agent/role.rs`: `default`, `explorer`,
`worker`). `explorer` is read-only; `worker` may write.

## Phase 1 = B-opt2 (inline injection)

Codex plugin manifests expose only `skills`, `hooks`, `mcpServers`, and `apps` — there is **no
`agents` field** (`core-plugins/src/manifest.rs`). Agent roles are discovered only per config
layer at `<config_folder>/agents/*.toml` (`core/src/config/agent_roles.rs`), and a plugin's
install directory is never registered as a config layer. So these files are **not
auto-registered** as live roles.

Instead, the main agent injects each role's `developer_instructions` **inline** when spawning:

```
spawn_agent({ agent_type: "explorer", task_name: "explorer_<slug>", fork_turns: "none",
              message: "TASK: <role instructions + the concrete task>" })
spawn_agent({ agent_type: "worker",   task_name: "executor_<slug>", fork_turns: "none",
              message: "TASK: <executor instructions + scoped task>" })
// V2 shape: task_name is required ([a-z0-9_]+); fork_turns "none" keeps
// agent_type/model/effort overrides legal (a full-history fork rejects them).
```

This is omo's proven pattern. The `.toml` files are the canonical SOURCE of those prompts and
stay B-opt1-ready: if a future codex build supports plugin- or config-layer role registration,
the same files can be copied into a config-layer `agents/` dir with no rewrite.

Note: these files intentionally carry no `read_only` key — that is not a valid agent-role-file
field (`ConfigToml` uses `deny_unknown_fields`). Read-only intent is encoded in the
`agent_type` mapping and the developer_instructions.

## Model / prompt override status

`model = "default"` means inherit the parent model. The `.codexclaw/subagents.json`
store, MCP/GUI roundtrip, and `resolveSpawnConfig(cwd, role)` resolver are shipped; S8/S10
tests prove persistence and resolver behavior. The store also carries a per-role `effort`
override (codex wire values low/medium/high/xhigh; null = inherit).

On both V1 and V2, the spawn hook independently injects configured role `model` and
`reasoning_effort` values when the caller omits them and the spawn is not a full-history
fork. Otherwise each omitted field inherits from the parent. Full-history means V1
`fork_context:true` or V2 `fork_turns` omitted/`"all"`.

Production wrapper (L9.1, shipped): `components/subagent-config/src/spawn-wrapper.ts` consumes
`resolveSpawnConfig()` at spawn time. `resolveSpawnPayload(cwd, role, task, agentsDir)` reads the
per-role store config plus this file's `developer_instructions`, then builds the concrete
`spawn_agent` payload (v2): `agent_type` from `ROLE_AGENT_TYPE`, `task_name` from `taskNameForRole`, `fork_turns:"none"`, the role prompt injected inline in
`message` (a `promptOverride` replaces this TOML body). The hook adds omitted configured
model/effort fields under the non-full-fork rule above. Model selection is owned by the
store resolver, not the TOML `model` sentinel.
