# Motion Choreography — Animation Engineering Guide

Rules for meaningful, performant animation. One well-choreographed moment > 10 scattered effects.

---

## Domain Gates

Motion intensity must match the product surface:

| Surface | Default |
| --- | --- |
| Finance, gov, B2B, auth, payment, security | 1-3: feedback-only, low anxiety |
| Dashboards, admin, ops, developer tools | 1-4: state transition only |
| Consumer apps, education, community | 3-6: guided feedback and progress |
| Landing, campaign, editorial | 5-8: expressive but still performant |
| Games / interactive art | domain-specific |

Avoid cinematic page loads for repeated-work tools. Motion should clarify state, not slow the task.

## MOTION_INTENSITY Levels

| Level | Rules                                                                                                           |
| :---: | --------------------------------------------------------------------------------------------------------------- |
|  1-3  | No automatic animations. CSS `:hover` and `:active` only.                                                       |
|  4-7  | Enumerate transition properties, usually `transform`, `opacity`, `background-color`, `border-color`, `box-shadow`. `animation-delay` cascades. |
| 8-10  | Complex scroll-triggered reveals. Framer Motion hooks. NEVER `window.addEventListener('scroll')`.               |

---

Never use `transition-all` as a default in Tailwind or CSS all-property transitions. Enumerate the properties so layout, width, height, and color changes do not animate accidentally.

## CSS-Only Patterns (Level 4-7)

### Staggered Reveal
```css
.reveal-item {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeUp 0.6s ease forwards;
  animation-delay: calc(var(--index) * 100ms);
}

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### Hover Lift
```css
.card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -15px rgba(0,0,0,0.1);
}
```

### Active Press
```css
.button:active {
  transform: translateY(1px) scale(0.98);
}
```

---

## Framer Motion Patterns (Level 6+)

### Spring Physics (mandatory for interactive elements)
```tsx
// Premium, weighty feel — no linear easing
const spring = { type: "spring", stiffness: 100, damping: 20 };
```

### Stagger Children
```tsx
// Parent + Children MUST be in the same Client Component tree
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};
```

### Layout Animations
```tsx
// Smooth re-ordering / resizing
<motion.div layout layoutId="unique-id" />
```

### Magnetic Hover (Level 8+)
**CRITICAL**: NEVER use `useState` for magnetic hover. Use EXCLUSIVELY:
```tsx
const x = useMotionValue(0);
const y = useMotionValue(0);
// No re-renders. Pure motion outside React cycle.
```

---

## Scroll-Driven (Level 8+)

### Scroll Progress
```tsx
const { scrollYProgress } = useScroll();
const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
```

### View Transitions API
```tsx
document.startViewTransition(() => {
  // DOM update
});
```

**NEVER mix GSAP/Three.js with Framer Motion in the same component tree.**
Use Framer for UI. Use GSAP/Three.js ONLY for isolated full-page scrolltelling or canvas backgrounds, wrapped in strict `useEffect` cleanup blocks.

---

## Performance Rules

1. Animate ONLY `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
2. `will-change: transform` sparingly. Remove after animation completes.
3. Grain/noise filters → fixed `pointer-events-none` pseudo-elements only.
4. Perpetual/infinite animations MUST be `React.memo`'d and isolated in microscopic Client Components.
5. Wrap dynamic lists in `<AnimatePresence>`.
6. 60fps target. Profile on mobile before shipping.

---

## Creative Arsenal (Inspiration)

Pick from these for signature moments — don't use all of them:

| Category       | Concepts                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Navigation** | Mac OS Dock magnification, Magnetic buttons, Gooey menu, Dynamic Island                          |
| **Cards**      | Parallax tilt (3D on mouse), Spotlight border, Holographic foil hover                            |
| **Scroll**     | Sticky scroll stack, Horizontal scroll hijack, Zoom parallax, SVG path drawing                   |
| **Text**       | Kinetic marquee, Text mask reveal (type as window to video), Text scramble (Matrix decode)       |
| **Micro**      | Particle explosion button, Directional hover fill, Ripple click effect, Mesh gradient background |

---

## `prefers-reduced-motion` (Mandatory)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Always include. No exceptions.
