# Source evidence and autonomous interview

Prior release: v0.2.17 had only output-budget guidance in dev/loop and peer-response
projection; the broader patterns stayed proposals in the 260905 research unit.
Searches: code.mode, functions.exec, js_repl, ALL_TOOLS, store/load, yield_control
across shipped skills, config-guard and prior adoption candidates.
No reusable common execution owner or executable reference-test harness was found.
Reuse existing dev/reference, node:test and native tools; no product runtime helper.

## Primary source

Read-only checkout /Users/jun/Developer/codex/121_openai-codex at
d2d5b70241fb448044c1c088a977cc720d70443a, not a latest-upstream claim.
codex-rs/code-mode-protocol/src/description.rs:11-60 defines deferred discovery,
fresh async V8 isolates, no Node/fs/network/console, raw JS, awaited tools,
serializable store/load, text/media helpers and wait's cell_id contract.
codex-rs/code-mode-runtime/src/runtime/callbacks.rs:218-234 serializes values;
session_runtime/mod.rs:295 merges stored writes. No live shared-state transaction.
The actual current functions.exec/wait contract is authoritative when defaults
differ from this source snapshot. Shell process session_id is not a code-mode cell_id.

Three federated memory stores were cross-checked selectively. Aside's 2026-09-04
skill/process notes and wiki product version table are historical; neither overrides
the actual tool catalog, current branch or this unit's evidence. No memory/wiki edits.

## Questions under examination

Grok design peer Russell: 01a074ad-85c4-7932-95a3-98854ba0f796.
Grok failure-contract peer Aristotle: 01a074ad-864b-7c82-9a25-3fe532ca0346.
Both requested xai/grok-4.6 high; their native turn_context model is xai/grok-4.6.
No full-history fork; read-only lanes, main owns decisions and writes.

Main initial hypothesis: use a capability-aware preference for meaningful
composition/projection, not every-call compulsion and not an optional specialist
that ordinary cxc-loop never discovers. Keep shared owner under dev with short
routes from dev/loop/pabcd; no hook changes. Record peer replies and follow-up
questions below before the final roadmap audit.

## Round 1 — design peer and main response

Russell found no common owner and proposed a browser-routing-style decision table,
an ownership-map row, dev/loop/pabcd/SOT pointers and optional reviewer/security
stubs. Questions: what makes composition useful; which owner; when to re-inspect
catalog; which safety rules are mandatory; whether generic read text should move.

Main answers: six concrete selection cases in 010; native-execution.md owns the
choice, code-mode-examples.md is conditional detail. Add ownership/peer pointers.
Reject redundant reviewer/security stubs because their mandatory dev attachment
already supplies the route. Keep full-read rules inline in dev/loop because their
correctness boundary applies even when no JS executor exists. Inspect schema at
first relevant use and after toolset/context changes or mismatch, not every call.
Availability is the exposed callable contract, not a CLI flag or a historical SOT.
Safety/error/freshness rules are mandatory; preference remains non-enforced guidance.
Peer suggestion to replace ordinary one-call workflows with compulsory eval rejected.
Follow-up sent to Russell to challenge these dispositions, not merely agree.

## Round 1 — failure peer and main response

Aristotle proposed F1-F11: absent/deferred callable, partial failure, dependent
writes, Pre/Post deny, ephemeral/stale/racing store, truncation, wait/cancel and
hostile tool output. Accepted the host-fact versus agent-policy split and mutation
oracles. F1/F2/F3/F7/F9 plus hostile strings feed extracted executable reference
examples with independent expected call/output traces. F4/F5/F10 host-side effects
and cancellation stay explicit documented/reviewed boundaries, not unit-test PASS.
Actual native safe calls, store/miss and yield observations are separate evidence.

Main rebuttals: stored functions must not be promised silently dropped; use JSON
values only and preserve serialization rejection. Raw evidence is sometimes needed
for full reads, so a blanket ban on displaying a tool string is inappropriate;
display/store does not promote it into executable code or authority. A universal
projector/sanitizer would be a new runtime layer and would not certify injection
immunity. Keep fixed tool-call traces under hostile data, and independently assess
forward tasks. Do not claim zero C2 routing misses or host cancellation proof.
Follow-up sent to Aristotle asking for concrete falsifiers of this bounded contract.

## Round 2 — concrete routing refinement

Russell agreed generic full-read protection belongs inline, but separated that
from nested/outer budget mechanics. Main accepts: transport-neutral completeness
stays in dev/loop; composition budgets move to the conditional reference. Also
split pure in-context JSON work from nested multi-read calls and sharpen the hub
trigger so it cannot read as every-tool native compulsion. Ownership/peer file
entries had been added while the peer read an earlier draft; fresh audit gets the
updated files. No additional user choice is needed for these scoped refinements.

## Round 2 — falsifiable dependent execution

Aristotle correctly separated F4 (read failure must prevent dependent write) from
host hook mechanics. Main accepts an executable task-local callback example and
zero-write-count negative oracles. It is not a native tool or authorization helper.
Accept the second falsifier: previews carry completeRead:false and nested
truncation metadata; successful exit is not full-file acceptance. Add store-failure
propagation, but reject pretending a Map implements V8 serialization. No functions
are stored by the example; the host serialization boundary is explicitly not
certified. These concrete amendments precede implementation and the roadmap lock.

## A audit synthesis

Russell returned GO-WITH-FIXES (blockers=4): repeat F4 zero-write cases in the
explicit test map; remove duplicate full-read recovery ownership; spell out the
inventory script/path; define code-only from current callable contract. All four
are folded in 010/020. Hostile strings remain data fed to read-batch, not a fifth
fence or immunity claim. Main near-pass judgment accepts the corrected roadmap.
Baseline remote command completed 8/8 package/catalog tests, gate and inventory
with zero exits; new examples cannot run before their files exist. Local roadmap
validation passed numbering, balanced fences and all existing target paths.
