import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  renderExhibit,
  validateExhibitInstance,
  validateExhibitRecipe,
} from "../skills/dev-visualizer/scripts/exhibit-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const assetPath = join(here, "..", "skills", "dev-visualizer", "assets", "exhibit-recipes.json");
const catalog = JSON.parse(readFileSync(assetPath, "utf8"));

const recipeById = (id) => structuredClone(catalog.recipes.find((recipe) => recipe.id === id));
const instanceById = (id) => structuredClone(catalog.instances.find((instance) => instance.recipeId === id));

function issueIds(issues) {
  return issues.map((issue) => issue.id);
}

function pieRecipe() {
  return {
    version: 1,
    id: "business-share-pie",
    domain: "business",
    readerQuestion: "How is the measured whole divided?",
    prerequisites: ["Categories are mutually exclusive and exhaustive."],
    requiredFields: ["sourceRefs", "data", "denominator", "caption", "accessibleText"],
    allowedEvidence: ["audited-financial-record"],
    calculation: { kind: "share-of-whole", description: "Category value divided by the stated whole." },
    method: null,
    encoding: { kind: "pie", labelField: "label", valueField: "value" },
    misleadingAlternatives: ["A pie without a measured whole."],
    failureCases: ["Category values do not sum to the denominator."],
    staticStrategy: "Use a table with category values, shares, denominator, and source references.",
  };
}

function pieInstance() {
  return {
    recipeId: "business-share-pie",
    sourceRefs: ["SRC-P1"],
    evidenceType: "audited-financial-record",
    data: {
      rows: [
        { id: "north", label: "North", value: 40, sourceRefs: ["SRC-P1"] },
        { id: "south", label: "South", value: 60, sourceRefs: ["SRC-P1"] },
      ],
      analysis: { claimType: "descriptive", design: "descriptive", pooled: false, poolingCompatibility: "not-applicable" },
      assumptions: [],
    },
    units: "percentage points",
    denominator: { value: 100, unit: "percentage points", label: "All measured sales" },
    uncertainty: null,
    caption: "Illustrative regional sales shares sum to the stated whole.",
    accessibleText: "North is 40 percent and South is 60 percent of the illustrative total.",
    edges: [],
  };
}

test("curated recipes and bound instances validate as separate contracts", () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.recipes.length >= 10);
  assert.equal(catalog.instances.length, catalog.recipes.length);
  assert.deepEqual(
    new Set(catalog.recipes.map((recipe) => recipe.domain)),
    new Set(["policy", "business", "ux", "science", "history", "operations"]),
  );
  assert.ok(catalog.recipes.some((recipe) => recipe.calculation !== null));
  assert.ok(catalog.recipes.some((recipe) => recipe.method !== null));

  for (const recipe of catalog.recipes) {
    assert.deepEqual(validateExhibitRecipe(recipe), [], recipe.id);
    const instance = catalog.instances.find((candidate) => candidate.recipeId === recipe.id);
    assert.ok(instance, `missing instance for ${recipe.id}`);
    assert.deepEqual(validateExhibitInstance(instance, recipe), [], recipe.id);
    const output = renderExhibit(instance, recipe);
    assert.match(output.html, /^<figure\b/);
    assert.equal(output.staticStrategy, recipe.staticStrategy);
    assert.ok(output.accessibleText.includes(instance.accessibleText));
  }
});

test("recipe validation rejects unreadable versions and mixed calculation/method ownership", () => {
  const recipe = pieRecipe();
  recipe.version = 2;
  assert.ok(issueIds(validateExhibitRecipe(recipe)).includes("recipe.version"));

  const mixed = pieRecipe();
  mixed.method = { kind: "thematic-coding", description: "A qualitative method cannot coexist with a calculation." };
  assert.ok(issueIds(validateExhibitRecipe(mixed)).includes("recipe.analysis"));
});

test("instance validation rejects a mismatched recipe and missing evidence anchors", () => {
  const recipe = pieRecipe();
  const mismatch = pieInstance();
  mismatch.recipeId = "another-recipe";
  assert.ok(issueIds(validateExhibitInstance(mismatch, recipe)).includes("instance.recipeId"));

  const missing = pieInstance();
  missing.sourceRefs = [];
  missing.data.rows[0].sourceRefs = [];
  const ids = issueIds(validateExhibitInstance(missing, recipe));
  assert.ok(ids.includes("instance.sourceRefs"));
  assert.ok(ids.includes("instance.data.rows[0].sourceRefs"));
});

test("a pie is rejected when category values do not match its denominator", () => {
  const instance = pieInstance();
  instance.denominator.value = 120;
  const issues = validateExhibitInstance(instance, pieRecipe());
  assert.ok(issueIds(issues).includes("instance.denominator.sum"), JSON.stringify(issues));
});

test("qualitative exhibits reject invented scores", () => {
  const recipe = recipeById("policy-assumption-map");
  const instance = instanceById(recipe.id);
  instance.data.rows[0].score = 9;
  const issues = validateExhibitInstance(instance, recipe);
  assert.ok(issueIds(issues).includes("instance.data.rows[0].score"), JSON.stringify(issues));
});

test("incompatible estimates cannot be rendered as a pooled result", () => {
  const recipe = recipeById("science-heterogeneity");
  const instance = instanceById(recipe.id);
  instance.data.analysis.poolingCompatibility = "incompatible";
  instance.data.analysis.pooled = true;
  const issues = validateExhibitInstance(instance, recipe);
  assert.ok(issueIds(issues).includes("instance.data.analysis.pooling"), JSON.stringify(issues));
});

test("observational correlation cannot be labeled causal", () => {
  const recipe = recipeById("ux-cohort-comparison");
  const instance = instanceById(recipe.id);
  instance.data.analysis.design = "observational";
  instance.data.analysis.claimType = "causal";
  const issues = validateExhibitInstance(instance, recipe);
  assert.ok(issueIds(issues).includes("instance.data.analysis.causality"), JSON.stringify(issues));
});

test("recipes that require uncertainty reject an omitted uncertainty statement", () => {
  const recipe = recipeById("science-intervals");
  const instance = instanceById(recipe.id);
  instance.uncertainty = null;
  const issues = validateExhibitInstance(instance, recipe);
  assert.ok(issueIds(issues).includes("instance.uncertainty"), JSON.stringify(issues));
});

test("malformed nested rows and assumptions return issues instead of throwing", () => {
  const intervalRecipe = recipeById("science-intervals");
  const malformedInterval = instanceById(intervalRecipe.id);
  malformedInterval.data.rows = [null];
  assert.doesNotThrow(() => validateExhibitInstance(malformedInterval, intervalRecipe));
  assert.ok(validateExhibitInstance(malformedInterval, intervalRecipe).length > 0);

  const sensitivityRecipe = recipeById("business-sensitivity");
  const malformedSensitivity = instanceById(sensitivityRecipe.id);
  delete malformedSensitivity.data.assumptions;
  assert.doesNotThrow(() => validateExhibitInstance(malformedSensitivity, sensitivityRecipe));
  assert.ok(validateExhibitInstance(malformedSensitivity, sensitivityRecipe).length > 0);
});

test("quantitative rendering uses an explicit exact-table fallback without fabricated marks", () => {
  const recipe = recipeById("operations-latency");
  const instance = instanceById(recipe.id);
  const output = renderExhibit(instance, recipe);

  assert.equal(typeof output.html, "string");
  assert.equal(output.accessibleText.includes(instance.accessibleText), true);
  assert.equal(output.staticStrategy, recipe.staticStrategy);
  assert.doesNotMatch(output.html, /<svg\b/);
  assert.match(output.html, /data-rendering="exact-table"/);
  assert.match(output.html, /<table\b/);
  assert.match(output.html, /P95/);
  assert.match(output.html, /data-source-ref="OPS-LAT-1"/);
  assert.match(output.html, /24,?000|24000/);
  assert.match(output.accessibleText, /Denominator: 24000 requests/);
  assert.match(output.accessibleText, /Assumptions:/);
  assert.match(output.html, /<figcaption>.*Illustrative/s);
});

test("evidence and hypothesis edges stay distinct in markup and accessible text", () => {
  const recipe = recipeById("policy-assumption-map");
  const instance = instanceById(recipe.id);
  const output = renderExhibit(instance, recipe);

  assert.match(output.html, /data-edge-kind="evidence"/);
  assert.match(output.html, /data-edge-kind="hypothesis"/);
  assert.match(output.accessibleText, /Evidence edge:/);
  assert.match(output.accessibleText, /Hypothesis edge \(not established evidence\):/);
});

test("hostile text is escaped into inert table text", () => {
  const recipe = recipeById("ux-cohort-comparison");
  const instance = instanceById(recipe.id);
  instance.caption = '</figcaption><script data-x="caption">alert(1)</script>';
  instance.accessibleText = '<img src=x onerror="alert(2)">';
  instance.data.rows[0].label = '<script data-x="row">alert(3)</script>';
  const output = renderExhibit(instance, recipe);

  assert.doesNotMatch(output.html, /<script\b/i);
  assert.doesNotMatch(output.html, /<img\b/i);
  assert.match(output.html, /&lt;script data-x=&quot;row&quot;&gt;/);
  assert.match(output.html, /&lt;\/figcaption&gt;&lt;script data-x=&quot;caption&quot;&gt;/);
  assert.match(output.html, /&lt;img src=x onerror=&quot;alert\(2\)&quot;&gt;/);
});

// Independent expectations: source values and dates must survive even when the
// authored summary deliberately says nothing about them.
function cells(html, id) {
  const row = [...html.matchAll(/<tr data-row-id="([^"]+)">([\s\S]*?)<\/tr>/g)]
    .find((match) => match[1] === id);
  assert.ok(row, id);
  return [...row[2].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((match) => match[1]);
}

test("interval table and text preserve both study bounds independently of supplied prose", () => {
  const recipe = recipeById("science-intervals");
  const instance = instanceById(recipe.id);
  instance.accessibleText = "Reported study results.";
  const result = renderExhibit(instance, recipe);
  assert.deepEqual(cells(result.html, "study-a"), ["Illustrative Study A", "1.4", "0.8", "2", "SCI-STUDY-A"]);
  assert.deepEqual(cells(result.html, "study-b"), ["Illustrative Study B", "0.9", "0.3", "1.5", "SCI-STUDY-B"]);
  assert.match(result.accessibleText, /Lower: 0.8; Upper: 2/);
  assert.doesNotMatch(result.html, /<svg|<rect/);
});

test("chronology preserves original date precision alongside the event description", () => {
  const recipe = recipeById("history-chronology-provenance");
  const instance = instanceById(recipe.id);
  instance.accessibleText = "Events from the supplied record.";
  const result = renderExhibit(instance, recipe);
  assert.deepEqual(cells(result.html, "proposal"), [
    "Proposal recorded", "A fictional letter proposes a regional archive.",
    "Spring 1912 (illustrative)", "HIST-LETTER-1",
  ]);
  assert.match(result.accessibleText, /Date: Spring 1912 \(illustrative\)/);
});

test("waterfall table preserves roles, signed contributions and independently stated outcome", () => {
  const result = renderExhibit(instanceById("business-waterfall"), recipeById("business-waterfall"));
  assert.deepEqual(cells(result.html, "service"), ["Service cost contribution", "-35", "delta", "BIZ-LEDGER-1"]);
  assert.deepEqual(cells(result.html, "outcome"), ["Outcome operating result", "480", "total", "BIZ-LEDGER-1"]);
  assert.doesNotMatch(result.html, /<svg|<rect/);
});

test("cohort and percentile exact tables retain numeric values and population metadata", () => {
  const cohort = renderExhibit(instanceById("ux-cohort-comparison"), recipeById("ux-cohort-comparison"));
  assert.deepEqual(cells(cohort.html, "guided"), ["Guided flow completions", "62", "UX-ANALYTICS-1"]);
  assert.match(cohort.html, /80 eligible accounts per cohort/);
  const latency = renderExhibit(instanceById("operations-latency"), recipeById("operations-latency"));
  assert.deepEqual(cells(latency.html, "p95"), ["P95", "620", "95", "OPS-LAT-1"]);
  assert.match(latency.html, /24000 requests/);
});

for (const [id, name, mutate, issue] of [
  ["business-waterfall", "unreconciled outcome", (i) => { i.data.rows[1].value += 1; }, "instance.data.waterfall"],
  ["business-waterfall", "missing total", (i) => { i.data.rows = i.data.rows.filter(r => r.role !== "total"); }, "instance.data.waterfall"],
  ["ux-cohort-comparison", "negative count", (i) => { i.data.rows[0].value = -1; }, "instance.data.rows[0].value"],
  ["ux-cohort-comparison", "count exceeds population", (i) => { i.data.rows[0].value = 999; }, "instance.data.rows[0].value"],
  ["ux-cohort-comparison", "fractional count", (i) => { i.data.rows[0].value = 1.5; }, "instance.data.rows[0].value"],
  ["science-intervals", "missing lower bound", (i) => { delete i.data.rows[0].lower; }, "instance.data.rows[0].interval"],
  ["science-intervals", "reversed interval", (i) => { i.data.rows[0].lower = 3; }, "instance.data.rows[0].interval"],
  ["history-chronology-provenance", "missing date", (i) => { delete i.data.rows[0].date; }, "instance.data.rows[0].date"],
  ["operations-latency", "negative latency", (i) => { i.data.rows[0].value = -1; }, "instance.data.rows[0].value"],
  ["operations-latency", "decreasing quantiles", (i) => { i.data.rows[1].value = 1; }, "instance.data.latency"],
  ["operations-latency", "invalid percentile", (i) => { i.data.rows[0].percentile = 101; }, "instance.data.rows[0].percentile"],
  ["operations-latency", "missing percentile", (i) => { delete i.data.rows[0].percentile; }, "instance.data.rows[0].percentile"],
  ["operations-latency", "percentile label mismatch", (i) => { i.data.rows[0].label = "P95"; }, "instance.data.rows[0].label"],
  ["operations-latency", "duplicate percentile", (i) => { i.data.rows[1].percentile = 50; }, "instance.data.latency"],
  ["business-sensitivity", "missing assumptions", (i) => { i.data.assumptions = []; }, "instance.data.assumptions"],
  ["business-sensitivity", "missing scenario inputs", (i) => { delete i.data.rows[0].scenario; }, "instance.data.rows[0].scenario"],
  ["science-heterogeneity", "unknown pooling basis", (i) => { i.data.analysis.pooled = true; i.data.analysis.poolingCompatibility = "unknown"; }, "instance.data.analysis.pooling"],
  ["science-heterogeneity", "missing study definition", (i) => { delete i.data.rows[0].description; }, "instance.data.rows[0].description"],
  ["ux-journey-evidence", "missing stage", (i) => { delete i.data.rows[0].stage; }, "instance.data.rows[0].stage"],
  ["operations-process-evidence", "missing detail", (i) => { delete i.data.rows[0].description; }, "instance.data.rows[0].description"],
  ["policy-assumption-map", "numeric proxy score", (i) => { i.data.rows[0].value = 9; }, "instance.data.rows[0].value"],
]) {
  test(`encoding invariant: ${name}`, () => {
    const recipe = recipeById(id), instance = instanceById(id);
    assert.deepEqual(validateExhibitInstance(instance, recipe), [], "valid control");
    mutate(instance);
    assert.ok(issueIds(validateExhibitInstance(instance, recipe)).includes(issue));
    assert.throws(() => renderExhibit(instance, recipe), TypeError);
  });
}

test("omitted and null unused analysis descriptors behave identically across all APIs", () => {
  for (const [id, unused] of [["policy-assumption-map", "calculation"], ["operations-latency", "method"]]) {
    const recipe = recipeById(id), instance = instanceById(id);
    const expected = renderExhibit(instance, recipe);
    delete recipe[unused];
    assert.deepEqual(validateExhibitRecipe(recipe), []);
    assert.deepEqual(validateExhibitInstance(instance, recipe), []);
    assert.deepEqual(renderExhibit(instance, recipe), expected);
  }
});

test("oversized rows and strings fail validation and rendering without a RangeError", () => {
  const recipe = recipeById("operations-latency");
  const huge = instanceById(recipe.id);
  huge.data.rows = Array.from({length: 150000}, (_, index) => ({
    id: String(index), label: "row", value: index, sourceRefs: ["OPS-LAT-1"],
  }));
  assert.deepEqual(issueIds(validateExhibitInstance(huge, recipe)), ["instance.data.rows"]);
  assert.throws(() => renderExhibit(huge, recipe), error => error instanceof TypeError && !(error instanceof RangeError));
  const long = instanceById(recipe.id);
  long.data.rows[0].label = "x".repeat(16001);
  assert.ok(issueIds(validateExhibitInstance(long, recipe)).includes("instance.data.rows[0].label"));
  assert.throws(() => renderExhibit(long, recipe), TypeError);
});

test("rendering invalid input fails explicitly instead of fabricating marks", () => {
  const recipe = pieRecipe();
  const instance = pieInstance();
  instance.denominator.value = 1;
  assert.throws(
    () => renderExhibit(instance, recipe),
    (error) => error instanceof TypeError && /instance\.denominator\.sum/.test(error.message),
  );
});

test("remaining encodings preserve hardcoded details and values in individual cells", () => {
  const render = id => renderExhibit(instanceById(id), recipeById(id)).html;
  assert.deepEqual(cells(render("business-sensitivity"), "low"), [
    "Lower demand", "310", "620 thousand units at USD 0.50 margin", "BIZ-MODEL-1",
  ]);
  assert.deepEqual(cells(render("science-heterogeneity"), "trial-two"), [
    "Illustrative trial two", "2.1", "Fictional adult population, outcome measured after twelve weeks.", "SCI-REVIEW-2",
  ]);
  assert.deepEqual(cells(render("ux-journey-evidence"), "discover"), [
    "Discover eligibility", "Illustrative participants looked for eligibility before starting.", "Entry", "UX-SESSION-1",
  ]);
  assert.deepEqual(cells(render("operations-process-evidence"), "intake"), [
    "Request intake", "Illustrative requests enter one queue.", "OPS-OBS-1",
  ]);
  assert.deepEqual(cells(render("policy-assumption-map"), "eligibility"), [
    "Eligibility rule", "The illustrative policy text limits eligibility to registered sites.", "POL-TEXT-1",
  ]);
  const pie = renderExhibit(pieInstance(), pieRecipe());
  assert.deepEqual(cells(pie.html, "north"), ["North", "40", "SRC-P1"]);
  assert.match(pie.html, /100 percentage points/);
  assert.doesNotMatch(pie.html, /<svg|<rect/);
  const table = recipeById("science-intervals");
  table.encoding.kind = "table";
  const instance = instanceById(table.id);
  assert.deepEqual(cells(renderExhibit(instance, table).html, "study-a"), [
    "Illustrative Study A", "1.4", "0.8", "2", "SCI-STUDY-A",
  ]);
});

test("pie rejects negatives even when the whole reconciles and cannot waive its denominator", () => {
  const recipe = pieRecipe(), instance = pieInstance();
  instance.data.rows[0].value = -40;
  instance.data.rows[1].value = 140;
  assert.ok(issueIds(validateExhibitInstance(instance, recipe)).includes("instance.data.rows[0].value"));
  instance.data.rows[0].value = 40;
  instance.data.rows[1].value = 60;
  recipe.requiredFields = ["sourceRefs"];
  instance.denominator = null;
  assert.ok(issueIds(validateExhibitInstance(instance, recipe)).includes("instance.denominator"));
});

test("encoding requirements survive a recipe with minimal requiredFields", () => {
  const recipe = recipeById("science-intervals"), instance = instanceById(recipe.id);
  recipe.requiredFields = ["sourceRefs"];
  instance.uncertainty = null;
  delete instance.data.rows[0].upper;
  const ids = issueIds(validateExhibitInstance(instance, recipe));
  assert.ok(ids.includes("instance.uncertainty"));
  assert.ok(ids.includes("instance.data.rows[0].interval"));
});

test("unsupported mappings and modes are rejected by the recipe boundary", () => {
  for (const mutate of [
    r => { r.encoding.labelField = "description"; },
    r => { r.encoding.valueField = "invented"; },
    r => { r.calculation = null; r.method = {kind: "narrative", description: "Qualitative"}; },
  ]) {
    const recipe = recipeById("operations-latency");
    mutate(recipe);
    assert.ok(validateExhibitRecipe(recipe).length > 0);
    assert.throws(() => renderExhibit(instanceById(recipe.id), recipe), TypeError);
  }
});

test("table capacity boundaries, nested malformed data and overflow arithmetic fail closed", () => {
  const recipe = pieRecipe(); recipe.encoding.kind = "table";
  const instance = pieInstance();
  instance.data.rows = Array.from({length: 1000}, (_, id) => ({
    id: String(id), label: "row", value: id, sourceRefs: ["SRC-P1"],
  }));
  assert.deepEqual(validateExhibitInstance(instance, recipe), []);
  assert.equal([...renderExhibit(instance, recipe).html.matchAll(/<tr data-row-id=/g)].length, 1000);
  instance.data.rows.push({...instance.data.rows[0], id: "overflow"});
  assert.deepEqual(issueIds(validateExhibitInstance(instance, recipe)), ["instance.data.rows"]);
  for (const field of ["data", "edges", "sourceRefs", "uncertainty", "denominator"]) {
    const malformed = pieInstance(); malformed[field] = null;
    assert.doesNotThrow(() => validateExhibitInstance(malformed, pieRecipe()));
  }
  const bridge = instanceById("business-waterfall");
  bridge.data.rows[0].value = Number.MAX_VALUE;
  bridge.data.rows[1].value = Number.MAX_VALUE;
  assert.ok(issueIds(validateExhibitInstance(bridge, recipeById(bridge.recipeId))).includes("instance.data.waterfall"));
});

test("selected estimate field is used for interval validation and exact output", () => {
  const recipe = recipeById("science-intervals"), instance = instanceById(recipe.id);
  recipe.encoding.valueField = "estimate";
  for (const row of instance.data.rows) { row.estimate = row.value; delete row.value; }
  assert.deepEqual(validateExhibitInstance(instance, recipe), []);
  assert.deepEqual(cells(renderExhibit(instance, recipe).html, "study-a"), [
    "Illustrative Study A", "1.4", "0.8", "2", "SCI-STUDY-A",
  ]);
  instance.data.rows[0].estimate = 3;
  assert.ok(issueIds(validateExhibitInstance(instance, recipe)).includes("instance.data.rows[0].interval"));
});

test("new date and scenario columns, sources and metadata escape hostile strings", () => {
  const recipe = recipeById("history-chronology-provenance"), instance = instanceById(recipe.id);
  instance.data.rows[0].date = '<img src=x onerror="date()">';
  instance.data.rows[0].scenario = '<script>scenario()</script>';
  instance.data.analysis.design = "historical";
  const output = renderExhibit(instance, recipe);
  assert.doesNotMatch(output.html, /<img|<script/);
  assert.ok(cells(output.html, "proposal").includes('&lt;img src=x onerror=&quot;date()&quot;&gt;'));
  assert.ok(cells(output.html, "proposal").includes('&lt;script&gt;scenario()&lt;/script&gt;'));
});

test("size limits cover recipe text, edges, total text, cycles and exact string boundary", () => {
  const recipe = recipeById("policy-assumption-map"), instance = instanceById(recipe.id);
  recipe.readerQuestion = "x".repeat(16001);
  assert.deepEqual(issueIds(validateExhibitRecipe(recipe)), ["recipe.readerQuestion"]);
  recipe.readerQuestion = "Question";
  instance.data.rows[0].label = "x".repeat(16000);
  assert.deepEqual(validateExhibitInstance(instance, recipe), []);
  instance.edges = Array(1001).fill(instance.edges[0]);
  assert.deepEqual(issueIds(validateExhibitInstance(instance, recipe)), ["instance.edges"]);
  const long = instanceById(recipe.id);
  long.data.assumptions = Array(100).fill("x".repeat(16000));
  assert.ok(validateExhibitInstance(long, recipe).some(issue => issue.msg === "Input exceeds exhibit size limits"));
  const cycle = instanceById(recipe.id);
  cycle.data = cycle;
  assert.ok(validateExhibitInstance(cycle, recipe).length);
});
