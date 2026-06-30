---
title: Work Classes (C0-C5)
description: How cxc-dev classifies every coding task by depth and risk, and what each class requires.
---

`cxc-dev` classifies every coding task into one of six work classes. The class sets how much
planning, search, auditing, and verification the task gets — small tasks stay fast, risky tasks
get full PABCD.

| Class | Name | Scope | Required treatment |
|---|---|---|---|
| C0 | Trivial text | Typo, comment, copy, log string — zero behavior change | Direct fix plus the smallest proof. |
| C1 | Single-file local | One file, local behavior, no new abstractions | Fast path plus a targeted check. |
| C2 | Ordinary product slice | Conventional endpoint, form, table, model, list/detail screen | Compact plan, adjacent-convention search, focused tests, micro-audit. |
| C3 | Cross-domain feature/refactor | Multiple modules, public API, shared types, broad behavior | Compact or full PABCD by risk; subagent audit when scope warrants. |
| C4 | High-risk | Auth, payments, data deletion, migration, release, permission/security boundary | Full PABCD (mandatory), full gates, durable risk/evidence record. |
| C5 | Research / ambiguous | Unclear requirements after one clarification round | Interview-first via the `pabcd` skill, then reclassify. |

## Promotion rules

- A conventional route → service → storage slice stays C2 even though it spans files. C3's
  "multiple modules" means crossing a module or package boundary beyond that slice.
- **C4-promotion triggers override any fast path.** Security, data deletion, payments, migration,
  and permission changes pull the work up to C4-level care.
- If only a sliver of a task is high-risk, split that sliver out rather than inflating the whole
  slice.

## Fast path (C0 / C1)

C0 and C1 work — one file, no new abstractions, local behavior, roughly a five-line edit — takes
the patch fast path: a direct edit plus the smallest proof that it works. A zero-behavior edit
inside a sensitive file stays C0, but any edit touching executed logic in that path is not
C0/C1 — reclassify and read first.

## Routing

Once classified, `cxc-dev` routes to surface-specific `dev-*` skills (frontend, backend, data,
architecture, testing, security, and more). See the [Skills guide](/codexclaw/guides/skills/) for
the full routing table.
