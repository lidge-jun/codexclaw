# Evidence and export contract

Status: DONE

The existing exporter now delegates browser readiness, PDF diagnostics, local
font binding and claim references to feature-local modules. No dependency was
added or installed. Existing invocation and --qa-only remain; CLI-only output
is explicitly BLOCKED instead of implying resource verification.

The optional installed Playwright route preserves one DOM across TOC passes,
waits for font/image/chart completion, checks failures, and uses isolated browser
state. The final receipt command binds seven evidence checks to actual PDF bytes.
Neither structured references nor a hash proves semantic truth: fresh-reader and
page-image review remain mandatory and are never generated from export success.

Verification:
- `node --test plugins/codexclaw/test/report-*.test.mjs`: 74 passed, 0 failed.
- `node --test plugins/codexclaw/test/report-browser.smoke.mjs`: 8 passed, 0 failed
  with installed Playwright 1.59.1 and its existing Chromium.
- Negatives include missing tools, stale hashes, missing source/claim IDs,
  unsourced attribution, font mismatches, ambiguous TOC titles, image failure,
  page exceptions, false completion and canvas without an explicit signal.

The font specification example must be completed with verified local files and
metadata. No font bytes, private reports, external page captures or account data
are included in the repository. Page composition and end-to-end Korean PDF proof
follow in 030.
