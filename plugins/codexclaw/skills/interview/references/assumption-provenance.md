## Assumption provenance (INTERVIEW-ASSUME-01)

An assumption the assistant inferred is not a requirement the user agreed to, and
the handoff to Plan keeps the two apart. In the plan file, write each assumption
as one line: an id (`A1`, `A2`, ...), its status in brackets, the assumption,
then its source, confidence and consequence if wrong.

    - A3 [proposed] Exports stay CSV only — source: src/export.ts:41; confidence: medium; if wrong: the XLSX writer and its tests join the scope

- `source` is a repository `path:line`, or for something the user said, the
  `eventId` of its `answer_recorded` event in the Q/A ledger
  (`<turnId>:<questionId>:answer_recorded`). A bare `questionId` is not enough
  because it can repeat across turns; an `eventId` starting with `no-turn:` has
  the same weakness, so re-ask rather than rely on it.
- `confidence` is `low`, `medium` or `high`. `if wrong` names what changes in
  scope, design or verification; an assumption is high-impact when that
  consequence changes any of them.
- Status is `proposed` (inferred, not yet asked), `open` (asked or deliberately
  deferred, still unresolved), `user_confirmed` or `user_rejected`. The last two
  require an answer reference: the answer's `eventId`, or under an active goal a
  decided goalplan decision id (below). Without one an entry stays `proposed` or
  `open`, whatever the conversation seemed to imply. A reply typed in chat has
  no `eventId`: confirm it through the next `request_user_input` round, or keep
  the entry `open` and quote the reply.
- The plan keeps three sections. `## OPEN ASSUMPTIONS` holds only `proposed` and
  `open` entries. `## CONFIRMED REQUIREMENTS` holds `user_confirmed` entries
  with their reference. `## ASSUMPTION DECISIONS` holds `user_rejected` entries
  with their reference, so the decision stays traceable without being carried as
  open.
- The Interview tracker (session state read by the readiness gate) may also hold
  assumptions, and `cxc freeze` copies every recorded one into the frozen
  manifest as open, adding the leading `- `. Where a tracker entry exists, its
  `text` repeats the plan line without that `- `, and only `proposed` or `open`
  entries belong there. Do not hand-edit session state; if a tracker entry
  cannot be moved after it is resolved, the plan line's status is authoritative.
- A plan written after Interview, under an active goal where Interview is
  suppressed, may put a decided goalplan decision id (`cxc loop decide`) in the
  `source` field, with the decision's answer quoting the user's reply.
- This rule shapes existing plan text and tracker entries. It adds no field or
  command, and older plans and trackers read as before.
