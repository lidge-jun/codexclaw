# HTTP API QA — wire-driving scenarios (QA-HTTP-01)

Drive the real wire and capture what it actually returned. E7 discipline.
Ownership: this file owns the DRIVE-the-surface procedure only — test
strategy/harness choice is `dev-testing` (references/backend-testing.md);
the response-envelope DEFINITION is `dev-backend` §5. Assert against the
repo's envelope; never restate its rules here.

## Faithful channel

- `curl -i` (or `-v` when TLS/redirect behavior is the claim) — headers AND
  body in one artifact. Client SDK output is not wire evidence: it may
  deserialize, retry, or normalize before you see it.
- One scenario = one captured request/response pair. Multi-step flows
  (login -> use token) capture every hop, numbered in `invocation.txt`.
- Streaming/SSE exception: `curl -N --max-time <n>` with the first N events
  captured; state the cutoff. WebSocket flows need a scripted client — name
  the script in the artifact.

## Scenario axes (probe the applicable ones)

1. **Auth states** — anonymous, valid token, expired token, wrong
   scope/role. Each returns the DOCUMENTED status (401 vs 403 distinction is
   a finding when collapsed); no protected payload ever leaks in an error
   body.
2. **Contract shape** — the repo's envelope (see `dev-backend` §5) holds on
   BOTH success and error paths; error responses carry the machine `code`
   (clients must never need to parse `message`). Capture one success + one
   error body per surface as the shape evidence.
3. **Idempotency / repeat** — double-submit the same POST/PUT; assert
   documented behavior (dedupe, 409, or duplicate side effect = finding).
   Retried requests honor idempotency keys when the API claims them.
4. **Boundary payloads** — empty body, missing required field, oversized
   payload (documented limit +1), wrong `Content-Type`. Expect a 4xx with a
   parseable error, never a 500 or a hang.
5. **Content negotiation** — wrong/absent `Accept` returns a sane default or
   406, not garbage; compressed responses (`Accept-Encoding`) still parse.
6. **CORS preflight** (browser-facing APIs only) — `curl -i -X OPTIONS` with
   `Origin` + `Access-Control-Request-Method`; captured allow-list matches
   intent (a `*` on a credentialed API is a finding).
7. **Status-code truth table** — for the changed routes, one captured line
   per (method, auth-state) cell you claim; do not infer untested cells.

## Artifacts + teardown

Per SKILL.md §3: `invocation.txt` (exact curl lines), `capture.txt`
(response(s) verbatim), `verdict.json`. Server you started for the pass ->
teardown line with `lsof -i :<port>` empty proof (SKILL.md §6). Redact
tokens/cookies in artifacts: keep length + first 4 chars only.

## Adversarial mapping

Axes 3-6 ARE SKILL.md §4 classes 1-4 specialized for the wire; class 5
(viewport/CJK) is N/A for headless APIs — record the N/A reason once per
matrix, not per scenario.
