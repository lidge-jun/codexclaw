# Content Surface Pipeline

Read this when the surface you are building is produced repeatedly by a chain
of people rather than authored once by a developer: campaign landing pages,
product detail pages, promotional sections, editorial blocks, seasonal
variants. The engineering question is not how to render one page. It is what
the tenth page costs, and who is blocked while it is made.

`asset-requirements.md` owns how an individual asset is produced and selected.
This file owns the chain the asset travels through, and where engineering can
shorten it.

## Map the handoff before assuming its shape

There is no canonical stage list. Who authors, who approves, who publishes,
and whether publishing needs engineering all vary by organisation, and the
variation is exactly what determines where the time goes. Draw the map for the
team you are working with rather than importing one.

What to record for each step: who does it, what they wait on, what they hand
over, and whether the next step can start without them.

The reflex fix is to give non-developers a better editor. That may be right.
It is also possible that layout composition is already solved and the queue
sits somewhere the editor never touches. Both happen; the point is to find out
rather than assume.

Stages worth examining, in no fixed order, and not all present everywhere:
layout composition, block data entry, preview of personalised output, handoff
into engineering, QA, and release. For each, ask what evidence you have that it
is or is not the constraint.

**FE-PIPELINE-STALL-01 (DEFAULT):** before designing an authoring tool for a
recurring content surface, identify the constraining step from recorded
evidence rather than assumption. Mechanism: trace one representative recent
instance end to end and record, per step, the wait time, the rework, and what
it waited on; state the sample you used. Failure: a tool ships against an
assumed bottleneck and lead time does not move. Exception: none — a team's
request for a specific tool is a hypothesis to check against this trace, not a
reason to skip it.

A single traced instance is a weak sample and should be reported as one. If the
trace and the team's belief disagree, that disagreement is the finding.

## Multiple render paths on one surface

Recurring surfaces accumulate render paths. A hand-written component per page,
a shared renderer fed by per-page data, a CMS-driven template, an experiment or
flag branch, a tenant override — several of these commonly coexist, because
the older ones still serve live traffic and removing them costs more than
keeping them.

Paths are indistinguishable in a browser and are edited in entirely different
places. A change applied to the wrong one either does nothing visible or
silently affects every other page sharing that renderer.

**FE-RENDER-PATH-01 (STRICT):** before changing a page on a multi-path surface,
identify the renderer and content source that actually serve the target route,
with evidence. Mechanism: resolve the route through the router, then inventory
what could serve it — per-page components, per-page data entries, CMS records,
config or flag branches, tenant or experiment overrides — and confirm which one
wins. Failure: a change lands on a page nobody was looking at, or a shared
renderer change ships believed to be page-local. Exception: none; when the
resolution is ambiguous, ask before editing.

**FE-RENDER-PATH-02 (DEFAULT):** state which path you changed when reporting.
Mechanism: name the renderer and content source in the change summary. Failure:
a reviewer cannot tell the blast radius of the change. Exception: a
single-path surface.

Where pages receive paid traffic, treat their routes as contracts. A rename
that looks like cleanup can detach live advertising from its landing page, and
nothing in the repository shows the breakage.

## Data-injected style and the token boundary

A data-driven renderer usually lets each page carry its own colours, and that
is the point: a campaign is allowed to look like itself. The consequence is
that values outside the design tokens enter through content rather than code,
so a token audit that only greps source will misjudge them.

Classify before acting. A per-page brand colour arriving through content is a
feature; the same value hard-coded in a shared component is a defect. See
`token-source-divergence.md` for the full classification.

What the boundary should hold: structure, spacing, type scale, and interaction
belong to the renderer; per-page identity belongs to the data. When page data
starts carrying layout, the template has stopped being a template.

## Preview fidelity

A preview that does not match production is worse than no preview, because it
moves the error later. Labelling the preview is necessary but not sufficient:
what matters is which production conditions it actually reproduces.

**FE-PREVIEW-FIDELITY-01 (DEFAULT):** establish and record what a content
preview shares with production and where it diverges, then verify one
representative case against a production-equivalent render. Mechanism: compare
renderer version, data source, personalisation inputs, auth or entitlement
state, and external assets; render the same route under both and read both
outputs. Failure: an approval is granted on a rendering the user will never
receive. Exception: none — when a production-equivalent render is unavailable,
report the divergences as `UNVERIFIED` rather than treating the preview as
proof.

Record the comparison rather than asserting it:

| Condition | Preview | Production | Same? |
|---|---|---|---|
| renderer version | | | |
| content source | | | |
| personalisation input | | | |
| auth / entitlement | | | |
| external assets | | | |

Follow `visual-verification.md` for the render observation itself; this file
only fixes what the comparison must cover.

## Per-block QA instead of per-page QA

Re-checking a whole page for every variant does not scale, and it is why QA
becomes the queue. Move the checks to the blocks: each block type gets its
invariants once — text fits at target widths, images have required dimensions
and alt text, links resolve, the responsive collapse holds — and a page is
checked by checking its blocks plus their composition.

This also converts QA into something an automated gate can run, which is the
version most likely to keep pace when production is weekly rather than
occasional.

## Release coupling

If publishing a content change requires a code deploy, the content team's lead
time is bounded by the release train no matter how good the editor is. That
coupling is an architecture decision rather than a tooling one, and where it
exists it can dominate every other improvement. Whether it is the largest
lever in a given pipeline is a question for the trace above, not an assumption.

When decoupling is not available, say so explicitly rather than promising a
lead-time improvement the pipeline cannot deliver.

## Handoff contract

Whatever the chain, the handoff into engineering should carry the same things
every time: which render path, which route, which blocks changed, the assets
with their intended dimensions, the preview evidence, and who approved it.

A handoff missing any of these becomes a conversation, and conversations are
the queue this file exists to shorten.
