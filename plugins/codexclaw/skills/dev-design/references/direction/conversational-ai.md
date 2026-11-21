# Conversational AI UX

Read this when designing or reviewing a turn-based AI surface: a chat, an
assistant panel, a guided reading, or any flow where the user sends something,
waits, and receives a generated response.

`ux-states.md` owns the general screen states — onboarding, empty, error,
loading, progressive disclosure. This file owns what a *turn* adds on top:
partial output, interruption, regeneration, and results the system cannot
fully stand behind.

## Scope and non-goals

In scope: the state model of one turn, what actions are available in each
state, how uncertainty is expressed, and Korean copy decisions specific to
generated output.

Out of scope: a product's voice, its domain vocabulary, and any rule specific
to one service. Those belong in that project's `DESIGN.md`. This file must
stay usable by a support assistant, a coding tool, and a fortune-reading app
alike.

## Turn state model

**UX-CONVERSATION-TURN-01 (STRICT):** every turn state must be distinguishable
on screen, and the actions available must match the state. Mechanism: name the
states before styling and map each to its permitted actions. Failure: a user
cannot tell whether output is finished, and presses send again on a response
still arriving. Exception: none for turn-based surfaces.

| State | What the user must be able to tell | Actions that belong here |
|---|---|---|
| composing | input is accepted, nothing sent yet | send, attach, clear |
| queued | the request left, generation has not started | cancel |
| streaming | output is arriving and is incomplete | stop |
| complete | output finished on its own | regenerate, copy, follow-up |
| stopped | the user interrupted; output is partial by choice | continue, regenerate, edit and resend |
| failed | the system could not finish | retry, edit and resend, escalate |

`stopped` and `failed` are different states and must look different. Rendering
a user-cancelled response as an error teaches the user that stopping breaks
something.

Never show a completion affordance while output is still streaming, and never
leave a stop control visible after the stream ends.

## Interrupted and partial responses

**UX-CONVERSATION-RECOVERY-01 (DEFAULT):** after an interruption or failure,
the user's input must survive and at least one forward action must be
available. Mechanism: keep the submitted text recoverable and offer retry,
regenerate, or edit-and-resend as the state allows. Failure: a failed turn
discards what the user typed and the conversation dead-ends. Exception: an
input the product is required not to retain, which must be stated in the UI.

Partial output is not automatically worthless. A response stopped halfway
through a list is often useful; deleting it on interrupt destroys work the
user chose to keep. Keep it, mark it partial, and offer continuation.

Do not silently retry on the user's behalf. A retry that happens without a
visible signal makes latency look like a hang.

## Regeneration and suggested follow-ups

Regeneration replaces or appends, and the choice is a product decision, not a
default. Replacing loses a response the user may have wanted; appending grows
the transcript. Whichever is chosen, the previous response must remain
reachable at least until the new one completes.

Suggested follow-ups earn their place only when they reduce work. Three
generic prompts under every response is decoration; a suggestion that matches
what the user is likely to ask next is a shortcut. Suggestions must be
dismissible and must never occupy the primary action slot.

## Uncertain, conditional, and high-stakes results

**UX-AI-UNCERTAINTY-01 (STRICT):** never present a generated result as more
certain than the system can support. Mechanism: state the basis, the
conditions, or the limits alongside the result; do not invent sources,
citations, or progress. Failure: a user acts on a confident-sounding answer the
system cannot stand behind. Exception: none.

Concretely, this bans four things:

- Fake progress. A determinate bar for an indeterminate wait is a lie about
  time.
- Fabricated attribution. A citation, source list, or tool-call trace that does
  not correspond to a real one.
- Confidence theatre. Percentage scores, star ratings, or "high confidence"
  labels that no measurement produced.
- Silent conditionals. A result that only holds under assumptions the user
  never saw.

For domains where the output is interpretive rather than factual — readings,
recommendations, forecasts, creative generation — the honest framing states
what the result is derived from. A product may have legal or editorial
requirements beyond that; those live in the project's own documents, not here.

## Korean copy decisions

`ux-writing-ko.md` owns general Korean UI copy. Two decisions are specific to
generated output.

State labels read better as what is happening than as what the system is:
"답변 생성 중" over "로딩 중", "중단됨" over "실패". The distinction between
`stopped` and `failed` must survive into the copy, since Korean UI often
collapses both into 오류.

Uncertainty in Korean carries through sentence endings, and overusing
추측형 endings makes every response sound evasive. Prefer naming the basis
("입력한 생년월일을 기준으로") over hedging the verb. Reserve hedged endings
for the specific claim that is uncertain rather than applying them to the whole
response.

## Accessibility and reduced-motion behaviour

Streaming text needs a live region, but a region that announces every token is
unusable. Announce on meaningful boundaries — sentence or block — and announce
state transitions once each.

A typing indicator is decorative motion. Under `prefers-reduced-motion` it
should become a static state label, not simply disappear; the user still needs
to know output is coming.

Stop, retry, and regenerate must be reachable by keyboard while the stream is
active. A control that only appears on hover is unreachable during the exact
moment it matters.

## Design-review checklist

- Are all six turn states distinguishable, and does each show only its actions?
- Do `stopped` and `failed` look and read differently?
- Does the user's input survive a failure?
- Is partial output kept rather than discarded on interrupt?
- Does any progress indicator correspond to real progress?
- Are citations, sources, or tool traces real?
- Do suggested follow-ups reduce work, or fill space?
- Does the stream announce on boundaries rather than per token?
- Are stop and retry keyboard-reachable mid-stream?
- Under reduced motion, does the user still know output is coming?
