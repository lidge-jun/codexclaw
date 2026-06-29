# Svelte 5 / SvelteKit 2 Stack

Last reviewed: 2026-06-16
Applies to: Svelte 5.x (Runes), SvelteKit 2.x
When to read: Building or modifying Svelte/SvelteKit projects
Canonical owner: dev-frontend

Read `core/aesthetics.md` + `core/anti-slop.md` first.

## 1. Runes (Svelte 5)

Svelte 5 replaces stores and reactive declarations with **Runes** — explicit reactivity primitives:

| Rune | Replaces | Purpose |
|------|----------|---------|
| `$state()` | `let x = 0` (reactive) | Declare reactive state |
| `$derived()` | `$: doubled = x * 2` | Computed value from state |
| `$effect()` | `$: { sideEffect() }` | Side effect on state change |
| `$props()` | `export let prop` | Declare component props |
| `$bindable()` | `export let value` (two-way) | Two-way bindable prop |
| `$inspect()` | `console.log` debugging | Dev-only reactive logging (stripped in prod) |

```svelte
<script>
  let { title, onSave } = $props();
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`count changed to ${count}`);
    return () => { /* cleanup */ };
  });
</script>

<button onclick={() => count++}>
  {title}: {count} (doubled: {doubled})
</button>
```

Rules:
- Use `$state()` for all mutable reactive values — bare `let` is no longer reactive in Svelte 5.
- Prefer `$derived()` over `$effect()` for computed values — effects are for side effects only.
- `$effect()` runs after DOM update. Use `$effect.pre()` only when you need pre-DOM-update timing.
- Use `$inspect()` for debugging, never `console.log` inside `$effect()` — `$inspect` is stripped from production builds.
- Destructure `$props()` at the top of `<script>` — do not access `$$props` or `$$restProps` (Svelte 4 patterns).

## 2. SvelteKit 2

### Routing & Data Loading

```
src/routes/
├── +layout.svelte          # root layout
├── +layout.server.ts       # root layout data (runs on server)
├── +page.svelte            # home page
├── +page.server.ts         # home page data (runs on server)
├── blog/
│   ├── +page.svelte        # blog list
│   ├── +page.server.ts     # blog list data
│   └── [slug]/
│       ├── +page.svelte    # blog post
│       └── +page.server.ts # blog post data
└── api/
    └── posts/
        └── +server.ts      # API endpoint
```

| File | Runs On | Purpose |
|------|---------|---------|
| `+page.server.ts` → `load()` | Server only | Fetch data, access DB, read secrets |
| `+page.ts` → `load()` | Server + client | Universal data loading (no secrets) |
| `+page.svelte` | Client (hydrated) | Render UI with loaded data |
| `+server.ts` | Server only | API endpoints (GET, POST, PUT, DELETE) |
| `+layout.server.ts` | Server only | Shared layout data (auth, user session) |

### Form Actions

```typescript
// +page.server.ts
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData();
    const title = data.get('title');

    if (!title) {
      return fail(400, { title, missing: true });
    }

    await db.posts.create({ data: { title, author: locals.user.id } });
    redirect(303, '/blog');
  }
};
```

```svelte
<!-- +page.svelte -->
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="title" value={form?.title ?? ''} />
  {#if form?.missing}<p class="error">Title required</p>{/if}
  <button>Create</button>
</form>
```

Rules:
- Always use `+page.server.ts` for data that requires secrets, DB access, or auth checks.
- Use form actions for mutations — progressive enhancement works without JavaScript.
- Validate server-side in form actions — client validation is UX, not security.
- Use `redirect()` and `error()` from `@sveltejs/kit`, not manual response construction.
- Use `$app/stores` sparingly in Svelte 5 — prefer `$props()` data flow from `load()`.

### SvelteKit Adapters

| Adapter | Target | Install |
|---------|--------|---------|
| `@sveltejs/adapter-auto` | Auto-detect (Vercel, Netlify, Cloudflare) | Default — included in new projects |
| `@sveltejs/adapter-node` | Node.js server (Docker, VPS) | `npm i -D @sveltejs/adapter-node` |
| `@sveltejs/adapter-static` | Static site (GitHub Pages, S3) | `npm i -D @sveltejs/adapter-static` |
| `@sveltejs/adapter-vercel` | Vercel (edge/serverless) | `npm i -D @sveltejs/adapter-vercel` |
| `@sveltejs/adapter-cloudflare` | Cloudflare Workers/Pages | `npm i -D @sveltejs/adapter-cloudflare` |

### Performance Characteristics

| Metric | Svelte 5 | React 19 | Vue 3.5 |
|--------|----------|----------|---------|
| Bundle size (hello world) | ~2 KB | ~45 KB | ~30 KB |
| Reactivity model | Compile-time (runes) | Runtime (fiber + hooks) | Runtime (proxy) |
| Virtual DOM | No — direct DOM updates | Yes | Yes |
| SSR streaming | SvelteKit `+page.server.ts` | React Server Components | Nuxt `useAsyncData` |
| Built-in transitions | Yes (`svelte/transition`) | No (need library) | Yes (`<Transition>`) |
| Scoped CSS | Default (`<style>`) | No (need CSS modules/Tailwind) | Default (`<style scoped>`) |

## 3. Component Patterns

### Snippets (Svelte 5 — replaces slots)

```svelte
<!-- Parent -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}
  {#snippet footer()}
    <button>Action</button>
  {/snippet}
  <p>Default content</p>
</Card>

<!-- Card.svelte -->
<script>
  let { header, footer, children } = $props();
</script>

<div class="card">
  {#if header}{@render header()}{/if}
  {@render children()}
  {#if footer}{@render footer()}{/if}
</div>
```

### Transitions & Animations

```svelte
<script>
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  let items = $state([]);
</script>

{#each items as item (item.id)}
  <div
    animate:flip={{ duration: 300 }}
    in:fly={{ y: 20, duration: 200 }}
    out:fade={{ duration: 150 }}
  >
    {item.name}
  </div>
{/each}
```

Rules:
- Use Snippets instead of slots — slots are deprecated in Svelte 5.
- Use `{@render}` for snippet rendering, not `<svelte:component>`.
- Scoped `<style>` is default — use `:global()` only when intentionally escaping scope.
- Prefer CSS transitions for simple effects; use Svelte transitions for enter/exit/list animations.
- Always provide `(key)` in `{#each}` blocks for stable identity.

## 4. Migration from Svelte 4

| Svelte 4 | Svelte 5 | Migration |
|----------|----------|-----------|
| `export let prop` | `let { prop } = $props()` | Destructure from `$props()` |
| `$: derived = x * 2` | `let derived = $derived(x * 2)` | Wrap in `$derived()` |
| `$: { sideEffect() }` | `$effect(() => { sideEffect() })` | Wrap in `$effect()` |
| `<slot />` | `{@render children()}` | Replace slots with snippets |
| `<slot name="x" />` | `{@render x()}` | Named slots → named snippets |
| `$$props` / `$$restProps` | `let { ...rest } = $props()` | Destructure with rest |
| Writable stores | `$state()` in `.svelte.ts` | Move to Rune-based state |
| `createEventDispatcher()` | Callback props | Pass functions via `$props()` |

```bash
# Automated migration (partial — review output manually)
npx svelte-migrate svelte-5
```

Rules:
- Migrate one component at a time — Svelte 5 components can coexist with Svelte 4 in the same project.
- Test each migrated component individually before proceeding.
- Stores in `.js`/`.ts` files still work — migrate to `.svelte.ts` Rune-based state when touching the file.
- `createEventDispatcher` → callback props is the biggest behavioral change; verify all event consumers.

## 5. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `$effect()` for derived values | Unnecessary re-runs, stale value bugs | Use `$derived()` instead |
| Missing `(key)` in `{#each}` | Animation glitches, wrong element updates | Always provide a stable key |
| `$$props` in Svelte 5 | Deprecated, loses type safety | Destructure from `$props()` |
| Bare `let` expecting reactivity | Value does not update in template | Use `$state()` for reactive values |
| `on:click` syntax in Svelte 5 | Deprecated event directive | Use `onclick` attribute |

## Pre-flight

- [ ] All reactive state uses `$state()`, not bare `let`
- [ ] Computed values use `$derived()`, not `$effect()`
- [ ] Components use `$props()` destructuring, not `export let`
- [ ] `{#each}` blocks have stable keys
- [ ] Server-only data in `+page.server.ts`, not `+page.ts`
- [ ] Form actions validate server-side
- [ ] Slots migrated to Snippets (`{@render}`) in new/updated components
