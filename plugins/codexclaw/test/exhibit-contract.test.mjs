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

test("quantitative rendering returns native SVG, an exact table, and static fallback guidance", () => {
  const recipe = recipeById("operations-latency");
  const instance = instanceById(recipe.id);
  const output = renderExhibit(instance, recipe);

  assert.equal(typeof output.html, "string");
  assert.equal(output.accessibleText.includes(instance.accessibleText), true);
  assert.equal(output.staticStrategy, recipe.staticStrategy);
  assert.match(output.html, /<svg\b/);
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

test("hostile text is escaped into inert HTML and SVG text", () => {
  const recipe = recipeById("operations-latency");
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

test("rendering invalid input fails explicitly instead of fabricating marks", () => {
  const recipe = pieRecipe();
  const instance = pieInstance();
  instance.denominator.value = 1;
  assert.throws(
    () => renderExhibit(instance, recipe),
    (error) => error instanceof TypeError && /instance\.denominator\.sum/.test(error.message),
  );
});
