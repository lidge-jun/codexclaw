/** Evidence-led report checks. Structural validation is not semantic fact checking. */
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const issue = (id, msg) => ({ level: "P0", id, msg });
const kinds = new Set(["observation", "inference", "hypothesis", "recommendation", "attribution"]);
const CHECK_STATUSES = new Set(["PASS", "FAIL", "REVIEW", "NOT_RUN", "BLOCKED"]);
const SAFE_METADATA_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._+~-]{0,127}$/;

export function validateClaims(model) {
  const issues = [];
  const fail = (id, msg) => issues.push(issue(id, msg));
  if (!object(model) || model.schemaVersion !== 1 || !text(model.question) || !text(model.audience)
      || !text(model.answerClaimId) || !Array.isArray(model.claims) || !model.claims.length
      || !Array.isArray(model.sources)) {
    fail("model", "Expected schemaVersion:1, audience, question, answerClaimId, claims and sources");
    return issues;
  }

  const sources = new Map();
  const spansBySource = new Map();
  for (const source of model.sources) {
    if (!object(source) || !text(source.id) || !text(source.locator) || !text(source.observedAt)) {
      fail("source", "Source requires id, locator and observedAt");
      continue;
    }
    if (sources.has(source.id)) fail(source.id, "Duplicate source id");
    else sources.set(source.id, source);

    const spans = new Set();
    spansBySource.set(source.id, spans);
    if (source.spans === undefined) continue;
    if (!Array.isArray(source.spans)) {
      fail(source.id, "source.spans must be a list when present");
      continue;
    }
    for (const span of source.spans) {
      if (!object(span) || !text(span.id) || !text(span.locator) || !text(span.language)
          || (span.excerpt !== undefined && !text(span.excerpt))) {
        fail(source.id, "Source span requires id, locator, language and optional nonempty excerpt");
        continue;
      }
      if (spans.has(span.id)) fail(source.id, `Duplicate source span id: ${span.id}`);
      spans.add(span.id);
    }
  }

  const ids = new Set();
  for (const claim of model.claims) {
    if (!object(claim) || !text(claim.id) || !text(claim.text) || !kinds.has(claim.kind)
        || !Array.isArray(claim.sourceRefs) || !Array.isArray(claim.limitations)
        || !claim.limitations.every(text)) {
      fail("claim", "Claim requires id, text, kind, sourceRefs and limitations");
      continue;
    }
    if (ids.has(claim.id)) fail(claim.id, "Duplicate claim id");
    ids.add(claim.id);
    if (new Set(claim.sourceRefs).size !== claim.sourceRefs.length) {
      fail(claim.id, "claim.sourceRefs must contain unique IDs");
    }
    if (!claim.sourceRefs.length && claim.kind !== "hypothesis") fail(claim.id, "Claim requires evidence references");
    if (claim.kind === "hypothesis" && !claim.limitations.length) fail(claim.id, "Hypothesis requires a visible limitation");
    for (const ref of claim.sourceRefs) {
      if (!text(ref) || !sources.has(ref)) fail(claim.id, `Unknown evidence reference: ${String(ref)}`);
    }
    if (claim.kind === "attribution" && (!text(claim.actor) || !text(claim.attributedStatement))) {
      fail(claim.id, "Intent attribution requires actor and directly attributable statement");
    }

    if (claim.sourceSpans === undefined) continue;
    if (!Array.isArray(claim.sourceSpans)) {
      fail(claim.id, "claim.sourceSpans must be a list when present");
      continue;
    }
    const seen = new Set();
    for (const ref of claim.sourceSpans) {
      if (!object(ref) || !text(ref.sourceId) || !text(ref.spanId)) {
        fail(claim.id, "Claim source span requires sourceId and spanId");
        continue;
      }
      const key = `${ref.sourceId}\u0000${ref.spanId}`;
      if (seen.has(key)) fail(claim.id, `Duplicate claim source span: ${ref.sourceId}/${ref.spanId}`);
      seen.add(key);
      if (!claim.sourceRefs.includes(ref.sourceId)) {
        fail(claim.id, `Claim source span is not listed in sourceRefs: ${ref.sourceId}`);
      } else if (!spansBySource.get(ref.sourceId)?.has(ref.spanId)) {
        fail(claim.id, `Unknown source span: ${ref.sourceId}/${ref.spanId}`);
      }
    }
  }
  if (!ids.has(model.answerClaimId)) fail("answer", "answerClaimId does not resolve to a claim");
  return issues;
}

/** Research routes in report-model contract version 1. */
export const RESEARCH_ROUTES = new Set(["source-only", "bounded-lookup", "deep-research"]);
const LOAD_BEARING = new Set(["inference", "recommendation"]);

export function researchLanguages(model) {
  const research = object(model) && object(model.research) ? model.research : null;
  if (!research) return { sourceLanguages: [], outputLanguage: null, legacyInput: false, issues: [] };

  const issues = [];
  const hasCanonical = research.sourceLanguages !== undefined || research.outputLanguage !== undefined;
  const hasLegacy = research.languages !== undefined;
  let sourceLanguages = [];
  let outputLanguage = null;

  if (hasCanonical) {
    if (!Array.isArray(research.sourceLanguages) || !research.sourceLanguages.length
        || !research.sourceLanguages.every(text) || new Set(research.sourceLanguages).size !== research.sourceLanguages.length
        || !text(research.outputLanguage)) {
      issues.push(issue("research", "research.sourceLanguages must be unique nonempty text and research.outputLanguage is required"));
    } else {
      sourceLanguages = [...research.sourceLanguages];
      outputLanguage = research.outputLanguage;
    }
  }

  if (hasLegacy) {
    if (!object(research.languages) || !text(research.languages.source) || !text(research.languages.output)) {
      issues.push(issue("research", "legacy research.languages requires source and output"));
    } else if (!hasCanonical) {
      sourceLanguages = [research.languages.source];
      outputLanguage = research.languages.output;
    } else if (sourceLanguages.length !== 1 || sourceLanguages[0] !== research.languages.source
        || outputLanguage !== research.languages.output) {
      issues.push(issue("research", "canonical and legacy language representations conflict"));
    }
  }

  if (!hasCanonical && !hasLegacy) {
    issues.push(issue("research", "research.sourceLanguages and research.outputLanguage are required"));
  }
  return { sourceLanguages, outputLanguage, legacyInput: hasLegacy, issues };
}

export function validateResearchHandoff(model) {
  const issues = [];
  const fail = (id, msg) => issues.push(issue(id, msg));
  if (!object(model) || model.research === undefined) return issues;
  const research = model.research;
  if (!object(research)) {
    fail("research", "research must be an object when present");
    return issues;
  }
  if (research.contractVersion !== 1) fail("research", "research.contractVersion must be 1; an unreadable version is not an upgrade");
  if (!RESEARCH_ROUTES.has(research.route)) fail("research", `research.route must be one of ${[...RESEARCH_ROUTES].join(", ")}`);
  if (!text(research.sourceBoundary)) fail("research", "research.sourceBoundary is required: what the answer was allowed to read");
  issues.push(...researchLanguages(model).issues);
  if (!Array.isArray(research.gaps) || !research.gaps.every(text)) {
    fail("research", "research.gaps must be a list of unresolved points; an empty list is a claim that none remain");
  }
  if (research.stopReason !== undefined && !text(research.stopReason)) fail("research", "research.stopReason must be text when present");

  const claims = new Set(Array.isArray(model.claims) ? model.claims.filter(object).map((claim) => claim.id) : []);
  const sources = new Set(Array.isArray(model.sources) ? model.sources.filter(object).map((source) => source.id) : []);
  const questionIds = new Set();
  if (!Array.isArray(research.questions) || !research.questions.length) {
    fail("research", "research.questions is required and must not be empty");
  } else {
    for (const question of research.questions) {
      if (!object(question) || !text(question.id) || !text(question.text) || !Array.isArray(question.answeredBy)
          || !question.answeredBy.every(text)) {
        fail("research", "question requires id, text and answeredBy");
        continue;
      }
      if (questionIds.has(question.id)) fail(question.id, "Duplicate research question id");
      questionIds.add(question.id);
      if (new Set(question.answeredBy).size !== question.answeredBy.length) {
        fail(question.id, "question.answeredBy must contain unique IDs");
      }
      for (const ref of question.answeredBy) {
        if (!claims.has(ref)) fail(question.id, `Question answered by an unknown claim: ${String(ref)}`);
      }
      if (!question.answeredBy.length) {
        // Gap prefix grammar: optional whitespace, literal full question ID, then
        // end, whitespace, or a colon followed by whitespace/end. IDs are not regexes.
        if (!Array.isArray(research.gaps) || !research.gaps.some((gap) => {
          if (!text(gap)) return false;
          const prefix = gap.trimStart();
          if (!prefix.startsWith(question.id)) return false;
          const suffix = prefix.slice(question.id.length);
          return suffix === "" || /^(?:\s|:(?:\s|$))/u.test(suffix);
        })) {
          fail(question.id, "Unanswered question must be listed in research.gaps");
        }
      }
    }
  }

  if (research.counterEvidence !== undefined) {
    if (!Array.isArray(research.counterEvidence)) {
      fail("research", "research.counterEvidence must be a list when present");
    } else {
      for (const counter of research.counterEvidence) {
        if (!object(counter) || !text(counter.claimId) || !Array.isArray(counter.sourceRefs)
            || !counter.sourceRefs.length || !counter.sourceRefs.every(text) || !text(counter.note)) {
          fail("research", "counterEvidence requires claimId, nonempty sourceRefs and note");
          continue;
        }
        if (new Set(counter.sourceRefs).size !== counter.sourceRefs.length) {
          fail(counter.claimId, "counterEvidence.sourceRefs must contain unique IDs");
        }
        if (!claims.has(counter.claimId)) fail("research", `counterEvidence references an unknown claim: ${counter.claimId}`);
        for (const ref of counter.sourceRefs) {
          if (!sources.has(ref)) fail("research", `counterEvidence references an unknown source: ${ref}`);
        }
      }
    }
  }

  const sourceList = Array.isArray(model.sources) ? model.sources : [];
  if (research.route === "source-only") {
    for (const source of sourceList) {
      if (object(source) && source.discovered === true) fail(source.id || "source", `source-only route carries a discovered source: ${String(source.id)}`);
    }
  }

  const byId = new Map(sourceList.filter(object).map((source) => [source.id, source]));
  for (const claim of Array.isArray(model.claims) ? model.claims : []) {
    if (!object(claim) || !LOAD_BEARING.has(claim.kind) || !Array.isArray(claim.sourceRefs) || !claim.sourceRefs.length) continue;
    const resolved = claim.sourceRefs.map((ref) => byId.get(ref)).filter(object);
    if (resolved.length && resolved.every((source) => source.via === "snippet")) {
      fail(claim.id, "Load-bearing claim rests only on snippet-derived sources; snippets are leads, not evidence");
    }
  }
  return issues;
}

export function validateGenerationMetadata(metadata = {}) {
  const issues = [];
  if (!object(metadata)) return [issue("generation.metadata", "generation metadata must be an object")];
  const allowed = new Set(["skillVersion", "packageVersion", "sourceSha", "hostAdapter", "genre", "templateIds", "recipeIds", "checks"]);
  for (const key of Object.keys(metadata)) {
    if (!allowed.has(key)) issues.push(issue("generation.metadata", `Unknown generation metadata field: ${key}`));
  }
  for (const key of ["skillVersion", "packageVersion", "hostAdapter", "genre"]) {
    if (metadata[key] !== undefined && (!text(metadata[key]) || !SAFE_METADATA_TOKEN.test(metadata[key]))) {
      issues.push(issue(`generation.${key}`, `${key} must be unknown or a portable identifier`));
    }
  }
  if (metadata.sourceSha !== undefined && metadata.sourceSha !== "unknown"
      && !(typeof metadata.sourceSha === "string" && /^[0-9a-f]{40}$/i.test(metadata.sourceSha))) {
    issues.push(issue("generation.sourceSha", "sourceSha must be a full 40-character hexadecimal SHA or unknown"));
  }
  for (const key of ["templateIds", "recipeIds"]) {
    if (metadata[key] !== undefined && (!Array.isArray(metadata[key]) || !metadata[key].every((id) => text(id) && SAFE_METADATA_TOKEN.test(id))
        || new Set(metadata[key]).size !== metadata[key].length)) {
      issues.push(issue(`generation.${key}`, `${key} must be a list of unique portable identifiers`));
    }
  }
  if (metadata.checks !== undefined) {
    if (!Array.isArray(metadata.checks)) {
      issues.push(issue("generation.checks", "checks must be a list of per-check outcomes"));
    } else {
      const ids = new Set();
      for (const check of metadata.checks) {
        if (!object(check) || !text(check.id) || !SAFE_METADATA_TOKEN.test(check.id) || !CHECK_STATUSES.has(check.status)
            || (check.reason !== undefined && !text(check.reason))) {
          issues.push(issue("generation.checks", "Each check requires a portable id, a recognized status, and optional nonempty reason"));
          continue;
        }
        if (ids.has(check.id)) issues.push(issue("generation.checks", `Duplicate generation check id: ${check.id}`));
        ids.add(check.id);
      }
    }
  }
  return issues;
}

const safeToken = (value) => text(value) && SAFE_METADATA_TOKEN.test(value) ? value : "unknown";
const safeIds = (value) => Array.isArray(value) && value.every((id) => text(id) && SAFE_METADATA_TOKEN.test(id))
  && new Set(value).size === value.length ? [...value] : [];

export function generationReceipt(model, metadata = {}) {
  const supplied = object(model) && object(model.research);
  const provided = object(metadata) ? metadata : {};
  const validationIssues = validateGenerationMetadata(metadata);
  const checks = Array.isArray(provided.checks)
    ? provided.checks.filter((check) => object(check) && text(check.id) && SAFE_METADATA_TOKEN.test(check.id)
      && CHECK_STATUSES.has(check.status) && (check.reason === undefined || text(check.reason)))
      .map((check) => ({ ...check, basis: "caller-assertion" }))
    : [];
  const sourceSha = provided.sourceSha === undefined || provided.sourceSha === "unknown"
    ? "unknown"
    : typeof provided.sourceSha === "string" && /^[0-9a-f]{40}$/i.test(provided.sourceSha)
      ? provided.sourceSha.toLowerCase()
      : "unknown";
  const languages = researchLanguages(model);
  const completed = checks.filter((check) => check.status !== "NOT_RUN").map((check) => check.id);
  const omitted = checks.filter((check) => check.status === "NOT_RUN").map((check) => check.id);
  return {
    kind: "generation-receipt",
    schemaVersion: 1,
    supplied,
    route: supplied ? model.research.route : null,
    contractVersion: supplied ? model.research.contractVersion : null,
    legacyInput: languages.legacyInput,
    skillVersion: safeToken(provided.skillVersion ?? "unknown"),
    packageVersion: safeToken(provided.packageVersion ?? "unknown"),
    sourceSha,
    hostAdapter: safeToken(provided.hostAdapter ?? "unknown"),
    genre: safeToken(provided.genre ?? "unknown"),
    templateIds: safeIds(provided.templateIds ?? []),
    recipeIds: safeIds(provided.recipeIds ?? []),
    questions: supplied && Array.isArray(model.research.questions) ? model.research.questions.length : 0,
    gaps: supplied && Array.isArray(model.research.gaps) ? model.research.gaps.length : 0,
    checks,
    completed,
    omitted,
    authenticatedProof: false,
    validationIssues,
  };
}

/** Compatibility receipt for callers using the original boolean check map. */
export function researchReceipt(model, options = {}) {
  const provided = object(options) ? options : {};
  const skillVersion = provided.skillVersion ?? "unknown";
  const checks = provided.checks ?? {};
  const supplied = object(model) && object(model.research);
  const checkMap = object(checks) ? checks : {};
  const completed = Object.entries(checkMap).filter(([, value]) => value === true).map(([key]) => key).sort();
  const omitted = Object.entries(checkMap).filter(([, value]) => value !== true).map(([key]) => key).sort();
  return {
    kind: "research-handoff",
    supplied,
    route: supplied ? model.research.route : null,
    contractVersion: supplied ? model.research.contractVersion : null,
    skillVersion,
    legacyInput: researchLanguages(model).legacyInput,
    questions: supplied && Array.isArray(model.research.questions) ? model.research.questions.length : 0,
    gaps: supplied && Array.isArray(model.research.gaps) ? model.research.gaps.length : 0,
    completed,
    omitted,
  };
}

/** A phrase match is an advisory review location, never an automatic rewrite. */
export function reviewVoice(blocks) {
  const pattern = /의도적으로|설계 의도|작성자는|정독했|집필 중|흥미로운 것은|the author intended|intentionally designed/ig;
  return blocks.flatMap((block) => {
    if (["quote", "method", "notice"].includes(block.role) && block.source) return [];
    const matches = [...block.text.matchAll(pattern)].map((match) => match[0]);
    return matches.length ? [{ level: "P2", id: block.id || "voice", msg: `Review attribution/process language in context: ${[...new Set(matches)].join(", ")}` }] : [];
  });
}

export function validateBindings(model, bindings) {
  const issues = [];
  const claims = new Set(model.claims.map((claim) => claim.id));
  const sources = new Set(model.sources.map((source) => source.id));
  for (const id of bindings.claims) if (!claims.has(id)) issues.push(issue(id, "HTML references an unknown claim"));
  for (const id of bindings.sources) if (!sources.has(id)) issues.push(issue(id, "HTML references an unknown source"));
  if (!bindings.claims.includes(model.answerClaimId)) issues.push(issue("answer", "Governing answer is not bound in HTML"));
  for (const claim of model.claims) {
    if (!bindings.claims.includes(claim.id)) continue;
    for (const source of claim.sourceRefs) {
      if (!bindings.sources.includes(source)) issues.push(issue(claim.id, `Cited source is absent from rendered HTML: ${source}`));
    }
  }
  return issues;
}
