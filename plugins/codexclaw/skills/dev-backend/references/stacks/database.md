# Database — PostgreSQL & MongoDB

Stack-specific database rules.
Synthesized from dev-backend + senior-backend + mrgoonie databases skill.

---

## Database Selection Guide

### Choose PostgreSQL When:
- ACID transactions critical (financial, e-commerce)
- Complex relationships (JOINs, referential integrity)
- SQL expertise on team
- Mature tooling needed (extensions, pg_stat, pgBouncer)
- Analytical workloads (window functions, CTEs)

### Choose MongoDB When:
- Schema flexibility needed (frequent structure changes)
- Document-centric data (natural JSON/BSON)
- Horizontal scaling (sharding)
- High write throughput (IoT, logging)
- Rapid prototyping

### Both Support:
JSON/JSONB, full-text search, geospatial, replication, ACID transactions.

---

## Query Optimization

### EXPLAIN Everything
```sql
EXPLAIN ANALYZE SELECT * FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;

-- Look for: Seq Scan (bad) vs Index Scan (good)
-- Check: actual time, rows, loops
```

### Never SELECT *
```sql
-- ❌ BAD
SELECT * FROM users;

-- ✅ GOOD — only needed columns
SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 20;
```

---

## N+1 Prevention

```
❌ BAD (N+1):
  users = fetchUsers()          -- 1 query
  for user in users:
    orders = fetchOrders(user.id) -- N queries

✅ GOOD (batch):
  users = fetchUsers()                    -- 1 query
  userIds = users.map(u => u.id)
  orders = fetchOrdersByUserIds(userIds)  -- 1 query
  ordersMap = groupBy(orders, 'userId')
  -- Total: 2 queries regardless of N
```

ORM solutions:
- **SQLAlchemy**: `joinedload()`, `selectinload()`
- **Prisma**: `include: { orders: true }`
- **TypeORM**: `relations: ['orders']`
- **Mongoose**: `.populate('orders')`

---

## Index Strategy

| Type       | Use Case            | Example                                                                 |
| ---------- | ------------------- | ----------------------------------------------------------------------- |
| Single     | Equality lookups    | `CREATE INDEX idx_users_email ON users(email)`                          |
| Composite  | Multi-column WHERE  | `CREATE INDEX idx_orders_user_status ON orders(user_id, status)`        |
| Partial    | Filtered subsets    | `CREATE INDEX idx_active ON orders(created_at) WHERE status = 'active'` |
| Covering   | Avoid table lookups | `CREATE INDEX idx_email_name ON users(email) INCLUDE (name)`            |
| Expression | Computed values     | `CREATE INDEX idx_lower_email ON users(LOWER(email))`                   |

**Rule of thumb:** If a WHERE clause column appears in slow queries → index it.

---

## Transactions

- Use the framework's transaction API — never manual `BEGIN`/`COMMIT`
- Keep transactions SHORT — no network calls inside
- Deadlock prevention: always acquire locks in consistent order
- Use `SERIALIZABLE` isolation only when required

---

## Migrations

- One file per schema change, timestamped
- Always include rollback (reverse migration)
- **Never modify an applied migration**
- Test on copy of production data before deploying
- Use tools: Alembic (Python), Prisma Migrate (Node), Flyway (Java)

---

## Connection Pooling

| Tool       | Language    | Purpose                  |
| ---------- | ----------- | ------------------------ |
| pgBouncer  | Any         | External pool proxy      |
| pg.Pool    | Node.js     | Built-in connection pool |
| SQLAlchemy | Python      | Built-in `pool_size`     |
| HikariCP   | Java/Kotlin | High-performance pool    |

Settings:
- `pool_size`: number of DB connections
- `max_overflow`: extra connections when pool is full
- `pool_timeout`: wait time for connection
- `pool_recycle`: recycle connections to prevent stale

---

## PostgreSQL Specifics

### Performance Maintenance
```sql
-- Regular maintenance
VACUUM ANALYZE table_name;

-- Check table bloat
SELECT schemaname, relname, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Check missing indexes
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND seq_scan > 100;
```

### Useful Extensions
| Extension          | Purpose                    |
| ------------------ | -------------------------- |
| pg_stat_statements | Query performance tracking |
| pgvector           | AI vector search           |
| PostGIS            | Geospatial data            |
| uuid-ossp          | UUID generation            |
| pg_trgm            | Fuzzy text search          |

---

## MongoDB Specifics

### Aggregation Pipeline
```javascript
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
]);
```

### Schema Design Patterns
- **Embedded**: 1-to-few relationships (address in user doc)
- **Referenced**: 1-to-many or many-to-many (separate collection + $lookup)
- **Bucket**: time-series grouping (hourly/daily buckets)
