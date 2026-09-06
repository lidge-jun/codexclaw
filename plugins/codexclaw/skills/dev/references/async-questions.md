# Async user questions

Use this when useful missing input arises during ongoing work. The current host's
tool schema and instructions decide availability and permitted use; model names
(Astra, Grok, Sol, etc.) do not substitute for checking the callable tool list.
Ask only when the answer changes the work and is not already available in context.

## Select the exposed tool

- When `request_user_input_async` is exposed and allowed, prefer it for a question
  during work. Leave it for the user to see without expecting a reply; continue
  authorized work. Use its actual namespace.
- If it is absent or rejected, inspect the available schema/policy and use an allowed
  plain-text note/question where permitted, without claiming a question card was sent.
  Do not switch optional mid-work questions to blocking `request_user_input`. Reserve
  that tool for its existing authorized workflow (such as Interview). Never invent an async tool,
  change feature flags, or retry a forbidden request through another channel.
- Blocking `request_user_input` has different fields and limits. Never copy its
  `header`, `id`, `question` or option-object payload into the async tool.

The observed async schema accepts `questions[]` with `title` and optional string
`options[]`. Check the live schema before copying this example:

```json
{"questions":[{"title":"Which export format should this report use?","options":["CSV (Recommended)","JSON"]}]}
```

Ask a concise, self-contained question naming the decision it changes. Put the
recommended option first when choices help; omit options for free text. Do not add
an Other choice or free-text placeholder when the UI already supplies free text.
Group only independent questions; a later question whose meaning depends on an
earlier answer must wait. Do not inherit the blocking tool's three-question limit.

## Send, continue, incorporate

1. Send once and treat immediate return as submitted/pending, not answered. A
   preselected option has not been submitted. Do not end the turn just because
   the tool returned, repeatedly resend the question, or invent an answer-poll tool.
2. Continue concrete work that does not depend on the answer: inspect inputs,
   calculate shared results, review existing code, or prepare common sections.
   Keep the affected decision and outstanding question in the existing work record
   when it must survive a turn or compaction; create no separate tracking system.
3. Do not schedule a wait, poll for a reply, or make progress depend on an optional
   answer. Continue independent work and follow any host-required reply opportunity
   before committing an optional choice; then use a stated, reasonable assumption
   within the authorized scope. A missing reply never blocks completion of optional
   work. Required input or approval remains a real dependency: silence and
   preselection are never consent; only the dependent action stays pending.
4. A later user message supplies the answer. Match it to the pending decision,
   update assumptions and affected work, and retain the original objective unless
   the user changes it. An ambiguous reply leaves the unresolved part pending.
   When no independent work remains and required input is missing, yield with the
   dependency clearly stated; report partial status rather than claiming completion.
5. Keep leaving useful new questions as new uncertainties arise during the work,
   even when earlier optional questions are unanswered. Do not repeat the same
   unresolved question, send reminders, or create questions just to demonstrate the tool.

For the export example, compute common report rows while format is pending. If
the user chooses JSON, serialize those rows as JSON. If an optional default was
already used, revise the affected artifact when feasible. A required publication
approval leaves publication pending regardless of time spent preparing the report.
Interview retains its existing blocking question flow; do not migrate it to async.

## Goal and Interview boundaries

Follow the actual host's question/approval rules and the current goal's authority.
Async delivery does not grant permission to interrupt an unattended workflow or
bypass a denied question. Subagents return question candidates to the main agent;
they do not question the user independently.

The persisted CodexClaw Interview currently captures synchronous `request_user_input`
question IDs and returned answers. Async submission and later messages are not
automatically captured by that path. See the [Interview owner](../../interview/SKILL.md)
before using questions as readiness evidence; never mark a pending async question as
answered, manufacture ledger events, or assume the exact-name synchronous goal guard
covers async variants. This reference is agent guidance, not new runtime enforcement.
