# Evidence: async user questions

Date: 2026-09-06. Baseline CodexClaw commit: `1c1d6c36f6fcdcb75a299fe8a90f1eb7fc544b79`.

## Live host schema

The main session exposes `functions.request_user_input_async` with `questions[]`, each containing required `title` and optional string-array `options`. It returns immediately; replies arrive asynchronously as new user messages. Free text is always available. The first option is preselected but not automatically submitted. Its description restricts use to actual missing information/preferences/constraints/clarification/approval during ongoing work; no model-name restriction is stated. This proves schema exposure in this session, not universal availability or successful end-to-end use on all models.

The distinct blocking `functions.request_user_input` schema uses `header`, `id`, `question`, and option objects. It waits for a response and has separate mode/policy limits. Schema fields and limits must not be copied between these tools.

## Current plugin boundary

- `plugins/codexclaw/components/pabcd-state/src/goal-gate.ts:135-139`: the existing goal guard matches exactly `request_user_input`.
- `plugins/codexclaw/components/pabcd-state/src/hook.ts:1843-1844`: PostToolUse capture matches exactly `request_user_input` before calling `captureInterviewAnswers`.
- `plugins/codexclaw/components/pabcd-state/src/interview-ledger.ts:231-280`: capture expects question IDs and returned `answers`, unlike async `title` and later messages.
- `plugins/codexclaw/skills/interview/SKILL.md:194-225`: automatic capture and goal firewall describe that synchronous Interview path.

Therefore general async guidance must not promise automatic Interview capture/readiness, extend exact-name enforcement claims to async names, or use async as a workaround for a host denial. This unit changes prose only.

## Public lookup and historical context

Official-domain exact-name search returned no documentation for `request_user_input_async`. The opened [official feature overview](https://learn.chatgpt.com/docs/features) does not establish model-specific availability of this tool. General API async tool execution is not evidence for this desktop question UI. Historical local notes cover the synchronous Default-mode feature gate only; current async behavior must be established independently.

## Independent source and model observations

Grok leaf Russell inspected `/Users/jun/Developer/codex/121_openai-codex` at `d2d5b70241fb448044c1c088a977cc720d70443a`. Main re-read the following source:

- `codex-rs/core/src/tools/spec_plan.rs:1167-1189`: registration requires a root session and `model_info.experimental_supported_tools` containing either `request_user_input_async` or legacy `send_user_message_async`. No hardcoded Astra identity test in this registration condition.
- `codex-rs/core/src/tools/handlers/request_user_input_async.rs:30-75,104-138`: async schema, nonempty validation, `AgentMessageDelivery::Async`, immediate `{"accepted":true}` output.
- A fresh JSON projection of `codex-rs/models-manager/models.json` found Astra has `["send_user_message_async", "clock"]`; all 10 other bundled entries have an empty experimental tool list.
- A fresh projection of `/Users/jun/.codex/models_cache.json` found the same Astra opt-in and empty lists for all other cached entries, including xai/grok-4.6 and Sol/Terra/Luna. This cache is a local snapshot, not a universal remote catalog guarantee.
- Grok leaves Russell and Dalton independently reported no async question tool in their live catalog. Subagents are excluded by the root guard, so this alone cannot prove a model-family restriction. Combined source/cache evidence establishes effectively Astra-only availability in this observed setup, with catalog-based extensibility.

The old sibling `120_codex-cli` uses the legacy tool name (agent lead, not required for this patch). Do not derive callable aliases from it; live schemas decide. No async question was sent as a test, no end-to-end user-reply proof, and no provider capability flag was changed.
