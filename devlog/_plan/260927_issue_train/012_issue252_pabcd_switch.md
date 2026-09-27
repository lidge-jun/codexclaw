# #252 — PABCD hook policy switch

`CODEXCLAW_PABCD` is a two-way override: normalized `off|0|false` disables and `on|1|true` enables PABCD hooks, regardless of project config. An unrecognized value is ignored; then project-root `codexclaw.json` `{ "pabcd": { "enabled": false } }` disables. Missing or malformed project config defaults to enabled. This changes hook dispatch only; it does not erase state or disable CLI commands.

Current anchors: `plugins/codexclaw/components/pabcd-state/src/cli.ts:329`, `plugins/codexclaw/components/pabcd-state/src/interview-policy.ts:26`, `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:313`, `docs-site/src/content/docs/guides/pabcd.md:67`.

## File change map

### MODIFY `plugins/codexclaw/components/pabcd-state/src/interview-policy.ts`

This module already owns the project config filename and fail-safe JSON read (`:26-61`). Add `readPabcdEnabled(cwd: string, env: NodeJS.ProcessEnv = process.env): boolean` beside `readInterviewPolicy`. Normalize the env value with `trim().toLowerCase()` and handle the recognized enable/disable sets **before** reading project config. For an unrecognized env value, use `configPath(cwd)`; parse only a plain object with a plain-object `pabcd` member and boolean `enabled`. Only exact JSON boolean `false` disables at that layer. No write is needed: `writeInterviewPolicy` preserves unrelated keys (`:63-95`).

```ts
export function readPabcdEnabled(cwd: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const override = env.CODEXCLAW_PABCD?.trim().toLowerCase();
  if (override === "off" || override === "0" || override === "false") return false;
  if (override === "on" || override === "1" || override === "true") return true;
  try {
    const raw: unknown = JSON.parse(readFileSync(configPath(cwd), "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
    const pabcd = (raw as Record<string, unknown>).pabcd;
    if (!pabcd || typeof pabcd !== "object" || Array.isArray(pabcd)) return true;
    return (pabcd as Record<string, unknown>).enabled !== false;
  } catch { return true; }
}
```

### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

After raw hook observation at `:333-341` and before PABCD handlers (`:391-480`), parse only `cwd` from the hook payload, fall back to `process.cwd()` for malformed input, and apply the explicit allowlist. Keep the three independent safety branches above it (`worktree-guard-pretool :357-364`, `pre-tool-use-memory-write :374-381`, `pre-tool-use-automation-ownership :383-387`). The subagent early return at `:391-393` can stay above the new switch; `subagent-stop` is deliberately exempt there. For a disabled event, exit 0 without output or state writes. No synthetic allow response is needed: an empty hook response means no intervention.

```ts
const PABCD_DISABLED_EVENTS = new Set([
  "session-start", "user-prompt-submit", "stop", "post-compact",
  "post-tool-use", "subagent-stop", "subagent-stop-review",
  "pre-tool-use-idle-edit", "pre-tool-use-friction", "post-tool-use-friction",
  "post-tool-use-edit-shape", "post-tool-use-render-observation",
]);
```

Insert this exact dispatch fragment after the subagent early exit at `cli.ts:391-393` and before the `pre-tool-use` branch at `:395-402`:

```ts
let hookCwd = process.cwd();
try {
  const payload: unknown = JSON.parse(raw);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidate = (payload as Record<string, unknown>).cwd;
    if (typeof candidate === "string" && candidate.length > 0) hookCwd = candidate;
  }
} catch { /* malformed hook input keeps process cwd */ }
const pabcdEnabled = readPabcdEnabled(hookCwd);
if (!pabcdEnabled && PABCD_DISABLED_EVENTS.has(event)) process.exit(0);
```

Import `readPabcdEnabled` from `interview-policy.ts` at `cli.ts:23-53`. Use `pabcdEnabled` in the mixed branch: replace `if (output === "") output = handleIdleEditAdvisory(raw)` at `:442` with `if (pabcdEnabled && output === "") output = handleIdleEditAdvisory(raw)`. This leaves lint active. `pre-tool-use` stays live and is split in `goal-gate.ts` below.

Split mixed branches, rather than skipping independent logic: `pre-tool-use-edit :438-442` must still execute `handleApplyPatchLint` but must skip `handleIdleEditAdvisory`; `post-tool-use-edit-shape :459-467` can no-op because both its shape hint and render capture serve PABCD; `pre-tool-use-lint :433-436` always stays. `session-start-rules :478-480` and `worktree-guard :451-454` stay, because project rules and worktree identity are not PABCD policy. `pre-tool-use :395-402` stays for goal-complete and goal-budget safety, but inspect `goal-gate.ts` branches: only `request_user_input` Interview/goal-mode prohibition is PABCD-specific and should return no intervention under the switch. Goal completion, evidence tombstones and budget protection are independent host-goal safety. Do not change recall's separate component hooks.

The switch must cover `SubagentStop` evidence for both executor and worker when disabled; it does not delete old attempts or tombstones. When enabled, the registered executor is always receipt-gated and the built-in worker is gated only in an active B/C cycle (015). When disabled, the gate is silent for **both**, even if a prior cycle was armed. A standalone `subagent-stop-review` observer is PABCD audit state and no-ops. Existing safety hooks registered outside this component remain untouched.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts`

At `handlePreToolUseFailClosed` (`:313-321`), parse the payload, compute `const enabled = readPabcdEnabled(payload.cwd)`, then return `applyGoalBudgetGuard(payload) || (enabled ? applyGoalModeInterviewGuard(payload, deps) : "") || applyGoalCompleteGuard(payload, enabled)`. In the catch, env-off must not trigger the `request_user_input` fail-closed fallback; for a malformed payload use `readPabcdEnabled(process.cwd())` before that fallback. This is necessary because the `pre-tool-use` dispatcher remains live. Test enabled/disabled branches with goal active and inactive.

`applyGoalBudgetGuard` checks the independent `create_goal` input shape (`goal-gate.ts:104-124`) and always stays. `applyGoalCompleteGuard` mixes boundaries (`:209-299`): add optional `pabcdEnabled = true`. When disabled, skip only the in-flight PABCD phase denial at `:226-229` and bound-goalplan quality denial at `:275-296`. Keep unreadable-state denial and unresolved subagent verdict/tombstone checks at `:215-225,231-274`, because existing evidence debt must not disappear when policy turns off. This is the explicit decision for goal-complete; it cannot remain byte-identical because two of its predicates depend on PABCD. Test that a previously in-flight but otherwise clean state can complete with PABCD off, while an unresolved tombstone still denies. Goal-budget has no PABCD dependency and stays intact.

### MODIFY `docs-site/src/content/docs/guides/pabcd.md`

Add a short “Disable PABCD hooks” subsection near the existing runtime lifecycle guidance (`:67`). Show both exact forms, env precedence, defaults, and the retained safety guards. The present project config reader is `interview-policy.ts:26-61`; the new `pabcd` key belongs in that same `codexclaw.json`. State that `cxc config interview off` only changes Interview promotion (`cli.ts:209-245`), whereas this switch disables PABCD hook dispatch. Do not claim the switch disables the CLI.

### MODIFY tests

- `plugins/codexclaw/components/pabcd-state/test/interview-policy.test.ts`: table-test every recognized env spelling in both directions, invalid env fallback, missing/malformed config, and preservation of the `pabcd` key by interview-policy writes. Assert exact expected booleans from the matrix below.
- `plugins/codexclaw/test/hook-e2e.test.mjs`: `pabcd off silences UserPromptSubmit, Stop, SessionStart, PostCompact, SubagentStop`; invoke the built hook entry with project config/env, assert stdout empty and no new session/attempt file. This fails before the switch because trigger and Stop hooks still emit/write.
- Same e2e file: `pabcd off retains worktree, memory, automation and apply_patch lint guards`; feed each registered event an existing deny fixture and assert its denial survives. `pre-tool-use-edit` must still deny a lint violation and emit no idle advisory.
- `plugins/codexclaw/components/pabcd-state/test/goal-gate.test.ts`: `pabcd off allows request_user_input while preserving goal completion and budget denials`.
- `plugins/codexclaw/components/pabcd-state/test/subagent-evidence.test.ts` and built-hook e2e: `pabcd off silences registered executor and built-in worker SubagentStop even with an armed B/C parent`; `pabcd on gates executor when project false`; assert no new attempts or tombstones in the disabled case.

| Env value | Project `pabcd.enabled` | Expected PABCD hooks |
| --- | --- | --- |
| `off`, `0`, `false` (each, case/space normalized) | true or absent | disabled |
| `on`, `1`, `true` (each, case/space normalized) | false | enabled |
| unrecognized (including empty) | false | disabled (project decides) |
| unrecognized (including empty) | true or absent | enabled (project decides) |
| unset | false | disabled |
| unset | true, absent, or malformed config | enabled |

## Activation and bypass record

Exercise every matrix row, root/subagent payloads, executor/worker SubagentStop and every mixed event. **Tier:** local hook dispatch policy and E8 tests; no E1 host-wide tool denial. **Executing surface:** `pabcd-state` hook CLI. **Known bypass:** direct library calls, terminal CLI commands, and an uninstalled/untrusted hook. **Residual risk:** other components may issue independent context. **Wording downgrade:** “PABCD hooks in this component are silent,” not “CodexClaw is disabled.” **Final enforcement layer:** `cli.ts` hook dispatch plus `goal-gate.ts`'s Interview branch and E8 regression tests. Out of scope: recall hooks, state deletion, CLI write blocking, and safety-guard disablement.

## Note from the roadmap reflection

The wp3 hook verbs `permission-request` and `session-start-permission-advisory` (020) are not PABCD policy. The switch must not list them, and wp3's integration test asserts they still run with `CODEXCLAW_PABCD=off`.
