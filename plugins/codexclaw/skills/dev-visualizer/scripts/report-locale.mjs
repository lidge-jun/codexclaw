import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PAPER_SIZES = new Set(["A4", "Letter"]);
const VALUE_KINDS = new Set(["date", "number", "currency", "unit"]);
const TOP_LEVEL_CONFIG_KEYS = new Set([
  "sourceLanguages",
  "outputLanguage",
  "locale",
  "paperSize",
  "formats",
]);
const FORMAT_KEYS = {
  date: new Set(["dateStyle", "timeZone"]),
  number: new Set(["minimumFractionDigits", "maximumFractionDigits", "useGrouping"]),
  currency: new Set([
    "currencyDisplay",
    "minimumFractionDigits",
    "maximumFractionDigits",
    "useGrouping",
  ]),
  unit: new Set(["minimumFractionDigits", "maximumFractionDigits", "useGrouping", "separator"]),
};
const RUNNING_LABELS = {
  en: {
    contents: "Contents",
    sources: "Sources",
    limitations: "Limitations",
    runningHeader: "Running header",
    sourceRefs: "Sources",
    original: "Original Korean",
    page: "Page",
    report: "Report example",
  },
  ko: {
    contents: "목차",
    sources: "자료",
    limitations: "한계",
    runningHeader: "면주",
    sourceRefs: "자료",
    original: "한국어 원문",
    page: "쪽",
    report: "보고서 예시",
  },
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const issue = (id, msg) => ({ level: "P0", id, msg });

function validLanguageTag(value) {
  if (!isText(value)) return false;
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch {
    return false;
  }
}

function unknownKeys(value, allowed, prefix) {
  if (!isObject(value)) return [];
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => issue(`${prefix}.${key}`, `Unknown ${prefix} field: ${key}`));
}

function validateFormat(name, value) {
  const issues = [];
  if (!isObject(value)) return [issue(`formats.${name}`, `formats.${name} must be an object`)];
  issues.push(...unknownKeys(value, FORMAT_KEYS[name], `formats.${name}`));
  for (const key of ["minimumFractionDigits", "maximumFractionDigits"]) {
    if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 20)) {
      issues.push(issue(`formats.${name}.${key}`, `${key} must be an integer from 0 to 20`));
    }
  }
  if (value.useGrouping !== undefined && typeof value.useGrouping !== "boolean") {
    issues.push(issue(`formats.${name}.useGrouping`, "useGrouping must be boolean"));
  }
  return issues;
}

export function validateLocale(config) {
  if (!isObject(config)) return [issue("config", "Locale config must be an object")];
  const issues = unknownKeys(config, TOP_LEVEL_CONFIG_KEYS, "config");

  if (
    !Array.isArray(config.sourceLanguages) ||
    config.sourceLanguages.length === 0 ||
    !config.sourceLanguages.every(validLanguageTag) ||
    new Set(config.sourceLanguages).size !== config.sourceLanguages.length
  ) {
    issues.push(issue("sourceLanguages", "sourceLanguages must be a nonempty list of unique language tags"));
  }
  if (!validLanguageTag(config.outputLanguage)) {
    issues.push(issue("outputLanguage", "outputLanguage must be an explicit language tag"));
  }
  if (!validLanguageTag(config.locale)) {
    issues.push(issue("locale", "locale must be a valid Intl locale"));
  }
  if (!PAPER_SIZES.has(config.paperSize)) {
    issues.push(issue("paperSize", "paperSize must be explicitly A4 or Letter"));
  }
  if (!isObject(config.formats)) {
    issues.push(issue("formats", "formats must define date, number, currency, and unit"));
    return issues;
  }
  issues.push(...unknownKeys(config.formats, new Set(Object.keys(FORMAT_KEYS)), "formats"));
  for (const name of Object.keys(FORMAT_KEYS)) issues.push(...validateFormat(name, config.formats[name]));

  if (isObject(config.formats.date)) {
    if (!["full", "long", "medium", "short"].includes(config.formats.date.dateStyle)) {
      issues.push(issue("formats.date.dateStyle", "dateStyle must be full, long, medium, or short"));
    }
    if (!isText(config.formats.date.timeZone)) {
      issues.push(issue("formats.date.timeZone", "timeZone must be explicit"));
    }
  }
  if (isObject(config.formats.currency) && !["symbol", "narrowSymbol", "code", "name"].includes(config.formats.currency.currencyDisplay)) {
    issues.push(issue("formats.currency.currencyDisplay", "currencyDisplay must be explicit"));
  }
  if (isObject(config.formats.unit) && (typeof config.formats.unit.separator !== "string" || config.formats.unit.separator.length === 0)) {
    issues.push(issue("formats.unit.separator", "unit separator must be explicit text"));
  }

  if (!issues.length) {
    try {
      new Intl.DateTimeFormat(config.locale, config.formats.date);
      new Intl.NumberFormat(config.locale, config.formats.number);
      new Intl.NumberFormat(config.locale, { ...config.formats.currency, style: "currency", currency: "USD" });
      const { separator: _separator, ...unitNumber } = config.formats.unit;
      new Intl.NumberFormat(config.locale, unitNumber);
    } catch (error) {
      issues.push(issue("formats", `Intl rejected the locale formats: ${error.message}`));
    }
  }
  return issues;
}

function valueError(message) {
  throw new TypeError(`Invalid value: ${message}`);
}

/** Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss[.sss]Z; no implicit timezone or date rollover. */
function validSerializedDate(raw) {
  if (typeof raw !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(raw)) return false;
  const canonical = raw.length === 10 ? `${raw}T00:00:00.000Z`
    : raw.length === 20 ? `${raw.slice(0, -1)}.000Z` : raw;
  const date = new Date(canonical);
  // Round-trip every supplied calendar/time component so February 30 and hour 24 cannot roll forward.
  return Number.isFinite(date.getTime()) && date.toISOString() === canonical;
}

/** Shared boundary for formatting and semantic facts, including facts not used by a figure. */
function validateValue(value) {
  if (!isObject(value)) return [issue("value", "expected a value object")];
  const issues = [];
  if (!VALUE_KINDS.has(value.kind)) issues.push(issue("kind", "expected a supported kind"));
  if (!Object.hasOwn(value, "raw")) issues.push(issue("raw", "raw is required"));
  else if (value.kind === "date") {
    if (!validSerializedDate(value.raw)) issues.push(issue("raw", "raw must be a real YYYY-MM-DD date or UTC YYYY-MM-DDTHH:mm:ss[.sss]Z timestamp"));
  } else if (VALUE_KINDS.has(value.kind) && (typeof value.raw !== "number" || !Number.isFinite(value.raw))) {
    issues.push(issue("raw", `${value.kind} raw must be a finite number`));
  }
  if ((value.kind === "currency" || value.currency !== undefined) &&
      (typeof value.currency !== "string" || !/^[A-Za-z]{3}$/.test(value.currency))) {
    issues.push(issue("currency", "currency must be a three-letter currency code"));
  }
  if ((value.kind === "unit" || value.unit !== undefined) && !isText(value.unit)) {
    issues.push(issue("unit", "unit must be nonempty text"));
  }
  return issues;
}

export function formatValue(value, config) {
  const configIssues = validateLocale(config);
  if (configIssues.length) throw new TypeError(`Invalid locale config: ${configIssues.map((item) => item.id).join(", ")}`);
  const valueIssues = validateValue(value);
  if (valueIssues.length) valueError(valueIssues.map((item) => item.msg).join(", "));

  const { raw, kind } = value;
  let display;
  if (kind === "date") {
    const date = new Date(raw);
    display = new Intl.DateTimeFormat(config.locale, config.formats.date).format(date);
  } else {
    if (kind === "number") display = new Intl.NumberFormat(config.locale, config.formats.number).format(raw);
    if (kind === "currency") {
      try {
        display = new Intl.NumberFormat(config.locale, {
          ...config.formats.currency,
          style: "currency",
          currency: value.currency,
        }).format(raw);
      } catch (error) {
        valueError(`currency is invalid: ${error.message}`);
      }
    }
    if (kind === "unit") {
      const { separator, ...numberOptions } = config.formats.unit;
      display = `${new Intl.NumberFormat(config.locale, numberOptions).format(raw)}${separator}${value.unit}`;
    }
  }
  return { raw, display };
}

function indexById(items, id, issues) {
  if (!Array.isArray(items)) {
    issues.push(issue(id, `${id} must be an array`));
    return new Map();
  }
  const indexed = new Map();
  for (const item of items) {
    if (!isObject(item) || !isText(item.id)) {
      issues.push(issue(id, `${id} entries require ids`));
    } else if (indexed.has(item.id)) {
      issues.push(issue(`${id}.${item.id}`, `Duplicate id: ${item.id}`));
    } else {
      indexed.set(item.id, item);
    }
  }
  return indexed;
}

function idList(value, id, issues) {
  if (!Array.isArray(value) || !value.every(isText) || new Set(value).size !== value.length) {
    issues.push(issue(id, `${id} must be a unique text-id list`));
    return [];
  }
  return [...value].sort();
}

function compareField(issues, id, source, target, field) {
  if (!Object.is(source?.[field], target?.[field])) {
    issues.push(issue(`${id}.${field}`, `${field} changed across the locale pair`));
  }
}

function validateSemantics(example, side) {
  const issues = [];
  const semantics = example?.semantics;
  if (!isObject(semantics)) return [issue(`${side}.semantics`, "semantics must be an object")];
  idList(semantics.questionIds, `${side}.semantic.questionIds`, issues);
  idList(semantics.sourceIds, `${side}.semantic.sourceIds`, issues);
  const claims = indexById(semantics.claims, `${side}.semantic.claims`, issues);
  const facts = indexById(semantics.facts, `${side}.semantic.facts`, issues);
  for (const claim of claims.values()) {
    if (!isText(claim.strength) || !isText(claim.qualification)) {
      issues.push(issue(`${side}.semantic.claims.${claim.id}`, "claim strength and qualification markers are required"));
    }
  }
  for (const fact of facts.values()) {
    for (const failure of validateValue(fact)) {
      issues.push(issue(`${side}.semantic.facts.${fact.id}.${failure.id}`, failure.msg));
    }
    if (!isText(fact.claimId) || !claims.has(fact.claimId) || !VALUE_KINDS.has(fact.kind) || !isText(fact.unit) ||
        !isText(fact.denominator) || !isText(fact.qualification)) {
      issues.push(issue(`${side}.semantic.facts.${fact.id}`, "fact requires a known claim, kind, unit, denominator, and qualification"));
    }
    if (fact.kind === "unit" && !isText(fact.displayUnit)) {
      issues.push(issue(`${side}.semantic.facts.${fact.id}.displayUnit`, "unit facts require a localized displayUnit"));
    }
  }
  return issues;
}

export function compareSemanticPair(source, target) {
  const issues = [...validateSemantics(source, "source"), ...validateSemantics(target, "target")];
  if (!isObject(source?.semantics) || !isObject(target?.semantics) ||
      !Array.isArray(source.semantics.questionIds) || !Array.isArray(target.semantics.questionIds) ||
      !Array.isArray(source.semantics.sourceIds) || !Array.isArray(target.semantics.sourceIds) ||
      !Array.isArray(source.semantics.claims) || !Array.isArray(target.semantics.claims) ||
      !Array.isArray(source.semantics.facts) || !Array.isArray(target.semantics.facts)) return issues;
  const sourceSemantic = source.semantics;
  const targetSemantic = target.semantics;

  for (const field of ["questionIds", "sourceIds"]) {
    const left = [...sourceSemantic[field]].sort();
    const right = [...targetSemantic[field]].sort();
    if (JSON.stringify(left) !== JSON.stringify(right)) issues.push(issue(`semantic.${field}`, `${field} changed across the locale pair`));
  }
  const sourceClaims = indexById(sourceSemantic.claims, "source.semantic.claims", issues);
  const targetClaims = indexById(targetSemantic.claims, "target.semantic.claims", issues);
  if (JSON.stringify([...sourceClaims.keys()].sort()) !== JSON.stringify([...targetClaims.keys()].sort())) {
    issues.push(issue("semantic.claimIds", "claim ids changed across the locale pair"));
  }
  for (const [id, claim] of sourceClaims) {
    if (!targetClaims.has(id)) continue;
    compareField(issues, `semantic.claims.${id}`, claim, targetClaims.get(id), "strength");
    compareField(issues, `semantic.claims.${id}`, claim, targetClaims.get(id), "qualification");
  }
  const sourceFacts = indexById(sourceSemantic.facts, "source.semantic.facts", issues);
  const targetFacts = indexById(targetSemantic.facts, "target.semantic.facts", issues);
  if (JSON.stringify([...sourceFacts.keys()].sort()) !== JSON.stringify([...targetFacts.keys()].sort())) {
    issues.push(issue("semantic.factIds", "fact ids changed across the locale pair"));
  }
  for (const [id, fact] of sourceFacts) {
    const paired = targetFacts.get(id);
    if (!paired) continue;
    for (const field of ["claimId", "raw", "kind", "currency", "unit", "denominator", "qualification"]) {
      compareField(issues, `semantic.facts.${id}`, fact, paired, field);
    }
  }

  const sourceQuotes = indexById(source.quotations, "source.quotations", issues);
  const targetQuotes = indexById(target.quotations, "target.quotations", issues);
  if (JSON.stringify([...sourceQuotes.keys()].sort()) !== JSON.stringify([...targetQuotes.keys()].sort())) {
    issues.push(issue("quotationIds", "quotation ids changed across the locale pair"));
  }
  for (const [id, quote] of sourceQuotes) {
    const paired = targetQuotes.get(id);
    if (!paired) {
      issues.push(issue(`quotations.${id}`, "quotation is missing from the target locale"));
      continue;
    }
    for (const field of ["originalText", "sourceLanguage", "sourceRef"]) {
      compareField(issues, `quotations.${id}`, quote, paired, field);
    }
    if (paired.sourceLanguage !== target.language && (paired.translated !== true || !isText(paired.translationMarker))) {
      issues.push(issue(`quotations.${id}.translationMarker`, "translated quotation requires an explicit marker"));
    }
  }
  return issues;
}

const escapeText = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function exampleIssues(example, config) {
  const issues = validateSemantics(example, "example");
  if (!isObject(example)) return [issue("example", "example must be an object")];
  if (example.schemaVersion !== 1) issues.push(issue("example.schemaVersion", "example schemaVersion must be 1"));
  for (const field of ["id", "genre", "language", "title", "summary"]) {
    if (!isText(example[field])) issues.push(issue(`example.${field}`, `${field} is required`));
  }
  if (example.language !== config.outputLanguage) issues.push(issue("example.language", "example language must match config outputLanguage"));
  for (const field of ["sections", "sourceNotes", "figures", "quotations", "limitations"]) {
    if (!Array.isArray(example[field]) || example[field].length === 0) issues.push(issue(`example.${field}`, `${field} must not be empty`));
  }
  const semanticSources = Array.isArray(example.semantics?.sourceIds) ? example.semantics.sourceIds : [];
  const semanticFacts = Array.isArray(example.semantics?.facts) ? example.semantics.facts : [];
  const semanticClaims = Array.isArray(example.semantics?.claims) ? example.semantics.claims : [];
  const sections = Array.isArray(example.sections) ? example.sections : [];
  const sourceNotes = Array.isArray(example.sourceNotes) ? example.sourceNotes : [];
  const figures = Array.isArray(example.figures) ? example.figures : [];
  const quotations = Array.isArray(example.quotations) ? example.quotations : [];
  const limitations = Array.isArray(example.limitations) ? example.limitations : [];
  const sectionById = indexById(sections, "example.sections", issues);
  const sourceNoteById = indexById(sourceNotes, "example.sourceNotes", issues);
  const sources = new Set(semanticSources);
  for (const sourceId of sources) {
    if (!sourceNoteById.has(sourceId)) {
      issues.push(issue(`example.sourceNotes.${sourceId}`, "each declared source requires exactly one visible source note"));
    }
  }
  const facts = new Set(semanticFacts.map((item) => item?.id));
  const claims = new Set(semanticClaims.map((item) => item?.id));
  for (const claim of semanticClaims) {
    if (!isObject(claim) || !isText(claim.text) || !isText(claim.strengthLabel) || !isText(claim.qualificationText)) {
      issues.push(issue(`example.claims.${claim?.id ?? "unknown"}`, "rendered claims require text, strengthLabel, and qualificationText"));
    }
  }
  for (const fact of semanticFacts) {
    if (!isObject(fact) || !isText(fact.label) || !isText(fact.denominatorText) || !isText(fact.qualificationText)) {
      issues.push(issue(`example.facts.${fact?.id ?? "unknown"}`, "rendered facts require label, denominatorText, and qualificationText"));
    }
  }
  for (const section of sections) {
    if (!isObject(section) || !isText(section.id) || !isText(section.title) || !Array.isArray(section.paragraphs) || !section.paragraphs.length || !section.paragraphs.every(isText)) {
      issues.push(issue("example.sections", "each section requires id, title, and paragraphs"));
    }
    for (const factId of section?.factIds ?? []) if (!facts.has(factId)) issues.push(issue(`example.sections.${section?.id ?? "unknown"}`, `unknown fact: ${factId}`));
    for (const claimId of section?.claimIds ?? []) if (!claims.has(claimId)) issues.push(issue(`example.sections.${section?.id ?? "unknown"}`, `unknown claim: ${claimId}`));
  }
  for (const note of sourceNotes) {
    if (!isObject(note) || !sources.has(note.id) || !isText(note.locator) || !isText(note.text)) issues.push(issue("example.sourceNotes", "source note must resolve and include locator and text"));
  }
  for (const figure of figures) {
    if (!sectionById.has(figure?.sectionId)) {
      issues.push(issue(`example.figures.${figure?.id ?? "unknown"}.sectionId`, "figure sectionId must resolve to a unique section"));
    }
    if (!isObject(figure) || !isText(figure.id) || !isText(figure.sectionId) || !isText(figure.caption) || !isText(figure.accessibleDescription) ||
        !Array.isArray(figure.factIds) || !figure.factIds.length || !figure.factIds.every((id) => facts.has(id)) ||
        !Array.isArray(figure.sourceRefs) || !figure.sourceRefs.length || !figure.sourceRefs.every((id) => sources.has(id))) {
      issues.push(issue("example.figures", "figure requires caption, accessible description, facts, and source references"));
    }
  }
  for (const quote of quotations) {
    if (isObject(quote) && quote.sourceLanguage !== config.outputLanguage && quote.translated !== true) {
      issues.push(issue(`example.quotations.${quote.id ?? "unknown"}.translated`, "foreign-language quotation requires translated:true to retain its original text"));
    }
    if (!sectionById.has(quote?.sectionId)) {
      issues.push(issue(`example.quotations.${quote?.id ?? "unknown"}.sectionId`, "quotation sectionId must resolve to a unique section"));
    }
    if (!isObject(quote) || !isText(quote.id) || !isText(quote.sectionId) || !isText(quote.text) || !isText(quote.originalText) ||
        !isText(quote.sourceLanguage) || !config.sourceLanguages.includes(quote.sourceLanguage) || !sources.has(quote.sourceRef) || !isText(quote.translationMarker)) {
      issues.push(issue("example.quotations", "quotation requires visible text, original text, source, language, and marker"));
    }
  }
  if (!limitations.every(isText)) issues.push(issue("example.limitations", "limitations must be visible text"));
  return issues;
}

function renderFact(fact, config) {
  const value = fact.kind === "unit" ? { ...fact, unit: fact.displayUnit } : fact;
  const { display } = formatValue(value, config);
  return `<div class="metric"><dt>${escapeText(fact.label)}</dt><dd><strong>${escapeText(display)}</strong><span>${escapeText(fact.denominatorText)}</span><span>${escapeText(fact.qualificationText)}</span></dd></div>`;
}

function renderFigure(figure, facts, labels, config) {
  const id = `figure-${figure.id}`;
  const factHtml = figure.factIds.map((factId) => renderFact(facts.get(factId), config)).join("");
  return `<figure id="${escapeText(id)}" aria-labelledby="${escapeText(id)}-caption" aria-describedby="${escapeText(id)}-description"><dl>${factHtml}</dl><p class="sr-only" id="${escapeText(id)}-description">${escapeText(figure.accessibleDescription)}</p><figcaption id="${escapeText(id)}-caption">${escapeText(figure.caption)}</figcaption><p class="source-line">${escapeText(labels.sourceRefs)}: ${escapeText(figure.sourceRefs.join(", "))}</p></figure>`;
}

function renderQuote(quote, labels) {
  const original = quote.translated
    ? `<p class="quote-original" lang="${escapeText(quote.sourceLanguage)}"><strong>${escapeText(labels.original)}:</strong> ${escapeText(quote.originalText)}</p>`
    : "";
  return `<figure class="quotation"><blockquote>${escapeText(quote.text)}</blockquote>${original}<figcaption>${escapeText(quote.translationMarker)} · ${escapeText(quote.sourceRef)}</figcaption></figure>`;
}

export function renderLocalizedExample(example, config) {
  const configIssues = validateLocale(config);
  if (configIssues.length) throw new TypeError(`Invalid locale config: ${configIssues.map((item) => item.id).join(", ")}`);
  const labels = RUNNING_LABELS[config.outputLanguage];
  if (!labels) throw new TypeError(`Invalid example language: unsupported outputLanguage ${config.outputLanguage}`);
  const issues = exampleIssues(example, config);
  if (issues.length) throw new TypeError(`Invalid example: ${issues.map((item) => item.id).join(", ")}`);

  const facts = new Map(example.semantics.facts.map((item) => [item.id, item]));
  const claims = new Map(example.semantics.claims.map((item) => [item.id, item]));
  const figures = new Map(example.sections.map((section) => [section.id, example.figures.filter((item) => item.sectionId === section.id)]));
  const quotes = new Map(example.sections.map((section) => [section.id, example.quotations.filter((item) => item.sectionId === section.id)]));
  const contents = example.sections.map((section) => `<li><a href="#${escapeText(section.id)}">${escapeText(section.title)}</a></li>`).join("");
  const sections = example.sections.map((section) => {
    const paragraphs = section.paragraphs.map((paragraph) => `<p>${escapeText(paragraph)}</p>`).join("");
    const claimHtml = (section.claimIds ?? []).map((claimId) => {
      const claim = claims.get(claimId);
      return `<aside class="claim"><p>${escapeText(claim.text)}</p><p><strong>${escapeText(claim.strengthLabel)}</strong> · ${escapeText(claim.qualificationText)}</p></aside>`;
    }).join("");
    const quoteHtml = (quotes.get(section.id) ?? []).map((quote) => renderQuote(quote, labels)).join("");
    const figureHtml = (figures.get(section.id) ?? []).map((figure) => renderFigure(figure, facts, labels, config)).join("");
    return `<section id="${escapeText(section.id)}"><h2>${escapeText(section.title)}</h2>${paragraphs}${claimHtml}${quoteHtml}${figureHtml}</section>`;
  }).join("");
  const sources = example.sourceNotes.map((source) => `<li id="source-${escapeText(source.id)}"><strong>${escapeText(source.id)}</strong> · ${escapeText(source.locator)} · ${escapeText(source.text)}</li>`).join("");
  const limitations = example.limitations.map((limitation) => `<li>${escapeText(limitation)}</li>`).join("");
  const html = `<!doctype html>
<html lang="${escapeText(config.outputLanguage)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeText(example.title)}</title>
  <style>
    @page { size: ${config.paperSize}; margin: 18mm 16mm 20mm;
      @top-left { content: "${labels.report}"; }
      @bottom-center { content: "${labels.page} " counter(page) " / " counter(pages); }
    }
    :root { color-scheme: light; font-family: Inter, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif; color: #17191d; background: #fff; }
    * { box-sizing: border-box; }
    body { max-width: 920px; margin: 0 auto; padding: 32px; line-height: 1.62; }
    :lang(ko) { word-break: keep-all; overflow-wrap: break-word; }
    header, nav, main, section, figure { display: block; }
    .running-header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #b8bec7; padding-bottom: 8px; font-size: .82rem; }
    h1 { max-width: 24ch; font-size: 2.1rem; line-height: 1.15; text-wrap: balance; }
    h2 { margin-top: 2.2rem; font-size: 1.35rem; text-wrap: balance; }
    nav { margin: 2rem 0; }
    nav ol { padding-inline-start: 1.4rem; }
    .summary { max-width: 68ch; font-size: 1.08rem; }
    .claim { border-inline-start: 3px solid #315c9b; padding-inline-start: 1rem; margin: 1.25rem 0; }
    figure { margin: 1.5rem 0; break-inside: avoid; }
    figure dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1px; background: #c7ccd4; border: 1px solid #c7ccd4; }
    .metric { background: #fff; padding: 14px; }
    .metric dt { font-weight: 650; }
    .metric dd { margin: .35rem 0 0; display: grid; gap: .2rem; }
    .metric strong { font-size: 1.35rem; }
    .metric span, .source-line, figcaption { font-size: .83rem; color: #4c5563; }
    blockquote { margin-inline: 0; font-size: 1.05rem; }
    .quote-original { font-size: .9rem; color: #4c5563; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 640px) { body { padding: 20px; } .running-header { display: block; } h1 { font-size: 1.75rem; } figure dl { grid-template-columns: 1fr; } }
    @media print { body { max-width: none; padding: 0; } h2, figcaption { break-after: avoid; } p, li { orphans: 3; widows: 3; } figure dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } .quotation, .source-line { break-inside: avoid; } }
  </style>
</head>
<body>
  <header class="running-header" aria-label="${escapeText(labels.runningHeader)}"><span>${escapeText(example.title)}</span><span>${escapeText(config.locale)} · ${escapeText(config.paperSize)}</span></header>
  <main>
    <article>
      <h1>${escapeText(example.title)}</h1>
      <p class="summary">${escapeText(example.summary)}</p>
      <nav aria-label="${escapeText(labels.contents)}"><h2>${escapeText(labels.contents)}</h2><ol>${contents}<li><a href="#sources">${escapeText(labels.sources)}</a></li><li><a href="#limitations">${escapeText(labels.limitations)}</a></li></ol></nav>
      ${sections}
      <section id="sources"><h2>${escapeText(labels.sources)}</h2><ol>${sources}</ol></section>
      <section id="limitations"><h2>${escapeText(labels.limitations)}</h2><ul>${limitations}</ul></section>
    </article>
  </main>
</body>
</html>`;
  return { html, lang: config.outputLanguage, paperSize: config.paperSize };
}

function runCli() {
  if (process.argv.length !== 3) throw new Error("usage: node report-locale.mjs <example.json>");
  const example = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
  const result = renderLocalizedExample(example, example.localeConfig);
  process.stdout.write(result.html);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`report-locale: ${error.message}\n`);
    process.exitCode = 1;
  }
}
