# Source evidence and scope decisions

Sources measured 2026-09-22 before runtime implementation:

- Existing codexclaw dev/main visualizer code is identical. Prior audit at
  ../260919_issue_sweep/063_visualizer_port_status_20260922.md includes exact SHAs.
- Exporter's finish ignores notRun (scripts/export-paged-report.mjs:223–234),
  while standalone quality-gate rejects it (:31–33). A fake-header temporary PDF
  with child PATH empty returns PASS/0 in both repos. This is negative evidence,
  not PDF validity proof.
- report-contract already owns claim/evidence IDs and optional research validation.
  Extend that owner and preserve model v1; do not introduce another evidence engine.
- VIZ-VERIFY-SCALE-01 is already shipped in codexclaw SKILL. Simple static source
  review is intentional. Preserve it and port it to Aside; export checks apply only
  when actual PDF/export behavior is requested.
- Aside main has 17 tracked files, no test harness, no releases/tags, no dev branch.
  Its README install path ~/.aside/u/0/skills/user/dev-visualizer is currently absent;
  publishing this skill does not prove an account installation.

## Release evidence

Sol scout 01a0c7fa-3825-7900-b3c9-ec097d70db5f reported live GitHub refs,
permissions, branch rules and workflows. Main independently read release.yml,
current Aside branches/releases and permissions. Both repos permit push. Codexclaw
main requires CI/artifact/install checks; dev->main is the promotion exception in
PR target policy. v* tags disallow update/deletion. Aside has no required checks;
add an isolated Node built-in test workflow as part of the port, no npm package.

Codexclaw release is a GitHub payload archive with checksum/candidate manifest and
workflow attestation. Current v0.2.34 payload digest reported by scout:
ce0001d2825796c6845c36876516ebf022d279bb2c18e4043201000e475d505.
Main must re-read actual prior artifact before rollback evidence is claimed. Release
requires fresh main CI, WSL and Packed install, full version match and actual counts.

## Why not restore the historical migration

The previous additive recovery deliberately excluded browser/font/PDF runtime
helpers. Reintroducing every old module would increase compatibility and renderer
scope beyond the four issues. Harden current export verdict and subprocess checks,
use explicit existing quality-gate receipts, and rewrite unsupported pipeline examples
to describe current behavior. This preserves the no-system-Chrome QA-only path.

## Review boundaries

Automated semantic comparisons protect declared invariant values, not unrestricted
prose truth. Human KO/EN review checks conclusion strength, source mapping and visible
qualifications. Analytical recipes carry method prerequisites and uncertainty; they
do not assert causal truth from metadata alone. Visual proof is required for the
real mixed-script PDF/export smoke, not for static Markdown/HTML maintenance itself.

## Scoped trust model

Assets: user-authored HTML/PDF, output paths and source evidence; release archives.
Entrypoints: CLI arguments/JSON files, optional injected retrieval output, external
PDF tool results, recipe labels. Boundary: untrusted serialized data/subprocess
output becomes trusted contract or rendered text. An input author can provide bad
numbers/IDs/markup/path aliases, or a tool can fail/emit malformed output. No new
network service/auth surface is introduced. Controls: boundary validators, inert
escaping, shell-free argv arrays, source-only no-network guarantee, input/output
alias guard, private temporary test homes and explicit non-success states. Tests
exercise injection labels, malformed JSON/types, conflicting IDs, command failures
and unavailable tools. No secrets/real account data in fixtures or artifacts.

Main integration finding: VIZ-VERIFY-SCALE-01's small-static row conflicted with a
later 'anything that leaves the conversation' row and the environment reference's
browser-available=>inspect rule. Narrowed the former to PDF/print/paged reports and
the latter to computed/exported or defect verification. Merely saving/sharing static
HTML is not an escalation. SVG measurement recipes now inherit the same boundary.
This is user-requested policy preservation, not an exception to PDF truthfulness.
