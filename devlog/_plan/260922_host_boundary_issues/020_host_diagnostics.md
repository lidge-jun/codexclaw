# wp2 — preserve pending identity and report unobservable memory gates

Depends on wp1. This phase revalidates the initial discovery against the integrated tree. No native resolver, global threshold write, host memory DB mutation or new recall engine.

## Pending lane state

MODIFY plugins/codexclaw/scripts/check-lane-packet.mjs: extend declared mode dispatch|bound with pending. Add creation object with provisionalId, hostId, requestedAt (valid ISO timestamp), optional worktree. pending requires creation evidence and forbids canonical address; bound keeps current address checks and rejects copying creation.provisionalId into threadId. Explicit CLI/declaration conflicts fail rather than silently relabeling pending as dispatch. Dispatch cannot carry creation evidence indicating a request already happened. Preserve legacy dispatch/bound packets without creation. No automatic dispatch is added.

MODIFY plugins/codexclaw/test/lane-packet.test.mjs: valid pending and JSON/CLI output; absent/invalid creation, copied provisional IDs, incompatible mode/address, malformed timestamps, caller-forced dispatch rejection, existing fixtures unchanged. Value chain: CLI/JSON mode -> validation -> resolved.mode -> CLI JSON/text; no persisted reviver beyond caller-supplied JSON. Document the fields consistently in skills/pabcd/references/dispatch-surfaces.md and skills/loop/references/lane-dispatch.md. This is packet validation only; no native mutation interception. Missing listing never authorizes recreation.

## Memory observation limits

MODIFY components/recall/src/memory-status.ts: add observation fields effectiveExtractionRoute='unknown', startupGuardDecision='unknown', and observationSource='jobs-db' to all collected snapshot states. Centralize common construction where useful. Format both available and unavailable states with a concise explanation that job history does not establish the current startup guard or effective route; preserve SessionStart silence for healthy snapshots. Keep existing capacity buckets as error classification, never a guard verdict.

MODIFY components/recall/test/memory-status.test.ts and affected typed literal fixtures (enumerate by type/field searches before edit). Creation is collectMemoryStatus -> direct JSON serialization in CLI -> no persisted deserialization -> formatter/notice/doctor consumers. Existing callers are compatibility consumers and must preserve their prior behavior. Tests activate empty readable DB, success history, quota-classified failure, absent/unsupported DB: observability stays unknown in all. Verify existing memory search chat fallback without adding another fallback.

MODIFY status documentation and structure/INDEX.md to distinguish partial improvements from native fixes. #209/#191 remain open. Verifiers: node plugins/codexclaw/scripts/test.mjs plugins/codexclaw/test/lane-packet.test.mjs plugins/codexclaw/components/recall/test/memory-status.test.ts plus directly affected fixture tests; npm run build; gate. Independent review confirms no optimistic route or ID guesses.
