---
name: cxc-dev-debugging
description: "Use for debugging and system comprehension. Triggers: debug this, root cause, how does X work, reverse engineer, 왜 안 돼, 디버깅, 원인 분석, 로직 파악, 뜯어봐."
metadata:
  last-verified: "2026-07-02"
  short-description: "Phases 0-4 systematic root-cause debugging method (any language)."
  keywords: [debug, error, stack trace, root cause, flaky, regression, crash, bisect, "logic analysis", "comprehension", "unknown system", "reverse engineering"]
---
# dev-debugging — Systematic Root Cause Analysis

**Boundary**: This skill covers how to reason about bugs. For test harness,
reproduction frameworks, and verification tooling, see `dev-testing`. For
domain-specific context (API errors, hydration issues, query performance),
consult `dev-backend` or `dev-frontend`. Comprehension without a defect —
understanding how an unknown app, API, AI tool, or codebase works — routes to
`references/logic-analysis.md`.

Class, fast path, rule authority, proof, and safety: [dev](../dev/SKILL.md). Current/public evidence: [dev routing](../dev/SKILL.md#conditional-routes).

## Core Principle

Check if the problem is structural before debugging code.
Before a permanent fix, investigate and explain the cause. During an active incident,
an already-authorized, reversible mitigation may precede full RCA; follow `dev-devops`
incident policy and preserve evidence. Diagnosis alone never authorizes a code fix,
rollback, production access, or an upstream issue submission.

## RCA Entry Gates

**STRICT (DEBUG-RCA-EVIDENCE-01):** Before investigating any single root-cause
hypothesis or making a root-cause claim, write at least three orthogonal
hypotheses (`H1/H2/H3`) and one falsifier for each. Collapse duplicates, test
against disconfirming evidence, and do not claim root cause until competing
hypotheses have been ruled out by evidence. If fewer than three are plausible,
state why.

**STRICT (DEBUG-TOGGLE-PROOF-01):** Enter implementation only after the captured
value matches the hypothesis prediction, the repro repeats, and toggling the
suspected cause off/on removes then restores the bug. Write one paragraph
explaining the causal mechanism before patching.

## Logic Analysis (comprehension without a defect)

When the request is to understand how a system works — closed app, AI tool,
undocumented API, unfamiliar codebase — rather than to fix a defect, read
[Logic analysis](references/logic-analysis.md). Core rules: "I can't" is a
skipped analysis loop, not a limit; missing source/docs is a starting
condition; hypothesize from names/strings/errors, observe static AND dynamic,
mutate one variable at a time, keep an incremental model with UNKNOWN fields,
and prove the model by writing a client that uses it. Honest lab-boundary
routing (IDA/Procmon/Cuckoo class) beats both refusal and fabrication.

## Security-Sensitive Bugs

For security-sensitive bugs (auth bypass, data leak, injection), use `dev-security` for
controls and `dev-devops` for incident response. Preserve the same authorization boundary.

## Modular References

| Condition | Reference |
|---|---|
| Defect diagnosis before permanent repair: phases 0–4 and implementation entry gates | [root-cause-phases.md](references/root-cause-phases.md) |
| Guessing, repeated failures, or suppressive fixes | [debugging-pitfalls.md](references/debugging-pitfalls.md) |
| API 500, hydration mismatch, N+1 query, or flaky-test diagnosis examples | [debugging-scenarios.md](references/debugging-scenarios.md) |
| Investigation stalls, needs escalation, or meets postmortem criteria | [escalation-and-postmortems.md](references/escalation-and-postmortems.md) |
| Choosing the boundary between debugging and companion skills | [skill-boundaries.md](references/skill-boundaries.md) |
| Choosing a debug approach | [methodologies.md](references/methodologies.md) |
| Understanding how an unknown system works (no defect) | [logic-analysis.md](references/logic-analysis.md) |
| Concurrency issues | [async-debugging.md](references/async-debugging.md) |
| Quick cheatsheet | [tool-guides.md](references/tool-guides.md) |
| After resolving a significant incident | [postmortem-template.md](references/postmortem-template.md) |
| Node.js / tsx / Bun / Deno | [runtimes/node.md](references/runtimes/node.md) |
| Next.js 16 / React 19 | [runtimes/js/nextjs-react.md](references/runtimes/js/nextjs-react.md) |
| Vite 8 / Vitest 4 | [runtimes/js/vite-vitest.md](references/runtimes/js/vite-vitest.md) |
| Express 5 / Fastify 5 / NestJS 11 | [runtimes/js/node-backend.md](references/runtimes/js/node-backend.md) |
| Python (CPython 3.9+) | [runtimes/python.md](references/runtimes/python.md) |
| Rust | [runtimes/rust.md](references/runtimes/rust.md) |
| Go | [runtimes/go.md](references/runtimes/go.md) |
| C/C++ | [runtimes/c-cpp.md](references/runtimes/c-cpp.md) |
| Java/Kotlin (JVM) | [runtimes/jvm.md](references/runtimes/jvm.md) |
| Swift / iOS / macOS AppKit | [runtimes/swift.md](references/runtimes/swift.md) |
| Ruby (3.2+) | [runtimes/ruby.md](references/runtimes/ruby.md) |
| Elixir/Erlang (BEAM) | [runtimes/beam.md](references/runtimes/beam.md) |
| Browser/web-surface bugs | [tools/playwright.md](references/tools/playwright.md) |
