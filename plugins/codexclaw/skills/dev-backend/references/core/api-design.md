# API Design Patterns

Framework-agnostic API design guidelines.
Synthesized from dev-backend + senior-backend (alirezarezvani) + mrgoonie backend-development.

---

## RESTful Conventions

| Method | Purpose          | Idempotent | Example                        |
| ------ | ---------------- | :--------: | ------------------------------ |
| GET    | Read (list/item) |    Yes     | `GET /api/users`, `/users/:id` |
| POST   | Create resource  |     No     | `POST /api/users`              |
| PUT    | Full replace     |    Yes     | `PUT /api/users/:id`           |
| PATCH  | Partial update   | No (not required by RFC 5789; use idempotency keys if needed) | `PATCH /api/users/:id` |
| DELETE | Remove resource  |    Yes     | `DELETE /api/users/:id`        |

---

## Consistent Response Envelope

Every endpoint MUST use the same envelope:

```json
// Success
{
  "success": true,
  "data": { "id": 1, "name": "Alice" },
  "meta": { "requestId": "req-abc-123" }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [{ "field": "email", "message": "must be a valid email" }]
  },
  "meta": { "requestId": "req-abc-123" }
}
```

---

## HTTP Status Codes

| Code | When to Use                            |
| ---- | -------------------------------------- |
| 200  | Success (GET, PUT, PATCH)              |
| 201  | Created (POST)                         |
| 204  | No Content (DELETE)                    |
| 400  | Validation error, malformed input      |
| 401  | Authentication required                |
| 403  | Authenticated but not authorized       |
| 404  | Resource not found                     |
| 409  | Conflict (duplicate, version mismatch) |
| 429  | Rate limit exceeded                    |
| 500  | Internal server error                  |

---

## Pagination

For list endpoints, support cursor-based or offset pagination:

```
GET /api/users?limit=20&offset=0&sort=name&order=asc
GET /api/users?limit=20&cursor=abc123
```

Response:
```json
{
  "data": [],
  "meta": { "total": 142, "limit": 20, "offset": 0, "hasMore": true }
}
```

Prefer cursor-based for large datasets (O(1) vs O(n) for offset skip).

---

## URL Design

- **Nouns, not verbs**: `/api/users` not `/api/getUsers`
- **Plural resources**: `/api/users` not `/api/user`
- **Nested when owned**: `/api/users/:id/orders` (user's orders)
- **Max 2 levels deep**: `/api/users/:id/orders/:orderId` — never deeper
- **Query params for filtering**: `?status=active&role=admin`
- **Kebab-case for multi-word**: `/api/user-profiles` not `/api/userProfiles`

---

## API Versioning

| Strategy    | Example         | When to Use         |
| ----------- | --------------- | ------------------- |
| URL prefix  | `/api/v1/users` | Simple, most common |
| Header      | `Accept: v=2`   | Cleaner URLs        |
| Query param | `?version=2`    | Quick prototyping   |

Default to URL prefix (`/api/v1/`) for clarity.

---

## GraphQL Considerations

Choose GraphQL when:
- Client needs flexible data shapes
- Multiple resources needed in single request
- Mobile apps with bandwidth constraints

Choose REST when:
- Simple CRUD operations
- Caching important (HTTP caching is free)
- File uploads/downloads
- Server-to-server communication

---

## Retry with Exponential Backoff

For transient failures (network timeouts, rate limits, DB locks):

| Attempt | Wait         |
| ------- | ------------ |
| 1       | 0s           |
| 2       | 1s           |
| 3       | 2s           |
| 4       | 4s           |
| Max     | 3-5 attempts |

**Never retry non-idempotent operations (POST) without deduplication.**

---

## GraphQL Patterns

When using GraphQL (BFF/mobile clients):

- **Schema-first development**: Define schema → generate types → implement resolvers
- **Apollo Federation v2** for distributed schema ownership across teams
- **DataLoader** is mandatory for N+1 prevention — batch and deduplicate per-request
- **Depth limiting** + **query complexity analysis** to prevent abuse
- **Persisted queries** for production: whitelist allowed queries, reduce attack surface

```graphql
type Query {
  user(id: ID!): User
  users(first: Int = 20, after: String): UserConnection!  # cursor pagination
}

type User {
  id: ID!
  name: String!
  orders(first: Int = 10): OrderConnection!  # DataLoader required here
}
```

**Security:** Always limit query depth (≤7), field count, and complexity score. Never expose introspection in production.

---

## gRPC Patterns

When using gRPC (internal microservices):

- **Protobuf contracts**: Define `.proto` files as the single source of truth
- **buf.build** for linting, breaking change detection, and code generation
- **Unary RPC** for request-response, **server streaming** for data feeds, **bidirectional** for real-time
- **Deadlines**: Always set per-call deadlines (not timeouts) — propagated across service chain
- **Error codes**: Use standard gRPC status codes, not HTTP status codes

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);  // server streaming
}

message GetUserRequest {
  string user_id = 1;
}
```

---

## tRPC Patterns

When using tRPC (TypeScript monorepo internal tools):

- **Zero-codegen type safety** — procedure types flow from server to client automatically
- Best for: admin dashboards, internal tools, rapid prototyping within TS monorepos
- **Not suitable for**: public APIs, polyglot environments, mobile apps (non-TS clients)

```typescript
// Server — define procedures
const appRouter = router({
  user: router({
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => userService.findById(input.id)),
    create: protectedProcedure
      .input(createUserSchema)
      .mutation(({ input }) => userService.create(input)),
  }),
})

// Client — fully typed, zero codegen
const user = await trpc.user.get.query({ id: "123" })
//    ^? User — type inferred from server
```

---

## API Protocol Decision Matrix

| Factor | REST | GraphQL | gRPC | tRPC |
|--------|:----:|:-------:|:----:|:----:|
| Public API | ✅ | ⚠️ | ❌ | ❌ |
| Mobile BFF | ⚠️ | ✅ | ❌ | ❌ |
| Internal services | ⚠️ | ❌ | ✅ | ⚠️ |
| TS monorepo | ⚠️ | ⚠️ | ❌ | ✅ |
| HTTP caching | ✅ | ❌ | ❌ | ❌ |
| Type safety (codegen-free) | ❌ | ❌ | ❌ | ✅ |
| Streaming | ❌ | ⚠️ | ✅ | ❌ |
| Browser native | ✅ | ✅ | ❌ | ✅ |
| Polyglot | ✅ | ✅ | ✅ | ❌ |
