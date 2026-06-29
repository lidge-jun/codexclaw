# Astro Stack

Last reviewed: 2026-06-16
Applies to: Astro 5.x
When to read: Building or modifying Astro projects
Canonical owner: dev-frontend

Read `core/aesthetics.md` + `core/anti-slop.md` first.

## 1. Islands Architecture

Astro ships zero JavaScript by default. Interactive components are explicit **islands** that hydrate independently:

```astro
---
// Static by default — no JS shipped
import Header from '../components/Header.astro';
import Counter from '../components/Counter.tsx';  // React island
import Newsletter from '../components/Newsletter.svelte';  // Svelte island
---

<Header />

<!-- Interactive islands — each hydrates independently -->
<Counter client:load />
<Newsletter client:visible />
```

| Directive | When JS Loads | Use Case |
|-----------|--------------|----------|
| `client:load` | Immediately on page load | Above-fold interactive elements (nav, search, auth) |
| `client:idle` | After page is idle (`requestIdleCallback`) | Below-fold interactive elements, analytics |
| `client:visible` | When element enters viewport | Comments, newsletter forms, lazy widgets |
| `client:media` | When media query matches | Mobile-only interactive elements |
| `client:only="react"` | Immediately, no SSR | Components that cannot SSR (canvas, WebGL, browser APIs) |
| _(none)_ | Never — static HTML only | Content display, navigation, layout |

Rules:
- Default to no `client:*` directive — components are static HTML unless interaction is required.
- Use `client:visible` for anything below the fold — saves initial bundle size.
- Use `client:only` only when SSR genuinely fails (browser APIs, canvas) — it sends no HTML.
- Every `client:*` directive adds a framework runtime to the page bundle — minimize island count.
- Astro components (`.astro`) are always static — they cannot be islands. Use React/Svelte/Vue for interactive islands.

## 2. Multi-Framework Shell

Astro uniquely supports mixing frameworks in one project:

| Framework | File Extension | Island Support | When to Use |
|-----------|---------------|---------------|-------------|
| React | `.tsx` / `.jsx` | Yes | Existing React component library, complex interactive UI |
| Svelte | `.svelte` | Yes | Lightweight interactivity, transitions, form handling |
| Vue | `.vue` | Yes | Existing Vue codebase, directive-heavy UI |
| Solid | `.tsx` (with Solid plugin) | Yes | Performance-critical islands, fine-grained reactivity |
| Preact | `.tsx` (with Preact plugin) | Yes | Smaller React-compatible islands |

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [
    react({ include: ['**/react/*'] }),
    svelte(),
  ],
});
```

Rules:
- Keep to **one primary framework** per project — multi-framework is for migration or specialized components, not default practice.
- Organize framework-specific components in separate directories (`components/react/`, `components/svelte/`).
- Shared state between different framework islands requires a framework-agnostic store (nanostores, signals).
- Do not pass complex objects as island props — islands serialize props through HTML attributes. Use primitive types or simple objects.

```typescript
// Shared state across frameworks with nanostores
// src/stores/cart.ts
import { atom, map } from 'nanostores';

export const cartItems = map<Record<string, CartItem>>({});
export const cartCount = atom(0);
```

## 3. Content Collections

Type-safe content management for Markdown, MDX, YAML, and JSON:

```typescript
// src/content.config.ts (Astro 5 — file-based content config)
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map(post => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<article>
  <h1>{post.data.title}</h1>
  <time>{post.data.pubDate.toLocaleDateString()}</time>
  <Content />
</article>
```

Rules:
- Define schemas for all content collections — untyped content defeats the purpose.
- Use `z.coerce.date()` for dates — Markdown frontmatter dates are strings.
- Filter drafts in `getCollection()` calls, not in templates.
- Use Astro 5's `content.config.ts` (replaces `config.ts` in `src/content/`).

## 4. Rendering Modes: SSG / SSR / Hybrid

| Mode | Config | When to Use |
|------|--------|-------------|
| **SSG** (default) | `output: 'static'` | Blog, docs, marketing — content changes infrequently |
| **SSR** | `output: 'server'` | Auth-gated, personalized, real-time — every request is dynamic |
| **Hybrid** | `output: 'static'` + per-page `export const prerender = false` | Mostly static site with a few dynamic pages |

```astro
---
// src/pages/dashboard.astro — dynamic page in hybrid mode
export const prerender = false;

const user = await getUser(Astro.cookies.get('session'));
if (!user) return Astro.redirect('/login');
---

<h1>Welcome, {user.name}</h1>
```

Rules:
- Default to SSG — ship HTML, not a server.
- Use hybrid mode before full SSR — mark only dynamic pages with `prerender = false`.
- SSR requires a deployment adapter (`@astrojs/node`, `@astrojs/vercel`, `@astrojs/cloudflare`).
- Do not use SSR for content that can be statically generated — it adds latency and server cost.
- Cache SSR responses at the CDN edge when content is user-independent.

### Deployment Adapters

| Adapter | Target | Install |
|---------|--------|---------|
| `@astrojs/node` | Node.js server (Docker, VPS) | `npx astro add node` |
| `@astrojs/vercel` | Vercel (edge/serverless) | `npx astro add vercel` |
| `@astrojs/cloudflare` | Cloudflare Workers/Pages | `npx astro add cloudflare` |
| `@astrojs/netlify` | Netlify Functions | `npx astro add netlify` |
| _(none)_ | Static output (default) | No adapter needed for SSG |

### Performance Characteristics

| Metric | Astro 5 | Next.js 16 | SvelteKit 2 |
|--------|---------|------------|-------------|
| Default JS shipped | 0 KB (static pages) | Framework runtime (~80 KB) | ~2 KB (compiled) |
| Hydration model | Islands (opt-in per component) | Full page (RSC partial) | Full page |
| Multi-framework | Yes (React + Svelte + Vue) | React only | Svelte only |
| Content layer | Built-in Collections + Zod | MDX (plugin) | mdsvex (plugin) |
| Build tool | Vite | Turbopack/Webpack | Vite |
| Best for | Content-heavy, docs, marketing | Full-stack apps | Interactive apps |

## 5. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| `client:load` on everything | Full React/Vue/Svelte runtime shipped on every page | Use `client:visible` or `client:idle`; most components need no JS |
| Multiple frameworks without justification | Bundle bloat — each framework adds its runtime | One primary framework; multi-framework only for migration |
| Complex objects as island props | Serialization errors, silent data loss | Use primitives or simple objects; fetch data inside the island |
| SSR for static content | Unnecessary server cost and latency | Use SSG or hybrid mode (§4) |
| Skipping content collection schemas | Untyped frontmatter, runtime errors on missing fields | Always define Zod schemas for collections (§3) |

## Pre-flight

- [ ] Default rendering is SSG unless dynamic pages are explicitly marked
- [ ] Islands use appropriate `client:*` directives — no unnecessary `client:load`
- [ ] Single primary framework chosen; multi-framework justified if present
- [ ] Content collections have Zod schemas defined
- [ ] Island prop types are serialization-safe (no functions, classes, or complex objects)
- [ ] Shared cross-framework state uses nanostores or equivalent
