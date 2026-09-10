# Explorer routing verification

2026-09-10. Implementation: `5fd6a6fd670cfaf66d3c0a4dbf867ec9bfe363e6`,
based on dev `9cd52769`. Later evidence-only changes do not change that code.
Local environment: Linux, Node 24.20.0, Codex CLI 0.153.4.

The CXC hook now routes both native input forms and preserves explicit explorer
selection. Real native children received the configured model and effort and
completed. The downstream proxy selected another provider model, so this is
proof of CXC delivery, not proof that the intended provider served the request
or that costs fell.

## Failure and repair

The effective explorer configuration was present before the repair. Replaying
the installed hook isolated the defects without a provider request:

| Input with explicit explorer | Before | After |
| --- | --- | --- |
| Plain message | Configured explorer model/effort | Same |
| Same task as text items, no message | Empty hook output; parent inherited | Configured explorer model/effort |
| Message containing `no review or verification` | Reviewer model | Explorer model |
| Message containing `do not 검증` | Reviewer model | Explorer model |
| Deliberate `CXC-ROLE: reviewer` header before `TASK:` | Reviewer model | Same |

`spawn-attach-hook.ts:443` owns role precedence; `:787` projects caller text from
items; `:817` preserves item boundaries and attachments; `:979` returns the
original one-of input shape. These are all under
`plugins/codexclaw/components/subagent-config/src/`.
Existing role/configuration and dispatch owners are reused; no new dispatcher,
provider dependency or universal model default was added.

## Regression and repository checks

Red evidence: role regressions failed 2/2; initial items regressions failed 3/4;
managed-items regressions failed 3/3. The final tests cover native role and legacy
header precedence, caller overrides, full-history restrictions, attachments,
per-item text normalization, idempotence, recursion denial, final-gate receipts
and single-use managed dispatch claims. The independent reviewer passed the
final implementation and independently ran the 11 new regression tests.

Commands use fresh empty `CODEXCLAW_HOME`, `CODEX_HOME` and `CODEX_SQLITE_HOME`,
plus a `TMPDIR` outside any Git checkout. This prevents personal role settings
and an unrelated Git repository above the normal temporary directory from
changing fixture behavior. `CODEXCLAW_SKIP_REPOMAP_SMOKE=1` matches CI.

| Command | PR implementation result |
| --- | --- |
| `npm run build` | Exit 0; 179 files compiled |
| `npm test` | Exit 0; 3,019 total, 2,947 passed, 0 failed, 72 skipped |
| `node plugins/codexclaw/scripts/inventory.mjs --check --tests 3019` | Exit 0 |
| `npm run gate` | Exit 0 |
| `npm run smoke` | Exit 0; Linux platform smoke |
| `git diff --check` | Exit 0 |

These are local results. Skipped tests are not counted as passes. macOS, Windows
and hosted CI require their own receipts. Evidence filenames retained outside
the repository: `role-red.log`, `items-red.log`, `items-managed-red.log`,
`full-suite-final.log`, `build.log`, `gate.log`, `smoke.log`.

## Real native calls

After building and installing the preserved integration branch, two fresh
native `spawn_agent` calls used `agent_type: explorer`, `fork_context: false`,
and no explicit model or effort argument. One used `message`; one used only
`items: [{type: text, text: ...}]`. Both tasks included negative review wording
and required a fixed response without tools. A temporary project override set
explorer to `gpt-5.6-luna` / `xhigh` with CXC first-fallback disabled, isolating
hook injection from the managed dispatch path. It was removed after the test.

| Transport | Child turn context | Completion | Correlated upstream result |
| --- | --- | --- | --- |
| message | `gpt-5.6-luna` / `xhigh` | `CXC_MESSAGE_EXPLORER_OK` | HTTP 200; proxy selected another model |
| items | `gpt-5.6-luna` / `xhigh` | `CXC_ITEMS_EXPLORER_OK` | HTTP 200; proxy selected another model |

Each child had one usage record with a unique proxy match by input/output/cache
token tuple and completion-time window. The proxy row retained requested Luna
and xhigh, while its selected route and actual model differed. Both children
were closed. One malformed historical usage line was skipped explicitly; it
was unrelated to these two matched rows. Private IDs, account references,
transcripts and raw usage stay outside the repository in `native-message.json`
and `native-items.json`.

The installed compiled hook SHA-256 was
`cd53634928da64cf2afee41ad741c71383967a4efb61aa86bca240a0bd938977`, identical
to the built source. Source, CLI, discovery guidance and account-catalog files
also matched the integration copy. Installation doctor separately reported
four untrusted/drifted stop/background hook entries. Spawn injection executed;
this report does not claim all installed hooks are trusted or active.

## Local integration coverage

The preserved integration was tested separately: 3,020 total, 2,948 passed,
0 failed, 72 skipped; component and GUI builds passed. Its extra catalog test
belongs to existing PR #118; those source/test files match that PR's head
`b1e76d3469864ceddc64945596651dd9a04a53f6` exactly. No duplicate catalog PR is
needed. Architect (#110), first fallback (#116) and executor registration (#91)
were already merged into dev. The remaining unpublished installation guidance
was generalized in `development/dogfood-dev-install.md` in this change.

The integration branch retains local features. The upstream PR contains generic
source, synthetic fixtures and sanitized evidence. It does not contain local
account settings or raw work logs.
