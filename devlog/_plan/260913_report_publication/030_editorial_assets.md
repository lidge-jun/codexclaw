# Evidence-led editorial assets

Status: DONE

The report route now covers analytical briefs regardless of page count. It keeps
its existing entrypoint and assigns writing, source binding, print preparation and
final review to explicit stages. REPORT-VOICE-01 separates observation, inference,
hypothesis, attribution and recommendation before sentence polishing. Intent is
not inferred from implementation size; short briefs are not padded into reports.

## Research and design decision

Aside researched public consulting reports. Direct primary McKinsey PDF screenshots
were inspected on physical pages 2 and 4 (printed pages 1 and 3). Those pages use
multi-line headings, large statistics and attributed tinted commentary. Therefore
the old universal design bans were revised into a quiet CXC profile rather than
presented as an industry-wide rule. Bain mirror observations were not promoted to
verified primary evidence. The source ledger retains primary URLs and limits.

The original Korean sample now has cover, contents, a self-contained answer,
evidence, conditional action and appendix. Its source model explicitly identifies
fictional cohorts/costs. It never calls alternating allocation random, converts
short-term association into causation, or treats a proposed plan as completed.
`consulting-ko.css` owns reusable print tokens; the manifest selects actual font
files. No font binary, branded artwork or private source report is committed.

## Render and independent review

An existing Playwright 1.59.1 installation with Chromium 152.0.7977.83 produced
six A4 pages in two passes. All four contents entries matched pages 3/4/5/6.
The only emitted font families were locally pinned Pretendard Regular and
SemiBold (local metadata Version 1.309), both embedded.

An independent Aside fresh reader viewed all six rendered PNGs and recovered
the conditional expansion recommendation, 12% versus 8% observation, 1,400 KRW
cost difference, nonrandom allocation limit and next action. It reported no
clipping, overlap or broken Hangul. This is a bounded sample review, not an
authoritative guarantee for every future report. The graph source already
identifies both 1,000-person samples and nonrandom allocation; uncertainty is
explicit in the claim and surrounding source note.

The exporter's single P2 is 42% empty space below summary text on page 3. The
reader reported that it did not obstruct understanding, with mild visual
imbalance. It is retained for a self-contained summary-page boundary, not
silently changed to an automated PASS or filled with unrelated text.

Final export after runtime hardening matched every pixel of all six independently
reviewed page images. Final PDF SHA-256:
`bd717d261c4a70b8017b9a5d7b896bcdea91c293059c99cfb18caed6abbeab23`.
Artifacts and full private evidence stay in the task-owned local evidence directory.

## Independent code-review disposition

Accepted: hidden/non-leaf contents slots could silently corrupt the contents.
The browser now rejects those cases; real-browser negatives cover them. Empty
receipt placeholders and equivalent uppercase hashes were also hardened.
Rejected: the claimed promise-serialization defect does not match the code,
which awaits the promise inside page.evaluate. A delayed content-update test
passes on the installed browser. Manifest strictness and trusted receipt
producers are documented contract boundaries, not undisclosed guarantees.

Current focused proof: 76 dependency-free tests and 12 explicit browser smoke
tests passed. Full-suite and final publication receipts are recorded separately.
