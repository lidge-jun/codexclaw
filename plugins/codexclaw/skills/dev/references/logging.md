# Logging discipline — CLI, scripts, libraries

What to emit and where, for surfaces that are not production services.

## Scope

| Surface | Owner | Example |
| --- | --- | --- |
| One-shot CLI | this document | `cxc map`, `cxc doctor` |
| Long-running local server | process stdout/stderr transport: this document's `LOG-CONSUMER-01`/`LOG-ONCE-01` only. HTTP and request instrumentation: `dev-backend` | `cxc serve` |
| Production-deployed service | `dev-backend` `references/core/observability.md` (JSON, traceId, OTel conventions) | a deployed API |

Where they overlap on a deployed service, `dev-backend` wins.

## Rules

**LOG-CONSUMER-01 (DEFAULT).** Before emitting, answer "who reads this line, and what do
they do with it?". If you cannot answer, do not emit. Do not introduce logging into a
module that had none — the absence is also a decision.

**LOG-STREAM-01 (DEFAULT, one-shot CLI only).** For a command that produces output others
may pipe: stdout is the successful command output, stderr is diagnostics, progress,
warnings and errors. Do not put piped values on stderr, and do not mix diagnostics into
stdout. (`--help` and `--version` are successful output and belong on stdout —
`plugins/codexclaw/skills/qa/references/cli-tui-qa.md:18-20`.)

An expected usage error — a bad flag, bad input — is not error-level *telemetry*, but in a
CLI it still gets **stderr plus a nonzero exit**. Do not conflate the two ideas.

A long-running local server is outside this rule. `cxc serve` sends its whole injected
lifecycle logger to stdout today and that is fine: a server process's stdout is a log
stream, not pipeline output. Do not apply this rule to it retroactively.

**LOG-ONCE-01 (DEFAULT).** Judge duplication by consumer and sink, not by event identity.
The same event may be recorded once per distinct consumer — one durable telemetry/event
record plus one human-facing diagnostic is legitimate. What is forbidden is
indistinguishable repetition into the same sink for the same consumer. Boundary
log-and-rethrow that adds context is allowed (`dev-debugging/SKILL.md` explicitly permits
it).

Worked example — the `cxc serve` adapter-failure path is NOT a violation:
`components/messenger-bridge/src/bridge-controller.ts:191-196` records to the durable
event log and rethrows; `components/messenger-bridge/src/cli.ts:83-92` tells the operator
on stderr. Different sink, different consumer.

## Owned elsewhere

This document does not redefine any of these:

- Following existing conventions — `dev/SKILL.md` §Conventions.
- Where log statements belong — `dev-debugging/references/methodologies.md`.
- Surfacing async failures at a clear boundary — `dev/SKILL.md` §5 Safety Rules.
- Service log levels, JSON transport, trace fields, logger libraries —
  `dev-backend/references/core/observability.md`.
