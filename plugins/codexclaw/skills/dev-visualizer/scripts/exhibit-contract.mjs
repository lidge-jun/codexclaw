/** Dependency-free analytical exhibit validation and static HTML/SVG rendering. */

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const finite = (value) => typeof value === "number" && Number.isFinite(value);

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
  "group", "estimate", "duration", "start", "end", "lower", "upper", "sourceRefs",
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

  const hasCalculation = recipe.calculation !== null && recipe.calculation !== undefined;
  const hasMethod = recipe.method !== null && recipe.method !== undefined;
  if (hasCalculation === hasMethod)
    fail(issues, "recipe.analysis", "Recipe must define exactly one of calculation or method");
  if (hasCalculation) validateAnalysisDescriptor(recipe.calculation, "recipe.calculation", issues);
  if (hasMethod) validateAnalysisDescriptor(recipe.method, "recipe.method", issues);

  if (!object(recipe.encoding)) fail(issues, "recipe.encoding", "Recipe encoding is required");
  else {
    rejectUnknown(recipe.encoding, new Set(["kind", "labelField", "valueField"]), "recipe.encoding", issues);
    if (!ENCODINGS.has(recipe.encoding.kind)) fail(issues, "recipe.encoding.kind", "Unsupported encoding kind");
    if (!text(recipe.encoding.labelField)) fail(issues, "recipe.encoding.labelField", "Encoding labelField is required");
    if (hasCalculation && !text(recipe.encoding.valueField))
      fail(issues, "recipe.encoding.valueField", "Quantitative encodings require valueField");
    if (recipe.encoding.valueField !== undefined && !text(recipe.encoding.valueField))
      fail(issues, "recipe.encoding.valueField", "valueField must be text when present");
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
    if (recipe.method !== null) {
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
    for (const field of ["value", "estimate", "duration", "start", "end", "lower", "upper"])
      if (row[field] !== undefined && !finite(row[field])) fail(issues, `${path}.${field}`, `${field} must be finite`);
    if (recipe.calculation !== null) {
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
  if (pooled === true && poolingCompatibility === "incompatible")
    fail(issues, "instance.data.analysis.pooling", "Incompatible estimates cannot be presented as pooled");
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

export function validateExhibitInstance(instance, recipe) {
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

  const rows = object(instance.data) && Array.isArray(instance.data.rows) ? instance.data.rows : [];
  if (recipe.encoding.kind === "pie" && object(instance.denominator) && finite(instance.denominator.value)) {
    const field = recipe.encoding.valueField;
    const values = rows.map((row) => row && row[field]);
    if (values.every(finite)) {
      const sum = values.reduce((total, value) => total + value, 0);
      const tolerance = Math.max(1e-9, Math.abs(instance.denominator.value) * 1e-9);
      if (Math.abs(sum - instance.denominator.value) > tolerance)
        fail(issues, "instance.denominator.sum", `Pie values sum to ${sum}, not denominator ${instance.denominator.value}`);
    }
  }
  if (recipe.encoding.kind === "interval") {
    for (const [index, row] of rows.entries()) {
      if (object(row) && finite(row.lower) && finite(row.value) && finite(row.upper) && !(row.lower <= row.value && row.value <= row.upper))
        fail(issues, `instance.data.rows[${index}].interval`, "Interval must contain its estimate");
    }
  }
  if (recipe.encoding.kind === "sensitivity" && object(instance.data) && Array.isArray(instance.data.assumptions) && instance.data.assumptions.length === 0)
    fail(issues, "instance.data.assumptions", "Sensitivity analysis requires explicit assumptions");
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

function displayValue(row, recipe) {
  if (recipe.calculation !== null) return String(row[recipe.encoding.valueField]);
  return row.description ?? row.date ?? row.stage ?? row.category ?? "—";
}

function renderTable(instance, recipe) {
  const rows = instance.data.rows.map((row) => `<tr data-row-id="${escapeHtml(row.id)}"><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(displayValue(row, recipe))}</td><td data-source-ref="${escapeHtml(row.sourceRefs.join(" "))}">${escapeHtml(row.sourceRefs.join(", "))}</td></tr>`).join("");
  return `<table><thead><tr><th scope="col">Item</th><th scope="col">Value or detail (${escapeHtml(instance.units)})</th><th scope="col">Source</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderQuantitativeSvg(instance, recipe) {
  if (recipe.calculation === null) return "";
  const field = recipe.encoding.valueField;
  const values = instance.data.rows.map((row) => row[field]);
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const rowHeight = 38;
  const height = 54 + values.length * rowHeight;
  const marks = instance.data.rows.map((row, index) => {
    const value = row[field];
    const width = Math.round((Math.abs(value) / max) * 250);
    const y = 38 + index * rowHeight;
    const x = value < 0 ? 350 - width : 350;
    return `<g data-row-id="${escapeHtml(row.id)}"><text x="12" y="${y + 16}">${escapeHtml(row.label)}</text><rect x="${x}" y="${y}" width="${width}" height="22" fill="${value < 0 ? "#a24b42" : "#2f6673"}"/><text x="620" y="${y + 16}" text-anchor="end">${escapeHtml(value)} ${escapeHtml(instance.units)}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-label="${escapeHtml(instance.accessibleText)}"><title>${escapeHtml(instance.caption)}</title><desc>${escapeHtml(instance.accessibleText)}</desc><line x1="350" x2="350" y1="28" y2="${height - 8}" stroke="#59636a"/>${marks}</svg>`;
}

function renderEdges(instance) {
  if (instance.edges.length === 0) return "";
  const labels = new Map(instance.data.rows.map((row) => [row.id, row.label]));
  const items = instance.edges.map((edge) => `<li data-edge-kind="${edge.type}"><strong>${edge.type === "evidence" ? "Evidence" : "Hypothesis"}:</strong> ${escapeHtml(labels.get(edge.from))} → ${escapeHtml(labels.get(edge.to))}: ${escapeHtml(edge.label)}${edge.sourceRefs.length ? ` <span data-source-ref="${escapeHtml(edge.sourceRefs.join(" "))}">(${escapeHtml(edge.sourceRefs.join(", "))})</span>` : ""}</li>`).join("");
  return `<ul class="exhibit-edges">${items}</ul>`;
}

function renderMetadata(instance) {
  const denominator = instance.denominator
    ? `<dt>Denominator</dt><dd>${escapeHtml(instance.denominator.value)} ${escapeHtml(instance.denominator.unit)} — ${escapeHtml(instance.denominator.label)}</dd>`
    : "";
  const assumptions = instance.data.assumptions.length
    ? `<dt>Assumptions</dt><dd><ul>${instance.data.assumptions.map((assumption) => `<li>${escapeHtml(assumption)}</li>`).join("")}</ul></dd>`
    : "";
  return denominator || assumptions ? `<dl class="exhibit-metadata">${denominator}${assumptions}</dl>` : "";
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
  const uncertainty = instance.uncertainty ? `Uncertainty: ${instance.uncertainty.description}.` : "";
  return [instance.accessibleText, ...edges, denominator, assumptions, `Sources: ${instance.sourceRefs.join(", ")}.`, uncertainty].filter(Boolean).join(" ");
}

export function renderExhibit(instance, recipe, options = {}) {
  if (!object(options)) throw new TypeError("renderExhibit options must be an object");
  const recipeIssues = validateExhibitRecipe(recipe);
  const issues = recipeIssues.length ? recipeIssues : validateExhibitInstance(instance, recipe);
  if (issues.length) throw new TypeError(`Invalid exhibit contract: ${issues.map((issue) => `${issue.id}: ${issue.msg}`).join("; ")}`);

  const sources = instance.sourceRefs.map((ref) => `<span data-source-ref="${escapeHtml(ref)}">${escapeHtml(ref)}</span>`).join(", ");
  const uncertainty = instance.uncertainty
    ? `<p class="exhibit-uncertainty"><strong>Uncertainty:</strong> ${escapeHtml(instance.uncertainty.description)}</p>`
    : "";
  const accessibleText = buildAccessibleText(instance);
  const html = `<figure class="exhibit exhibit--${escapeHtml(recipe.encoding.kind)}" data-recipe-id="${escapeHtml(recipe.id)}" aria-label="${escapeHtml(accessibleText)}">${renderQuantitativeSvg(instance, recipe)}${renderTable(instance, recipe)}${renderEdges(instance)}${renderMetadata(instance)}<figcaption>${escapeHtml(instance.caption)}</figcaption><p class="exhibit-sources"><strong>Sources:</strong> ${sources}</p>${uncertainty}</figure>`;
  return { html, accessibleText, staticStrategy: recipe.staticStrategy };
}
