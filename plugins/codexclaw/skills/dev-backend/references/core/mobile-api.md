# Mobile API Patterns

**Last reviewed**: 2026-06-16
**Applies to**: REST/GraphQL APIs serving mobile clients (iOS, Android, cross-platform)
**When to read**: Building or modifying APIs consumed by mobile apps, change-surface: mobile-native consumers
**Canonical owner**: `dev-backend` — API design and server-side patterns for mobile
**Non-goals**: Framework selection (→ `dev-frontend/references/stacks/mobile-native.md`), native UX (→ `dev-uiux-design/references/mobile-native-ux.md`), general API design (→ `api-design.md`)

---

## §1 Mobile BFF Pattern

A Backend-for-Frontend aggregates and shapes data for mobile-specific needs, avoiding over-fetching and N+1 screen loads.

### Decision table

| Approach | When | Tradeoff |
|----------|------|----------|
| **GraphQL BFF** | Mobile needs flexible field selection, multiple data sources per screen | Schema complexity, caching harder (POST by default) |
| **REST BFF** | Simple screens, few aggregations, team unfamiliar with GraphQL | Over-fetching if screens grow; multiple endpoints per screen |
| **tRPC BFF** | TypeScript fullstack, RN client, type safety priority | Tight coupling to TS; not usable from Swift/Kotlin native |
| **No BFF (direct API)** | Single client, CRUD-dominant, no aggregation needed | Acceptable for MVPs; refactor to BFF when screen complexity grows |

### BFF structure (Express 5.x + GraphQL)

```typescript
// bff/mobile/schema.ts
import { makeExecutableSchema } from "@graphql-tools/schema";

const typeDefs = `
  type HomeScreen {
    user: User!
    recentItems: [Item!]!
    notifications: NotificationBadge!
  }
  type Query {
    homeScreen: HomeScreen!
  }
`;

// Single query replaces 3 REST calls: GET /user, GET /items/recent, GET /notifications/count
const resolvers = {
  Query: {
    homeScreen: async (_: unknown, __: unknown, ctx: Context) => ({
      user: ctx.loaders.user.load(ctx.userId),
      recentItems: ctx.loaders.recentItems.load(ctx.userId),
      notifications: ctx.loaders.notificationBadge.load(ctx.userId),
    }),
  },
};
```

### Banned

| Banned | Fix |
|--------|-----|
| Mobile client calling 5+ endpoints per screen load | Aggregate behind BFF query; one request per screen |
| Returning desktop-sized payloads to mobile | BFF selects mobile-relevant fields only |
| BFF with business logic | BFF is an aggregation/shaping layer; business logic stays in domain services |

---

## §2 Push Notifications

### FCM + APNs architecture

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│  Client  │────>│  App Server  │────>│  FCM / APNs  │
│ (token)  │     │ (send API)   │     │  (delivery)  │
└─────────┘     └─────────────┘     └──────────────┘
```

### Token lifecycle

| Event | Action |
|-------|--------|
| App install / first launch | Register token with server; store `(userId, token, platform, createdAt)` |
| Token refresh (FCM callback) | Update server record; invalidate old token |
| User logout | Disassociate token from user (keep token for anonymous push if needed) |
| App uninstall | FCM returns `NotRegistered` → delete token from DB |
| Token age > 2 months with no activity | Prune from DB to avoid silent delivery failures |

### Token storage schema

```sql
CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
```

### Korean push notification rules

| Rule | Detail |
|------|--------|
| 야간 푸시 제한 | 21:00~08:00 KST 광고성 푸시 금지 (정보통신망법 제50조) |
| 수신 동의 | 광고성 푸시는 별도 opt-in 필수; 서비스 알림은 동의 불필요 |
| 발신자 표시 | 광고성 푸시에 `(광고)` 접두어 + 수신거부 방법 포함 |
| 야간 발송 처리 | 서버에서 KST 21:00 이후 광고 푸시를 큐에 보관, 08:00에 일괄 발송 |

```typescript
// Push scheduling with KST night restriction
function shouldDelayPush(type: "ad" | "service", nowKst: Date): boolean {
  if (type === "service") return false; // Service notifications exempt
  const hour = nowKst.getHours();
  return hour >= 21 || hour < 8; // 21:00-08:00 KST blocked for ads
}
```

---

## §3 Offline-First & Sync

### Strategy decision table

| Strategy | Consistency | Complexity | Best For |
|----------|------------|-----------|----------|
| **Last-Write-Wins (LWW)** | Eventual (last timestamp wins) | Low | Single-user data, settings, preferences |
| **CRDT (Conflict-free)** | Eventual (auto-merge) | High | Collaborative editing, shared lists |
| **Operational Transform** | Strong (server-ordered) | Very high | Real-time collaborative text editing |
| **Server-authoritative** | Strong (server always wins) | Medium | Financial data, inventory, anything requiring consistency |

### LWW sync pattern (recommended default)

```typescript
// Client-side sync queue
interface SyncQueueItem {
  id: string;
  entity: string;       // e.g. "task"
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: unknown;
  timestamp: number;     // client-side ISO timestamp
  retryCount: number;
}

// Sync on reconnect
async function flushSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  const sorted = queue.sort((a, b) => a.timestamp - b.timestamp);
  for (const item of sorted) {
    try {
      await api.sync(item);
      await localDb.removeSyncItem(item.id);
    } catch (err) {
      if (isConflict(err)) {
        // Server version wins; update local with server state
        const serverState = await api.get(item.entity, item.entityId);
        await localDb.upsert(item.entity, item.entityId, serverState);
        await localDb.removeSyncItem(item.id);
      } else {
        item.retryCount++;
        if (item.retryCount >= 5) await localDb.removeSyncItem(item.id);
      }
    }
  }
}
```

### Optimistic UI pattern

```
User action → Update local state immediately → Show success UI
                ↓
           Background sync to server
                ↓
        ┌── Success ──→ Done
        └── Failure ──→ Revert local state + show error toast
```

---

## §4 Mobile Auth

### Biometric authentication

| Platform | API | Storage |
|----------|-----|---------|
| iOS | `LAContext` (Face ID / Touch ID) | Keychain with `.biometryCurrentSet` access control |
| Android | `BiometricPrompt` (fingerprint / face) | Android Keystore with `setUserAuthenticationRequired(true)` |

### Token storage (MANDATORY)

| Platform | Where | Never |
|----------|-------|-------|
| iOS | Keychain Services (`kSecClassGenericPassword`) | `UserDefaults`, plain files, `NSCache` |
| Android | EncryptedSharedPreferences (Jetpack Security) or Android Keystore | `SharedPreferences`, plain files, SQLite |
| React Native | `expo-secure-store` (maps to Keychain/Keystore) | `AsyncStorage` (unencrypted) |

### Refresh token flow

```
┌─────────┐                    ┌─────────────┐
│  Client  │─── access token ──>│   API Server │
│          │<── 401 Expired ────│              │
│          │                    │              │
│          │─── refresh token ──>│              │
│          │<── new access +    │              │
│          │    new refresh ────│              │
└─────────┘                    └─────────────┘
```

| Token | TTL | Storage | Rotation |
|-------|-----|---------|----------|
| Access | 15 min | In-memory (preferred) or secure store | On every refresh |
| Refresh | 30 days | Secure store (Keychain/Keystore) | Rotate on use (one-time use) |

### Banned

| Banned | Fix |
|--------|-----|
| Tokens in `AsyncStorage` / `SharedPreferences` / `UserDefaults` | Use platform secure storage (Keychain, Keystore, expo-secure-store) |
| Refresh token without rotation | One-time-use refresh tokens; issue new pair on each refresh |
| Biometric without fallback | Always provide PIN/password fallback for biometric failure |

---

## §5 API Optimization

### Compression

| Method | When | Savings |
|--------|------|---------|
| gzip | Default for all JSON responses | ~70% size reduction |
| Brotli (`br`) | Static assets, pre-compressed API responses | ~15-20% better than gzip |
| None | Binary payloads (images, protobuf) already compressed | — |

```typescript
// Express middleware (gzip + brotli)
import compression from "compression";
app.use(compression({ level: 6, threshold: 1024 })); // Skip < 1KB
```

### Delta sync (bandwidth-critical apps)

```
GET /api/v1/items?since=2026-06-15T10:00:00Z
→ Returns only items created/updated/deleted after timestamp
→ Client merges delta into local DB

// Response includes tombstones for deleted items
{ "updated": [...], "deleted": ["id1", "id2"], "serverTime": "..." }
```

### CDN strategy for mobile

| Asset Type | CDN | Cache TTL |
|-----------|-----|-----------|
| App bundle (OTA updates) | CloudFront / Fastly | Versioned URL, immutable |
| User-uploaded images | CDN + image transform (Cloudflare Images, imgproxy) | 1 year, versioned |
| API responses | Edge cache only for public, read-heavy endpoints | 60s max, `stale-while-revalidate` |

---

## §6 Anti-Patterns & Pre-flight

### Anti-patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| Mobile client making 5+ API calls per screen | Slow load, battery drain, waterfall requests | BFF pattern — one query per screen (§1) |
| Uncompressed JSON responses to mobile | High data usage on cellular, slow TTFB | gzip at minimum; brotli for static (§5) |
| 광고 푸시 21시~08시 KST 발송 | 정보통신망법 위반, 과태료 | 야간 큐 + 08:00 일괄 발송 (§2) |
| Tokens in unencrypted storage | Credential theft via device backup/extraction | Keychain (iOS), Keystore (Android), expo-secure-store (RN) (§4) |
| Full dataset sync on every app launch | Bandwidth waste, slow startup | Delta sync with `?since=` timestamp (§5) |

### Pre-flight checklist

- [ ] BFF or aggregation layer exists for screens with 3+ data sources
- [ ] Push token lifecycle handles refresh, logout disassociation, and uninstall cleanup
- [ ] 야간 광고 푸시 제한 (21:00~08:00 KST) enforced server-side
- [ ] Offline sync strategy selected (LWW default, CRDT if collaborative)
- [ ] Auth tokens stored in platform secure storage (never plain storage)
- [ ] Refresh tokens are one-time-use with rotation
- [ ] API responses gzip-compressed (threshold > 1KB)
- [ ] Delta sync available for list/feed endpoints (`?since=` parameter)
