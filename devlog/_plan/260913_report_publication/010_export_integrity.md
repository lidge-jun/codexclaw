# Export integrity

Status: DONE

A focused CLI regression first failed because missing PDF tools returned PASS/0. The same test now expects BLOCKED/3. PDF metadata and text commands reject nonzero/timeout results, outputs are staged so a stale file cannot masquerade as a fresh print, and TOC lookup no longer guesses from a 24-character prefix. Unresolved targets and missing slots produce P0.

Verification: `node --test plugins/codexclaw/test/report-export.test.mjs` (5 tests). Baseline `npm run gate` passed before implementation. Red output was kept outside the repository under the task-owned evidence directory.

This unit only repairs the existing CLI. Explicit resource readiness and final delivery attestation follow in 020. No native loop/FSM is claimed.
