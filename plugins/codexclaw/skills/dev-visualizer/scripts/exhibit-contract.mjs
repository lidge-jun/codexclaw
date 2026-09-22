/** Dependency-free analytical exhibit validation and exact-table rendering. */

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length <= 16000 && value.trim().length > 0;
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const NUMERIC_FIELDS = ["value", "estimate", "duration", "start", "end", "lower", "upper", "percentile"];
const QUALITATIVE_ENCODINGS = new Set(["assumption-map", "journey", "timeline", "process"]);
const present = (value) => value !== null && value !== undefined;

// JSON-sized boundary: reject before row iteration, allocation of marks, or string output.
function inputLimit(value, root) {
  let nodes = 0, characters = 0;
  function visit(item, path, depth) {
    if (++nodes > 50000 || depth > 12) return path;
    if (typeof item === "string") {
      characters += item.length;
      return item.length > 16000 || characters > 1000000 ? path : null;
    }
    if (Array.isArray(item)) {
      if (item.length > 1000) return path;
      for (let i = 0; i < item.length; i++) {
        const bad = visit(item[i], `${path}[${i}]`, depth + 1);
        if (bad) return bad;
      }
    } else if (object(item)) {
      const keys = Object.keys(item);
      if (keys.length > 50) return path;
      for (const key of keys) {
        const bad = key.length > 100 ? path : visit(item[key], `${path}.${key}`, depth + 1);
        if (bad) return bad;
      }
    }
    return null;
  }
  const path = visit(value, root, 0);
  return path ? [{level: "P0", id: path, msg: "Input exceeds exhibit size limits"}] : [];
}

const DOMAINS = new Set(["policy", "business", "ux", "science", "history", "operations"]);
const ENCODINGS = new Set([
  "assumption-map", "waterfall", "sensitivity", "journey", "cohort", "interval",
  "heterogeneity", "timeline", "process", "latency", "pie", "table",
]);
const REQUIRED_INSTANCE_FIELDS = new Set([
  "sourceRefs", "evidenceType", "data", "units", "denominator", "uncertainty",
  "caption", "accessibleText", "edges",
]);
const RECIPE_KEYS = new Set([
  "version", "id", "domain", "readerQuestion", "prerequisites", "requiredFields",
  "allowedEvidence", "calculation", "method", "encoding", "misleadingAlternatives",
  "failureCases", "staticStrategy",
]);
const INSTANCE_KEYS = new Set([
  "recipeId", "sourceRefs", "evidenceType", "data", "units", "denominator",
  "uncertainty", "caption", "accessibleText", "edges",
]);
const ROW_KEYS = new Set([
  "id", "label", "value", "description", "date", "stage", "category", "scenario",
  "group", "estimate", "duration", "start", "end", "lower", "upper", "role", "percentile", "sourceRefs",
]);
const QUALITATIVE_SCORE_KEYS = new Set(["score", "rating", "weight"]);
const EDGE_KEYS = new Set(["from", "to", "type", "label", "sourceRefs"]);
const ANALYSIS_KEYS = new Set(["claimType", "design", "pooled", "poolingCompatibility"]);
const ANALYSIS_DESIGNS = new Set(["descriptive", "observational", "randomized", "historical", "modeled"]);
const CLAIM_TYPES = new Set(["descriptive", "associational", "causal", "hypothesis"]);
const POOLING = new Set(["compatible", "incompatible", "not-applicable", "unknown"]);

function fail(issues, id, msg) {
  issues.push({ level: "P0", id, msg });
}

function rejectUnknown(value, allowed, path, issues) {
  if (!object(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(issues, `${path}.${key}`, `Unknown field: ${key}`);
  }
}

function validateTextList(value, path, issues, { nonempty = true } = {}) {
  if (!Array.isArray(value) || (nonempty && value.length === 0) || !value.every(text)) {
    fail(issues, path, `${path} must be ${nonempty ? "a nonempty" : "an"} array of text values`);
    return;
  }
  if (new Set(value).size !== value.length) fail(issues, path, `${path} must not contain duplicates`);
}

function validateAnalysisDescriptor(value, path, issues) {
  if (!object(value)) {
    fail(issues, path, `${path} must be an object when present`);
    return;
  }
  rejectUnknown(value, new Set(["kind", "description"]), path, issues);
  if (!text(value.kind)) fail(issues, `${path}.kind`, `${path}.kind is required`);
  if (!text(value.description)) fail(issues, `${path}.description`, `${path}.description is required`);
}

export function validateExhibitRecipe(recipe) {
  const limits = inputLimit(recipe, "recipe");
  if (limits.length) return limits;
  const issues = [];
  if (!object(recipe)) {
    fail(issues, "recipe", "Recipe must be an object");
    return issues;
  }
  rejectUnknown(recipe, RECIPE_KEYS, "recipe", issues);
  if (recipe.version !== 1) fail(issues, "recipe.version", "Recipe version must be 1");
  if (!text(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.id))
    fail(issues, "recipe.id", "Recipe id must be lowercase kebab-case text");
  if (!DOMAINS.has(recipe.domain)) fail(issues, "recipe.domain", "Recipe domain is not supported");
  if (!text(recipe.readerQuestion)) fail(issues, "recipe.readerQuestion", "Reader question is required");
  validateTextList(recipe.prerequisites, "recipe.prerequisites", issues);
  validateTextList(recipe.requiredFields, "recipe.requiredFields", issues);
  validateTextList(recipe.allowedEvidence, "recipe.allowedEvidence", issues);
  validateTextList(recipe.misleadingAlternatives, "recipe.misleadingAlternatives", issues);
  validateTextList(recipe.failureCases, "recipe.failureCases", issues);
  if (Array.isArray(recipe.requiredFields)) {
    for (const field of recipe.requiredFields) {
      if (!REQUIRED_INSTANCE_FIELDS.has(field))
        fail(issues, "recipe.requiredFields", `Unsupported required instance field: ${String(field)}`);
    }
  }

  const hasCalculation = present(recipe.calculation);
  const hasMethod = present(recipe.method);
  if (hasCalculation === hasMethod)
    fail(issues, "recipe.analysis", "Recipe must define exactly one of calculation or method");
  if (hasCalculation) validateAnalysisDescriptor(recipe.calculation, "recipe.calculation", issues);
  if (hasMethod) validateAnalysisDescriptor(recipe.method, "recipe.method", issues);

  if (!object(recipe.encoding)) fail(issues, "recipe.encoding", "Recipe encoding is required");
  else {
    rejectUnknown(recipe.encoding, new Set(["kind", "labelField", "valueField"]), "recipe.encoding", issues);
    if (!ENCODINGS.has(recipe.encoding.kind)) fail(issues, "recipe.encoding.kind", "Unsupported encoding kind");
    if (recipe.encoding.labelField !== "label") fail(issues, "recipe.encoding.labelField", "labelField must be label");
    if (hasCalculation && !NUMERIC_FIELDS.includes(recipe.encoding.valueField))
      fail(issues, "recipe.encoding.valueField", "Quantitative encodings require a supported numeric valueField");
    if (hasMethod && recipe.encoding.valueField !== undefined)
      fail(issues, "recipe.encoding.valueField", "Qualitative methods do not accept valueField");
    if (recipe.encoding.kind !== "table" && QUALITATIVE_ENCODINGS.has(recipe.encoding.kind) !== hasMethod)
      fail(issues, "recipe.analysis", "Calculation or method must match the encoding");
  }
  if (!text(recipe.staticStrategy)) fail(issues, "recipe.staticStrategy", "Static strategy is required");
  return issues;
}

function validateDenominator(value, path, issues) {
  if (value === null) return;
  if (!object(value)) {
    fail(issues, path, "Denominator must be null or an object");
    return;
  }
  rejectUnknown(value, new Set(["value", "unit", "label"]), path, issues);
  if (!finite(value.value) || value.value <= 0) fail(issues, `${path}.value`, "Denominator value must be positive and finite");
  if (!text(value.unit)) fail(issues, `${path}.unit`, "Denominator unit is required");
  if (!text(value.label)) fail(issues, `${path}.label`, "Denominator label is required");
}

function validateUncertainty(value, path, issues) {
  if (value === null) return;
  if (!object(value)) {
    fail(issues, path, "Uncertainty must be null or an object");
    return;
  }
  rejectUnknown(value, new Set(["kind", "description", "lower", "upper"]), path, issues);
  if (!text(value.kind)) fail(issues, `${path}.kind`, "Uncertainty kind is required");
  if (!text(value.description)) fail(issues, `${path}.description`, "Uncertainty description is required");
  if (value.lower !== undefined && !finite(value.lower)) fail(issues, `${path}.lower`, "Uncertainty lower bound must be finite");
  if (value.upper !== undefined && !finite(value.upper)) fail(issues, `${path}.upper`, "Uncertainty upper bound must be finite");
  if (finite(value.lower) && finite(value.upper) && value.lower > value.upper)
    fail(issues, path, "Uncertainty lower bound cannot exceed upper bound");
}

function validateData(data, recipe, sourceRefs, issues) {
  if (!object(data)) {
    fail(issues, "instance.data", "Instance data must be an object");
    return new Set();
  }
  rejectUnknown(data, new Set(["rows", "analysis", "assumptions"]), "instance.data", issues);
  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    fail(issues, "instance.data.rows", "Instance data requires at least one row");
    return new Set();
  }
  if (!Array.isArray(data.assumptions) || !data.assumptions.every(text))
    fail(issues, "instance.data.assumptions", "Data assumptions must be an array of text values");

  const ids = new Set();
  for (const [index, row] of data.rows.entries()) {
    const path = `instance.data.rows[${index}]`;
    if (!object(row)) {
      fail(issues, path, "Data row must be an object");
      continue;
    }
    if (present(recipe.method)) {
      for (const key of QUALITATIVE_SCORE_KEYS) {
        if (Object.hasOwn(row, key))
          fail(issues, `${path}.${key}`, "Qualitative evidence cannot use an invented numeric score");
      }
    }
    rejectUnknown(row, ROW_KEYS, path, issues);
    if (!text(row.id)) fail(issues, `${path}.id`, "Data row id is required");
    else if (ids.has(row.id)) fail(issues, `${path}.id`, `Duplicate data row id: ${row.id}`);
    else ids.add(row.id);
    if (!text(row.label)) fail(issues, `${path}.label`, "Data row label is required");
    validateTextList(row.sourceRefs, `${path}.sourceRefs`, issues);
    if (Array.isArray(row.sourceRefs)) {
      for (const ref of row.sourceRefs) if (!sourceRefs.has(ref)) fail(issues, `${path}.sourceRefs`, `Unknown source reference: ${ref}`);
    }
    for (const field of NUMERIC_FIELDS) {
      if (Object.hasOwn(row, field) && (present(recipe.method) || !finite(row[field])))
        fail(issues, `${path}.${field}`, "Quantitative fields require a calculation and finite values");
    }
    for (const field of ["description", "date", "stage", "category", "scenario", "group", "role"])
      if (Object.hasOwn(row, field) && !text(row[field])) fail(issues, `${path}.${field}`, "Expected nonempty text");
    if (present(recipe.calculation)) {
      const valueField = recipe.encoding.valueField;
      if (!finite(row[valueField])) fail(issues, `${path}.${valueField}`, `Quantitative row requires finite ${valueField}`);
    }
  }
  return ids;
}

function validateAnalyticalClaims(data, recipe, issues) {
  if (!object(data) || !object(data.analysis)) {
    fail(issues, "instance.data.analysis", "Data analysis metadata is required");
    return;
  }
  rejectUnknown(data.analysis, ANALYSIS_KEYS, "instance.data.analysis", issues);
  const { claimType, design, pooled, poolingCompatibility } = data.analysis;
  if (!CLAIM_TYPES.has(claimType)) fail(issues, "instance.data.analysis.claimType", "Unsupported claim type");
  if (!ANALYSIS_DESIGNS.has(design)) fail(issues, "instance.data.analysis.design", "Unsupported study design");
  if (typeof pooled !== "boolean") fail(issues, "instance.data.analysis.pooled", "pooled must be boolean");
  if (!POOLING.has(poolingCompatibility))
    fail(issues, "instance.data.analysis.poolingCompatibility", "Unsupported pooling compatibility");
  if (pooled === true && poolingCompatibility !== "compatible")
    fail(issues, "instance.data.analysis.pooling", "Pooling requires explicitly compatible estimates");
  if (claimType === "causal" && design !== "randomized")
    fail(issues, "instance.data.analysis.causality", "A non-randomized association cannot be labeled causal");
}

function validateEdges(edges, rowIds, sourceRefs, issues) {
  if (!Array.isArray(edges)) {
    fail(issues, "instance.edges", "Edges must be an array");
    return;
  }
  for (const [index, edge] of edges.entries()) {
    const path = `instance.edges[${index}]`;
    if (!object(edge)) {
      fail(issues, path, "Edge must be an object");
      continue;
    }
    rejectUnknown(edge, EDGE_KEYS, path, issues);
    if (!rowIds.has(edge.from)) fail(issues, `${path}.from`, `Unknown edge source: ${String(edge.from)}`);
    if (!rowIds.has(edge.to)) fail(issues, `${path}.to`, `Unknown edge target: ${String(edge.to)}`);
    if (!new Set(["evidence", "hypothesis"]).has(edge.type)) fail(issues, `${path}.type`, "Edge type must be evidence or hypothesis");
    if (!text(edge.label)) fail(issues, `${path}.label`, "Edge label is required");
    validateTextList(edge.sourceRefs, `${path}.sourceRefs`, issues, { nonempty: edge.type === "evidence" });
    if (Array.isArray(edge.sourceRefs)) {
      for (const ref of edge.sourceRefs) if (!sourceRefs.has(ref)) fail(issues, `${path}.sourceRefs`, `Unknown source reference: ${ref}`);
    }
  }
}

function validateWaterfall(rows, field, issues) {
  const roles = rows.map(row => row.role);
  if (rows.length < 3 || roles[0] !== "baseline" || roles.at(-1) !== "total" ||
      !roles.slice(1, -1).every(role => role === "delta")) {
    fail(issues, "instance.data.waterfall", "Require baseline, signed deltas, then an independently supplied total");
    return;
  }
  let sum = rows[0][field];
  for (const row of rows.slice(1, -1)) sum += row[field];
  const total = rows.at(-1)[field];
  if (!finite(sum) || !finite(total) || Math.abs(sum - total) > Math.max(1e-9, Math.abs(total) * 1e-9))
    fail(issues, "instance.data.waterfall", "Baseline plus deltas must reconcile to the stated total");
}

function validateEncoding(instance, recipe, issues) {
  const {kind, valueField: field} = recipe.encoding;
  const rows = instance.data?.rows;
  if (!Array.isArray(rows) || !rows.length || !rows.every(object)) return;
  const denominator = instance.denominator?.value;
  if (["pie", "cohort", "latency"].includes(kind) && (!finite(denominator) || denominator <= 0))
    fail(issues, "instance.denominator", "This encoding requires a positive denominator");
  if (["cohort", "latency"].includes(kind) && !Number.isSafeInteger(denominator))
    fail(issues, "instance.denominator.value", "Population count must be a safe integer");
  if (["interval", "heterogeneity", "sensitivity", "cohort", "latency", ...QUALITATIVE_ENCODINGS].includes(kind) &&
      !object(instance.uncertainty))
    fail(issues, "instance.uncertainty", "This encoding requires uncertainty or a limitation");
  for (const [index, row] of rows.entries()) {
    const path = `instance.data.rows[${index}]`, value = row[field];
    const requiredText = {
      "assumption-map": ["description"], journey: ["description", "stage"],
      process: ["description"], timeline: ["description", "date"],
      heterogeneity: ["description"], sensitivity: ["scenario"],
    }[kind] ?? [];
    for (const key of requiredText)
      if (!text(row[key])) fail(issues, `${path}.${key}`, `This encoding requires ${key}`);
    if (kind === "cohort" && (!Number.isSafeInteger(value) || value < 0 || value > denominator))
      fail(issues, `${path}.${field}`, "Cohort outcome count must be between zero and the eligible population");
    if (["pie", "latency"].includes(kind) && (!finite(value) || value < 0))
      fail(issues, `${path}.${field}`, "Shares and latency must be finite and nonnegative");
    if (kind === "interval" && !(finite(row.lower) && finite(row.upper) && finite(value) &&
        row.lower <= value && value <= row.upper))
      fail(issues, `${path}.interval`, "Finite lower and upper bounds must contain the estimate");
    if (kind === "latency") {
      if (!finite(row.percentile) || row.percentile < 0 || row.percentile > 100)
        fail(issues, `${path}.percentile`, "Percentile must be a number from 0 to 100");
      if (row.label !== `P${row.percentile}`)
        fail(issues, `${path}.label`, "Latency label must match its numeric percentile (for example P95)");
      if (index > 0 && (row.percentile <= rows[index - 1].percentile || value < rows[index - 1][field]))
        fail(issues, "instance.data.latency", "Percentiles must be unique and increasing with nondecreasing latency");
    }
    if (present(recipe.method) && kind === "table" &&
        !["description", "date", "stage", "category", "scenario", "group"].some(key => text(row[key])))
      fail(issues, `${path}.description`, "Qualitative table rows require a sourced detail");
  }
  if (kind === "waterfall") validateWaterfall(rows, field, issues);
  if (kind === "pie" && finite(denominator)) {
    let sum = 0;
    for (const row of rows) sum += row[field];
    if (!finite(sum) || Math.abs(sum - denominator) > Math.max(1e-9, Math.abs(denominator) * 1e-9))
      fail(issues, "instance.denominator.sum", "Pie values must sum to the stated denominator");
    if (instance.denominator.unit !== instance.units)
      fail(issues, "instance.denominator.unit", "Pie values and denominator must use the same unit");
  }
  if (kind === "sensitivity" && (!Array.isArray(instance.data.assumptions) || !instance.data.assumptions.length))
    fail(issues, "instance.data.assumptions", "Sensitivity analysis requires explicit assumptions");
}

export function validateExhibitInstance(instance, recipe) {
  const limits = inputLimit(instance, "instance");
  if (limits.length) return limits;
  const issues = [];
  if (validateExhibitRecipe(recipe).length) {
    fail(issues, "recipe", "A valid recipe is required before validating an instance");
    return issues;
  }
  if (!object(instance)) {
    fail(issues, "instance", "Instance must be an object");
    return issues;
  }
  rejectUnknown(instance, INSTANCE_KEYS, "instance", issues);
  if (instance.recipeId !== recipe.id) fail(issues, "instance.recipeId", "Instance recipeId does not match recipe id");
  validateTextList(instance.sourceRefs, "instance.sourceRefs", issues);
  const sourceRefs = new Set(Array.isArray(instance.sourceRefs) ? instance.sourceRefs : []);
  if (!recipe.allowedEvidence.includes(instance.evidenceType))
    fail(issues, "instance.evidenceType", "Instance evidence type is not allowed by the recipe");
  if (!text(instance.units)) fail(issues, "instance.units", "Instance units are required; use not-applicable when appropriate");
  if (!text(instance.caption)) fail(issues, "instance.caption", "Instance caption is required");
  if (!text(instance.accessibleText)) fail(issues, "instance.accessibleText", "Instance accessibleText is required");
  validateDenominator(instance.denominator, "instance.denominator", issues);
  validateUncertainty(instance.uncertainty, "instance.uncertainty", issues);
  for (const field of recipe.requiredFields) {
    const value = instance[field];
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
      fail(issues, `instance.${field}`, `Recipe requires instance.${field}`);
  }

  const rowIds = validateData(instance.data, recipe, sourceRefs, issues);
  validateAnalyticalClaims(instance.data, recipe, issues);
  validateEdges(instance.edges, rowIds, sourceRefs, issues);

  validateEncoding(instance, recipe, issues);
  return issues;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Every supplied, validated row field receives its own column. No precedence chain
// may hide date behind description, or bounds behind the estimate.
function rowColumns(instance) {
  return [...ROW_KEYS].filter(key => !["id", "label", "sourceRefs"].includes(key) &&
    instance.data.rows.some(row => Object.hasOwn(row, key)));
}

const heading = key => key[0].toUpperCase() + key.slice(1);
function renderTable(instance) {
  const columns = rowColumns(instance);
  const rows = instance.data.rows.map(row => {
    const values = columns.map(key => `<td data-field="${key}">${Object.hasOwn(row, key) ? escapeHtml(row[key]) : "Not supplied"}</td>`).join("");
    return `<tr data-row-id="${escapeHtml(row.id)}"><th scope="row">${escapeHtml(row.label)}</th>${values}<td data-source-ref="${escapeHtml(row.sourceRefs.join(" "))}">${escapeHtml(row.sourceRefs.join(", "))}</td></tr>`;
  }).join("");
  return `<table><caption>Exact values and evidence; units: ${escapeHtml(instance.units)}</caption><thead><tr><th scope="col">Item</th>${columns.map(key => `<th scope="col">${heading(key)}</th>`).join("")}<th scope="col">Source</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEdges(instance) {
  if (instance.edges.length === 0) return "";
  const labels = new Map(instance.data.rows.map((row) => [row.id, row.label]));
  const items = instance.edges.map((edge) => `<li data-edge-kind="${edge.type}"><strong>${edge.type === "evidence" ? "Evidence" : "Hypothesis"}:</strong> ${escapeHtml(labels.get(edge.from))} → ${escapeHtml(labels.get(edge.to))}: ${escapeHtml(edge.label)}${edge.sourceRefs.length ? ` <span data-source-ref="${escapeHtml(edge.sourceRefs.join(" "))}">(${escapeHtml(edge.sourceRefs.join(", "))})</span>` : ""}</li>`).join("");
  return `<ul class="exhibit-edges">${items}</ul>`;
}

function renderMetadata(instance, recipe) {
  const denominator = instance.denominator
    ? `<dt>Denominator</dt><dd>${escapeHtml(instance.denominator.value)} ${escapeHtml(instance.denominator.unit)} — ${escapeHtml(instance.denominator.label)}</dd>`
    : "";
  const assumptions = instance.data.assumptions.length
    ? `<dt>Assumptions</dt><dd><ul>${instance.data.assumptions.map((assumption) => `<li>${escapeHtml(assumption)}</li>`).join("")}</ul></dd>`
    : "";
  const analysis = Object.entries(instance.data.analysis).map(([key, value]) =>
    `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
  const descriptor = recipe.calculation ?? recipe.method;
  return `<dl class="exhibit-metadata"><dt>Method</dt><dd>${escapeHtml(descriptor.kind)}: ${escapeHtml(descriptor.description)}</dd>${denominator}${assumptions}${analysis}</dl>`;
}

function buildAccessibleText(instance) {
  const labels = new Map(instance.data.rows.map((row) => [row.id, row.label]));
  const edges = instance.edges.map((edge) => {
    const prefix = edge.type === "evidence" ? "Evidence edge:" : "Hypothesis edge (not established evidence):";
    return `${prefix} ${labels.get(edge.from)} to ${labels.get(edge.to)} — ${edge.label}.`;
  });
  const denominator = instance.denominator
    ? `Denominator: ${instance.denominator.value} ${instance.denominator.unit}, ${instance.denominator.label}.`
    : "";
  const assumptions = instance.data.assumptions.length
    ? `Assumptions: ${instance.data.assumptions.join("; ")}.`
    : "";
  const uncertainty = instance.uncertainty ? `Uncertainty: ${describeUncertainty(instance.uncertainty)}.` : "";
  const columns = rowColumns(instance);
  const rows = instance.data.rows.map(row =>
    `${row.label}: ${columns.filter(key => Object.hasOwn(row, key)).map(key => `${heading(key)}: ${row[key]}`).join("; ")}; Sources: ${row.sourceRefs.join(", ")}.`);
  const analysis = Object.entries(instance.data.analysis).map(([key, value]) => `${key}: ${value}`).join("; ");
  return [instance.accessibleText, `Units: ${instance.units}.`, ...rows, ...edges, denominator, assumptions, analysis,
    `Sources: ${instance.sourceRefs.join(", ")}.`, uncertainty].filter(Boolean).join(" ");
}

function describeUncertainty(uncertainty) {
  return Object.entries(uncertainty).map(([key, value]) => `${heading(key)}: ${value}`).join("; ");
}

export function renderExhibit(instance, recipe, options = {}) {
  if (!object(options)) throw new TypeError("renderExhibit options must be an object");
  if (Object.keys(options).length) throw new TypeError("renderExhibit has no supported options");
  const recipeIssues = validateExhibitRecipe(recipe);
  const issues = recipeIssues.length ? recipeIssues : validateExhibitInstance(instance, recipe);
  if (issues.length) throw new TypeError(`Invalid exhibit contract: ${issues.map((issue) => `${issue.id}: ${issue.msg}`).join("; ")}`);

  const sources = instance.sourceRefs.map((ref) => `<span data-source-ref="${escapeHtml(ref)}">${escapeHtml(ref)}</span>`).join(", ");
  const uncertainty = instance.uncertainty
    ? `<p class="exhibit-uncertainty"><strong>Uncertainty:</strong> ${escapeHtml(describeUncertainty(instance.uncertainty))}</p>`
    : "";
  const accessibleText = buildAccessibleText(instance);
  const html = `<figure class="exhibit exhibit--${escapeHtml(recipe.encoding.kind)}" data-recipe-id="${escapeHtml(recipe.id)}" data-rendering="exact-table"><figcaption>${escapeHtml(instance.caption)}</figcaption><p>${escapeHtml(instance.accessibleText)}</p>${renderTable(instance)}${renderEdges(instance)}${renderMetadata(instance, recipe)}<p class="exhibit-sources"><strong>Sources:</strong> ${sources}</p>${uncertainty}</figure>`;
  return { html, accessibleText, staticStrategy: recipe.staticStrategy };
}
