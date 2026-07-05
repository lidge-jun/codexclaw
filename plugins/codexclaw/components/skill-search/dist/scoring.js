/**
 * scoring.ts — pure keyword scorer (WP3 / 040). Deliberately simple: the jaw
 * registry is ~231 rows, so a linear scan with additive term weights beats an
 * index for both latency and debuggability. `superseded_by` / claude-specific
 * rows are demoted (x0.5), never hidden — remote storage is free and the
 * adapter preamble tells the agent which active skill wins.
 */


const W_ID_EXACT = 10;
const W_ID_PART = 5;
const W_NAME = 4;
const W_CATEGORY = 3;
const W_DESC = 2;

export function tokenize(query        )           {
  return query
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function scoreRow(row          , terms          )         {
  let score = 0;
  const id = row.id.toLowerCase();
  const name = row.name.toLowerCase();
  const desc = row.description.toLowerCase();
  const descKo = (row.descriptionKo ?? "").toLowerCase();
  const category = (row.category ?? "").toLowerCase();
  for (const term of terms) {
    if (id === term) score += W_ID_EXACT;
    else if (id.includes(term)) score += W_ID_PART;
    if (name.includes(term)) score += W_NAME;
    if (category.includes(term)) score += W_CATEGORY;
    if (desc.includes(term)) score += W_DESC;
    if (descKo.includes(term)) score += W_DESC;
  }
  if (score > 0 && (row.supersededBy || row.status === "claude-specific")) score *= 0.5;
  return score;
}

export function rank(rows            , query        , limit        )              {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return rows
    .map((row) => ({ ...row, score: scoreRow(row, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
