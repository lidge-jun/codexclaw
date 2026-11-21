# Diagram types — pick by the question

Read when choosing what to draw. Pick the type from the question the reader brings, not from
what looks rich. Composition, color and delivery stay in
[artifact composition](artifact-composition.md); chart truthfulness and print floors in
[visual design](visual-design.md).

## Rules for every figure (VIZ-FIGURE-01, DEFAULT)

- **One claim per figure.** The caption states that claim in one sentence. A figure that
  needs two captions is two figures.
- **Every edge is a verb, every number is a mark.**
  - An arrow carries what moves along it ("writes", "polls 30s", "approves"). An unlabeled
    arrow means nothing reached a decision.
  - A number in a figure gets a length, area or position. A figure is not a table of digits
    with decoration.
- **Density cap.**
  - About 9 nodes, 6 series or 12 bars per figure.
  - Above that, split into overview plus detail, or into small multiples.
  - Delete a node that always travels with another.
- **Color carries data.**
  - Neutrals for structure. One accent for the element that carries the claim.
  - Semantic hues only for real states, each also marked by shape or label.
  - No colored side bars on boxes (see [composition](artifact-composition.md#house-rules)).
- **Label directly.** Put a label on or beside its mark. Use a legend only when direct
  labels would collide.
- **Run the render check.** Run `scripts/look.mjs` on any figure whose geometry is computed.

## Catalog

| Type | Question it answers | Do not use when | Specific rule |
|---|---|---|---|
| Architecture | What are the parts and how does data move between them? | The reader asks about one request's order of events (use sequence) | Boxes are components the reader can name; edges carry the protocol or verb; group by trust or deployment boundary, not by color |
| Architecture delta | What changes between now and the proposal? | Nothing structural changes | Same layout both sides; mark added, removed and changed elements by shape or label, not color alone |
| Sequence | In what order do actors exchange messages for one case? | More than ~6 actors or several cases at once | Time runs down; every message is a verb phrase; show the failure path as its own figure |
| State | What states can this thing be in, and what moves it between them? | States are really steps in a single flow (use flow) | Every transition names its event; mark the start and terminal states; unreachable states are a finding, not a drawing |
| ER / data model | What entities exist and how are they related? | The question is about one query's path | Show only fields that matter to the claim; cardinality on every relation |
| Swimlane | Who does which step, and where are the handoffs? | One actor does everything | One lane per role; handoffs cross lanes and carry the artifact handed over |
| Flow | What steps lead to which outcome? | Steps loop back often (use state or cycle) | Decisions are questions with labeled branches; ≤9 steps per figure |
| Cycle | What repeats, and where does the loop restart? | The process ends | Mark the entry point and what each pass changes |
| Timeline | When did things happen, and how long were the gaps? | Exact dates matter more than spacing (use a table) | Time axis is linear and labeled; durations are spans, not dots |
| Gantt | What runs in parallel, what blocks what, when does it finish? | Fewer than 3 tasks | Dependencies are drawn; today is marked; the critical path is the accent |
| Tree / hierarchy | What contains what? | Items belong to several parents (use dependency graph) | Depth ≤3 per figure; siblings in a meaningful order |
| Org chart | Who reports to whom? | The reader asks how work flows (use swimlane) | Roles, not decoration; mark open roles by shape |
| Dependency graph | What breaks if this node changes? | The graph has more than ~20 nodes (cluster first) | Edge direction is "depends on"; cycles highlighted as a finding |
| Quadrant | How do items compare on two judgments? | Either axis is not a real measure or an explicit rubric | Axes name the measure and direction; quadrant names are optional; items are dots with labels |
| Matrix | Which combinations of two lists hold? | One list has a single item | Rows and columns ordered by meaning; marks or values, not colored cells alone |
| Heatmap | Where are the highs and lows across two dimensions? | Exact values are the point (use a table) | Sequential single-hue scale with a labeled key; diverging only around a meaningful zero |
| Funnel | Where do people drop out between stages? | Stages are not strictly sequential | Bars proportional to counts; the drop between stages is labeled as a number |
| Waterfall | How did a start value become an end value? | Components do not sum to the change | Start and end bars anchored at zero; each step labeled with its signed value |
| Small multiples | How does the same pattern differ across cases? | Cases do not share a scale | Same axes and scale in every panel; one panel highlights the claim |
| Before / after | What did this change do? | No measurement exists for both states | Identical framing and scale; the difference is drawn, not only described |
| Bar / line / dot chart | Ranking, trend or comparison of measured values | Only two numbers (put them in the sentence) | Bars start at zero; sorted unless order is meaningful; one accent series |

## Choosing between neighbors

| Situation | Use |
|---|---|
| "Show the system" | Architecture. Add a sequence only for a specific request. |
| "Explain the process" | Flow. Use swimlane when roles matter, state when the process loops back. |
| "Compare options" | A table first. Use small multiples or a quadrant only when the shape of the difference is the point. |
| "Show progress or plan" | Gantt with dependencies and today marked. A timeline when only dates matter. |
| "Show what changed" | Architecture delta or before/after, same framing on both sides. |
