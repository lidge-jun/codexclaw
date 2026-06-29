# Tech Debt Inventory & Paydown

## 1. What Counts as Tech Debt

Not all old code is debt. Debt is code that **actively slows current development** or **increases defect risk**.

| Is Debt | Is NOT Debt |
|---------|-------------|
| Duplicated validation logic across 4 services | Old but working utility with no pending changes |
| Missing index causing p95 > 2s on a hot query | Framework version one minor behind latest |
| Hardcoded secrets in env setup scripts | Code style you personally dislike |
| Circular dependency blocking tree-shaking | A function that could theoretically be shorter |

Rule: if nobody will touch the area in the next 6 months, it is not actionable debt — it is legacy.

## 2. Debt Classification

Use the Fowler quadrant to classify before prioritizing:

| | Reckless | Prudent |
|---|---------|---------|
| **Deliberate** | "Ship it, we'll fix later" — track immediately, set paydown deadline | "We know the tradeoff" — document the decision in ADR, schedule review |
| **Inadvertent** | "What's layering?" — training gap, fix + educate | "Now we know better" — refactor when the area is next touched |

```
# ADR template for prudent-deliberate debt
## Decision: Accept [describe shortcut]
## Context: [why this is acceptable now]
## Consequences: [what breaks if we don't pay down by Q+1]
## Paydown trigger: [metric threshold or calendar date]
```

## 3. Inventory Template

Track debt in a structured format — spreadsheet, issue tracker, or Markdown table:

```markdown
| ID | Location | Category | Impact | Effort | Priority | Owner | Deadline |
|----|----------|----------|--------|--------|----------|-------|----------|
| TD-001 | src/auth/legacy-jwt.ts | Security | HIGH | M (2d) | P1 | @backend | 2026-07 |
| TD-002 | src/api/v1/users.ts:45-120 | Duplication | MEDIUM | S (4h) | P2 | @backend | 2026-08 |
| TD-003 | shared/validators/ | Coupling | HIGH | L (5d) | P1 | @arch | 2026-07 |
```

**Priority formula**: `Impact × (1 / Effort) × Frequency-of-area-changes`

- HIGH impact + small effort + frequently changed = P1 (fix now)
- LOW impact + large effort + rarely changed = P4 (monitor only)

## 4. Review Integration

During code review, create a debt ticket when:

- [ ] A workaround is introduced with a `// TODO` or `// HACK` comment
- [ ] Reviewer spots duplication that cannot be fixed within the current PR scope
- [ ] Test coverage drops below threshold due to "too complex to test" code
- [ ] A dependency is pinned to an EOL version to avoid breakage

```
# Review comment template
🏦 **Tech Debt**: [description]
- Quadrant: [deliberate-prudent | inadvertent-reckless | ...]
- Impact: [HIGH | MEDIUM | LOW]
- Suggested paydown: [brief fix approach]
- Ticket: [link or "created TD-NNN"]
```

Do NOT block PRs for pre-existing debt. Tag it, ticket it, move on.

## 5. Budget & Paydown

| Strategy | When to Use | Rule |
|----------|-------------|------|
| **20% rule** | Sustained velocity projects | Reserve 20% of each sprint for debt paydown |
| **Boy scout** | Any PR in a debt-heavy area | Leave the area cleaner than you found it — one small improvement per PR |
| **Debt sprint** | Debt inventory > 15 P1/P2 items | Dedicated sprint focused exclusively on debt reduction |
| **Strangler fig** | Large legacy replacement | Build new path alongside old, migrate callers incrementally, delete old |

```typescript
// Boy scout example: extract before adding new feature
// BEFORE: 200-line function with mixed concerns
function processOrder(order: Order) { /* validation + pricing + notification */ }

// AFTER: split during feature work
function validateOrder(order: Order): ValidationResult { /* ... */ }
function calculatePricing(order: Order): PricingResult { /* ... */ }
function processOrder(order: Order) {
  const valid = validateOrder(order);
  const pricing = calculatePricing(order);
  // new feature code goes here cleanly
}
```

## 6. Measurement

Track these metrics to detect debt accumulation:

| Metric | Tool | Threshold |
|--------|------|-----------|
| Coupling score | `madge --circular` / `dpdm` | 0 circular deps |
| Cycle time (PR open → merge) | Git analytics | < 24h for standard PRs |
| Defect density per module | Issue tracker tags | Hotspot = 3× average |
| Code churn (same file changed > 5× in 30d) | `git log --format` | Flag for review |
| TODO/HACK count | `grep -r "TODO\|HACK\|FIXME"` | Trending down quarter-over-quarter |

## 7. Anti-Patterns

| Banned | Symptom | Fix |
|--------|---------|-----|
| "We'll refactor someday" without a ticket | Debt grows invisibly | Create TD-NNN ticket at discovery time |
| Blocking PRs for pre-existing debt | Review bottleneck, resentment | Tag + ticket, do not block |
| Rewriting from scratch to "fix debt" | Scope explosion, new bugs | Strangler fig or incremental refactor |
| Counting all old code as debt | Wasted prioritization effort | Apply §1 filter: does it slow current work? |

## Pre-flight

- [ ] Debt inventory exists and is current (updated within 30 days)
- [ ] Each P1/P2 item has an owner and deadline
- [ ] Sprint/iteration includes debt budget allocation
- [ ] New debt introduced in PRs is tagged with quadrant classification
- [ ] Metrics from §6 are tracked and reviewed monthly
