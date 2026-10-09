# Refs lane verification

2026-10-09. Bounded leaf edits only; no git writes, agent spawn, goal/FSM commands,
package builds or edits outside the assigned references, lane-packet test and
requested evidence paths. The parent retains integration and full-gate ownership.

## Fresh targeted checks

```sh
node --test plugins/codexclaw/test/manifest-policy.test.mjs plugins/codexclaw/test/native-execution.test.mjs plugins/codexclaw/test/lane-packet.test.mjs
```

Exit 0: 67 tests, 67 passed, 0 failed, 0 cancelled, 0 skipped.

```sh
node --test --experimental-strip-types plugins/codexclaw/components/pabcd-state/test/attest-shape-hint.test.ts plugins/codexclaw/components/subagent-config/test/spawn-attach-hook.test.ts plugins/codexclaw/components/subagent-config/test/dispatch-card.test.ts
```

Exit 0: 110 tests, 110 passed, 0 failed, 0 cancelled, 0 skipped.
The additional dispatch-card suite verifies the parent's new card against this
lane's exact resolver-cell relocation.

## Source and structural checks

- All original rule IDs from the eleven assigned files remain present in the
  rewritten lane files. No ID was silently retired.
- All six original attest table rows are byte-for-byte unchanged.
- The exact seven-line resolver-cell.txt is present in a fenced js block beneath
  SessionStart dispatch card.
- Relative skill links resolve, including fragments. Lane-owned rule definitions
  have one defining file. ORCH-MANDATE-01 belongs to loop/SKILL.md; runtime links
  to its execution-invariants section. DISPATCH-SURFACE-01 belongs only to
  dispatch-surfaces.md. Wake/polling definitions moved to waiting.md.
- The ledger contains 469 pre-edit obligation/schema/example rows;
  destination fragments were checked against current headings.
- git diff --check on the scoped references and test exited 0.

The imported prompt-architecture checker reported other-router/catalog ceilings
and existing reader/frontend duplicate definitions while the parent was still
staging its baseline. This is not a repository-gate pass. Six referenced IDs use
machine owners or legacy definition formats the scanner does not recognize;
see obligations-refs.md for the parent's normalization decision. No runtime or
out-of-scope canonical-owner file was changed by this lane.

## UTF-8 byte sizes

| File | Before | After | Delta |
|---|---:|---:|---:|
| plugins/codexclaw/skills/pabcd/references/plan-output.md | 4115 | 3976 | -139 |
| plugins/codexclaw/skills/pabcd/references/implementation-units.md | 5328 | 3725 | -1603 |
| plugins/codexclaw/skills/pabcd/references/delegation.md | 28682 | 19829 | -8853 |
| plugins/codexclaw/skills/pabcd/references/dispatch-surfaces.md | 21040 | 14225 | -6815 |
| plugins/codexclaw/skills/pabcd/references/phase-control.md | 9178 | 9583 | 405 |
| plugins/codexclaw/skills/loop/references/durable-goalplan.md | 9359 | 9792 | 433 |
| plugins/codexclaw/skills/loop/references/runtime-lifecycle.md | 6137 | 4457 | -1680 |
| plugins/codexclaw/skills/loop/references/waiting.md | 7992 | 6893 | -1099 |
| plugins/codexclaw/skills/loop/references/lane-dispatch.md | 9524 | 9520 | -4 |
| plugins/codexclaw/skills/dev/references/stacked-prs.md | 28919 | 16337 | -12582 |
| plugins/codexclaw/test/lane-packet.test.mjs | 19986 | 19212 | -774 |
| Total | 150260 | 117549 | -32711 |

The total includes the ten instruction references and lane-packet.test.mjs.
Delegation remains 19829 B: above the 16 KiB advisory target,
below the 24 KiB report threshold. Its managed fallback contract was preserved
in full to avoid losing reconciliation and permission obligations.

## Test output

### MJS checks

```text
✔ legacy no-mode dispatch and bound defaults remain address-based (0.572792ms)
✔ pending records creation without inventing an address (0.968834ms)
✔ present malformed modes cannot fall back or be hidden by CLI options (0.755167ms)
✔ pending forbids any address property and dispatch forbids creation or provisional addresses (0.166416ms)
✔ pending requires creation and bound validates it whenever present (0.295583ms)
✔ creation timestamps use canonical UTC syntax and real calendar dates (0.103459ms)
✔ bound refuses provisional copies from either recorded location (0.085208ms)
✔ mixed packet sets retain their response shape and collision checks (0.555791ms)
✔ CLI parses ordered options, reports mode, and rejects ambiguous arguments (519.889416ms)
✔ a minimal non-looping packet is accepted and its defaults are explicit (0.122416ms)
✔ a dispatch packet carries no address, because creation has not returned one (0.059084ms)
✔ a dispatch packet that already claims an address is refused (0.044917ms)
✔ a bound packet missing its address is refused (0.042417ms)
✔ a recorded provisional id copied into threadId is refused (0.037334ms)
✔ a lane told to loop without an objective is told to invent a goal (0.04175ms)
✔ a looping lane without criteria decides its own completion (0.026583ms)
✔ a complete looping packet is accepted (0.024667ms)
✔ a merge target without the grant is not a grant (0.025208ms)
✔ a granted merge must name this lane's own branch (0.024042ms)
✔ a granted merge on its own branch resolves to an explicit target (0.191042ms)
✔ merge without push is refused: a lane that cannot push cannot land (0.053166ms)
✔ opening a pull request needs a pushed branch (0.033708ms)
✔ a provisional clientThreadId is refused as an address (0.027792ms)
✔ a host id outside the accepted charset is refused (0.020083ms)
✔ overlapping write scopes across two lanes are caught before dispatch (0.040625ms)
✔ an aliased path cannot hide an overlap (0.027375ms)
✔ two lanes claiming one branch are caught (0.030417ms)
✔ disjoint lanes pass as a set (0.024542ms)
✔ the CLI exits 1 on an invalid packet and 0 on a valid one (69.26025ms)
✔ lane-dispatch quotes the recorded bound wait_threads.targets.max (0.067792ms)
✔ lane-dispatch quotes the recorded bound wait_threads.timeoutMs.max (0.018458ms)
✔ lane-dispatch quotes the recorded bound worktree.retention.keepCount (0.015541ms)
✔ every recorded bound carries an evidence locator (0.045875ms)
✔ the subagent cap and its failure string are recorded together (0.031541ms)
✔ waiting.md links to the lane-dispatch host envelope (0.174583ms)
✔ delegation.md links to the lane-dispatch host envelope (0.117875ms)
✔ dispatch-surfaces routes its fan-out rule to the lane contract (0.071167ms)
✔ a missing artifact is NOT RUN, never a pass (0.231708ms)
✔ a drifted value is reported as drift, not silence (0.127833ms)
✔ skill SKILL.md frontmatter carries no forbidden fields (license/keywords) (2.539042ms)
✔ S3: implicit set is exactly {dev,+7}; other dev-* routers are on-demand (0.948ms)
✔ L3: PreToolUse goal-budget hook is registered in the plugin manifest (0.204333ms)
✔ MEMORY-WRITE-GATE-01: the memory-write hook is registered and pins both write surfaces (0.152584ms)
✔ S5: each role TOML is spawn-valid (name + description + default model + instructions) (0.303333ms)
✔ L18: search skill is a codex-native 3-tier on-demand hub with Korean guard (0.064292ms)
✔ selected router references resolve to real owner files (0.959584ms)
✔ native owner routes resolve from common entrypoints and peer projection (0.803166ms)
✔ discovery reports bounded candidate metadata and never invokes a match (0.871542ms)
✔ absent metadata is reported without a guessed fallback (0.575792ms)
✔ read batch uses the observed schema and preserves empty successful output (1.306166ms)
✔ independent calls are both started before either completes (0.487083ms)
✔ a rejected read preserves the other result without retry (0.507125ms)
✔ nonzero exit is not converted into success (0.483875ms)
✔ tool-level error is not converted into success (0.436333ms)
✔ running shell is not converted into success (0.384459ms)
✔ missing status is not converted into success (0.434ms)
✔ missing output is not converted into success (0.383709ms)
✔ null envelope is not converted into success (0.39925ms)
✔ preview and upstream truncation are preserved and never a full-read pass (0.417542ms)
✔ hostile command output remains data and cannot add tool calls (0.352542ms)
✔ store rejection propagates instead of emitting success (0.455916ms)
✔ cache misses and malformed envelopes require recollection (1.07175ms)
✔ cache hit in a later invocation stays an untrusted stale preview (0.81375ms)
✔ failed, incomplete or malformed prerequisites never invoke dependent write (2.250375ms)
✔ complete prerequisite invokes write once and retains its rejection (0.522334ms)
✔ successful dependent write returns its result once (0.486125ms)
✔ mutation controls detect lost read outcomes and bypassed prerequisites (2.177334ms)
ℹ tests 67
ℹ suites 0
ℹ pass 67
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 637.019958
```

### TypeScript checks

```text
✔ inline --attest without from/to names the real edge and a worked example (3.2895ms)
✔ --attest-file without from/to gets the hint on its own distinct wording (0.6775ms)
✔ an unresolvable session yields a status pointer instead of a fabricated phase (0.114625ms)
✔ malformed JSON keeps its own diagnosis and gets no shape example (0.501ms)
✔ renderAttestShapeHint is silent for the control verbs (0.056666ms)
✔ orchestrate help ships a copy-paste object for every gated edge (0.092791ms)
✔ an illegal edge names the legal routes instead of teaching a doomed attest (0.542209ms)
✔ a legal edge from the same phase still gets the worked example (0.529417ms)
✔ every gated Stop command carries the keys its edge actually requires (0.096584ms)
✔ the goal-idle block emits did, not evidence, and closes its backticks (0.324875ms)
✔ the arming directive points to the attestation owner on both platforms (0.102417ms)
✔ the pabcd attest table names every key its edge's gate requires (0.247542ms)
✔ the chat grammar rejects a from/to-less attest with the same guidance (0.212458ms)
✔ V1 card names the exact nested helper, the owner and dated aliases (1.069875ms)
✔ unresolved card points at the resolver instead of carrying it (0.382792ms)
✔ the resolver cell resolves the family and calls once (0.676125ms)
✔ delegation.md carries the resolver cell verbatim under the card's anchor (0.24375ms)
✔ alias catalog membership and full ID passthrough (0.470042ms)
✔ cards stay under the cap (0.323916ms)
perf smoke: unmatched "[" flood (131072 chars) normalized in 0.0ms
perf smoke: mid-line "~" flood (131074 chars) normalized in 0.0ms
perf smoke: repeated paren-in-title links (131081 chars) normalized in 0.0ms
perf smoke: repeated standalone broken-link lines (131085 chars) normalized in 15.7ms
✔ mention normalization: bare and plugin-prefixed known skills become canonical links (0.831708ms)
✔ mention normalization: unknown, boundary-extended, and mixed-case tokens stay verbatim (0.088458ms)
✔ mention normalization: complete links, inline code, and fenced code are protected (0.075666ms)
✔ mention normalization: an inline delimiter inside a fence body does not close the fence (0.057334ms)
✔ mention normalization: a close-run line with trailing text does not close the fence (0.047666ms)
✔ mention normalization: indented fences close on the same prefix; drift protects to EOM (0.047666ms)
✔ mention normalization: a block-quoted fence with an inline delimiter protects its body (0.042416ms)
✔ mention normalization: CRLF fences close so mentions after the fence still normalize (0.039833ms)
✔ mention normalization: an escaped backtick is not an inline-code opener (0.045708ms)
✔ mention normalization: broken known-skill links are atomically repaired (0.107416ms)
✔ mention normalization: canonical and alternate existing SKILL.md targets stay verbatim (0.6195ms)
✔ mention normalization: angle-bracket and titled destinations are not the standalone shape and stay verbatim (0.054125ms)
✔ mention normalization: a quoted-title link keeps its whole line protected (0.037917ms)
✔ mention normalization: a huge quoted-title link stays byte-identical, never nested-rewritten (0.032209ms)
✔ mention normalization: nested block-quote fences protect their body (0.033292ms)
✔ mention normalization: a literal quoted fence line inside a top-level fence does not close it (0.036417ms)
✔ mention normalization: deep container nesting still opens fence protection (0.025667ms)
✔ mention normalization: an escaped destination is not the standalone shape and stays verbatim (0.021208ms)
✔ mention normalization: a bare mention sharing a line with any link stays bare (0.018041ms)
✔ mention normalization: container-prefixed standalone link lines are handled (0.044166ms)
✔ mention normalization: adversarial floods stay linear-time (16.488541ms)
✔ mention normalization: messages over 256 KiB pass through untouched (0.054584ms)
✔ mention normalization: link-unsafe skill roots use the plugin-prefixed token (0.521708ms)
✔ mention normalization: plugin prefix is pinned to plugin.json name (0.189292ms)
✔ leaf guard text does not contain the literal recursion token name (0.039417ms)
✔ v2 leaf guard: subagent-issued spawn is denied without the token (0.488875ms)
✔ RECURSE_DENY_REASON does not contain the literal token name (0.120625ms)
✔ v2 leaf guard: subagent denial runs even when message is missing (0.0715ms)
✔ public recursion token cannot authorize a spawn from a subagent context (0.07525ms)
✔ root-minted recursion capability authorizes exactly one child spawn (32.261375ms)
✔ v2 root spawn: guard + configured model/effort injected on a non-full fork (14.432167ms)
✔ v2 model+effort routing: injected independently on fork_turns none/integer (28.09775ms)
✔ v2 full-history fork (omitted or all) skips model/effort but still guards (27.552959ms)
✔ independent field routing: caller model keeps configured effort injection and vice versa (28.594875ms)
✔ default-mode role with configured effort injects effort only (15.149084ms)
✔ v2 leaf guard: a bare marker cannot dedupe the trusted full guard (30.130875ms)
✔ root recursion request mints a capability and keeps coordinator scope constraints (16.010792ms)
✔ v2 mention normalization emits an allow envelope even when the guard is already present (15.2965ms)
✔ v2 mention normalization composes with a newly prepended leaf guard (15.473417ms)
✔ v1 mention normalization composes with guard, model routing, and effort (15.964834ms)
✔ v1 model routing: caller-picked model wins (15.898292ms)
✔ v1 model routing: default mode injects no model; guard still applies (31.458917ms)
✔ v1 model routing: explicit legacy reviewer header selects reviewer config (15.823375ms)
✔ v1 model routing: items are preserved while model is injected (16.102875ms)
✔ v1 full-history fork skips model/effort but still guards (16.296792ms)
✔ v1 spawns receive V1_SCOPE_BLOCK, not LEAF_GUARD_BLOCK (13.789667ms)
✔ v2 spawns still receive LEAF_GUARD_BLOCK (14.009417ms)
✔ v1 root coordinator receives V1_SCOPE_BLOCK_COORDINATOR and an opaque capability (14.36825ms)
✔ a bare leaf marker in user text cannot suppress the full guard (13.465917ms)
✔ promptOverride is injected between guard and task for configured role (15.039459ms)
✔ promptOverride is NOT injected when null (14.172666ms)
✔ promptOverride IS injected on full-history forks (message text, not a rejected field) (14.716375ms)
✔ promptOverride is injected on v2 spawns too (13.928834ms)
✔ v1 subagent-issued spawn is denied without the token (D1 parity) (0.149542ms)
✔ malformed, non-spawn, and missing message inputs are fail-open no-ops (0.167084ms)
✔ oversized spawn hook stdin is denied before JSON parsing (67.547792ms)
✔ inferRole: worker -> executor; review keywords -> reviewer; default explorer (0.110375ms)
✔ isV2SpawnInput and isFullHistoryFork classify spawn shapes (0.047958ms)
✔ mentionedFolders recognizes all supported mention shapes (0.310333ms)
✔ isSpawnToolName / isCollaborationToolName accept native V2 hook names (0.025875ms)
✔ collaboration hook name is treated as V2: inline + guard on a marker-less payload (16.135708ms)
✔ inlineSkillBodies: appends one block per recognized folder, dedupes repeats (0.186916ms)
✔ v1 spawn (no V2 markers) inlines the mentioned SKILL.md body (15.263458ms)
✔ v1 spawn without a skill mention is not given one (14.860125ms)
✔ inlineSkillBodies: unknown folders and mention-free messages are untouched (0.083ms)
✔ inlineSkillBodies: already-inlined folder is not duplicated (0.171791ms)
✔ inlineSkillBodies: atomic overflow appends nothing when bodies would exceed the cap (0.252459ms)
✔ inlineSkillBodies: an unclosed skill tag does not suppress the real attachment (0.08475ms)
✔ inlineSkillBodies: mentions inside an unclosed block still count; closed blocks dedupe (0.088541ms)
✔ inlineSkillBodies: oversized input passes through untouched (early guard) (0.027042ms)
✔ inlineSkillBodies: adversarial delimiter floods stay linear-time (scaling check) (1.525417ms)
✔ inlineSkillBodies: nested closed blocks hide their whole interior from scanning (0.048542ms)
✔ same-intent v1/v2 spawns produce surface-appropriate effective payloads (36.464584ms)
✔ v2 affordance: appended only when inlining attached nothing (27.480417ms)
✔ native V2 ciphertext survives routing and prompt overrides byte-for-byte (29.673792ms)
✔ native V2 ciphertext preserves explicit settings and full-history fork restrictions (29.921708ms)
✔ native V2 ciphertext cannot bypass the existing recursion denial (0.196708ms)
✔ valid Fernet frames stay byte-identical across padding forms and block counts (131.626958ms)
✔ malformed V2 ciphertext lookalikes keep the guard, affordance and configured prompt (206.549917ms)
✔ v1 items carrying a Fernet-shaped token stay on the normal attachment path (14.592ms)
✔ v1 spawns never get the affordance (upstream parses mentions there) (12.836292ms)
✔ v2 affordance: oversized message skips the affordance (size guard) (15.511042ms)
✔ skillAffordanceBlock names the skills dir and the mention forms (0.062958ms)
✔ concise dev metadata remains readable by the real leaf catalog (1.01225ms)
✔ concise entrypoint is delivered once without recursively inlining its refs (0.12625ms)
✔ BUG-R1: CLI source and dist drain large rewritten spawn JSON over a pipe (117.172625ms)
✔ architect role identity wins review words while explicit write/reviewer roles win markers (0.07425ms)
✔ architect hook routing preserves explicit overrides, full forks, and repeat application (200.7705ms)
✔ native architect keeps its own model and prompt without trusting message role metadata (77.682125ms)
✔ executor and legacy worker retain executor model and effort on fresh v1/v2 spawns (53.179333ms)
✔ explicit executor and reviewer roles take precedence over message keywords (0.024708ms)
ℹ tests 110
ℹ suites 0
ℹ pass 110
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1621.579166
```
