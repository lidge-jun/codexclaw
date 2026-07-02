# Design Read Example

Use this as a filled-in model for `SKILL.md` §2. Adapt the specifics to the brief; do not copy it as a default style.

## 1. Filled-In Design Read

```yaml
---
name: ops-review-console
colors:
  primary: "#1f4fd8"
  accent: "#21a67a"
  background: "#f7f8fb"
typography:
  heading: { fontFamily: "Geist", fontSize: "32px" }
  body: { fontFamily: "Inter", fontSize: "14px" }
---
```

Reading this as: a queue review tool for internal operations teams, with a precise, low-noise command-center language.

The reference is closer to Linear's density and keyboard-first posture than to a SaaS landing page. The first screen should expose live workload, blocked items, and one primary review action without marketing composition.

Do's: compact tables, strong status hierarchy, visible empty/error/loading states, one restrained accent for action and focus.

Don'ts: oversized hero type, decorative cards, purple gradients, fake activity, hover-only controls, or hiding critical status behind tabs.

```
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 2
Product density profile: D5
Reasoning: repeated operational review needs dense scanning, fast keyboard use, and minimal motion.
```
