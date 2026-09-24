# English report authoring with Korean source facts

Use this route when the sources are Korean and the report must read as native English. Preserve the source facts first, then write for the English genre. A decision memo should state the decision and tradeoffs; a research synthesis should preserve conflict and unresolved questions; a reference should define terms without manufacturing an ask.

## Locale input

Pass an explicit config to `validateLocale`, `formatValue`, and `renderLocalizedExample`:

- `sourceLanguages`: the languages actually present in source material.
- `outputLanguage`: the language of the visible report. The renderer supports the curated `ko` and `en` example labels.
- `locale`: the exact `Intl` locale for dates, numbers, and currency.
- `paperSize`: `A4` or `Letter`, selected independently of language.
- `formats`: explicit `date`, `number`, `currency`, and `unit` formatting options.

The six JSON examples under `assets/report-examples/` carry these fields in `localeConfig`. Korean examples use A4 and English examples use Letter to exercise both paths; this is fixture coverage, not a rule tying paper size to language.

The paged-report exporter checks `@page` content literals against explicit
`<html lang>`. Korean or dotted date literals in a non-Korean document are P2
review findings. Missing `lang` records an unresolved assumption; language is
not inferred from body text.

## Semantic pairing

Paired examples keep the same question, source, claim, fact, and quotation IDs. The `semantics` block keeps raw values, canonical units, denominators, qualification markers, and claim-strength markers. Localized labels and prose may differ. `compareSemanticPair(source, target)` checks the declared fields only; it does not determine whether arbitrary prose is a faithful translation or whether a source supports a claim.

Use a bilingual reviewer to compare visible titles, summaries, section prose, captions, accessible descriptions, source notes, limitations, and translated quotations against the frozen source facts. Record that review separately from layout or PDF checks.

Translated quotations retain `originalText`, `sourceLanguage`, and `sourceRef`. The English quotation also sets `translated: true` and a visible `translationMarker`. Do not replace the Korean original with an English-only paraphrase.

## Values and units

`formatValue({raw, kind, currency, unit}, config)` returns `{raw, display}` and never mutates `raw`. Canonical semantic units remain identical across the pair. A localized `displayUnit` may change visible grammar, such as `명` and `participants`, while the paired `unit` marker stays `participant`.

Keep the denominator and qualification visible beside each displayed value. Do not localize a percentage, currency, or date by editing its raw value.

## Produce fixture HTML

From the repository root, produce an A4 Korean fixture and a Letter English fixture with no network access:

```sh
node plugins/codexclaw/skills/dev-visualizer/scripts/report-locale.mjs plugins/codexclaw/skills/dev-visualizer/assets/report-examples/decision-ko.json > /tmp/report-locale-decision-ko-a4.html
node plugins/codexclaw/skills/dev-visualizer/scripts/report-locale.mjs plugins/codexclaw/skills/dev-visualizer/assets/report-examples/reference-en.json > /tmp/report-locale-reference-en-letter.html
```

The CLI reads frozen JSON, validates the example and locale config, escapes all prose into inert HTML text, and writes static HTML to standard output. It does not open a browser, fetch resources, or certify semantic review. Use the repository exporter and its explicit `--paper-size` option for the later PDF smoke.
