# Outbound Call Resilience (BE-RESILIENCE-01, DEFAULT)

Source: sol research (simota/agent-skills Gateway, Jeffallan/claude-skills).

## Deadline Propagation

- Every outbound HTTP/RPC call carries a deadline derived from the inbound request budget
- Deadline = remaining_budget - local_processing_estimate - safety_margin
- No outbound call without a deadline; framework-default infinite timeouts are bugs

## Retry Policy

- Classify operations: idempotent (safe to retry) vs non-idempotent (retry only with idempotency key)
- Exponential backoff with jitter (not fixed intervals)
- Retry budget: max 3 attempts OR 10% of total request rate, whichever is lower
- Never retry 4xx client errors (except 429 with Retry-After)

## Circuit Breaker

- Track failure rate per downstream service over a sliding window
- Open at >50% failure rate over 10+ requests; half-open after cooldown
- Emit metric on state transitions (closed→open, open→half-open, half-open→closed)

## Bulkhead Isolation

- Separate connection pools per downstream service
- Dedicated thread/goroutine pools for slow dependencies
- Never let one slow dependency exhaust the shared pool

## Cancellation Propagation

- When the caller disconnects, cancel downstream requests
- Use AbortController (Node), context.Context (Go), CancellationToken (.NET)
- Log cancellations separately from errors

## Connection Pool Hygiene

- Size pools based on measured throughput, not guesses
- Monitor pool exhaustion, wait time, and connection age
- Set max idle time; stale connections cause latency spikes
