# Frontend role boundaries

> **Role separation:** For design judgment — typography/color/layout direction, UX decision
> gates, product personalities, or vague visual briefs — load `dev-uiux-design` first. This
> skill implements the chosen direction; `dev-uiux-design` makes the design decisions.
> Implementation anti-slop tell detection and enforcement stays here (concrete rendered tells
> in UI); design-level concept/taste judgment lives in `dev-uiux-design`.

> **Role boundary (canonical — identical in `dev` and `dev-uiux-design`):**
> `dev` owns universal process, evidence, and safety rules. `dev-uiux-design` owns
> design intent, direction, and concept judgment. `dev-frontend` owns concrete frontend
> implementation and rendered tell enforcement. Anti-slop has three layers: `dev` =
> output/process hygiene (FAMILY-SLOP-01), `dev-uiux-design` = concept/taste judgment
> (is this direction generic or domain-wrong?), `dev-frontend` = rendered implementation
> tell detection and removal (FE-AI-TELL-01).
