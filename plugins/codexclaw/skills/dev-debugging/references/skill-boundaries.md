## Integration with Other Skills

| Skill | Relationship |
|-------|-------------|
| `dev` §2 | Summary of this methodology. This skill is the full version. |
| `dev-testing` | Phase 4 "write failing test first" → use `dev-testing` for test patterns and harness. `dev-testing` provides the tooling; this skill provides the thinking. |
| `dev-backend` | Server-side debugging context: API errors, database issues, middleware chains. |
| `dev-frontend` | Client-side debugging context: hydration, rendering, DevTools, layout shifts. |
| `dev-code-reviewer` | Code review catches bugs before they ship — prevention beats debugging. |

## Routing Role

This skill is the **thinking process** for fixing bugs. As a routing role it activates
by change-surface (an error/bug to diagnose), not by any external dispatcher. It enforces a structured
phases 0-4 methodology for every technical issue — test failures, runtime errors,
build failures, performance regressions, integration bugs.

```
dev-debugging = root cause methodology (the thinking)
dev-testing   = test harness for reproducing/verifying (the tooling)
dev §2        = summary pointer to this skill (the overview)
```
