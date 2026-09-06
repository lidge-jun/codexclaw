# wp1 — Native execution owner and executable examples

Dependency: wp0 audited roadmap. C3 satisfy-spec; no runtime/config changes.

## Exact file changes

MODIFY plugins/codexclaw/skills/dev/SKILL.md at Capability Routing Hub:
before: general native routing followed by Browse / QA Tool Routing.
after: insert Native execution subsection with a link to references/native-execution.md.
Wording: for tool composition, response projection or in-context JS computation,
prefer exposed native Code Mode; read the reference before nontrivial use; simple
direct calls and explicit tool restrictions take precedence; never assume availability.

MODIFY the existing full-read paragraphs in dev and loop: retain required complete
reads and recovery on truncation, but replace nested/outer code-mode-specific budget
wording with transport-neutral output limits. Concrete nested/outer budget mechanics
live only in the conditional native-execution reference. Pabcd adds no duplicate.

MODIFY plugins/codexclaw/skills/loop/SKILL.md in the conditional reading table:
add a Tool composition / JS data processing row linking to
../dev/references/native-execution.md. No unconditional full reference load.
MODIFY plugins/codexclaw/skills/pabcd/SKILL.md near phase routing:
add a short native execution pointer for tool-heavy phase work, not phase entry.

NEW plugins/codexclaw/skills/dev/references/native-execution.md:
sections: selection table; discover by live schema; compose with authority;
ephemeral values and loss; output/completeness; waits and handles; evidence limits.
Selection rows: simple operation -> direct when a direct callable is exposed;
if the live contract requires nested-only access or exposes only that route, use
the exposed Code Mode path (not an inferred CLI flag or model-name rule);
independent multiple reads/projection -> native Code Mode when exposed;
in-context JSON computation -> native pure JS without unnecessary nested tools;
dependent operations -> await/check then decide; absent capability -> supported direct;
Node/files/network/long-lived browser state -> owning tool/runtime, never pretend
native JS has those APIs. No configuration writes or installation for missing tools.
Require finite independent read batches, await every promise, preserve allSettled
failures, check tool-specific error envelopes/exit codes, distinguish transport
fulfilment from success. Unknown partial external write -> reconcile before retry;
never reroute denied calls or execute retrieved source strings.
Store/load is same-session serializable data only; task/revision-scoped keys,
explicit miss/stale handling; no secrets/credentials or persistent success proof.
Preserve IDs, totals, errors, missing and truncation signals in projections; budget
nested and outer output. Link to the existing dev full-read rule rather than own
a second recovery protocol.
Only wait with returned code cell handle; shell and agent handles stay separate;
yield/timeouts are not completion/cancellation/rollback proof. Link worked examples
only for concrete code patterns, not mandatory on simple reads.

NEW plugins/codexclaw/skills/dev/references/code-mode-examples.md:
Four labeled raw-js fences with extractable IDs discovery, read-batch, cache-read,
and applyAfterRead, intended for an exposed functions.exec-like
contract (copy fence contents, not the fence). No new exported runtime library.
Example discovery filters actual ALL_TOOLS by name/description, prints a bounded
set plus match/omitted counts; does not invoke a guessed first match.
Example read-batch uses two literal read-only git commands through the observed
exec_command schema, awaits Promise.allSettled, verifies exit_code/output/session_id,
retains each rejection/nonzero/incomplete result; bounded output with explicit
preview/total metadata and same-session storage, not a complete-read certificate.
Separate cache-read snippet handles miss and schema mismatch before accessing data;
never treats cache as a fresh source for a later write.

The applyAfterRead fence defines task-local applyAfterRead(read, write):
await the supplied prerequisite callback; require its explicit {ok:true,
complete:true} task contract before invoking the separately authorized write
callback; propagate either rejection unchanged. These callback names are example
parameters, not invented native tools. Tests supply controlled callbacks and
assert write count zero for rejected, unsuccessful, incomplete and malformed reads.
The example does not acquire authorization, provide atomicity or retry/rollback.
Read-batch summaries always carry completeRead:false; preserve nested truncation
signals and never use a successful exit code as a complete-read certificate.
The fixture store can throw; tests require rejection propagation, not success after
failed storage. Serializability remains a documented host constraint rather than
pretending the test Map proves native serialization semantics.

NEW plugins/codexclaw/test/native-execution.test.mjs:
use node:test and node:vm ONLY in test code to execute extracted trusted repository
example fences with controlled tools/text/store/load/ALL_TOOLS. The sandbox is not
a security boundary or native-runtime simulator. Fresh context for each invocation.
Compare observable outputs and call records to independent expected literals.
Tests cover exact discovery and no calls, no matches, independent batches, mixed
rejection/nonzero/structured error, malformed/missing output, shell-running handle,
long preview accounting, cache hit/miss/invalid schema and successful zero/empty
values; applyAfterRead rejected/unsuccessful/incomplete/malformed reads cause zero
writes, successful complete read causes one write, and write/store rejections
propagate. Hostile strings are data cases of read-batch, not a fifth fence.
Link tests extract owner links and resolve against actual payload paths;
missing example ID/fence and broken link must fail, not skip. No prose regex tests.
No native cancellation/permission claims from this fixture.

MODIFY structure/60_native_capabilities.md: add dated 2.2 common native execution
owner mapping, explicit host availability boundary, exposed exec/wait helpers and
guidance-only status; leave unrelated historical inventory alone.

MODIFY plugins/codexclaw/skills/dev/references/skill-ownership.md: add one table
row mapping native execution selection/composition to dev/references/native-execution.md
with dev, loop, pabcd, peer and structure60 as pointer sites.
MODIFY plugins/codexclaw/skills/dev/references/peer-collaboration.md: before its
code-mode projection paragraph, link the shared execution owner; retain peer-specific
identity/title/scope preservation. No reviewer/security pointer duplication because
those governed lanes already load dev. Retain generic full-read rules in dev/loop:
they govern direct-tool reads as well, not only code-mode execution.

## Verification and reviewer contract

Existing npm test reads plugins/codexclaw/test/*.test.mjs (package.json).
gate.mjs walks SKILL.md and references (lines 152-164), but it is not a semantic
agent compliance checker. inventory counts public tests and skill metadata.
New test command: node --test plugins/codexclaw/test/native-execution.test.mjs;
NEW, cannot run before the file exists. Execute remotely on macmini Node24, plus
existing packaging/skill-catalog tests and gate. Mutation-check examples against
swallowed errors and broken cache handling in an isolated in-memory copy.
Reviewer checks policy triggers and exclusions separately from executable syntax.
