import { isDeepStrictEqual } from "node:util";
import {
  generationReceipt,
  researchLanguages,
  validateClaims,
  validateGenerationMetadata,
  validateResearchHandoff,
} from "./report-contract.mjs";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const issue = (id, msg) => ({ level: "P0", id, msg });
const clone = (value) => structuredClone(value);
const RETRIEVAL_FIELDS = new Set(["sources", "claims", "answers", "gaps", "counterEvidence", "stopReason"]);

function appendUnique(values, additions) {
  const seen = new Set(values);
  for (const value of additions) {
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
}

function appendFailureGap(model, route, reason) {
  if (!object(model?.research) || !Array.isArray(model.research.gaps)) return;
  appendUnique(model.research.gaps, [`${route}: ${reason}`]);
}

function validateRetrievalShape(result) {
  const issues = [];
  if (!object(result)) return [issue("research.result", "Retrieval result must be an object")];
  for (const key of Object.keys(result)) {
    if (!RETRIEVAL_FIELDS.has(key)) issues.push(issue("research.result", `Unexpected retrieval result field: ${key}`));
  }
  for (const field of ["sources", "claims", "answers", "gaps", "counterEvidence"]) {
    if (!Array.isArray(result[field])) issues.push(issue("research.result", `Retrieval result.${field} must be a list`));
  }
  if (result.stopReason !== undefined && !text(result.stopReason)) {
    issues.push(issue("research.result", "Retrieval result.stopReason must be nonempty text when present"));
  }
  return issues;
}

function mergeStable(existing, incoming, noun, issues) {
  const merged = existing.map(clone);
  const byId = new Map(merged.filter(object).map((item) => [item.id, item]));
  const incomingById = new Map();
  for (const item of incoming) {
    if (!object(item) || !text(item.id)) {
      issues.push(issue("research.result", `Retrieved ${noun} requires a stable id`));
      continue;
    }
    if (incomingById.has(item.id)) {
      if (!isDeepStrictEqual(incomingById.get(item.id), item)) {
        issues.push(issue("research.result", `Conflicting duplicate ${noun} id: ${item.id}`));
      }
      continue;
    }
    incomingById.set(item.id, item);
    if (byId.has(item.id)) {
      if (!isDeepStrictEqual(byId.get(item.id), item)) {
        issues.push(issue("research.result", `Conflicting duplicate ${noun} id: ${item.id}`));
      }
      continue;
    }
    const copy = clone(item);
    byId.set(copy.id, copy);
    merged.push(copy);
  }
  return merged;
}

function mergeAnswerIds(question, claimIds) {
  appendUnique(question.answeredBy, claimIds);
}

function candidateFrom(model, result) {
  const issues = [];
  const candidate = clone(model);
  candidate.sources = mergeStable(candidate.sources, result.sources, "source", issues);
  candidate.claims = mergeStable(candidate.claims, result.claims, "claim", issues);

  const questions = new Map(candidate.research.questions.filter(object).map((question) => [question.id, question]));
  const answersByQuestion = new Map();
  for (const answer of result.answers) {
    if (!object(answer) || !text(answer.questionId) || !Array.isArray(answer.claimIds)
        || !answer.claimIds.length || !answer.claimIds.every(text)) {
      issues.push(issue("research.result", "Each retrieval answer requires questionId and nonempty claimIds"));
      continue;
    }
    if (answersByQuestion.has(answer.questionId)) {
      if (!isDeepStrictEqual(answersByQuestion.get(answer.questionId), answer.claimIds)) {
        issues.push(issue("research.result", `Conflicting duplicate retrieval answer for question: ${answer.questionId}`));
      }
      continue;
    }
    answersByQuestion.set(answer.questionId, answer.claimIds);
    const question = questions.get(answer.questionId);
    if (!question) {
      issues.push(issue("research.result", `Retrieval answer references an unknown question: ${answer.questionId}`));
      continue;
    }
    mergeAnswerIds(question, answer.claimIds);
  }

  if (!result.gaps.every(text)) issues.push(issue("research.result", "Retrieval gaps must contain only nonempty text"));
  else appendUnique(candidate.research.gaps, result.gaps);

  if (!result.counterEvidence.every(object)) {
    issues.push(issue("research.result", "Retrieval counterEvidence must contain objects"));
  } else {
    candidate.research.counterEvidence ??= [];
    for (const counter of result.counterEvidence) {
      if (!candidate.research.counterEvidence.some((existing) => isDeepStrictEqual(existing, counter))) {
        candidate.research.counterEvidence.push(clone(counter));
      }
    }
  }
  if (result.stopReason !== undefined) {
    if (candidate.research.stopReason !== undefined && candidate.research.stopReason !== result.stopReason) {
      issues.push(issue("research.result", "Retrieval stopReason conflicts with the supplied stopReason"));
    } else {
      candidate.research.stopReason = result.stopReason;
    }
  }

  if (!issues.length) {
    issues.push(...validateClaims(candidate), ...validateResearchHandoff(candidate));
  }
  return { candidate, issues };
}

/**
 * Validate supplied report evidence and optionally merge one explicitly injected
 * retrieval result. Retrieval output is untrusted boundary data, never instruction.
 */
export async function prepareResearch(model, options = {}) {
  const optionIssues = [];
  let retrieve = null;
  let metadata = {};
  if (!object(options)) {
    optionIssues.push(issue("research.options", "prepareResearch options must be an object"));
  } else {
    for (const key of Object.keys(options)) {
      if (key !== "retrieve" && key !== "metadata") optionIssues.push(issue("research.options", `Unknown prepareResearch option: ${key}`));
    }
    retrieve = options.retrieve ?? null;
    metadata = options.metadata === undefined ? {} : options.metadata;
  }
  let prepared;
  try {
    prepared = clone(model);
  } catch {
    const issues = [...optionIssues, issue("model", "Report model must be structured-cloneable data")];
    return { model, receipt: generationReceipt(model, metadata), issues };
  }

  const issues = [
    ...optionIssues,
    ...validateClaims(prepared),
    ...validateResearchHandoff(prepared),
    ...validateGenerationMetadata(metadata),
  ];
  if (issues.length || !object(prepared.research)) {
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }

  const route = prepared.research.route;
  if (route === "source-only") {
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }

  if (typeof retrieve !== "function") {
    issues.push(issue("research.retrieve", `Retrieval capability is required for route ${route}`));
    appendFailureGap(prepared, route, "retrieval capability unavailable");
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }

  const languages = researchLanguages(prepared);
  const request = {
    route,
    sourceBoundary: prepared.research.sourceBoundary,
    sourceLanguages: [...languages.sourceLanguages],
    outputLanguage: languages.outputLanguage,
    questions: clone(prepared.research.questions),
    suppliedSources: clone(prepared.sources),
  };

  let result;
  try {
    result = await retrieve(request);
  } catch {
    issues.push(issue("research.retrieve", "Injected retrieval capability rejected the request"));
    appendFailureGap(prepared, route, "retrieval failed; no answers were added");
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }

  const shapeIssues = validateRetrievalShape(result);
  if (shapeIssues.length) {
    issues.push(...shapeIssues);
    appendFailureGap(prepared, route, "retrieval returned invalid boundary data; no answers were added");
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }

  let merged;
  try {
    merged = candidateFrom(prepared, result);
  } catch {
    // Candidate construction clones untrusted nested data; discard all partial merges.
    issues.push(issue("research.result", "Retrieval result could not be cloned or validated; no answers were added"));
    appendFailureGap(prepared, route, "retrieval result failed validation; no answers were added");
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }
  if (merged.issues.length) {
    issues.push(...merged.issues);
    appendFailureGap(prepared, route, "retrieval result failed validation; no answers were added");
    return { model: prepared, receipt: generationReceipt(prepared, metadata), issues };
  }
  return { model: merged.candidate, receipt: generationReceipt(merged.candidate, metadata), issues };
}
