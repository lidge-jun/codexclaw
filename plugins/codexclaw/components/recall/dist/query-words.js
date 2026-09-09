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

/** Query words beyond this count are dropped (cli-jaw parity). */
export const MAX_WORDS = 8;

/**
 * One matchable term: lowercase text plus whether it must land on a token
 * boundary. The flag rides on the term rather than on the search call so an
 * OR-group can mix a boundary-gated symbol with its free-form synonyms.
 */


/** OR-group of interchangeable terms; matching stays AND across groups. */


/** Query words with original case intact — symbol judgment needs it. */
export function splitQueryWordsRaw(query        )           {
  return query
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_WORDS);
}

/** Lowercase query words (the historical tokenizer, unchanged behavior). */
export function splitQueryWords(query        )           {
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
export function isVersionWord(rawWord        )          {
  return VERSION.test(rawWord.toLowerCase());
}

/**
 * Is this query word symbol-shaped, i.e. should it match on token boundaries?
 * Takes the word with original case because the acronym rule is the only signal
 * separating `CI` from an ordinary two-letter fragment.
 */
export function isSymbolWord(rawWord        )          {
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

function isTokenEdge(ch        )          {
  return ch === "" || !TOKEN_CHAR.test(ch);
}

function isBoundaryAt(lowerText        , at        , length        )          {
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
export function termIndexOf(lowerText        , term           , from = 0)         {
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
export function termIncludes(lowerText        , term           )          {
  return termIndexOf(lowerText, term) !== -1;
}

/** Occurrence count for density scoring, stopping at cap. */
export function countTermOccurrences(lowerText        , term           , cap        )         {
  let occ = 0;
  let at = termIndexOf(lowerText, term);
  while (at !== -1 && occ < cap) {
    occ += 1;
    at = termIndexOf(lowerText, term, at + term.text.length);
  }
  return occ;
}

/** True when any term in any group is boundary-gated (drives the relaxed retry). */
export function hasBoundaryTerm(groups              )          {
  return groups.some((group) => group.some((term) => term.boundary));
}

/**
 * Same groups with boundary gating dropped. Used for the zero-result retry: a
 * symbol query that finds nothing on token boundaries is better served by
 * lower-confidence substring hits than by an empty answer (`3956` written as
 * `PR3956` has no boundary before the digits).
 */
export function relaxQueryGroups(groups              )               {
  return relaxGroupsAt(groups, new Set(groups.keys()));
}

/**
 * Drop boundary gating only for the groups at `indexes`. The per-group retry
 * (260910 wp2) relaxes just the symbol groups that found nothing anywhere in the
 * corpus, so a group that does hit on boundaries keeps its precision.
 */
export function relaxGroupsAt(groups              , indexes                     )               {
  return groups.map((group, i) =>
    indexes.has(i) ? group.map((term) => ({ text: term.text, boundary: false })) : group,
  );
}

/** Plain member texts of a group — for assertions and diagnostics. */
export function groupTexts(group            )           {
  return group.map((term) => term.text);
}
