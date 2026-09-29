# 020 — wp3: Interview assumption provenance (#275)

Interview hands Plan two different things under one heading today: requirements the user agreed to and assumptions the assistant inferred. This phase adds one guidance rule, INTERVIEW-ASSUME-01, so each assumption carries its source, confidence, consequence if wrong and a status, and only unresolved ones travel as OPEN ASSUMPTIONS. Confirmed and rejected entries keep an answer reference from the existing Q/A ledger. No code, schema, hook or command changes.

## Phase contract

- Work phase: `wp3`, issue [#275](https://github.com/lidge-jun/codexclaw/issues/275). Class C1 per file, C2 as a set (three skill documents, guidance only). Design decisions D17-D21 in `002_architect_consultation.md`.
- Why guidance satisfies the four acceptance checks: no production CLI writes `tracker.assumptions` (the only writer, `pabcd-state/src/triage.ts:95-107`, has no caller outside tests), so the plan file's `## OPEN ASSUMPTIONS` section is the working record; the plan directory is hash-covered at freeze (`pabcd-state/src/freeze.ts:9-11`, `freeze-cli.ts:29,93`); freeze copies tracker text verbatim (`freeze-cli.ts:97`), so a status written into the line survives into the manifest; the answer ledger already mints `eventId` = `<turnId>:<questionId>:answer_recorded` (`interview-ledger.ts:35-37`).
- Out of scope: the structured `Assumption` schema revision the issue mentions as future work (`interview.ts:48-57` and its reader at `:197-213` stay unchanged), `hook.ts:1935` runtime text (still correct: low/medium contradictions still become OPEN ASSUMPTIONS).

## File change map

Anchors checked against `659de59b`.

### 1. MODIFY `plugins/codexclaw/skills/interview/SKILL.md`

(a) `## Contract`, line 28:

```diff
-- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview.
+- Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview,
+  with the provenance fields of INTERVIEW-ASSUME-01.
```

(b) NEW section between `## Classify the loop before Plan` (ends `:44`) and `## Question quality (INTERVIEW-Q-01)` (`:46`):

```markdown
## Assumption provenance (INTERVIEW-ASSUME-01)

An assumption the assistant inferred is not a requirement the user agreed to, and
the handoff to Plan keeps the two apart. Write each assumption in the plan file as
one line:

    - A3 [proposed] Exports stay CSV only — source: src/export.ts:41; confidence: medium; if wrong: the XLSX writer and its tests join the scope

- `source` is a repository `path:line`, or for something the user said, the
  `eventId` of its `answer_recorded` event in the Q/A ledger
  (`<turnId>:<questionId>:answer_recorded`). A bare `questionId` is not enough;
  it can repeat across turns.
- `confidence` is `low`, `medium` or `high`. `if wrong` names what changes in
  scope, design or verification.
- Status is `proposed` (inferred, not yet asked), `open` (asked or deliberately
  deferred, still unresolved), `user_confirmed` or `user_rejected`. The last two
  require the answer's `eventId`; without one an entry stays `proposed` or
  `open`, whatever the conversation seemed to imply. Under an active goal, where
  Interview is suppressed, a decided goalplan decision id is the answer reference.
  A reply typed in chat has no `eventId`: confirm it through the next
  `request_user_input` round, or keep the entry `open` and quote the reply.
- Only `proposed` and `open` entries go under `## OPEN ASSUMPTIONS`. If a tracker
  holds assumptions, the same rule applies there, because freeze carries every
  recorded tracker assumption into the manifest as open; do not hand-edit session
  state to create one. Move a `user_confirmed` entry into the plan's requirements with
  its reference. Move a `user_rejected` entry under `## ASSUMPTION DECISIONS` with
  its reference, so the decision stays traceable without being carried as open.
- Where a tracker assumption exists, its `text` repeats the same line without its
  leading `- ` (freeze prepends it), so the frozen manifest keeps the provenance.
- This rule shapes existing plan text and tracker entries. It adds no field or
  command, and older plans and trackers read as before.
```

(c) `## Question quality (INTERVIEW-Q-01)`, insert after the bullet ending `:53` (`so a larger independent batch has to be split across calls.`):

```diff
+- High-impact `proposed` assumptions (INTERVIEW-ASSUME-01) are candidates for the
+  next relevant question round. Low-impact ones may stay `proposed`; closeout lists them.
```

(d) `## Rescan + readiness (INTERVIEW-SCAN-01)`, lines 170-172:

```diff
 - Treat readiness as a coverage claim on top of that: each dimension has concrete knowns, no
   unresolved unknown changes scope, and every contradiction has exited into an answer or a
-  recorded assumption. Summarize the remaining OPEN ASSUMPTIONS before claiming I -> P readiness.
+  recorded assumption. Before claiming I -> P readiness, summarize in two groups: confirmed
+  requirements with their answer references, then the remaining `proposed` and `open`
+  assumptions with their `if wrong` consequences (INTERVIEW-ASSUME-01).
```

(e) `## Closeout fork (INTERVIEW-FORK-01)`, lines 177-178:

```diff
-`request_user_input` is hard-denied — see Goal firewall), after a scan round do not drift forward
-silently. Present a numbered choice and let the user pick: `1. Proceed to Plan` ·
+`request_user_input` is hard-denied — see Goal firewall), after a scan round do not drift forward
+silently. Show the two-group summary from INTERVIEW-SCAN-01, then present a numbered choice and
+let the user pick: `1. Proceed to Plan` ·
```

### 2. MODIFY `plugins/codexclaw/skills/interview/references/mind-dispatch.md`, lines 47-49

```diff
 completed independent scan. Main triages high contradictions into questions and
-low/medium into OPEN ASSUMPTIONS, and records only actual authorized scan/tracker
-work. The existing answer-provenance/readiness and completion gates remain intact.
+low/medium into OPEN ASSUMPTIONS, which start as `proposed` under
+INTERVIEW-ASSUME-01, and records only actual authorized scan/tracker work. The
+existing answer-provenance/readiness and completion gates remain intact.
```

The file name stays; `minds.test.ts:37` checks that it exists.

### 3. MODIFY `plugins/codexclaw/skills/loop/references/durable-goalplan.md`, line 40

```diff
-- Carry Interview OPEN ASSUMPTIONS into Plan/Audit instead of dropping them.
+- Carry Interview OPEN ASSUMPTIONS into Plan/Audit instead of dropping them, with
+  their source, confidence, consequence if wrong and status. Only `proposed` and
+  `open` entries count as open; confirmed and rejected entries keep their answer
+  reference (INTERVIEW-ASSUME-01 in cxc-interview).
```

SoT sync (SOT-SYNC-01): the Interview skill is the canonical owner of these rules (`pabcd/references/phase-plan.md:34`); `structure/INDEX.md:125,311` names the files only, so no structure doc changes.

## Acceptance mapping (#275)

| Check | Where it is met |
|---|---|
| 1. inference cannot be presented as user-confirmed without an answer reference (rule-level; see enforcement naming) | 1(b) status bullet: confirmed/rejected require the answer `eventId` |
| 2. rejected inference kept as decision trace, not carried as open | 1(b) last-but-one bullet: `## ASSUMPTION DECISIONS`, never in tracker assumptions |
| 3. closeout distinguishes confirmed requirements from open inferred assumptions | 1(d), 1(e) |
| 4. existing trackers and freeze manifests remain readable | no code change; 1(b) last bullet |

## Verification (PLAN-VERIFIER-REAL-01)

| Command | Exit on `659de59b` | Reads the change target |
|---|---|---|
| `rg -n 'INTERVIEW-ASSUME-01' plugins/codexclaw/skills` | 1 before (no match), expected 0 after with hits in the three files | yes: the three paths are under the searched directory |
| `node plugins/codexclaw/scripts/gate.mjs` | 0 | partly: skill frontmatter/inventory checks read `skills/interview/SKILL.md`; it does not read rule prose |
| `npm test` (after `npm ci`) | 0 | no test reads these prose lines (explorer search of the rule strings found hits only in the SKILL.md and `hook.ts:1923,1932`); run as a regression guard |
| prose meaning | — | this command does not observe this change; human review in A (reviewer) and C (initiative verifier) |

No conditional code path is added, so C-ACTIVATION-GROUNDING-01 does not apply; C-READER-01 applies to the new section (a fresh reader checks that the example line and the four statuses are understandable without this doc).

## Enforcement naming (PLAN-BYPASS-NAMED-01)

Tier E7 (agent-followed guidance). Executing surface: the main session writing the plan. Known bypass: an agent can still label an entry `user_confirmed` without a real `eventId`; nothing checks the reference against the ledger. Residual risk: acceptance check 1 holds by discipline plus reviewability (the reference is visible and checkable in the hashed plan), not by a gate. Wording: guidance, never "cannot"; the acceptance table above reads as "the rule requires". Final enforcement layer: none.
