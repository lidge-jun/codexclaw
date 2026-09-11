/**
 * query-words.ts — query tokenization plus the match predicate shared by memory
 * search (R1 token boundary). Split out of chat-search.ts so memory-search no
 * longer reaches into its sibling search module just to tokenize a query.
 *
 * Why the boundary decision is per word instead of one global \b: forcing token
 * boundaries on every word breaks Korean, where memory search depends on
 * substring matching — there is no boundary between a stem and its ending, so
 * a boundary-gated 검색 would stop reaching 검색해봐. Forcing substring on every
 * word instead makes symbol queries useless. Measured on the 285-file memories
 * corpus (011_survey_recall_search.md 2.2): `fts` matched 41 paragraph chunks
 * and every single one was inside `drafts` or `conflicts`, and `id` mismatched
 * 93.9% of its 4,624 hits.
 *
 * So each query word is judged on its own shape. Symbol-shaped words match on
 * token boundaries; everything else keeps substring matching. Korean words fail
 * every symbol rule, which is exactly why they keep the behavior they need.
 */

/**
 * Relaxation threshold, NOT a truncation cap (260910 wp5). A query longer than
 * this keeps every token up to MAX_QUERY_TERMS but stops requiring all of them:
 * compileMatchPlan splits the groups into required (symbols, versions,
 * mixed-case proper nouns) and optional, and a text matches when it carries
 * every required group plus half of the optional ones.
 *
 * Truncating instead (the pre-wp5 cli-jaw parity behavior) silently discarded
 * the tail of a sentence query, which is where its symbols usually sit: the
 * measured 10-word Korean query lost `확인한 방법` and the 9-word release query
 * lost `기록` before matching even started, and all six evaluation paths
 * returned zero hits.
 */
export const MAX_WORDS = 8;

/**
 * Hard tokenizer cap. Tokens past this point are dropped for real, because the
 * per-word SQL conditions and OR-group expansion both grow with the count.
 */
export const MAX_QUERY_TERMS = 16;

/**
 * One matchable term: lowercase text plus whether it must land on a token
 * boundary. The flag rides on the term rather than on the search call so an
 * OR-group can mix a boundary-gated symbol with its free-form synonyms.
 */
export type QueryTerm = { text: string; boundary: boolean };

/** OR-group of interchangeable terms; matching stays AND across groups. */
export type QueryGroup = QueryTerm[];

/** Query words with original case intact — symbol judgment needs it. */
export function splitQueryWordsRaw(query: string): string[] {
  return query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_QUERY_TERMS);
}

/** Lowercase query words (the historical tokenizer, unchanged behavior). */
export function splitQueryWords(query: string): string[] {
  return splitQueryWordsRaw(query).map((w) => w.toLowerCase());
}

/** Uppercase acronym, judged before lowercasing: CI, PR, FTS, RRF. */
const UPPER_ACRONYM = /^[A-Z]{2,6}$/;
/** Short ASCII word whose substring hits are dominated by mismatches: go, id, ci. */
const SHORT_ASCII = /^[a-z]{1,3}$/;
/** PR / issue / run number, with or without the leading hash. */
const NUMERIC_ID = /^#?\d{2,10}$/;
/** Abbreviated or full commit SHA. */
const SHA = /^[0-9a-f]{7,40}$/;
/**
 * Dotted version: 2.49, 2.49.0, 2.49.0-rc.1, with an optional leading v. Judged
 * BEFORE the filename rule (260910 wp2): `2.49.0` ends in `.0`, which FILENAME
 * read as an extension, and a version written as `v2.49.0` in the corpus then
 * failed the token-boundary test because the `v` is a token character.
 */
const VERSION = /^v?\d+\.\d+(?:\.\d+)*(?:-[a-z0-9.]+)?$/;
/** Version core without the v — the slice looked up in the haystack for "2.49.0". */
const VERSION_CORE = /^\d+\.\d+(?:\.\d+)*(?:-[a-z0-9.]+)?$/;
/** Filename with an extension: hook.ts, plan.md. */
const FILENAME = /\.[a-z0-9]{1,5}$/;
/** Anything carrying a path separator: src/hook.ts. */
const PATH_LIKE = /[/\\]/;

/** Is this query word a dotted version (optionally v-prefixed)? */
export function isVersionWord(rawWord: string): boolean {
  return VERSION.test(rawWord.toLowerCase());
}

/**
 * Is this query word symbol-shaped, i.e. should it match on token boundaries?
 * Takes the word with original case because the acronym rule is the only signal
 * separating `CI` from an ordinary two-letter fragment.
 */
export function isSymbolWord(rawWord: string): boolean {
  if (UPPER_ACRONYM.test(rawWord)) return true;
  const lower = rawWord.toLowerCase();
  return (
    isVersionWord(rawWord) ||
    SHORT_ASCII.test(lower) ||
    NUMERIC_ID.test(lower) ||
    SHA.test(lower) ||
    FILENAME.test(lower) ||
    PATH_LIKE.test(lower)
  );
}

/**
 * Token characters for the boundary test. Deliberately narrower than \b: dots,
 * slashes and hyphens must count as boundaries so `hook.ts` and `src/hook.ts`
 * can be boundary-matched at all, while `my-hook.tsx` is still excluded.
 *
 * Hangul syllables are outside this class, so a boundary-gated ASCII term is
 * never blocked by adjacent Korean — `CI를` still matches `CI`.
 */
const TOKEN_CHAR = /[A-Za-z0-9_]/;

function isTokenEdge(ch: string): boolean {
  return ch === "" || !TOKEN_CHAR.test(ch);
}

function isBoundaryAt(lowerText: string, at: number, length: number): boolean {
  const before = at > 0 ? lowerText[at - 1] : "";
  const after = at + length < lowerText.length ? lowerText[at + length] : "";
  if (isTokenEdge(before) && isTokenEdge(after)) return true;
  // v2.49.0 / (v2.49.0): a lone v immediately before a VERSION core counts as a
  // boundary iff that v itself sits on a token edge. av2.49.0 and 12.49.0 stay out.
  if (before === "v" && isTokenEdge(after) && VERSION_CORE.test(lowerText.slice(at, at + length))) {
    const beforeV = at >= 2 ? lowerText[at - 2] : "";
    return isTokenEdge(beforeV);
  }
  return false;
}

/**
 * Index of the term in already-lowercased text, honoring its boundary flag, or
 * -1. This is the single primitive every R1 coordinate is built on — matching,
 * density counting and excerpt anchoring all route through it, so none of them
 * can drift back to raw substring semantics.
 */
export function termIndexOf(lowerText: string, term: QueryTerm, from = 0): number {
  if (term.text === "") return -1;
  if (!term.boundary) return lowerText.indexOf(term.text, from);
  let at = lowerText.indexOf(term.text, from);
  while (at !== -1) {
    if (isBoundaryAt(lowerText, at, term.text.length)) return at;
    at = lowerText.indexOf(term.text, at + 1);
  }
  return -1;
}

/** Does the term occur in the lowercased text under its own boundary rule? */
export function termIncludes(lowerText: string, term: QueryTerm): boolean {
  return termIndexOf(lowerText, term) !== -1;
}

/** Occurrence count for density scoring, stopping at cap. */
export function countTermOccurrences(lowerText: string, term: QueryTerm, cap: number): number {
  let occ = 0;
  let at = termIndexOf(lowerText, term);
  while (at !== -1 && occ < cap) {
    occ += 1;
    at = termIndexOf(lowerText, term, at + term.text.length);
  }
  return occ;
}

/** True when any term in any group is boundary-gated (drives the relaxed retry). */
export function hasBoundaryTerm(groups: QueryGroup[]): boolean {
  return groups.some((group) => group.some((term) => term.boundary));
}

/**
 * Same groups with boundary gating dropped. Used for the zero-result retry: a
 * symbol query that finds nothing on token boundaries is better served by
 * lower-confidence substring hits than by an empty answer (`3956` written as
 * `PR3956` has no boundary before the digits).
 */
export function relaxQueryGroups(groups: QueryGroup[]): QueryGroup[] {
  return relaxGroupsAt(groups, new Set(groups.keys()));
}

/**
 * Drop boundary gating only for the groups at `indexes`. The per-group retry
 * (260910 wp2) relaxes just the symbol groups that found nothing anywhere in the
 * corpus, so a group that does hit on boundaries keeps its precision.
 */
export function relaxGroupsAt(groups: QueryGroup[], indexes: ReadonlySet<number>): QueryGroup[] {
  return groups.map((group, i) =>
    indexes.has(i) ? group.map((term) => ({ text: term.text, boundary: false })) : group,
  );
}

/** Plain member texts of a group — for assertions and diagnostics. */
export function groupTexts(group: QueryGroup): string[] {
  return group.map((term) => term.text);
}

/**
 * Minimal stopword list (260910 wp5). Six words, all measured on the
 * evaluation queries as padding the user never meant as a search term:
 * `진짜 그 소스인지`, `사라지는 문제`, `확인한 방법`. Kept this small on purpose —
 * a longer list starts deciding which content words matter.
 */
export const QUERY_STOPWORDS: ReadonlySet<string> = new Set(["그", "이", "저", "것", "문제", "방법"]);

/**
 * Must this word be present, rather than merely count toward the optional
 * quota? Symbol-shaped words (versions, numeric ids, SHAs, filenames,
 * acronyms, short ASCII) plus mixed-case ASCII proper nouns (`Codex`,
 * `BundledPluginsMarketplace`) are what make a long query specific; Korean
 * prose and lowercase English words are the padding around them.
 *
 * Judged on the raw word because case is the only signal separating a proper
 * noun from an ordinary word.
 */
export function isRequiredTerm(rawWord: string): boolean {
  if (isSymbolWord(rawWord)) return true;
  return /^[A-Za-z][A-Za-z0-9]*$/.test(rawWord) && /[A-Z]/.test(rawWord) && /[a-z]/.test(rawWord);
}

/**
 * Drop stopwords, unless that would empty the query. A symbol or otherwise
 * required-shaped word is never dropped (`CI` is two characters but it is the
 * whole query), and a query made only of stopwords keeps its original words
 * instead of degenerating into "match everything".
 */
export function dropStopwords(rawWords: string[]): string[] {
  const kept = rawWords.filter((w) => !QUERY_STOPWORDS.has(w.toLowerCase()) || isRequiredTerm(w));
  return kept.length > 0 ? kept : rawWords;
}

/**
 * What a text has to carry to count as a match. `required` groups are ANDed,
 * `optional` groups contribute a quota (`minOptional`), and `anyMode` is the
 * explicit `--any` OR that overrides both. One plan is compiled per search and
 * used by every engine, so the index path, the JSONL scan path and the memory
 * store cannot drift apart.
 */
export type MatchPlan = {
  required: QueryGroup[];
  optional: QueryGroup[];
  minOptional: number;
  anyMode: boolean;
};

/**
 * Build the plan. `relax` is the caller's decision (chat and memory both derive
 * it from the ORIGINAL token count against MAX_WORDS, before stopword removal)
 * so a 9-word query that drops one stopword still relaxes; without that, the
 * threshold would move under the query.
 *
 * `rawWords` is index-aligned with `groups`: the shape judgment needs the word
 * the user typed, not the lowercased, stemmed, synonym-expanded group.
 */
export function compileMatchPlan(
  groups: QueryGroup[],
  rawWords: string[],
  anyMode: boolean,
  relax: boolean,
): MatchPlan {
  if (anyMode || !relax) return { required: groups, optional: [], minOptional: 0, anyMode };
  const required: QueryGroup[] = [];
  const optional: QueryGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const raw = rawWords[i] ?? groups[i][0]?.text ?? "";
    if (isRequiredTerm(raw)) required.push(groups[i]);
    else optional.push(groups[i]);
  }
  return { required, optional, minOptional: Math.ceil(optional.length / 2), anyMode: false };
}

/** Every group in the plan, for scoring and diagnostics (order: required first). */
export function allGroups(plan: MatchPlan): QueryGroup[] {
  return plan.optional.length === 0 ? plan.required : [...plan.required, ...plan.optional];
}

/** A plan with no groups at all — an empty query, which must match nothing. */
export function planIsEmpty(plan: MatchPlan): boolean {
  return plan.required.length === 0 && plan.optional.length === 0;
}

/**
 * The single match predicate. Every engine ends here, which is what keeps the
 * index/scan equivalence oracle meaningful once SQL stops carrying the whole
 * requirement.
 */
export function planMatches(lowerText: string, plan: MatchPlan): boolean {
  const hit = (group: QueryGroup) => group.some((term) => termIncludes(lowerText, term));
  if (plan.anyMode) return plan.required.some(hit) || plan.optional.some(hit);
  if (planIsEmpty(plan)) return false;
  if (!plan.required.every(hit)) return false;
  if (plan.optional.length === 0) return true;
  // Early exit matters: this runs per message over a multi-GB corpus.
  let seen = 0;
  for (const group of plan.optional) {
    if (hit(group) && ++seen >= plan.minOptional) return true;
  }
  return seen >= plan.minOptional;
}
