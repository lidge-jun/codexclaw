# Iterative Design — LLM Limitations & Multi-Round Process

How to overcome the statistical convergence problem inherent in LLM-generated design.
Adapted from b1rdmania/claude-brand-skills enhanced frontend-design skill.

---

## The Convergence Problem

Every design choice gravitates toward the statistical center of training data — the average of "good design."
This produces competent, polished work that looks like EVERY other competent, polished work.

### Why This Happens
- **No visual feedback loop** — Writing HTML/CSS as text tokens. No perception of beauty or distinction.
- **Optimized for coherence** — Training rewards consistency, polish, completeness. Deliberately rule-breaking design fights the model's weights.
- **Can't feel tension** — Great experimental design creates productive discomfort. The model can't calibrate this.
- **No taste** — Taste is judgment not reducible to rules. "This feels corporate" or "this needs to breathe" are embodied calls that can only be approximated with heuristics — and heuristics converge to the mean.
- **Can generate divergence, can't evaluate it** — Can produce 10 structurally different layouts but genuinely cannot tell which one is "surprising AND right."

### What This Means
User direction and references are NOT optional — they ARE the design.
The model is the hand, not the eye. User taste, references, and gut reactions push output somewhere it would never go alone.

---

## The Multi-Round Process

**CRITICAL**: Never treat this as single-pass (brief → design → done). That guarantees convergence.

For runnable implementation mechanics, read `prototype-variants.md`: this file owns
creative divergence; that file owns `?variant=` routing, switchers, verification, and
prototype cleanup after a winner is selected.

### Round 1: Diverge
Generate 3-5 **structurally different** variants. Not color/font swaps — fundamentally different:
- Different spatial logic
- Different rhythm and composition
- Different dominant aesthetic
- Each variant names which design convention it's "fighting"

### Round 2: Kill
User makes **binary decisions**: Alive or Dead.
**NO blending** — blending is averaging. Averaging is convergence.

Precedence: this Alive/Dead process governs POST-CODE iteration rounds. The
pre-code concept stage is owned by `dev-uiux-design` UX-CONCEPT-GEN-01, whose
mockup SYNTHESIS rule applies there and does not conflict with this ban.

### Round 3: Mutate
Within the surviving direction, introduce deliberate "breaks":
- Named violations of design convention
- Specific rules being intentionally broken
- User picks which breaks work

### Round 4+: Repeat
Each cycle moves further from center.
User selections are the creative act. The model is the generator.

---

## User Guidance

The user should:
1. **Provide reference images/sites** — especially from OUTSIDE the same industry. A restaurant menu layout applied to fintech is more distinctive than "experimental fintech."
2. **Name what they hate** — "I hate card grids" eliminates a convergence attractor better than "make it interesting."
3. **Expect multiple rounds** — First output is most average. Each "kill this, keep that, push further" cycle moves away from center.
4. **Kill boldly** — If a variant feels safe or familiar, it IS. Unfamiliarity feels wrong before it feels right.

---

## Upgrade Techniques Library

High-impact techniques for replacing generic patterns:

### Typography
- **Variable font animation** — Interpolate weight/width on scroll or hover
- **Outlined-to-fill transitions** — Text starts as stroke, fills with color on entry
- **Text mask reveals** — Large type as a window to video/animation behind it

### Layout
- **Broken grid / asymmetry** — Overlapping, bleeding off-screen, offset with calculated randomness
- **Whitespace maximization** — Aggressive negative space forcing focus on single element
- **Parallax card stacks** — Sections stick and physically stack during scroll
- **Split-screen scroll** — Two halves sliding in opposite directions

### Surfaces
- **True glassmorphism** — see `liquid-glass.md` (recipes + gates); the tell of fake glass is `backdrop-blur` with no edge refraction
- **Spotlight borders** — Card borders illuminating dynamically under cursor
- **Grain/noise overlays** — Fixed `pointer-events-none` overlay breaking digital flatness
- **Colored tinted shadows** — Shadows carrying background hue, not generic black
