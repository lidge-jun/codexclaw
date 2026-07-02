# [Feature Name] — Structure & Functions

> One-line summary of this feature module.

---

## File Tree

```
src/<feature-name>/
├── index.js              # public boundary export
├── <feature>.tool.js     # core logic
├── <feature>.test.js     # tests
├── <feature>.schema.js   # (if applicable)
└── <feature>.route.js    # (if applicable)
```

---

## Module Responsibility

Describe in one paragraph what this module does and why it exists.
Include the business context — what problem it solves.

---

## Key Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `exampleTool(input)` | `input: string` | `{ success: boolean, data: any }` | Main entry point |
| | | | |

### Function Details

#### `exampleTool(input)`

```js
// Usage example
const result = exampleTool('sample');
// → { success: true, data: 'sample' }
```

**Edge cases:**
- Empty input → returns `{ success: false, error: 'empty' }`
- Invalid type → throws TypeError

---

## Data Flow

```
Input → validate → process → format → Output
                      ↓
                  side effect (e.g., DB write, API call)
```

---

## Dependencies

| Depends On | Import Path | Why |
|-----------|-------------|-----|
| `shared/formatter` | `../shared/formatter.js` | Output formatting |
| | | |

---

## Dependents (who imports this module)

| Module | What It Uses | Import Path |
|--------|-------------|-------------|
| `report/` | `exampleTool` | `../feature/index.js` |
| | | |

---

## Configuration

| Config Key | Default | Description |
|-----------|---------|-------------|
| | | |

Environment variables used:
- `API_KEY` — (describe purpose)

---

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `NetworkError` | API unreachable | Retry 3x with exponential backoff |
| | | |

---

## Sync Checklist

When modifying this module, also update:

- [ ] The repo's module-structure doc for this feature (or create one only if the repo already uses that convention)
- [ ] Any index/table-of-contents file that tracks module docs
- [ ] Other files that must stay in sync

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| YYMMDD | Initial creation | — |

---

*Keep this document concise, bounded, and task-oriented. Expand only when the feature's real surface area requires it.*
