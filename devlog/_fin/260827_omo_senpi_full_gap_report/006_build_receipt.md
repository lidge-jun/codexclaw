# Build and render receipt

Date: 2026-08-27
Artifact: `output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf`

## Final build

- 42 A4 pages.
- 5 MECE pillars, 20 diagnostic domains, 5 strategic programs.
- 18+ vector exhibits plus adjacent text alternatives/tables.
- Pages 40–42: method, page-to-source map, score/N-E ledger.
- SHA-256: `09bc0e6071e79c5771d02612ef4bbeea680563c03cafa7b0e36595e8528daaee`.
- Size: 160,718 bytes.

## Verification

```text
PDF_VERIFY PASS pages=42 contacts=3
DELTA_VERIFY PASS rows=11
INSPECTION_LEDGER PASS rows=42 defects=0
MESSENGER_EVIDENCE PASS 35 tests, 0 fail
Pages: 42
Page size: 595.276 x 841.89 pts (A4)
Encrypted: no
JavaScript: no
Form: none
```

The PDF verifier reopened the artifact with pypdf and pdfplumber, checked exact page count and A4 bounds, rejected encryption/JavaScript/forms, rendered all pages with Poppler, checked text bounds and nonblank pixels, and built three contact sheets.

Visual review covered all three v8 contact sheets (pages 1–14, 15–28, 29–42) plus high-detail checks of pages 1, 7, 9, 10, 17, 23–25, 31, 35–37, and 40–42. The final pass includes the repaired page-41 source/footer collision; 2-column score/flow diagnostics with observed evidence and decisions; factual exhibit readouts; claim-basis strips; dependency-rich workstream roadmaps; domain-level owner/KPI/risk strips; exact operating formulas; and reconciled source codes.

Remote/messenger confidence is anchored to shipped runner and command code plus focused executable tests: `runner.test.ts` and `gateway-commands.test.ts` completed with 35 passes and zero failures.

## Evidence limits retained in report

- Scores are directional maturity judgments, not controlled performance benchmarks.
- N/E is excluded, not scored zero.
- OMO beta’s exact Senpi peer `2026.8.26-2` was not materialized; standalone Senpi `2026.8.27` remains a bounded comparison.
- Current remote GitHub exact-head certification was not refreshed for this artifact task.
- Host implicit skill loading and model compliance remain unobservable.
