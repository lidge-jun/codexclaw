## 1. Onboarding & First-Run Patterns

Design first-run experiences that deliver value immediately.

**Rules:**
- Enable action before profile completion. Let users DO something valuable first.
- Deliver core value within 60 seconds of first interaction.
- Collect only essential data on Day 1. Gather intent early (goal/use case) to personalize.
- Make every tutorial, walkthrough, and setup step skippable.
- Provide starter content, templates, or sample data so the first screen is never empty.

### Welcome Screen Anatomy
```
┌─────────────────────────────────┐
│  [Brand mark / illustration]    │
│                                 │
│  Headline (value proposition)   │
│  Subtext (1 line, what to do)   │
│                                 │
│  [Primary CTA: Start Action]    │
│  Skip / Later (text link)       │
└─────────────────────────────────┘
```

### Feature Discovery Patterns

| Pattern | When to Use | When to Avoid |
|---------|-------------|---------------|
| Contextual tooltip | First time a feature appears | Already-discovered features |
| Coach mark (spotlight) | Complex multi-step workflows | Simple, self-explanatory UI |
| Feature tour (multi-step) | Major new feature release | First-time onboarding (too heavy) |
| Empty-state-as-onboarding | Dashboard/list views with no data | Views that always have data |
| Progressive profile | Collecting user preferences over time | One-time setup flows |

### Permission Request Timing
Ask for permissions at the moment of need, not during onboarding. Explain why before asking: "To send you updates, we need notification access."

---

## 2. Empty State Design

Every major view MUST have a designed empty state. Never leave a screen blank or show a generic "No data" message.

### Three Types

| Type | When | Tone |
|------|------|------|
| Informational | Content absent, user hasn't acted yet | Neutral, guiding: "Add your first project to get started" |
| Action-oriented | Feature requires user input to populate | Encouraging, CTA-forward: "Create your first workspace" |
| Celebratory | All items completed/resolved | Positive reinforcement: "All caught up!" |

### Composition Template
```
┌─────────────────────────────────┐
│      [Illustration / Icon]      │
│     (contextual, not generic)   │
│                                 │
│   Headline (short, specific)    │
│   Subtext (1 line, optional)    │
│                                 │
│   [Primary CTA button]          │
│   Secondary link (optional)     │
└─────────────────────────────────┘
```

**Rules:**
- Tailor copy to the specific scenario: first-use vs empty-search vs completed-tasks each get different messages.
- Use direct language ("Your cart is empty") not vague ("Nothing here yet").
- Single prominent CTA. Never show multiple competing actions.
- Match visuals to design system (colors, fonts, spacing, illustration style).
- For search results: suggest alternatives ("Try adjusting filters or checking spelling").
- For first-use: provide starter templates or sample data to reduce uncertainty.
- Use ARIA live regions to notify assistive technology when content state changes.

---

## 3. Error State Taxonomy

Every error message follows: (1) what happened, (2) why, (3) what to do next.

| Pattern | When | Recovery | Severity |
|---------|------|----------|----------|
| Inline validation | Structured input (email, password) | Real-time feedback as user types | Preventative |
| Toast notification | Low-severity temporary errors | Brief 3-5s non-modal, optional retry | Ambient |
| Banner | System-wide warnings (maintenance, degraded) | Persistent, dismissible, with details link | Ambient |
| Full-page error | Critical system failure, content cannot load | Centered: Try Again + escape hatch | Interrupting |
| Empty-state error | No search results, empty filtered lists | Suggest alternatives or creation paths | Informational |
| Network failure | Lost connection | Enable offline mode where possible, auto-retry on reconnect | Interrupting |
| Timeout | Server response > 10–15s | Offer Cancel + Keep Waiting | Interrupting |
| Permission denied | User lacks role access | Offer Request Access or role upgrade info | Informational |
| 404 Not Found | URL does not exist | Branded page + search bar + top nav links. Never a dead end | Informational |
| Rate limiting | API limits exceeded | Banner with wait time + link to docs | Ambient |

**Rules:**
- Never use generic messages ("Invalid input"). Be specific ("Password must contain at least 8 characters").
- Never blame the user. "Enter a valid email address" not "You entered an invalid email."
- Every error needs one primary action (retry, fix, request access) and one optional escape hatch (home, support).
- For multi-step forms: surface errors at each step, not at final submission.
- Never rely on color alone for error indication. Pair red with icons AND text.
- Match error tone to product surface: playful for casual apps, professional for finance/health.
- Severity hierarchy: Preventative (inline) → Ambient (toast) → Interrupting (full-page). Use full-page ONLY for showstoppers.

---

## 4. Loading State Patterns

### Skeleton Loaders
- Match the skeleton to the real layout (same heights, widths, spacing).
- Shimmer direction: left-to-right, single wave, 1.5–2s duration.
- Animate with `background-position` on a gradient — not opacity flicker.
- Show skeleton for a minimum of 300ms to avoid flash.

### Decision Table

| Scenario | Pattern | Details |
|----------|---------|---------|
| Page initial load | Skeleton | Match layout, show immediately |
| Data refresh | Stale-while-revalidate | Show old data + subtle loading indicator |
| Action result | Optimistic update | Apply change immediately, revert on error |
| Long operation (> 3s) | Progress bar / percentage | Show estimated time if available |
| Background process | Toast / status badge | Non-blocking notification |
| Infinite scroll | Skeleton rows at bottom | 3–5 placeholder rows |

### Skeleton → Content Transition
Fade skeleton out, fade content in. Duration: 200ms. Never pop — the transition must feel continuous.

---

## 5. Progressive Disclosure

Show ONLY essential information first. Defer advanced/optional content behind explicit user action.

### Three Categories

| Category | Mechanism | Example |
|----------|-----------|---------|
| Step-by-step | Sequential multi-stage | Checkout: shipping → method → payment → confirm |
| Conditional | Hidden until explicitly requested | "Advanced Settings" toggle |
| Contextual | Content surfaced based on prior input | Show company fields only after selecting "Business" |

### UI Components for Disclosure

| Component | Use For |
|-----------|---------|
| Accordion | Structured information (FAQ, settings groups) |
| Tabs | Categorized content at the same level |
| Conditional form fields | Show/hide based on prior input |
| Tooltip / popover | Context help on hover/click |
| "Show more" link | Optional fields in forms |
| Lazy loading | Supplementary content on scroll |

**Rules:**
- Discoverability test: hidden features MUST be findable when needed. If users cannot discover advanced options, the pattern has failed.
- Do NOT use progressive disclosure when users need to compare information simultaneously.
- Do NOT hide critical safety information or destructive-action warnings.
- Save progress at each disclosure step. Users must be able to return without losing work.
- Default to simple. "Advanced Settings" collapsed by default.
- For forms: show only required fields initially. Optional fields appear via "Show more options."
- For dashboards: show summary KPIs first. Drill-down detail on click.
- For settings: group into Basic (visible) and Advanced (collapsed).

---

## 6. Error Page Taxonomy

| Page | Content | Tone |
|------|---------|------|
| **404** | Branded page + search bar + top nav + "popular pages" links | Friendly, helpful |
| **500** | Branded page + "We're working on it" + status page link + retry button | Reassuring, transparent |
| **Maintenance** | Branded page + estimated return time + status page link | Professional, time-bound |
| **Offline** | Service worker cached page + "You're offline" + cached content list | Informative, functional |

Rules:
- Every error page maintains site branding (logo, colors)
- Every error page has a path back (nav, home link, search)
- Never show stack traces or technical errors to end users
- 500 page: auto-retry with exponential backoff (2s, 4s, 8s) + manual retry button
- Offline page: cache in service worker during first successful visit
- Maintenance page: deploy as static HTML (doesn't depend on the broken server)

### Service Worker Offline Shell

```javascript
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline-v1').then(cache => cache.add('/offline.html'))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
  }
});
```
