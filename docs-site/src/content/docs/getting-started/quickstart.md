---
title: Quickstart
description: Run a full PABCD work-phase end to end with codexclaw.
---

This walks one PABCD work-phase from start to close. Each forward transition needs an `--attest`
block; narration alone does not advance the state.

Prerequisite: a source checkout with the `cxc` CLI activated
([Installation](/codexclaw/getting-started/installation/) Track 3) — the marketplace-only
install does not provide `cxc`.

No CLI? The same transitions work as line-anchored chat messages — sending `orchestrate P`
in chat is the human free-pass path.

## 1. Plan (P)

```bash
cxc orchestrate P --attest '{"from":"IDLE","to":"P","did":"plan: add pagination to /users"}'
```

Write the real diff-level plan during P.

## 2. Audit (A)

```bash
cxc orchestrate A --attest '{"from":"P","to":"A","did":"the plan you wrote"}'
```

Dispatch an adversarial review of the plan, then record the verdict.

## 3. Build (B)

```bash
cxc orchestrate B --attest '{"from":"A","to":"B","did":"who audited + verdict","auditOutput":"<reviewer verdict tail>"}'
```

Implement in small commits and verify as you go.

## 4. Check (C)

```bash
cxc orchestrate C --attest '{"from":"B","to":"C","did":"what you built + verifier verdict"}'
```

Run the real checks: build, tests, and any scrutiny the change warrants.

## 5. Done (D)

The `C → D` transition additionally requires the check output and a zero exit code:

```bash
cxc orchestrate D --attest '{"from":"C","to":"D","did":"what you checked","checkOutput":"289/289 pass","exitCode":0}'
```

`D` closes the cycle; the phase returns to `IDLE`.

## Inspect and reset

```bash
cxc orchestrate status   # show the current phase and flags
cxc orchestrate reset    # return the phase to IDLE
```

:::tip[Loop mode]
Under an active goal with work remaining, the Stop-continuation hook keeps the loop advancing
across work-phases. See [PABCD Workflow](/codexclaw/guides/pabcd/) for the continuation guards.
:::
