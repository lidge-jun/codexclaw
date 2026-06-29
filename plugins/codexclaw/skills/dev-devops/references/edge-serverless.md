# Edge & Serverless — Edge Computing Patterns

Last reviewed: 2026-06-16
Applies to: Cloudflare Workers, Vercel Edge Functions, AWS Lambda@Edge
When to read: Edge/serverless deployment tasks
Canonical owner: dev-devops

---

## §1 Edge Request Shaping

### What Belongs at the Edge

| ✅ Edge-appropriate | ❌ Keep at origin |
|--------------------|-------------------|
| Auth token validation (JWT verify) | Auth token issuance (login flow) |
| Rate limiting / throttling | Complex business logic |
| Geo-routing / A-B testing | Database writes |
| Response caching / transformation | Transactions |
| Bot detection / WAF rules | Long-running processes |
| Request header enrichment | ML inference (unless edge-optimized) |
| Static asset serving | Stateful sessions |

### Decision Tree

```
Request arrives at edge →
├── Static asset? → Serve from CDN cache
├── Auth check needed?
│   ├── JWT verify (stateless) → Edge
│   └── Session lookup (stateful) → Origin
├── Rate limit? → Edge (distributed counter)
├── Geo-specific routing? → Edge
└── Business logic → Origin
```

---

## §2 Global API Front Door

### Architecture

```
User → Edge PoP (nearest) → Auth/rate-limit/cache → Origin region
         │
         ├── Cache HIT → respond immediately
         ├── Auth FAIL → 401 at edge (no origin load)
         └── PASS → forward to origin with enriched headers
```

### Request Enrichment Headers

| Header | Source | Purpose |
|--------|--------|---------|
| `X-Country` | Edge geo-IP | Geo-routing, compliance |
| `X-Device-Type` | User-Agent parsing | Responsive content |
| `X-Request-ID` | Edge-generated UUID | Distributed tracing |
| `X-Edge-PoP` | Edge location | Debugging latency |
| `CF-Connecting-IP` | Cloudflare | Real client IP |

---

## §3 Auth at Edge

### JWT Verification Pattern

```typescript
// Cloudflare Workers — JWT verify at edge
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const payload = await verifyJWT(token, env.JWT_PUBLIC_KEY);

      // Enrich headers for origin
      const enriched = new Request(request, {
        headers: new Headers({
          ...Object.fromEntries(request.headers),
          "X-User-ID": payload.sub,
          "X-User-Role": payload.role,
        }),
      });

      return fetch(enriched);
    } catch {
      return new Response("Invalid token", { status: 401 });
    }
  },
};
```

### Rules

| Rule | Detail |
|------|--------|
| Stateless only | JWT verify, API key check — no session DB calls |
| Fail closed | Invalid/missing token → 401 at edge |
| Clock skew | Allow 30s tolerance for `exp` / `nbf` claims |
| Key rotation | Support multiple public keys (JWKS) |

---

## §4 Edge AI Triage

### When to Run AI at Edge

| ✅ Edge AI | ❌ Origin AI |
|-----------|-------------|
| Classification (<10ms, small model) | LLM inference (large models) |
| Content moderation (text/image) | Training / fine-tuning |
| Semantic cache lookup | RAG with vector DB |
| Request priority scoring | Complex chain-of-thought |

### Pattern: Semantic Cache at Edge

```
Request → Edge →
  1. Hash prompt → check KV cache
  2. Cache HIT → return cached response (sub-5ms)
  3. Cache MISS → forward to origin LLM → cache response → return
```

---

## §5 Platform Patterns

### Cloudflare Workers

| Feature | Detail |
|---------|--------|
| Runtime | V8 isolates (not Node.js) |
| Limits | 10ms CPU (free), 30s (paid); 128MB memory |
| Storage | KV (global), R2 (objects), D1 (SQLite), Durable Objects (state) |
| Deploy | `wrangler deploy` |

### Vercel Edge Functions

| Feature | Detail |
|---------|--------|
| Runtime | Edge Runtime (Web APIs subset) |
| Framework | Next.js `export const runtime = "edge"` |
| Limits | 30s execution, 4MB response |
| Use case | Middleware, API routes, ISR |

### AWS Lambda@Edge / CloudFront Functions

| Type | Limit | Use Case |
|------|-------|----------|
| CloudFront Functions | 1ms, 10KB | Header manipulation, redirects |
| Lambda@Edge | 30s (origin), 5s (viewer) | Auth, dynamic routing |

---

## §6 Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Database calls from edge | High latency, connection pool exhaustion | Cache at edge, query at origin |
| Heavy computation at edge | CPU timeout (10ms limit on CF free) | Offload to origin or queue |
| Stateful sessions at edge | Inconsistent state across PoPs | Stateless JWT or edge KV |
| No fallback for edge failures | Users see 500 from edge crash | Fail-open to origin |
| Hardcoded edge config | Can't update without redeploy | Edge KV / feature flags |
