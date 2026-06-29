# CRUD API Basics — Ordinary Endpoint Slice

On-demand reference for C2 ordinary product endpoints. CRUD here is a representative
benchmark — the same shape applies to most conventional resource endpoints.

## Route + schema

- Follow the repo's existing route style first (REST-ish resource paths, existing router
  conventions). Do not introduce a new API style for one resource.
- Define the request/response schema at the boundary (zod/valibot/DTO/serializer — whatever
  the repo already uses). Validation happens HERE, at the controller/trust boundary;
  services trust validated input (dev-architecture §4).
- Reuse the repo's existing error envelope. Only introduce one if none exists, and keep it
  minimal — status + machine code + message is the floor; the `success/data/error/meta`
  envelope from `dev-backend` §5 is the default shape when the project's production scope
  warrants one.

## The five operations

| Op | Method/shape | Cares about |
|----|--------------|-------------|
| List | `GET /things` | Pagination + stable ordering when data can grow; filtering only when the product needs it |
| Detail | `GET /things/:id` | 404 mapping; ownership/permission check before data access |
| Create | `POST /things` | Schema validation; duplicate handling; return created entity (or id) consistently |
| Update | `PATCH/PUT /things/:id` | Partial-vs-full semantics matching repo convention; idempotent where possible; permission check |
| Delete | `DELETE /things/:id` | ESCALATE if data is user-valuable/irreversible — soft-delete vs hard-delete is a product decision; permission check |

## Service + query layer

- Service functions take validated plain data, return plain data/entities; no req/res leakage.
- Queries: parameterized always (STRICT); index the lookup keys the list/detail paths use;
  avoid N+1 on list endpoints (join/batch per repo's data layer).
- Transactions only where multi-write consistency actually requires them.

## Error + permission mapping

- Map domain failures to status codes in one place (controller/error middleware), not
  scattered through services.
- Every operation states its permission rule explicitly, even if it is "any authenticated
  user". Missing permission rule on write paths = blocker in review.
- Auth/permission changes themselves are C4, not part of an ordinary slice.

## Verification (C2 default)

- One integration/contract test covering happy path + one negative (validation or
  permission) per changed operation.
- Targeted typecheck/build. Full suites only when shared types/contracts moved (C3+).
- See `dev-testing/references/core/crud-test-matrix.md` for the risk-tier matrix.
