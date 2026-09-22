import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  compareSemanticPair,
  formatValue,
  renderLocalizedExample,
  validateLocale,
} from "../skills/dev-visualizer/scripts/report-locale.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = join(here, "..", "skills", "dev-visualizer");
const examplesRoot = join(skillRoot, "assets", "report-examples");
const scriptPath = join(skillRoot, "scripts", "report-locale.mjs");
const fixture = (genre, language) =>
  JSON.parse(readFileSync(join(examplesRoot, `${genre}-${language}.json`), "utf8"));

const validConfig = () => ({
  sourceLanguages: ["ko"],
  outputLanguage: "en",
  locale: "en-US",
  paperSize: "Letter",
  formats: {
    date: { dateStyle: "long", timeZone: "UTC" },
    number: { maximumFractionDigits: 1, useGrouping: true },
    currency: {
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    },
    unit: { maximumFractionDigits: 1, useGrouping: true, separator: " " },
  },
});

test("the six locale examples have valid explicit configs and paired semantics", () => {
  for (const genre of ["decision", "research", "reference"]) {
    const ko = fixture(genre, "ko");
    const en = fixture(genre, "en");
    assert.deepEqual(validateLocale(ko.localeConfig), [], `${genre}-ko locale config`);
    assert.deepEqual(validateLocale(en.localeConfig), [], `${genre}-en locale config`);
    assert.equal(ko.localeConfig.paperSize, "A4");
    assert.equal(en.localeConfig.paperSize, "Letter");
    assert.deepEqual(compareSemanticPair(ko, en), [], `${genre} semantic pair`);
    assert.deepEqual(
      [renderLocalizedExample(ko, ko.localeConfig).lang, renderLocalizedExample(en, en.localeConfig).lang],
      ["ko", "en"],
      `${genre} render pair`,
    );
  }
});

test("validateLocale rejects absent, malformed, implicit, and unknown config", () => {
  const cases = [
    [null, "config"],
    [{}, "sourceLanguages"],
    [{ ...validConfig(), sourceLanguages: [] }, "sourceLanguages"],
    [{ ...validConfig(), outputLanguage: "" }, "outputLanguage"],
    [{ ...validConfig(), locale: "not_a_locale" }, "locale"],
    [{ ...validConfig(), paperSize: undefined }, "paperSize"],
    [{ ...validConfig(), paperSize: "Legal" }, "paperSize"],
    [{ ...validConfig(), formats: { ...validConfig().formats, unit: undefined } }, "formats.unit"],
    [{ ...validConfig(), surprise: true }, "config.surprise"],
  ];

  for (const [config, expectedId] of cases) {
    assert.ok(validateLocale(config).some((issue) => issue.id === expectedId), expectedId);
  }
});

test("formatValue preserves raw values while applying explicit locale formats", () => {
  const config = validConfig();
  assert.deepEqual(formatValue({ raw: 1234.5, kind: "number" }, config), {
    raw: 1234.5,
    display: "1,234.5",
  });
  assert.deepEqual(formatValue({ raw: 1234, kind: "currency", currency: "USD" }, config), {
    raw: 1234,
    display: "$1,234",
  });
  assert.deepEqual(formatValue({ raw: 420, kind: "unit", unit: "ms" }, config), {
    raw: 420,
    display: "420 ms",
  });
  assert.deepEqual(formatValue({ raw: "2026-09-22", kind: "date" }, config), {
    raw: "2026-09-22",
    display: "September 22, 2026",
  });
});

test("formatValue rejects invalid value contracts and never normalizes units", () => {
  const config = validConfig();
  for (const value of [
    null,
    { raw: NaN, kind: "number" },
    { raw: 1, kind: "currency" },
    { raw: 1, kind: "unit", unit: "" },
    { raw: "not-a-date", kind: "date" },
    { raw: 1, kind: "ratio" },
  ]) {
    assert.throws(() => formatValue(value, config), /value/i);
  }
  assert.equal(formatValue({ raw: 7, kind: "unit", unit: "%p" }, config).display, "7 %p");
});

for (const raw of [
  "2026-02-30", "2025-02-29", "1900-02-29", "2026-04-31", "2026-00-10",
  "2026-13-01", "2026-01-00", "2026-01-32", "2026-2-03", "09/22/2026",
  "2026", "2026-09-22T00:00:00", "2026-09-22T24:00:00Z",
  "2026-02-30T12:00:00Z", "2026-09-22T12:60:00Z", "2026-09-22T12:00:60Z",
  "2026-09-22T12:00:00+09:00", "2026-09-22T12:00:00.1234Z", " 2026-09-22 ",
]) test(`BUG-L2: reject invalid or unsupported serialized date ${raw}`, () => {
  assert.throws(() => formatValue({ raw, kind: "date" }, validConfig()), /Invalid value:.*raw/);
});

test("BUG-L2: accept real calendar dates and explicit UTC timestamps without altering raw", () => {
  for (const [raw, display] of [
    ["2024-02-29", "February 29, 2024"],
    ["2000-02-29", "February 29, 2000"],
    ["2026-02-28", "February 28, 2026"],
    ["2026-09-22T23:59:59Z", "September 22, 2026"],
    ["2026-09-22T00:00:00.123Z", "September 22, 2026"],
  ]) {
    assert.deepEqual(formatValue({ raw, kind: "date" }, validConfig()), { raw, display });
  }
});

const invalidFactValues = [
  ["impossible date", { kind: "date", raw: "2026-02-30" }],
  ["ambiguous date", { kind: "date", raw: "09/22/2026" }],
  ["numeric date", { kind: "date", raw: 20260922 }],
  ["missing raw", { kind: "number" }],
  ["null raw", { kind: "number", raw: null }],
  ["string number", { kind: "number", raw: "180" }],
  ["nonfinite number", { kind: "number", raw: Infinity }],
  ["NaN number", { kind: "number", raw: NaN }],
  ["string quantity", { kind: "unit", raw: "180", unit: "millisecond" }],
  ["missing currency", { kind: "currency", raw: 180 }],
  ["invalid currency", { kind: "currency", raw: 180, currency: "US" }],
  ["currency type", { kind: "currency", raw: 180, currency: 123 }],
  ["unit type", { kind: "unit", raw: 180, unit: 123 }],
  ["unknown kind", { kind: "ratio", raw: 180 }],
];

for (const [name, value] of invalidFactValues) {
  test(`BUG-L3: shared value contract rejects ${name}, even when both unreferenced facts agree`, () => {
    const source = fixture("reference", "ko");
    const target = fixture("reference", "en");
    // Keep each invalid fact outside section and figure references to exercise full validation.
    for (const example of [source, target]) {
      const fact = { ...example.semantics.facts[0], id: "F-unreferenced", ...value };
      if (!("raw" in value)) delete fact.raw;
      example.semantics.facts.push(fact);
    }
    assert.throws(() => formatValue(value, validConfig()), /Invalid value:/);
    const issues = compareSemanticPair(source, target);
    for (const side of ["source", "target"]) {
      assert.ok(issues.some((entry) => entry.id.startsWith(`${side}.semantic.facts.F-unreferenced.`)), side);
    }
    assert.throws(() => renderLocalizedExample(target, target.localeConfig), /Invalid example:.*F-unreferenced/);
  });
}

for (const collection of ["figures", "quotations"]) {
  test(`BUG-L1: reject orphan ${collection} before content can be silently filtered out`, () => {
    const example = fixture("decision", "en");
    example[collection][0].sectionId = "missing-section";
    assert.throws(() => renderLocalizedExample(example, example.localeConfig),
      new RegExp(`Invalid example:.*example\\.${collection}\\..*\\.sectionId`));
  });
}

test("BUG-L1: reject duplicate section IDs", () => {
  const example = fixture("decision", "en");
  example.sections.push(structuredClone(example.sections[0]));
  assert.throws(() => renderLocalizedExample(example, example.localeConfig), /Invalid example:.*example.sections.decision/);
});

test("BUG-L1: distinct valid sections retain their assigned figures and quotations", () => {
  const example = fixture("decision", "en");
  example.sections.push({ id: "second", title: "Second section", paragraphs: ["Second body"] });
  example.figures[0].sectionId = "second";
  example.quotations[0].sectionId = "second";
  const { html } = renderLocalizedExample(example, example.localeConfig);
  const sections = [...html.matchAll(/<section id="([^"]+)">([\s\S]*?)<\/section>/g)];
  const first = sections.find((match) => match[1] === "decision")[2];
  const second = sections.find((match) => match[1] === "second")[2];
  assert.doesNotMatch(first, /<figure/);
  assert.equal([...second.matchAll(/<figure\b/g)].length, 2);
  assert.match(second, /id="figure-decision-outcomes"/);
  assert.match(second, /class="quotation"/);
});

test("compareSemanticPair detects each declared invariant without judging prose", () => {
  const source = fixture("decision", "ko");
  const mutations = [
    ["question ids", (target) => target.semantics.questionIds.push("Q-extra"), "semantic.questionIds"],
    ["source ids", (target) => target.semantics.sourceIds.pop(), "semantic.sourceIds"],
    ["claim ids", (target) => { target.semantics.claims[0].id = "C-other"; }, "semantic.claimIds"],
    ["claim strength", (target) => { target.semantics.claims[0].strength = "causal"; }, "semantic.claims.C1.strength"],
    ["claim qualification", (target) => { target.semantics.claims[0].qualification = "none"; }, "semantic.claims.C1.qualification"],
    ["fact raw value", (target) => { target.semantics.facts[0].raw = 121; }, "semantic.facts.F1.raw"],
    ["fact unit", (target) => { target.semantics.facts[0].unit = "%"; }, "semantic.facts.F1.unit"],
    ["fact denominator", (target) => { target.semantics.facts[0].denominator = "all-users"; }, "semantic.facts.F1.denominator"],
    ["fact qualification", (target) => { target.semantics.facts[0].qualification = "causal"; }, "semantic.facts.F1.qualification"],
  ];

  for (const [name, mutate, expectedId] of mutations) {
    const target = fixture("decision", "en");
    mutate(target);
    const issues = compareSemanticPair(source, target);
    assert.ok(issues.some((issue) => issue.id === expectedId), name);
  }

  const proseOnly = fixture("decision", "en");
  proseOnly.summary = "Completely different wording that requires human review.";
  assert.deepEqual(compareSemanticPair(source, proseOnly), []);
});

test("compareSemanticPair reports malformed serialized semantics instead of throwing", () => {
  const source = fixture("decision", "ko");
  const target = fixture("decision", "en");
  target.semantics.claims[0] = null;
  target.semantics.facts = "not-an-array";
  target.quotations = [{ id: "QTE1" }];
  assert.doesNotThrow(() => compareSemanticPair(source, target));
  assert.ok(compareSemanticPair(source, target).length > 0);
});

test("translated quotations retain the original source and a visible marker", () => {
  const source = fixture("research", "ko");
  const target = fixture("research", "en");
  target.quotations[0].originalText = "바뀐 원문";
  assert.ok(compareSemanticPair(source, target).some((issue) => issue.id.endsWith(".originalText")));

  const missingMarker = fixture("research", "en");
  missingMarker.quotations[0].translationMarker = "";
  assert.ok(compareSemanticPair(source, missingMarker).some((issue) => issue.id.endsWith(".translationMarker")));

  for (const translated of [false, undefined, "true", 1]) {
    const foreignQuote = fixture("research", "en");
    foreignQuote.quotations[0].translated = translated;
    assert.throws(() => renderLocalizedExample(foreignQuote, foreignQuote.localeConfig),
      /Invalid example:.*example.quotations.QTE1.translated/, `foreign quotation flag: ${translated}`);
  }
  const translatedExample = fixture("research", "en");
  const { html } = renderLocalizedExample(translatedExample, translatedExample.localeConfig);
  const original = html.match(/<p class="quote-original" lang="ko"><strong>[^<]*<\/strong> ([^<]*)<\/p>/);
  assert.ok(original, "the translated quotation retains its original-language paragraph");
  assert.equal(original[1], "두 코호트는 같은 효과를 추정하지 않는다.");
});

test("renderLocalizedExample emits localized static HTML, furniture, captions, and accessibility text", () => {
  const example = fixture("decision", "en");
  const result = renderLocalizedExample(example, example.localeConfig);

  assert.equal(result.lang, "en");
  assert.equal(result.paperSize, "Letter");
  assert.match(result.html, /<html lang="en">/);
  assert.match(result.html, /@page\s*\{\s*size:\s*Letter;/);
  assert.match(result.html, /content: "Page " counter\(page\) " \/ " counter\(pages\)/);
  assert.match(result.html, /@media print/);
  assert.match(result.html, /figure dl \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(result.html, /\.quotation, \.source-line \{ break-inside: avoid; \}/);
  assert.match(result.html, />Contents</);
  assert.match(result.html, />Sources</);
  assert.match(result.html, />Limitations</);
  assert.match(result.html, /Expand first-month support only within a measured cohort/);
  assert.match(result.html, /120 subscribers/);
  assert.match(result.html, /1,000 enrolled subscribers/);
  assert.match(result.html, /Illustrative 30-day cohort; assignment was not randomized\./);
  assert.match(result.html, /Translated from Korean/);
  assert.match(result.html, /<figcaption[^>]*>Figure 1\./);
  assert.match(result.html, /aria-describedby="figure-decision-outcomes-description"/);
});

test("renderLocalizedExample uses Korean labels from outputLanguage rather than locale guessing", () => {
  const example = fixture("reference", "ko");
  const result = renderLocalizedExample(example, example.localeConfig);
  assert.equal(result.lang, "ko");
  assert.match(result.html, />목차</);
  assert.match(result.html, />자료</);
  assert.match(result.html, />한계</);
  assert.match(result.html, /2026년 9월 22일/);
});

test("the long English reference label remains visible and linked to its exact denominator", () => {
  const example = fixture("reference", "en");
  const { html } = renderLocalizedExample(example, example.localeConfig);
  assert.match(html, /95th-percentile end-to-end processing latency across completed requests/);
  assert.match(html, /12,000 completed requests/);
  assert.match(html, /Illustrative single-day snapshot/);
});

test("renderLocalizedExample rejects missing localized fields and config-language mismatch", () => {
  const example = fixture("reference", "en");
  for (const [name, mutate, expected] of [
    ["missing cited S2", (copy) => { copy.sourceNotes = copy.sourceNotes.filter((note) => note.id !== "S2"); }, /example.sourceNotes.S2/],
    ["duplicate S2", (copy) => { copy.sourceNotes.push(structuredClone(copy.sourceNotes[1])); }, /example.sourceNotes.S2/],
    ["semantic source without note", (copy) => { copy.semantics.sourceIds.push("S3"); }, /example.sourceNotes.S3/],
  ]) {
    const copy = structuredClone(example);
    mutate(copy);
    assert.throws(() => renderLocalizedExample(copy, copy.localeConfig), expected, name);
  }
  // Input ordering is immaterial; each declared source still gets exactly one visible note.
  const reordered = structuredClone(example);
  reordered.sourceNotes.reverse();
  const { html } = renderLocalizedExample(reordered, reordered.localeConfig);
  assert.deepEqual([...html.matchAll(/<li id="source-([^"]+)"/g)].map((match) => match[1]), ["S2", "S1"]);
  for (const mutate of [
    (copy) => { copy.title = ""; },
    (copy) => { copy.sections = []; },
    (copy) => { copy.sourceNotes = []; },
    (copy) => { copy.figures[0].caption = ""; },
    (copy) => { copy.figures[0].accessibleDescription = ""; },
    (copy) => { copy.quotations[0].translationMarker = ""; },
    (copy) => { copy.limitations = { unexpected: true }; },
    (copy) => { copy.semantics.facts = "not-an-array"; },
  ]) {
    const copy = structuredClone(example);
    mutate(copy);
    assert.throws(() => renderLocalizedExample(copy, copy.localeConfig), /example/i);
  }

  assert.throws(
    () => renderLocalizedExample(example, { ...example.localeConfig, outputLanguage: "ko", locale: "ko-KR" }),
    /language/i,
  );
});

test("renderLocalizedExample escapes prose and attributes into inert text", () => {
  const example = fixture("decision", "en");
  example.title = '<script>alert("title")</script>';
  example.sections[0].paragraphs[0] = '<img src=x onerror="alert(1)">';
  example.figures[0].accessibleDescription = 'Outcome chart" onmouseover="alert(2)';
  const { html } = renderLocalizedExample(example, example.localeConfig);

  assert.doesNotMatch(html, /<script>|<img src=x|onmouseover="alert\(2\)"/);
  assert.match(html, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /Outcome chart&quot; onmouseover=&quot;alert\(2\)/);
});

test("the CLI renders a frozen fixture without account or network state", () => {
  const home = mkdtempSync(join(tmpdir(), "report-locale-home-"));
  try {
    const run = spawnSync(process.execPath, [scriptPath, join(examplesRoot, "research-en.json")], {
      cwd: skillRoot,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: home, NO_PROXY: "*" },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, "");
    assert.match(run.stdout, /^<!doctype html>/);
    assert.match(run.stdout, /<html lang="en">/);
    assert.match(run.stdout, /Evidence remains mixed across the two illustrative cohorts/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
