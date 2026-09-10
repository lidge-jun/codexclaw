# codexclaw subagent roles

These `.toml` files define codexclaw's subagent roles — the Codex equivalent of orchestrated
"employees". Each role pairs a native Codex `agent_type` with a developer prompt that routes
through the `dev-*` skills for its surface.

## Roles

| Role | agent_type | Writes | References (dev-* routers) |
|------|------------|--------|----------------------------|
| `explorer` | `explorer` | no | dev-architecture, dev-debugging, dev-backend/frontend |
| `reviewer` | `explorer` | no | dev-code-reviewer, dev-security, dev-architecture, dev-testing |
| `architect` | `architect` | no | dev + dev-architecture; proposal and plan reflection |
| `executor` | `executor` when registered, else `worker` | yes (scoped) | dev (classifier) + surface router (frontend/backend/testing/scaffolding) |

Built-in `agent_type` values are codex-native (`core/src/agent/role.rs`: `default`, `explorer`,
`worker`). `explorer` is read-only; `worker` may write. Follow the live schema when
registered roles are exposed. Architect requires its own registered native role;
there is no explorer/reviewer fallback for architect.

When the host exposes a native `reviewer`, use it. On legacy explorer-only
read-only transport, prepend `CXC-ROLE: reviewer` before `TASK:` to select reviewer
settings. An explicit explorer without that header keeps explorer settings even
when its task mentions review or verification. Task vocabulary is not a role choice.

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
spawn_agent({ agent_type: "explorer", task_name: "explorer_<slug>", fork_turns: "none",
              message: "TASK: <role instructions + the concrete task>" })
spawn_agent({ agent_type: "architect", task_name: "architect_<slug>", fork_turns: "none",
              message: "CXC-ROLE: architect\n\n$codexclaw:cxc-dev $codexclaw:cxc-dev-architecture\n\nTASK: <role instructions + design or reflection packet>" })
spawn_agent({ agent_type: "worker",   task_name: "executor_<slug>", fork_turns: "none",
              message: "TASK: <executor instructions + scoped task>" })
```

This is omo's proven pattern. The `.toml` files are the canonical SOURCE of those prompts and
stay B-opt1-ready: if a future codex build supports plugin- or config-layer role registration,
the same files can be copied into a config-layer `agents/` dir with no rewrite.

Note: these files intentionally carry no `read_only` key — that is not a valid agent-role-file
field (`ConfigToml` uses `deny_unknown_fields`). Architect uses the supported `sandbox_mode = "read-only"` key in its registered
file. Other prompt sources retain their existing mapping and instructions.
The registered executor role supplies its base developer instructions; inline task
instructions remain for project prompt overrides and legacy worker calls. A `promptOverride`
replaces the inline template, not the registered native developer instructions.

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

Architect inherits the same per-role settings rules; no provider model is hardcoded.
Its prompt source does not install a native role. Formal P consultation, same-plan
context reuse, changed-decision rechecks and failure handling are owned by
[phase-plan](../skills/pabcd/references/phase-plan.md),
[phase-audit](../skills/pabcd/references/phase-audit.md) and
[delegation](../skills/pabcd/references/delegation.md#architect-context-and-routing).

## Explicit native role registration

Run `cxc subagents register architect` only when installation is authorized. It
publishes the canonical role to `$CODEX_HOME/agents/architect.toml` (default
`~/.codex/agents/architect.toml`), removes the `model = "default"` sentinel, and
retains read-only sandbox settings. Models and effort stay owned by architect's
CXC settings and existing explicit caller overrides; registration pins neither.
The shared command also supports `register executor` for compatibility.

Registration preserves custom/conflicting files and symlinks, updates only intact
managed or identical legacy content, and backs up the previous bytes. An abandoned
update lock fails closed for inspection. Start a fresh Codex session and verify
`architect` appears in the live spawn schema before calling it. A file on disk is
not proof of role discovery. Unsupported/missing roles must be reported; never
substitute explorer or reviewer. Builders and hooks never register roles themselves.
