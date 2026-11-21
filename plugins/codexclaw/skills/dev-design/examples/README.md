# Examples

## Minimal Operational Review Surface

Use this as the smallest acceptable artifact when no product domain has been provided yet.

```yaml
surface: internal operations tool
locale: global
density: D4 productivity
visual_direction: quiet precision, neutral base, one blue accent
required_states: loading, empty, error, success
verification: render in browser at mobile and desktop widths before delivery
```

```tsx
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const states = [
  { label: "Loading", text: "Show a skeleton shaped like the final content.", icon: Loader2 },
  { label: "Empty", text: "Offer one clear creation action and starter context.", icon: AlertCircle },
  { label: "Success", text: "Confirm completion and expose the next reversible action.", icon: CheckCircle2 },
];

export function ReviewSurface() {
  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground">
      <section className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-[1fr_360px]">
        <header className="rounded-card border border-border bg-surface p-6">
          <p className="text-sm font-medium text-accent">Queue health</p>
          <h1 className="mt-3 max-w-[16ch] text-balance text-4xl font-semibold tracking-normal">
            Review work before it ships.
          </h1>
          <p className="mt-4 max-w-[58ch] text-balance text-sm leading-6 text-muted">
            The first screen is a working surface: state coverage, containment, responsive layout, and accessible controls.
          </p>
          <button className="mt-8 min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground">
            Open active queue
          </button>
        </header>

        <div className="grid gap-3">
          {states.map((state) => {
            const Icon = state.icon;
            return (
              <article key={state.label} className="rounded-card border border-border bg-surface p-4">
                <Icon aria-hidden="true" className="mb-3 text-accent" size={20} />
                <h2 className="text-base font-semibold">{state.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{state.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
```

Why it passes:
- It builds the actual tool surface first, not a landing hero.
- It uses one accent, restrained radius, real state coverage, and Lucide icons.
- It has explicit width containment and a mobile-to-desktop grid transform.
- It leaves asset-heavy decisions out until a real domain requires them.
