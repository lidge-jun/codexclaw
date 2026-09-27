# wp3 — Agent-created thread permission hook and advisory

Codex Desktop can start a `create_thread` child with approval prompts even when the user's top-level Codex configuration says `never` and `danger-full-access`. This phase offers a user-global, default-off PermissionRequest auto-allow for that exact provenance and a separate SessionStart warning that works without the opt-in. It does not change the child's sandbox. With the opt-in it answers pending approvals the way the user's full-access config would, and that includes one-time network-access approvals, which Codex sends to hooks as `Bash` with a `network-access <target>` description (`codex-rs/core/src/tools/approvals.rs:217-224`); an allow there lets that one request through (`network_approval.rs:893-905`). The symptom also occurs for projectless children, so no worktree predicate belongs in the eligibility test.

## Phase contract

- Class: C4, permission boundary. Binding decisions: AD-1 through AD-5 and AD-7 in `devlog/_plan/260927_issue_train/002_architect_consultation.md:9-15`.
- Dependency: wp2's PABCD switch. The advisory is read-only and must not create `<cwd>/.codexclaw` itself; the separate existing SessionStart bootstrapping hook still creates state and 011's `.gitignore` when PABCD policy is enabled. The module itself only reads files and returns JSON and does not call `handleSessionStart`; the shared CLI path still records a hook observation under `CODEX_HOME` (plugins/codexclaw/scripts/hook-observation.mjs:17,70), never under the cwd. Both verbs stay active when `CODEXCLAW_PABCD=off` or `pabcd.enabled=false`, because they are not PABCD policy; 012's switch must not list them.
- Success: with the explicit global opt-in, an agent-created root thread whose hook says `permission_mode: "default"` and whose user Codex config shows explicit top-level evidence `approval_policy = "never"` and `sandbox_mode = "danger-full-access"` (no profile) emits the exact allow object for Bash (including one-time network-access approvals), write_stdin, apply_patch, and tool names that follow the `mcp__<server>__<tool>` naming convention. This is config evidence of user intent, not proof of the thread's effective permission; an exact guarantee needs Codex to expose the resolved policy and sandbox in PermissionRequest input. Every missing, mismatched, corrupt or unknown input emits zero stdout bytes and exits 0. The advisory is independent of opt-in.
- Runtime proof boundary: hook input has `session_id`, `transcript_path`, `permission_mode`, `tool_name`, and optional `agent_id`/`agent_type` at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:298-318`; SessionStart input has the first three at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:496-510`. `SessionMeta` stores `id` and `thread_source` at `/tmp/cxc-perm/codex-src/codex-rs/protocol/src/protocol.rs:3128-3154`, and `ThreadSource::Feature` serializes its feature string at `/tmp/cxc-perm/codex-src/codex-rs/protocol/src/protocol.rs:2841-2857`. The specific `agent_created_thread` value is the observed rollout fixture from this issue train, not a universal enum variant.

## File change map

All paths below are repository-relative. Anchors were rechecked at `codex/issue-train-0927` / `958441a9` on 2026-09-27. Add no package dependency.

### 1. NEW `plugins/codexclaw/components/pabcd-state/src/agent-thread-permissions.ts`

The module owns both event handlers and all eligibility reads. `CODEXCLAW_HOME` uses the existing user-global default at `plugins/codexclaw/components/subagent-config/src/store.ts:128-133`; unlike `subagents.json`, the new opt-in lives in `config.json`. This permission reader rejects relative home overrides so a cwd-local path cannot become an accidental opt-in. Do not read repo-local `codexclaw.json` (`plugins/codexclaw/components/pabcd-state/src/interview-policy.ts:26-27`) or `.codexclaw/*`. The existing `cxc config set` writes whitelisted Codex `config.toml` keys (`plugins/codexclaw/components/config-guard/src/cli.ts:27`, `plugins/codexclaw/components/config-guard/src/config-set.ts:62-74`), while `cxc config interview` writes project-local policy (`plugins/codexclaw/components/pabcd-state/src/cli.ts:209-245`). Do **not** add a CLI toggle: adding a second global JSON writer to those routes enlarges the permission surface for one opt-in. Document manual editing of `$CODEXCLAW_HOME/config.json` (default `~/.codexclaw/config.json`):

```json
{"permissions":{"agentCreatedThreadAutoAllow":true}}
```

The value must be the JSON boolean `true`; missing file/key, malformed JSON, arrays, and string `"true"` are off. Preserve other keys if editing an existing file. Add the following module verbatim; its 64 KiB first-record cap and 1 MiB config cap are named conservative bounds. It recognizes only the two required top-level TOML string assignments and refuses duplicates, an active `profile` key, or malformed section boundaries. This is deliberately narrower than a full TOML parser: the existing readers in `pabcd-state/src/review-round-cli.ts:36-50` and `config-guard/src/toml-edit.ts:51-69` are table/line readers, not a general parser. A syntax it cannot establish yields no allow.

```ts
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

const MAX_META_LINE_BYTES = 64 * 1024;
const MAX_CONFIG_BYTES = 1024 * 1024;
const ALLOW = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}';
const MODEL_ADVICE = "This Codex Desktop agent-created thread may show approval prompts even though the user Codex config requests full access. Request escalation explicitly for network or git operations when needed; do not assume this hook changes sandbox or network access.";
const USER_ADVICE = "This agent-created thread started in the default approval mode despite your full-access Codex config, so approval prompts may appear. You can switch this thread to Full Access in the composer or enable permissions.agentCreatedThreadAutoAllow in your user-global Codexclaw config.";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : null;
}

function readFirstRecord(path: string): JsonObject | null {
  if (!isAbsolute(path)) return null;
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(MAX_META_LINE_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const count = readSync(fd, buffer, used, buffer.length - used, used);
      if (count === 0) break;
      used += count;
      const end = buffer.subarray(0, used).indexOf(10);
      if (end >= 0) return end > MAX_META_LINE_BYTES ? null :
        object(JSON.parse(buffer.subarray(0, end).toString("utf8")));
    }
    if (used === 0 || used > MAX_META_LINE_BYTES) return null;
    return object(JSON.parse(buffer.subarray(0, used).toString("utf8")));
  } finally {
    closeSync(fd);
  }
}

function agentCreatedRoot(input: JsonObject): boolean {
  if (input.permission_mode !== "default" ||
      typeof input.session_id !== "string" || input.session_id.length === 0 ||
      typeof input.transcript_path !== "string" ||
      Object.hasOwn(input, "agent_id") || Object.hasOwn(input, "agent_type")) return false;
  const record = readFirstRecord(input.transcript_path);
  const payload = object(record?.payload);
  return record?.type === "session_meta" && payload?.id === input.session_id &&
    payload.thread_source === "agent_created_thread" && payload.forked_from_id == null;
}

function boundedText(path: string): string | null {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) return null;
  return readFileSync(path, "utf8");
}

function globalOptIn(env: NodeJS.ProcessEnv, cwd: string): boolean {
  const override = env.CODEXCLAW_HOME?.trim();
  if (override && !isAbsolute(override)) return false;
  const home = override || join(homedir(), ".codexclaw");
  // A project cannot grant this: an override that resolves inside the session cwd is ignored.
  const rel = relative(resolve(cwd), resolve(home));
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return false;
  const config = object(JSON.parse(boundedText(join(home, "config.json")) ?? "null"));
  const permissions = object(config?.permissions);
  return permissions?.agentCreatedThreadAutoAllow === true;
}

function codexConfigFullAccess(env: NodeJS.ProcessEnv): boolean {
  const override = env.CODEX_HOME?.trim();
  if (override && !isAbsolute(override)) return false;
  const home = override || join(homedir(), ".codex");
  const content = boundedText(join(home, "config.toml"));
  if (content === null) return false;
  const seen = new Map<string, string>();
  for (const raw of content.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      // An invalid table header leaves the ownership of following keys unknown.
      if (!/^(?:\[\[[^[\]\r\n]+\]\]|\[[^[\]\r\n]+\])\s*(?:#.*)?$/.test(line)) return false;
      break;
    }
    if (/^(?:profile|"profile"|'profile')\s*=/.test(line)) return false;
    const key = /^(approval_policy|sandbox_mode)\s*=/.exec(line)?.[1];
    if (!key) {
      if (!/^[A-Za-z0-9_-]+\s*=\s*\S/.test(line)) return false;
      continue;
    }
    if (seen.has(key)) return false;
    const match = new RegExp(`^${key}\\s*=\\s*"([^"\\r\\n]*)"\\s*(?:#.*)?$`).exec(line);
    if (!match) return false;
    seen.set(key, match[1]);
  }
  return seen.get("approval_policy") === "never" &&
    seen.get("sandbox_mode") === "danger-full-access";
}

function coveredTool(name: unknown): boolean {
  return typeof name === "string" &&
    (["Bash", "write_stdin", "apply_patch"].includes(name) ||
      isMcpToolName(name));
}

/** `mcp__<server>__<tool>` with both segments present. */
function isMcpToolName(name: string): boolean {
  const match = /^mcp__(.+?)__(.+)$/.exec(name);
  return !!match && match[1].replace(/_/g, "") !== "" && match[2].replace(/_/g, "") !== "";
}

function parseHook(raw: string, event: string): JsonObject | null {
  const input = object(JSON.parse(raw));
  return input?.hook_event_name === event ? input : null;
}

export function handleAgentThreadPermissionRequest(
  raw: string, env: NodeJS.ProcessEnv = process.env,
): string {
  try {
    const input = parseHook(raw, "PermissionRequest");
    return input && typeof input.cwd === "string" && input.cwd !== "" &&
      coveredTool(input.tool_name) && globalOptIn(env, input.cwd) &&
      agentCreatedRoot(input) && codexConfigFullAccess(env) ? ALLOW : "";
  } catch {
    return "";
  }
}

export function handleAgentThreadSessionStartAdvisory(
  raw: string, env: NodeJS.ProcessEnv = process.env,
): string {
  try {
    const input = parseHook(raw, "SessionStart");
    if (!input || !agentCreatedRoot(input) || !codexConfigFullAccess(env)) return "";
    return `${JSON.stringify({
      systemMessage: USER_ADVICE,
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: MODEL_ADVICE },
    })}\n`;
  } catch {
    return "";
  }
}
```

### 2. MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

Current `readStdin` and overflow handling are at lines 68-109 and 333-340; `recordHookInvocation` is line 340; the root-only early exit is lines 389-393. Insert the two hook verbs immediately after `const raw = stdin.raw` and before the recorder and early exit. Handle oversized input for these verbs before the existing branch's exit-1 behavior; AD-1 requires fail-open exit 0. The module rejects agent fields itself, so do not rely on the old early exit as the permission boundary.

```diff
   const stdin = readStdin();
   if (stdin.overflow) {
+    if (event === "permission-request" || event === "session-start-permission-advisory") {
+      process.exit(0);
+    }
     const denied = oversizedHookOutput(event);
@@
   const raw = stdin.raw;
+  if (event === "permission-request" || event === "session-start-permission-advisory") {
+    try {
+      recordHookInvocation(raw, "pabcd-state", event, import.meta.url);
+      const { handleAgentThreadPermissionRequest, handleAgentThreadSessionStartAdvisory } =
+        await import("./agent-thread-permissions.ts");
+      const result = event === "permission-request"
+        ? handleAgentThreadPermissionRequest(raw)
+        : handleAgentThreadSessionStartAdvisory(raw);
+      if (result) process.stdout.write(result);
+    } catch {
+      // Fail open: no decision/advisory, exit 0.
+    }
+    process.exit(0);
+  }
   recordHookInvocation(raw, "pabcd-state", event, import.meta.url);
```

No other event flow changes. The existing generic `session-start` handler remains side-effect-only at `cli.ts:406-410` and continues to create session state when PABCD policy is enabled; the new advisory does not create `.codexclaw` itself.

### 3. NEW `plugins/codexclaw/hooks/permission-request-allowing-agent-thread.json`

Use matcher `"*"` because the runtime may vary tool names; the module self-filters. The runtime accepts `*` as match-all at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/common.rs:166,192-194`. A synchronous command is essential: an async hook cannot apply the allow decision. The output wire's exact `hookSpecificOutput` and `decision.behavior` schema is `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:161-165,189-225`; the parser accepts it at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/engine/output_parser.rs:184-204`.

```json
{
  "hooks": {
    "PermissionRequest": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js\" hook permission-request",
        "timeout": 10,
        "statusMessage": "(codexclaw) Checking agent-created thread permission"
      }]
    }]
  }
}
```

### 4. NEW `plugins/codexclaw/hooks/session-start-advising-agent-thread-permissions.json`

Follow `plugins/codexclaw/hooks/session-start-bootstrapping-pabcd-state.json:1-16`, but use a separate verb. `systemMessage` is in the universal output at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:87-99`; SessionStart `additionalContext` is at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:384-403` and read by `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/engine/output_parser.rs:93-99`.

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "node \"${PLUGIN_ROOT}/components/pabcd-state/dist/cli.js\" hook session-start-permission-advisory",
        "timeout": 10,
        "statusMessage": "(codexclaw) Advising on agent-created thread permissions"
      }]
    }]
  }
}
```

### 5. MODIFY `plugins/codexclaw/.codex-plugin/plugin.json`

The manifest currently lists 29 hooks at lines 22-52. Add both paths once, beside the other SessionStart entries and before the PreToolUse entries. Their ordering among different event types does not determine policy.

```diff
     "./hooks/session-start-announcing-map-affordance.json",
+    "./hooks/session-start-advising-agent-thread-permissions.json",
@@
     "./hooks/pre-tool-use-guarding-goal-budget.json",
+    "./hooks/permission-request-allowing-agent-thread.json",
```

### 6. MODIFY `plugins/codexclaw/inventory.json` and `README.md`, `README.ko.md`, `README.zh.md`

Run the full `npm test` first and read its measured total, then `node plugins/codexclaw/scripts/inventory.mjs --write --tests <measured-total>` after the manifest and hook files exist, then `inventory.mjs --check --tests <measured-total>` and `npm run gate`. The generator derives hook identities from manifest entries at `plugins/codexclaw/scripts/inventory.mjs:77-92`, compares manifest and hook-file sets at lines 163-197, and updates the three README hook badges at lines 305-321. Expected count: 29 -> 31 (`README.md:18`, `README.ko.md:18`, `README.zh.md:18`). Then manually change the stale literal `24 active hooks` to `31 active hooks` at `README.md:189`, `README.ko.md:179`, and `README.zh.md:178`, plus `approve the 24 hooks` to `approve the 31 hooks` at `README.md:71`. The generator does not update those prose counts.

### 7. NEW `plugins/codexclaw/components/pabcd-state/test/agent-thread-permissions.test.ts`

Use `node:test` and `node:assert/strict`, as in adjacent component tests. Fixture helper makes temporary `CODEX_HOME/config.toml`, `CODEXCLAW_HOME/config.json`, and a rollout JSONL file whose first line is `{"type":"session_meta","payload":{"id":"fixture-id","thread_source":"agent_created_thread"}}\n`; pass those env vars to the exported handlers, with absolute `transcript_path`. Use `mkdtempSync(join(tmpdir(), ...))` and `t.after(() => rmSync(dir,{recursive:true,force:true}))`. The positive payload is `hook_event_name:"PermissionRequest", session_id:"fixture-id", permission_mode:"default", tool_name:"Bash"`; global JSON opt-in is boolean true; TOML has the two top-level required assignments. Test names and assertions:

| Named test | Exact assertion and reason it fails before this phase |
|---|---|
| `allows opted-in agent-created root thread for covered tools` | For `Bash`, a `Bash` network approval (`tool_input.description` = `network-access example.com`), `write_stdin`, `apply_patch`, `mcp__codex_app__create_worktree`, assert `strictEqual(result, '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}')`. No handler exists before this phase. |
| `default-off global setting leaves approval to Codex` | For missing `config.json`, missing `permissions`, malformed JSON, `permissions` array, `false`, and string `"true"`, assert empty output. The new gate must not silently grant approval. |
| `rejects missing corrupt and mismatched rollout identity` | Subcases: missing/empty `session_id`, null/missing transcript path, nonexistent path, empty file, malformed first JSONL line, first line not `session_meta`, missing payload, missing id, wrong id, missing/wrong `thread_source`, first line >64 KiB, and a valid second line after a wrong first line; assert empty output each. Without first-record verification an arbitrary thread could be allowed. |
| `rejects non-default permission and subagent payloads` | `permission_mode` missing/`full-access` and present `agent_id` or `agent_type` (including empty string or null) each produce empty output. An inherited child must never use this exception. |
| `rejects forked and user thread sources` | First-line `thread_source:"user"`, `"subagent"`, and `thread_source:"agent_created_thread"` with non-null `forked_from_id` all produce empty output, even with opt-in. Fork provenance remains outside this exception until measured. |
| `rejects unknown or conflicting Codex config` | Missing TOML, malformed/torn required assignment, malformed top-level line, duplicate required key, missing either key, `on-request`, `workspace-write`, top-level `profile = "team"`, and quoted top-level `"profile" = "team"` each produce empty output. The global opt-in cannot override unknown effective policy. |
| `ignores project-local opt-in and noncovered tool` | Write a project `codexclaw.json`/`.codexclaw/config.json` true but omit global opt-in: empty; set relative `CODEXCLAW_HOME` or `CODEX_HOME`: empty; with absolute global paths and opt-in true, `Edit`, `mcp_tool`, `functions.exec`, empty tool name, `mcp__`, `mcp__server`, `mcp____tool` and `mcp__server__`: empty; `mcp__codex_app__create_thread`: allow. The hook matcher is broad but the handler is not. |
| `emits exact allow JSON and otherwise no stdout` | Parse the positive output and assert only `hookSpecificOutput.hookEventName`/`decision.behavior` keys; assert the output bytes equal the literal JSON above with no trailing LF. Test malformed hook JSON, missing/wrong `hook_event_name`, and thrown read errors yield `""`; no `deny`, `continue:false`, or stderr path exists. |
| `advises agent-created default thread without opt-in` | Remove global opt-in, call SessionStart handler, parse output, assert nonempty `systemMessage` mentioning composer Full Access and opt-in, and `hookSpecificOutput = {hookEventName:"SessionStart",additionalContext:<string>}` with `network` and `git` in the context. This proves AD-5 is independent of AD-2. |
| `advisory is silent outside degraded agent-created context` | `approval_policy:on-request`, `sandbox_mode:workspace-write`, profile present, `permission_mode` other than default, `thread_source:user`, bad first line, and present agent field each yield `""`. Do not tell ordinary threads they degraded. |
| `CLI hooks fail open before root-only subagent exit` | Spawn the built CLI for both verbs with the fixture stdin; assert exit 0 and exact positive outputs. Spawn malformed and >4 MiB inputs; assert exit 0 and empty stdout. This pins placement around `cli.ts:333-340,389-393`; before the change these verb outputs are absent or oversized input exits 1. |

The first two rows alone are not sufficient: every conditional branch in `agentCreatedRoot`, `globalOptIn`, `codexConfigFullAccess`, `coveredTool`, `parseHook`, the 64 KiB cap, CLI overflow, and the advisory has an activating case above. Use table-driven subtests to keep the file compact.

### 8. MODIFY `plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts`

The existing real-hook golden tests at lines 53-76 and `EVENT_LABELS.PermissionRequest` at `components/cxc-ops/src/hook-trust.ts:18-29` establish the pattern. Add a test named `new agent thread hooks have stable trust identities and both require trust` after line 76. Parse each new hook JSON, pass its event, matcher and handler to `identityHash`, assert a `sha256:` hash, assert the PermissionRequest matcher is exactly `*`, and assert `listHookEntries(PLUGIN_ROOT, "codexclaw@local")` contains exactly one `:permission_request:0:0` key for the new file and exactly one `:session_start:0:0` key for its advisory. With a temporary `CODEX_HOME` containing no trust entries, call `diagnoseHookTrust` and assert both keys are `untrusted`; after writing one matching `trustSection` and one stale hash, assert trusted versus drifted statuses. This would fail before the manifest entries existed, and guards the fact that added hooks are inert until Codex trusts them.

## Runtime decision and bypass record

**Tier:** the synchronous PermissionRequest allow is a host permission decision **outside** structure/40's E1-E8 ladder (E1 means PreToolUse deny, not PermissionRequest allow); the SessionStart advisory is E4 context, and source tests/trust checks are E8. An allow does not override a separate denial. **Executing surface:** `handleAgentThreadPermissionRequest` and `handleAgentThreadSessionStartAdvisory` through their trusted hook manifests and `pabcd-state` CLI dispatch. **Known bypass:** an untrusted or absent hook has no effect; other hooks can deny; a direct caller can bypass the module predicates. **Residual risk:** runtime permission mode and sandbox/network constraints may differ from the top-level `config.toml` heuristic, and the `mcp__<server>__<tool>` name convention may misclassify tools. **Wording downgrade:** “may suppress this approval prompt when all predicates hold,” not “agent threads have full access.” **Final enforcement layer:** Codex's PermissionRequest decision aggregator (`/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/permission_request.rs:149-169,301-327`); the advisory has no enforcement layer beyond context delivery. E8 tests check hook trust, allow bytes, and fail-open cases.

The PermissionRequest surface can suppress a user approval prompt only after all predicates pass. An empty stdout and exit 0 is no decision, so Codex keeps its normal prompt path; this is supported by `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/permission_request.rs:205-211`. The exact allow is parsed at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/engine/output_parser.rs:184-204`. Never emit a denial, exit 2, `updatedInput`, `updatedPermissions`, or `interrupt`: the latter fields are unsupported at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/schema.rs:199-217`, and exit 2 can deny at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/permission_request.rs:249-263`. Another PermissionRequest hook's deny wins over this allow at `/tmp/cxc-perm/codex-src/codex-rs/hooks/src/events/permission_request.rs:149-169,301-327`.

Residual risks to record in the implementation PR: top-level `config.toml` can differ from runtime overrides; `permission_mode:"default"` does not prove the active sandbox; an allow result does not widen filesystem or network permissions; the `mcp__<server>__<tool>` name check is a naming convention, not proof that the approval is an MCP call; another hook may deny; a new/modified hook declaration changes its trust hash and needs re-approval. The advisory therefore says only that approval mode may have degraded. This workaround does not assert upstream #33282, #40793, or #41167 is fixed.

## Verification and activation

Run `npm run build` first (the CLI subprocess subtests execute `dist/cli.js`); then `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/agent-thread-permissions.test.ts" "plugins/codexclaw/components/cxc-ops/test/hook-trust.test.ts"`; then full `npm test`, `inventory.mjs --write/--check --tests <measured-total>` and `npm run gate`. Inspect command exit codes and actual test counts.

Cross-phase integration test (required, in `agent-thread-permissions.test.ts`): run the built CLI for both `permission-request` and `session-start-permission-advisory` with `CODEXCLAW_PABCD=off` and a fresh temporary cwd; assert the positive allow bytes and the advisory JSON are still produced and that `<cwd>/.codexclaw` does not exist afterwards. Use a scratch `CODEX_HOME` and `CODEXCLAW_HOME`; verify positive PermissionRequest stdout bytes and advisory JSON, then remove the opt-in and verify empty stdout. New manifest hooks require explicit Codex hook trust on an installed plugin before live activation; the source-level tests do not prove desktop permission behavior or sandbox/network access.

## Out of scope

No upstream Codex patch, runtime permission-profile change, automatic global opt-in, repo-local permission setting, forked-thread allowance, trust-state forging, or network/sandbox widening. `021_wp3_dispatch_guidance.md` owns the separate dispatch and #265 checkpoint text.


## wp3 re-verification against codex/issue-train-wp2 (supersedes stale anchors above)

Architect handle `01a0e3b8-436b-7203-a4f6-97d24b865814` re-checked this plan after wp2 landed (HEAD 5178e261). Binding corrections:

- **CLI placement (W3-2):** dispatch both verbs in `pabcd-state/src/cli.ts` right after stdin overflow handling and `const raw = stdin.raw` (`cli.ts:341-347`), before the hook recorder (`:348`), the subagent early exit (`:399-401`) and the PABCD switch (`:403-412`). On stdin overflow both verbs exit 0 with empty stdout. The generic SessionStart handler is now at `cli.ts:426-428`; `config interview` is at `cli.ts:217-252`.
- **Switch (W3-3):** neither `permission-request` nor `session-start-permission-advisory` is added to `PABCD_DISABLED_EVENTS` (`cli.ts:56-61`).
- **MCP names (W3-4, AD-4):** `coveredTool` accepts an MCP name only through `isMcpToolName` (the module code above now contains it): `/^mcp__(.+?)__(.+)$/` with both captures nonempty after removing underscores. Tests: `mcp__codex_app__create_thread` allowed; `mcp__`, `mcp__server`, `mcp____tool`, `mcp__server__` get no decision.
- **Switch tests (W3-5):** the built-CLI integration test runs both verbs twice, once with `CODEXCLAW_PABCD=off` and once with project `codexclaw.json` `{"pabcd":{"enabled":false}}`, each in a fresh cwd, asserting the allow bytes, the advisory JSON and no `<cwd>/.codexclaw`.
- **Counts:** manifest hooks 29 -> 31 (`plugin.json:22-52`); test baseline 3650 before this phase; README hook badges at line 18, tests badges at line 16.


## wp3 audit folds (round 1)

- **Network approvals are in scope.** A full-access user config grants network, so the opt-in also answers `Bash` network-access approvals once. Tests: `network-access approval is allowed with opt-in` and `network-access approval gets no decision without opt-in`.
- **Malformed TOML fails closed.** Table headers must have paired delimiters (`[name]` or `[[name]]`); `[[profiles]`, `[profiles]]` and any other line starting with `[` return no decision. Tests: both malformed headers plus a valid `[features]` header after the two keys.
- **`request_permissions` is out of scope.** The current host routes it straight to Guardian without PermissionRequest hooks (`codex-rs/core/src/session/mod.rs:2985-3008`, `approvals.rs:866-868`), so listing it would be a coverage claim no live path exercises. It is removed from `coveredTool` and the tests; revisit if the host starts routing it through hooks.
- **A project cannot grant the opt-in.** The handler requires a string `cwd` in the hook input and ignores a `CODEXCLAW_HOME` that resolves inside that cwd. Test: absolute `CODEXCLAW_HOME=<cwd>/.codexclaw` with `agentCreatedThreadAutoAllow: true` gets no decision; a sibling temp dir outside cwd with the same file allows.
