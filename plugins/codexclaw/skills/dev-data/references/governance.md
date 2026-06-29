# Data Governance — PII, Masking, Compliance

Security and privacy patterns for production data pipelines.

---

## PII Masking Techniques

| Technique | Reversible | Use Case |
|-----------|------------|----------|
| **Pseudonymization** | Yes (with mapping) | Analytics needing re-identification |
| **Anonymization** | No | Public datasets, research |
| **Dynamic masking** | N/A (query-time) | Production DBs with mixed access levels |
| **Static masking** | No | Non-production environments (dev/QA) |
| **Tokenization** | Yes (separate vault) | Payment data (PCI-DSS), SSNs |

**Rule:** Always use static masking for non-production environments. Never copy production PII to dev/staging.

---

## GDPR Engineering Patterns

### Right to Erasure (Article 17)
```
User deletion request
→ Soft delete in application DB
→ Batch purge job (after grace period)
→ Propagate to all downstream stores:
  ├── Data warehouse (DELETE or partition drop)
  ├── Data lake (Delta Lake/Iceberg row-level delete)
  ├── Search indices (Elasticsearch delete-by-query)
  ├── Caches (Redis DEL)
  └── Backups (mark for purge at next rotation)
```

### Consent-Aware Pipelines
- Check consent flags before processing PII columns
- Different processing paths per consent level
- Store consent as versioned events (not mutable flags)

### Data Subject Access Request (DSAR)
- Build export endpoint that collects all user data across systems
- Format: JSON or CSV per GDPR Article 20 (data portability)
- Automate where possible — manual DSAR handling doesn't scale

---

## CCPA Additions

| CCPA Requirement | Difference from GDPR | Engineering Pattern |
|-----------------|---------------------|---------------------|
| Right to opt-out of sale | No GDPR equivalent | Boolean `do_not_sell` flag on user profile; filter in data sharing pipelines |
| Financial incentive disclosure | No GDPR equivalent | Metadata on loyalty/discount programs linked to data collection |
| 12-month lookback | GDPR has no fixed window | Retain deletion request logs for 12 months |

---

## Row-Level Security (RLS)

```
Access Control Hierarchy:
├── Table-level: Can this role access this table?
├── Column-level: Which columns visible? (mask PII)
├── Row-level: Which rows visible? (filter by org_id)
└── Cell-level: Dynamic masking per field per role
```

**PostgreSQL RLS example:**
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON orders
    USING (org_id = current_setting('app.current_org_id')::int);
```

**Snowflake dynamic masking:**
```sql
CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->
  CASE
    WHEN CURRENT_ROLE() IN ('ADMIN', 'DATA_STEWARD') THEN val
    ELSE REGEXP_REPLACE(val, '.+@', '***@')
  END;
```

---

## Data Retention Policy

| Tier | Retention | Storage | Access Pattern |
|------|-----------|---------|----------------|
| **Hot** | 0-90 days | Primary warehouse | Real-time queries |
| **Warm** | 90 days - 2 years | Archive tables / cold storage | Occasional queries |
| **Cold** | 2-7 years | Object storage (S3/GCS) Parquet | Compliance/audit only |
| **Purge** | Beyond retention | Permanently deleted | N/A |

Automate tiering with lifecycle policies. Tag tables with `retention_days` and `data_classification` metadata.
