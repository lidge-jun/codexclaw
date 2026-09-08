# codexclaw subagent roles

These `.toml` files define codexclaw's subagent roles — the Codex equivalent of orchestrated
"employees". Each role pairs a native Codex `agent_type` with a developer prompt that routes
through the `dev-*` skills for its surface.

## Roles

| Role | agent_type | Writes | References (dev-* routers) |
|------|------------|--------|----------------------------|
| `explorer` | `explorer` | no | dev-architecture, dev-debugging, dev-backend/frontend |
| `reviewer` | `explorer` | no | dev-code-reviewer, dev-security, dev-architecture, dev-testing |
| `executor` | `executor` (registered) | yes (scoped) | dev (classifier) + surface router (frontend/backend/testing/scaffolding) |

Built-in `agent_type` values are codex-native (`core/src/agent/role.rs`: `default`, `explorer`,
`worker`). `explorer` is read-only; `worker` may write.

## Optional native executor registration

Plugin directories are not Codex configuration layers, so installing the plugin alone
cannot register these TOML files as live roles. Unregistered installs automatically dispatch executor tasks as built-in `worker`. With the CLI installed, run:

```sh
cxc subagents register executor
```

This creates `$CODEX_HOME/agents/executor.toml` (default `~/.codex/agents/executor.toml`)
from the shipped executor prompt, omitting the plugin's `model = "default"` sentinel.
The installed role does not override model, effort, sandbox or approval policy.
Registration marks the prompt with a content hash. Repeating this command updates an
unchanged managed prompt; user edits, differing unmarked files and symlinks are preserved
and reported as conflicts. Updates retain the previous bytes beside the role as
`executor.toml.backup-<sha256>`. An abandoned `.executor-update.lock` directory
blocks updates; inspect it and confirm no registrar is running before manual removal.
Existing worker files and project model settings are preserved.

For marketplace-only installs without `cxc` on PATH, ask in Codex chat:

> Register the CXC executor role using the installed plugin’s `subagents register executor` command.

Start a new Codex session after registration and verify the live spawn schema exposes
`executor`. File presence cannot prove that an already-running session loaded the role.
Registration never runs from a spawn hook. Missing registrations use `worker`; both
names select `roles.executor` and require exit evidence. The shipped prompt remains
inline so the legacy path retains the same instructions.

After upgrading the SubagentStop matcher, re-approve Modified hooks using Codex's normal
hook approval UI and check `cxc doctor`. A passing unit test does not prove hook delivery.

Fresh V2 call example (use only fields the live tool exposes):

```js
spawn_agent({ agent_type: "executor", task_name: "executor_change", fork_turns: "none",
              message: "TASK: <executor instructions + scoped task>" })
```

The native role supplies the base developer instructions. Inline task instructions remain
for project prompt overrides and legacy worker calls. A `promptOverride` replaces the
inline template, not the registered native developer instructions; native permissions
and higher-priority instructions still apply.

## Model / prompt override status

The shipped TOML `model = "default"` is a plugin sentinel, not a native model name. The `.codexclaw/subagents.json`
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
