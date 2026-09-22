# Evidence and boundaries

- Installed delegation.md:74-80 permits schema-adapted logical roles; :147 lists V1 without agent_type; :249-256 contradicts those rules by requiring native architect universally.
- spawn-attach-hook.ts:492-500 already recognizes a leading CXC-ROLE architect marker without agent_type; explicit worker/executor/reviewer types retain precedence.
- spawn-attach-hook.test.ts:1235+ covers logical/native identity, configured routing, explicit overrides and fork restrictions. spawn-wrapper.test.ts covers native architect producers.
- spawn-wrapper.ts:334+ and agents/README.md describe V2-shaped helpers. `rg` over non-test TypeScript finds no production caller outside the helper itself; this repair does not extend that API or present its full output as V1-valid.
- Baseline command: node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/subagent-config/test/spawn-wrapper.test.ts" "plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts"; exit 0, 124 tests passed. Output: /tmp/cxc-v1-architect-baseline.log (local evidence, not published artifact).
- Baseline gate: node plugins/codexclaw/scripts/gate.mjs; exit 0, no drift.
- No automated prose phrase assertions are added. Semantic instruction compatibility requires independent review; existing behavior tests prove routing boundaries only.
- The user-approved v1 logical-role route was exercised by a real architect subagent in this task. A successful call is not native sandbox proof or downstream served-model proof.
