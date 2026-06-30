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
spawn_agent({ agent_type: "explorer", message: "TASK: <role instructions + the concrete task>" })
spawn_agent({ agent_type: "worker",   message: "TASK: <executor instructions + scoped task>" })
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
tests prove persistence and resolver behavior.

Runtime caveat: there is not yet a production spawn wrapper that consumes
`resolveSpawnConfig()` when calling Codex `spawn_agent`. Until L9's implementation slices
land, these TOMLs remain canonical prompt sources and the config store is ready for a wrapper,
but a configured role model is not automatically applied to every live subagent launch.
