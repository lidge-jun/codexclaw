# Caching — Redis Patterns, CDN, Connection Pooling

Performance optimization through strategic caching at every layer.

---

## Redis Caching Patterns

| Pattern | Mechanism | Use When |
|---------|-----------|----------|
| **Cache-Aside** (Lazy) | App checks cache → DB on miss → populate | General-purpose default |
| **Write-Through** | Write to cache + DB simultaneously | Strong consistency needed |
| **Write-Behind** | Write to cache, async batch to DB | High write throughput |
| **Read-Through** | Cache auto-fills on miss (transparent) | Simplified app code |

### Cache-Aside (Default Pattern)
```typescript
async function getUser(id: string): Promise<User> {
  const cached = await redis.get(`user:${id}`)
  if (cached) return JSON.parse(cached)

  const user = await db.users.findById(id)
  if (!user) throw new NotFoundError("User not found")

  await redis.set(`user:${id}`, JSON.stringify(user), "EX", 3600) // 1h TTL
  return user
}
```

### Write-Through Pattern
```typescript
async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const user = await db.users.update(id, data)
  await redis.set(`user:${id}`, JSON.stringify(user), "EX", 3600)
  return user
}
```

---

## Cache Invalidation

| Strategy | How | Use When |
|----------|-----|----------|
| **TTL-based** | Set expiry matching data freshness | Default for most data |
| **Event-driven** | Invalidate on write via pub/sub | Real-time consistency needed |
| **Versioned keys** | `user:v2:{id}` — bump on schema change | Schema evolution |

### Stampede Prevention
When a popular key expires, many requests hit DB simultaneously:
```typescript
// Probabilistic early expiration
const ttl = await redis.ttl(key)
if (ttl < THRESHOLD && Math.random() < RECOMPUTE_PROBABILITY) {
  await refreshCache(key)
}
```

### Cache Key Design
```
Pattern: {entity}:{id}:{optional_variant}
Examples:
  user:123              → full user object
  user:123:profile      → profile subset
  users:list:page:1     → paginated list
  config:feature-flags  → application config
```

**Rules:**
- Use colon `:` as separator (Redis convention)
- Include version in key when serialization format changes
- Set TTL on every key — no immortal cache entries

---

## Multi-Level Cache Architecture

```
Request → L1 (in-memory, per-request: DataLoader)
        → L2 (Redis, cross-request, cross-instance)
        → L3 (CDN edge, static/semi-static content)
        → Origin (Database)
```

**Target:** ≥90% cache hit rate for read-heavy endpoints.

---

## CDN Caching Strategy

| Content Type | Cache-Control | CDN TTL |
|-------------|---------------|---------|
| Static assets (JS, CSS, images) | `public, max-age=31536000, immutable` | 1 year (fingerprinted filenames) |
| API responses (public, stable) | `public, max-age=60, stale-while-revalidate=300` | 1 min + 5 min stale |
| API responses (personalized) | `private, no-store` | No CDN caching |
| HTML pages (SSR) | `public, max-age=0, s-maxage=60` | 1 min at CDN, always revalidate at browser |

**Rules:**
- Use `Vary` header for content negotiation (e.g., `Vary: Accept-Encoding, Authorization`)
- Fingerprint static assets (hash in filename) for cache busting
- Never cache responses containing user-specific data at CDN layer

---

## Connection Pooling

| Resource | Library | Sizing Rule |
|----------|---------|-------------|
| PostgreSQL | `pg.Pool` | `pool_size = (2 × CPU_cores) + disk_spindles` |
| Redis | `ioredis` | Match max concurrent connections (10-50 per instance) |
| HTTP clients | `undici` | Keep-alive pools sized to downstream capacity |

**Rules:**
- Set `pool_timeout` to fail fast (5-10s) — don't queue indefinitely
- Set `pool_recycle` to prevent stale connections (300-600s)
- Monitor pool exhaustion as a critical alert

---

## DataLoader Pattern (N+1 Prevention)

```typescript
import DataLoader from "dataloader"

const userLoader = new DataLoader(async (ids: readonly string[]) => {
  const users = await db.users.findByIds([...ids])
  return ids.map(id => users.find(u => u.id === id) ?? null)
})

// Automatically batches within request scope
const posts = await db.posts.findAll({ limit: 20 })
await Promise.all(posts.map(async post => {
  post.author = await userLoader.load(post.authorId)  // 1 batched query
}))
```

**Rules:**
- Create a **new DataLoader per request** — never share across requests
- Use for GraphQL resolvers, REST list endpoints with nested relations
- Handles deduplication automatically (same ID requested twice = 1 DB lookup)
