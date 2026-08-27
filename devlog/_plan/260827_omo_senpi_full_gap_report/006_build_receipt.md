# Build and render receipt

Date: 2026-08-27
Artifact: `output/pdf/codexclaw-omo-senpi-gap-analysis-ko.pdf`

## Final build

- 42 A4 pages.
- 5 MECE pillars, 20 diagnostic domains, 5 strategic programs.
- 18+ vector exhibits plus adjacent text alternatives/tables.
- Pages 40–42: method, page-to-source map, score/N-E ledger.
- SHA-256: `28f2d1c2946b5b7e10bdbb832018da18e1f974c053a7f9d384e5cdc4c860c5d0`.
- Size: 119,661 bytes.

## Verification

```text
PDF_VERIFY PASS pages=42 contacts=3
DELTA_VERIFY PASS rows=11
INSPECTION_LEDGER PASS rows=42 defects=0
Pages: 42
Page size: 595.276 x 841.89 pts (A4)
Encrypted: no
JavaScript: no
Form: none
```

The PDF verifier reopened the artifact with pypdf and pdfplumber, checked exact page count and A4 bounds, rejected encryption/JavaScript/forms, rendered all pages with Poppler, checked text bounds and nonblank pixels, and built three contact sheets.

Visual review covered all three contact sheets (pages 1–14, 15–28, 29–42) plus high-detail checks of the cover, maturity heatmap, operator console, maintainability, operating model, and appendix pages. The first draft’s page-42 clipping and console-caption spacing were repaired before the final pass.

## Evidence limits retained in report

- Scores are directional maturity judgments, not controlled performance benchmarks.
- N/E is excluded, not scored zero.
- OMO beta’s exact Senpi peer `2026.8.26-2` was not materialized; standalone Senpi `2026.8.27` remains a bounded comparison.
- Current remote GitHub exact-head certification was not refreshed for this artifact task.
- Host implicit skill loading and model compliance remain unobservable.
