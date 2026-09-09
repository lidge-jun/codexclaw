# Local boundary evidence

- Catalog /home/jun/.codex/opencodex-catalog.json contains xai/grok-4.6 and cursor/grok-4.6. No provider request made.
- OCX src/lib/errors.ts:180 classifies structured error codes; upstream-retry.ts owns provider retries.
- OCX src/codex/subagent-model-fallback.ts:535,617,657 already resolves global/per-primary fallback and rewrites thread_spawn requests before provider routing. CXC will not mutate that configuration. Requested candidate is not proof of actual route; preserve actual model as unknown absent observed metadata.
- CXC components/pabcd-state/src/hook.ts:1889 documents incomplete/truncated PostToolUse error visibility. No verified PostToolUseFailure surface is available.
- CXC spawn-attach-hook.ts:926 returns an updated input envelope; it does not invoke native tools.
- Native host metadata exposes spawn_agent returning agent_id, and wait_agent returning errored:string or completed:string|null. No structured provider error field is promised. Parse only a complete JSON error envelope, never guess a code from arbitrary prose; unknown errors return reconcile/stop rather than blindly rotate.
- Scout independently inspected OCX and CXC source and recommended managed start/report with native main-owned calls. Runtime role observed in child turn_context: gpt-5.6-luna high. Reviewer route observed: anthropic/claude-opus-5 xhigh. Exact actual downstream route remains unverified.
