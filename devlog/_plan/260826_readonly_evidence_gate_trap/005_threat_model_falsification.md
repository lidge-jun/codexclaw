---
created: 2026-08-26
workPhase: wp1
---

# 005 — Executable falsification of the "bounded release is an opt-out" premise

Two audit rounds returned FAIL on the same core objection: releasing a worker after
MAX_ATTEMPTS lets it opt out of evidence verification. Before hardening further, the
premise was tested rather than argued.

## The experiment

Against current `src/subagent-evidence.ts`, in a fresh tmpdir:

```
.codexclaw/evidence/junk.md   <- one byte, content "x"
payload: agent_type=worker, last_assistant_message="done\nEVIDENCE_RECORDED: .codexclaw/evidence/junk.md"
runSubagentStopGate(payload)  ->  ""      RELEASED on call 1
```

## The result

`hasValidReceipt()` verifies containment, non-symlink, regular-file and non-empty. It
does not verify content, authorship, or that any check actually ran. **One junk byte
releases a worker immediately.**

## What this means for the design

The opt-out the audit feared already exists, and it is strictly cheaper than stalling:
one call instead of four, and it leaves no record at all. So the population that
actually reaches the attempt cap is:

- workers that CANNOT write the receipt — the read-only trapped case, this unit's
  entire reason for existing; and
- workers too broken to write one byte.

A worker that is both capable and adversarial never reaches the cap. Therefore bounded
release does not open an opt-out; it changes the outcome for the trapped population
from "infinite loop, no record" to "released, with a durable unresolved record that
denies goal completion". That is strictly more information and strictly more
enforcement than today, not less.

## What this gate can and cannot guarantee

CAN: that a receipt file exists in the right place, is a real non-empty regular file,
and that no child-authored text talked its way past the check.

CANNOT: that the receipt reflects real verification. That needs content/provenance
verification — a separate, much larger unit. Claiming this gate makes laundering
impossible was always false; the honest claim is that it raises the cost and leaves a
trail.

## Consequence for scope

Regressions this unit introduces are in scope and get fixed. Pre-existing weaknesses of
the evidence gate are recorded as residuals in the closeout, not silently inherited as
blockers on a defect fix. The unit's objective remains: a read-only subagent must not
be trapped in an unsatisfiable infinite block loop.
