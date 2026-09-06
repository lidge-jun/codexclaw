# PR80 review and delivery

C2 bounded stdout bug, C4 release. Satisfy-spec following user's 'review this too'
continuation of completed release. Scope: review/adopt contributor PR80, preserve
commit attribution, recheck current dev, release0.2.22 on established four hosts.
No unrelated hooks/roles/schema redesign or dirty-checkout edits. No broad local
suite. Same source/CI/promotion/release/backup/hash/smoke gates as0.2.21.
One cohesive work-phase: review+merge conflict resolution+release packaging.
Verifier: source/dist real spawn-hook pipe test with model/effort/message preservation;
mutation-red old process.exit, focused80 suite, final exact-head platform/WSL/packed
CI; installed compiled-pipe smoke on each host. End after release/install proof.
Artifacts here and .codexclaw/evidence/pr80. No user token/time bound.

Original contributor7f18db0416b186ca83bf72803e21c621e815e3db bythisisjun786.
Changed code: src/spawn-attach-hook.ts main ends natural exit via exitCode0;
matching compiled dist and one200KiB real CLI regression. Only other changes are
three generated README counts. No workflow/credential/policy changes.
Original checks are action_required, not tested. Current dev causes only README
badge conflicts. Resolve with newest generated inventory from measured total.
Hypotheses: H1 forced exit truncates pending pipe writes (toggle tests); H2 payload
normalization truncates before write (direct runSpawnAttachHook full output); H3
consumer read cap (maxBuffer2MiB and independently parse output). Node official
process docs warn process.exit can discard queued stdout; natural exit is intended.
Review test timeout20s so future leaked handles fail instead of wedging CI.

Delivery: merge original PR ancestry into isolated dev candidate, update contributor
branch only if maintained-edit authorization and FF preserved. CI for final original
PR, dev integration and main promotion. Version0.2.22 metadata/cachebuster, count2647
only after measured new test plus existing2646 proof; full CI must agree. Publish
normal Release workflow from exact main; verify tag/archive/all files then backed-up
macmini-cf,suji,Windows,local install. Unrelated config and working copies preserved.
