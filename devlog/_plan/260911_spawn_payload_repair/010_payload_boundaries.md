# Payload boundary implementation

Depends on: existing hook, store resolver and managed dispatch ledger. No new public
field or enum: creation/serialization/revival/consumer-chain expansion is N/A.

1. Normalize item text independently and remove only control tokens. Preserve all
   ordinary whitespace, CRLF, empty text and non-text metadata. Existing message-only
   normalization stays compatible.
2. Collect skill bodies across the text-item list, retaining existing mention
   collection semantics and validated existing skill blocks. Fence-aware mention
   normalization remains per item; no new fence-skipping collection policy.
   Deduplicate by skill folder over
   the complete list. Check the combined projected text (including separators and
   all proposed bodies) against the existing 256 KiB UTF-16-character limit before
   appending any new body. Over-budget input remains intact with no new body.
3. Recognize the exact existing warning/guard prefix before prepending either again.
   Preserve trusted prompt override behavior and attachment-only input. Do not use
   broad substring tests that let a quoted guard suppress the real prefix.
4. Resolve dispatch only from the first text item's producer header (or message
   header). Support exact hook-owned warning/guard prefixes and trusted prompt
   override on reapplication; quoted later lines/items, fences, bodies and media
   do not claim a dispatch. Pass the same extracted marker to resolution and
   issuance. Preserve malformed genuine-header denial, claimed/current checks,
   full-history restrictions and native tool-call single issuance.
   Concretely, unwrap the exact current ignored-config warning, then one known
   leaf/scope guard (ordinary or coordinator, including the exact optional grant
   instruction with a 64-hex nonce). After a recognized guard, try exact configured
   prompt overrides for every role, longest first: the ledger role is not known yet
   and can differ from native explorer transport. The remaining first line alone
   may carry authority. Validate the resolved ledger role's prefix when selecting
   among candidate prompt removals; prompts may contain their own marker examples.
   Existing recursion-grant mint/consumption semantics and unrelated coordinator
   prompt idempotence are not changed; coordinator prefix support is routing proof.
   Logical CXC-ROLE inference remains its separate existing contract.
5. Repair both reviewer recovery producers and exercise generated launch instructions
   against real role resolution with distinct explorer/reviewer configurations.

Architect dispositions: D1 accepted with one unique block set appended to the last
text item, including all separators in the aggregate limit. D2 amended: preserve
whitespace even in marker-bearing items while removing only actual control tokens.
D3 accepted; compare guard/prompt against the text without the exact warning prefix
and wrap once. Existing single-message prompt duplication is outside this repair.
D4 amended: a missing `TASK:` must not make all text authoritative, and configured
prompts may themselves contain `TASK:`. Require the managed marker at the start of
the first caller text; reapplication may unwrap exact known hook prefixes and the
trusted configured role prompt before that check. Do not scan arbitrary later text
or concatenate text items to find authority. D5 accepted. No new public field/enum.

Required acceptance (red before source repair, green after):

| Reachable input | Required result |
| --- | --- |
| Repeated skill mentions in multiple items | One body; all attachments/order intact |
| Individually small unique bodies whose combined size exceeds limit | No body attached; caller text retained |
| Existing body in later item plus earlier mention | No duplicate body |
| Indented YAML, trailing newlines and CRLF in a separate item | Exact original bytes |
| Tracked untrusted config, same hook applied twice/three times | One warning/guard; stable items |
| Valid same-session claimed marker quoted later in text/items | Claim remains unissued; actual first-header spawn can still issue |
| Message without TASK: with a valid marker on a later line | Claim remains unissued; genuine header can still issue |
| Items without TASK: with a valid marker in a later text item | Claim remains unissued; genuine header can still issue |
| Genuine header and reapplication under same native tool ID | Same managed model/effort; second distinct tool ID denied |
| Genuine header with malformed ID or unclaimed attempt | Denied without issuance |
| Guard/prompt prefix on legitimate reapplication | Managed routing retained, including prompts with marker-like examples |
| Legacy reviewer producer packet | Reviewer resolver/model rather than explorer |

Keep original tests and add real regression coverage without weakening assertions.
Run focused tests, full relevant suites, build, gate, inventory and Linux smoke.
Independent C review checks boundaries and exact diff. Compile integration and install
only from the preserved integration checkout; verify source/artifact hashes and run
the repaired synthetic hook cases against the installed artifact. Push both authorized
fork branches; update PR evidence and five review discussions only with current proof.

Audit round 1 dispositions: accept all three test/rollout clarifications. They do not
change D1-D5 interfaces or flow; no new architect design decision is introduced.

Post-change commands (existing runner/globs observe all changed sources):

```sh
node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/components/subagent-config/test/spawn-*.test.ts' 'plugins/codexclaw/components/subagent-config/test/fallback-*.test.ts' 'plugins/codexclaw/components/pabcd-state/test/*review*.test.ts' 'plugins/codexclaw/components/pabcd-state/test/attest*.test.ts' 'plugins/codexclaw/components/pabcd-state/test/crlf-inputs.test.ts'
npm run build
npm test
npm run gate
node plugins/codexclaw/scripts/inventory.mjs --check
npm run smoke
```

New `subagent-config/test/spawn-items-boundaries.test.ts` holds the hook negatives.
Executor adds `pabcd-state/test/reviewer-producer-routing.test.ts`: execute the public
`runReviewRoundCli` open path using existing review-round fixture setup, and the
attestation failure path, extract role/header values from emitted instructions and
pass their packet through `inferRole`/hook with distinct reviewer/explorer configs.
Do not replace this consumer test with source phrase assertions. Existing review-round
tests already exercise that CLI owner; the new test checks its changed routing advice.

Rollback: keep `installed-before.tar.gz`, current marketplace path, version/cache
listing and hashes before install. The expected marketplace already points at the
local integration checkout. If installed synthetic checks or hash/doctor verification
fail, stop native use of that payload. Restore this task's changed cache files from
the verified archive (stage outside the cache, compare for concurrent edits first),
and restore the recorded marketplace root using normal Codex marketplace commands if
the installer changed it. Recheck original hashes and doctor. Preserve the PR/integration
commits for diagnosis; never reset either worktree or overwrite concurrent user changes.
An unrelated concurrent cache change requires reconciliation rather than blind restore.
