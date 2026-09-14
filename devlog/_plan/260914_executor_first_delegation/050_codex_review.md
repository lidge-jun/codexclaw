# 050 — PR 177 ciphertext classification review

Loop: satisfy-spec, triggered by the user's request to fix consequential PR Codex
feedback. Memory artifact: this unit and its verification receipt. Success is the
verified outcome below; an unavailable review/runtime is reported as unresolved,
never a pass. Main reclaims implementation only after the configured two-attempt
dispatch path fails with reconciled evidence. A new worker handoff needs a P
amendment. Ask the user only for a scope change or an irreversible action beyond the
already authorized PR/fork/local patch; no upstream merge is authorized.

## Objective and class

Close the consequential Codex finding on PR 177, keep the executor/architect
policy intact, obtain a completed review on the corrected head, and retain that
validated patch in the local source, fork and installed plugin. C4 care applies
because the predicate controls whether child task guards are attached.

## Repository evidence and failure

Baseline: public head `a0163227e75ab06861c07721e8382aa5924f26a6`, identical tree to
the retained private local head `2a1e3b7e0680157296354d871bd7ce71fb508221`.
Codex comment `4007056665` at `spawn-attach-hook.ts:851` correctly identifies
that `gAAAAx` bypasses task guard and prompt-override attachment. A direct hook
probe reproduced unchanged message and a false ciphertext-preservation notice.
The previous unit/e2e ciphertext fixtures are not valid envelopes.

## Threat model and constraints

Asset: child task instructions and native encrypted-task integrity. Entrypoint:
PreToolUse V2 spawn message. The caller can provide arbitrary plaintext; the hook
cannot decrypt or authenticate backend ciphertext. Prefix resemblance alone
must not remove plaintext guards. Conversely, rewriting real ciphertext breaks
native spawn decryption. Recognize envelope structure only; never claim HMAC
authentication. D1 recursion denial, explicit routing and fork restrictions keep
their existing ordering. No provider, dependency, credential or gate changes.

## Architect consultation and main decisions

Architect `01a0a0b7-cc7b-7be1-88b2-2aece0d3171c`, managed dispatch
`pr177-envelope-design`, supplied ENV-01 through ENV-07. Main dispositions:

- ENV-01: amend: colocate a private pure predicate beside the V2 shape helper;
  test observable hook behavior rather than exporting solely for tests.
- ENV-02: amend: accept canonical padded and wholly unpadded base64url. Reject
  bad alphabet, partial/excess padding, impossible encoded lengths and nonzero
  unused pad bits with a decode/re-encode check. This is structural recognition,
  not authentication; HMAC cannot distinguish encodings of identical bytes.
- ENV-03: accept: decoded version 0x80, minimum 73 bytes and
  `(length - 57) % 16 === 0`. Drop the timestamp-dependent `gAAAA` prefix test.
  No timestamp/TTL or MAC validation.
- ENV-04: accept: malformed input follows existing plaintext attachment and
  emits no ciphertext notice. V1 stays on its existing attachment path.
- ENV-05/07: amend: real public Fernet vector plus synthetic block/padding
  variants and malformed inputs, exercised through the public hook. Preserve
  explicit settings, full-history restrictions and recursion denial assertions.
- ENV-06: accept: rebuild and commit the distributed hook.

Primary sources: [Fernet specification](https://github.com/fernet/spec/blob/master/Spec.md)
and [public generation vector](https://raw.githubusercontent.com/fernet/spec/master/generate.json).
No live task token or key belongs in committed fixtures.

## Scope and ownership

Executor: `components/subagent-config/src/spawn-attach-hook.ts`, its existing unit
test, and `test/hook-e2e.test.mjs` under `plugins/codexclaw/`. Main: consultation,
independent review, this record, matching search-skill wording, generated dist,
test inventory badges, integration, publication and installation evidence. Matching
stale ciphertext/affordance paragraphs in `structure/10_subagent_skill_routing.md`
are synchronized with the existing INDEX behavior description; no routing change.

Two existing V2 transport-parity fixtures omit `agent_type`; the new checkout's
`delegation-review` path enters the skill text and triggers legacy keyword-based
role inference. Baseline focused run was 118/120 passing. Make those fixtures
explicitly explorer like their V1 counterparts; retain all routing assertions.
Changing production inference is outside this repair and remains a known quirk.

## Interfaces and behavior

Before: any prefix-shaped `gAAAA...` token bypasses plaintext attachment.
After: only canonically encoded Fernet-shaped frames use byte preservation;
short/malformed text receives the ordinary guard, affordance and configured
prompt override. Existing behavior for actual ciphertext remains byte-identical.
Search skill wording must describe the plaintext affordance only on plaintext
V2, and explicitly state encrypted-message attachment is unavailable.

## Executable steps and budget

1. Obtain same-architect reflection on this concrete plan and independent A audit.
2. Delegate bounded hook/test changes; main corrects the matching search paragraph.
3. Inspect diff, rebuild shipped JavaScript, run negative/positive regression and
   full tests, update measured inventory and run repository gate.
4. Push correction to the existing PR branch, reply to the finding, request a
   fresh Codex review, and inspect latest-head findings and CI. Repeat only for
   consequential remaining defects, updating this unit when design changes.
5. Apply reviewed delta atop preserved local history, fast-forward fork dev,
   install from local source, compare bytes and preserved configuration, and
   close work/goal only with the evidence captured.

No user token/time ceiling was set. Commands and probes use bounded background
handles. Waiting for a running review is not a failed attempt.

## Verification and acceptance

Malformed cases: short prefix, old invalid fixtures, wrong version, undersized
frame, empty/non-block ciphertext, invalid alphabet/whitespace/padding/pad bits.
Each V2 malformed case must retain guard and override and lack omission notice.
Valid cases: real reference token, padded/unpadded forms, several ciphertext block
counts, timestamp bytes that do not encode the old prefix, exact settings/fork
behavior, recursion denial, and V1 nonclassification. E2e must use rebuilt dist.
Repeat a bounded actual native encrypted V2 spawn against isolated updated plugin
bytes; require actual child/follow-up results and the hook's ciphertext-preservation
notice. If a diagnostic exposes envelope metadata, retain only lengths/padding,
never raw live tokens. The canonical padding cases have independent unit evidence;
do not infer the backend's padding variant from child success. Prior runtime proof
is historical and does not alone validate the stricter classifier.

Done requires: regression and repository gate pass, completed latest-head Codex
review with no unaddressed consequential finding, passing hosted CI, and local
source/fork/installed equality with role settings preserved. No upstream merge.

## Review and remaining uncertainty

Same-handle architect reflection was ALIGNED on plan SHA-256
`0d0e68a3d0ea33911f6dcf937787971eecd298655b250835da979bb76e35f9bc`.
Main resolves its G1 evidence gap above: actual hook notice plus child results are
required; emitter padding is not claimed without a separate shape observation.
Independent A reviewer `01a0a0c1-efce-7c13-a6bb-d5424701cac4` returned PASS without
findings on plan SHA-256 `a1da4dcda5fca75c5f7a6a0047eb9d8565b917e7b0d4c59a09a0c08218d1ce33`.
Backend format support
is limited to the observed Fernet envelope; recognition cannot prove authenticity.
The main agent owns all final decisions and integration.
