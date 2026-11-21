# Next.js Stack — Development Rules

Extends `stacks/react.md` — read React rules first. These are Next.js-specific additions.

---

## Visual Assets

Use Next image/media features when the surface needs concrete visuals:

- product/place/person/object pages need a real or generated subject image in the first viewport
- screenshots and workflow images should use `next/image` when practical
- public pages need metadata and Open Graph images
- generic gradient/mesh backgrounds do not replace required assets
- soft 3D assets must pass `soft-3d-asset-gates.md`

Check mobile framing; a hero asset that only works on desktop is not done.

## Verification

After substantial UI changes:

- build the app
- capture desktop and mobile screenshots
- verify text fitting, asset rendering, and first viewport hierarchy
- test loading/error/empty states
- verify RSC/client boundaries for interactive pieces

Report any unverified viewport or state explicitly.

## App Router (Default)

### File Conventions
```
app/
├── layout.tsx          # Root layout (fonts, providers, metadata)
├── page.tsx            # Home (/)
├── loading.tsx         # Suspense fallback for this route
├── error.tsx           # Error boundary ('use client')
├── not-found.tsx       # 404 page
├── api/
│   └── health/route.ts # API route handler
└── dashboard/
    ├── layout.tsx      # Nested layout
    └── page.tsx        # /dashboard
```

### Route Handlers
```tsx
// app/api/users/route.ts
export async function GET(request: Request) {
  const users = await db.users.findMany();
  return Response.json({ success: true, data: users });
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.users.create({ data: body });
  return Response.json({ success: true, data: user }, { status: 201 });
}
```

---

## Server Components (Default)

Everything is a Server Component unless marked `'use client'`.

### When to use `'use client'`
Only for:
- `useState`, `useReducer`, `useEffect`
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- Third-party client libraries (Framer Motion, etc.)

### Common Mistake: Unnecessary Client Components
```tsx
// ❌ BAD — entire page is client just for one button
'use client';
export default function Page() {
  return <div><h1>Title</h1><InteractiveButton /></div>;
}

// ✅ GOOD — only the interactive part is client
export default function Page() {
  return <div><h1>Title</h1><InteractiveButton /></div>;
}
// InteractiveButton.tsx
'use client';
export function InteractiveButton() { /* ... */ }
```

---

## Data Fetching

### Server-side (Preferred)
```tsx
// Direct database/API call in Server Components
async function ProductPage({ params }) {
  const product = await getProduct(params.id);
  return <ProductView product={product} />;
}
```

### Parallel Fetching
```tsx
async function Dashboard() {
  const [user, stats, activity] = await Promise.all([
    getUser(), getStats(), getActivity()
  ]);
  return <DashboardView user={user} stats={stats} activity={activity} />;
}
```

### Streaming with Suspense
```tsx
export default function Page() {
  return (
    <div>
      <Header /> {/* Renders immediately */}
      <Suspense fallback={<DataSkeleton />}>
        <HeavyDataSection /> {/* Streams in when ready */}
      </Suspense>
    </div>
  );
}
```

---

## Image Optimization

```tsx
import Image from 'next/image';

// Hero — above fold, load immediately
<Image src="/hero.jpg" alt="Hero" width={1200} height={600} priority />

// Responsive with fill
<div className="relative aspect-video">
  <Image src="/product.jpg" alt="Product" fill
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    className="object-cover" />
</div>
```

### next.config.js
```js
const nextConfig = {
  images: {
    remotePatterns: [{ hostname: 'cdn.example.com' }],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
};
```

---

## Metadata & SEO

```tsx
// app/layout.tsx
export const metadata = {
  title: { default: 'App', template: '%s | App' },
  description: 'Description',
  openGraph: { images: ['/og.jpg'] },
};

// Per-page
export const metadata = { title: 'Dashboard' };

// Dynamic
export async function generateMetadata({ params }) {
  const product = await getProduct(params.id);
  return { title: product.name, description: product.summary };
}
```

---

## Proxy / Middleware By Version

```tsx
// Next.js 16+: proxy.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Auth check, redirect, rewrite, etc.
  const token = request.cookies.get('token');
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = { matcher: ['/dashboard/:path*'] };
```

- Next.js 16+ calls this file convention **Proxy**. Use `proxy.ts` / `proxy.js` and export `proxy`.
- Next.js 15 and earlier use `middleware.ts` / `middleware.js` and export `middleware`.
- Prefer route handlers, redirects, and app-level auth checks unless request-bound proxy logic is required.
- Keep only one root proxy/middleware file; split route-specific logic into imported modules.

---

## Performance Checklist

- [ ] Server Components for all non-interactive content
- [ ] `priority` on above-fold images
- [ ] `sizes` on all responsive images
- [ ] Parallel data fetching (no waterfall)
- [ ] `Suspense` boundaries for heavy sections
- [ ] `optimizePackageImports` for icon libraries
- [ ] No barrel imports from large packages
- [ ] Client Components as small leaf nodes
