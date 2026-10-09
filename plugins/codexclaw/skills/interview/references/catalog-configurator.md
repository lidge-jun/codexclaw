## Sub-modes (INTERVIEW-CATALOG-01)

Pick by the user's knowledge level:

- **Clarification** (default) — the user already knows roughly what they want; questions
  structure goals, constraints, success criteria.
- **Catalog Discovery** — the user names a vague domain but no features ("사주 앱 만들고
  싶어", "뭘 만들지 모르겠어"); present the option ontology from
  `$cxc-pabcd` [catalog-discovery.yaml](../../pabcd/references/catalog-discovery.yaml). See below.
- **Configurator** — compile the selections into a spec (PRD sections, MVP cut, risk
  register, PABCD plan seed).

Heuristic: concrete feature/goal -> Clarification; vague domain, no tech specifics ->
Catalog Discovery; explicit user request -> honor it.

## Catalog Discovery — design/UX LEADS (CATALOG-DESIGN-FIRST-01)

The user cannot choose from options they have never seen (strong form of INTERVIEW-TEACH-01).
Present the option ontology in [catalog-discovery.yaml](../../pabcd/references/catalog-discovery.yaml) (under `$cxc-pabcd`).

**Hard barrier:** iterate `axis_order` by ascending `stage`; do NOT present a stage until
every `required` entry of all earlier stages is answered. Stage 1 is design (6 dials: mood,
lightness, density, shape, typography, motion), all `required: true` — MUST be answered
before any Stage 2 (domain) or Stage 3 (feature/data/security/ops/cost) question appears.

- *Design methodology* — Product-Personality Selection first (from dev-uiux-design §1): for
  each design dial show `question_options` (labels + trade-offs) anchored on familiar
  products, then ask. Refine via Korean Request Translation, Reference Discovery, Design Read.
- *Deriving backend questions* — two paths populate Stage 3: **structural** (chosen Stage-2
  domain `implies[]` + Stage-3 `derived_from`, resolved transitively) and **keyword** (scan
  user's initial free-text against Stage-3 `auto_activate_rules`). Confirm high-impact
  activations.
- The catalog is a DATA STRUCTURE — do not invent entries not in it.

**Configurator**: once selections are complete, compile them (with resolved `implies[]`
chains) into: PRD sections, an MVP cut ordered by `cost_class`, a risk register of every
`risk_class: high` entry, and a PABCD plan seed carrying the work class + loop archetype.

## Option-set quality (INTERVIEW-OPTION-01)

When presenting options during Interview, generate against typicality bias: the 2-3 options
a model volunteers are usually one attractor family. Deliberately include at least one
atypical (low-probability) approach. Offer `A · B · BOTH (parallel spike, select by
evidence)` instead of forcing one pick. A `BOTH` answer becomes an explore-and-select
work-phase (loop-engineering §11.4).
