/**
 * synonyms.ts — curated bidirectional ko/en synonym table plus Korean ending
 * trimming for memory search query expansion. Static and in-code on purpose:
 * recall keeps its read-only-derived-cache posture, so there is no sqlite
 * synonym table to migrate or corrupt (cli-jaw stores the same seeds in a
 * memory_synonyms table; codexclaw ports the data, not the storage).
 *
 * Expansion model (cli-jaw indexing.ts parity): each query word becomes an
 * OR-group — the chunk matches the group when ANY member is present — and
 * matching stays AND across groups. Two query words that live in the same
 * group therefore collapse into the same requirement (documented behavior:
 * `plan audit` matches anything with one pabcd-family word).
 *
 * Emitted group members carry the boundary flag decided by query-words.ts, so a
 * symbol-shaped query word stays boundary-gated through expansion.
 */
import {
  isSymbolWord,
  type QueryGroup,
  type QueryTerm,
} from "./query-words.ts";

/** Each group is one concept; membership is bidirectional and case-insensitive. */
export const SYNONYM_GROUPS: string[][] = [
  // cli-jaw seeds (src/memory/synonyms.ts)
  ["preference", "preferences", "선호", "취향", "환경설정"],
  ["decision", "decisions", "결정", "선택", "방침"],
  ["project", "projects", "프로젝트", "작업"],
  ["runbook", "runbooks", "절차", "런북", "매뉴얼"],
  ["workflow", "워크플로우", "흐름"],
  ["pabcd", "plan", "audit", "build", "check", "done"],
  ["fts", "fts5", "full-text-search"],
  ["bm25", "ranking", "relevance"],
  ["cli-jaw", "cli_jaw", "clijaw", "jaw"],
  // codexclaw-domain additions
  ["memory", "memories", "메모리", "기억"],
  ["search", "검색"],
  ["session", "sessions", "세션"],
  ["error", "errors", "오류", "에러", "bug", "버그"],
  ["test", "tests", "테스트"],
  ["skill", "skills", "스킬"],
  ["plugin", "plugins", "플러그인"],
  ["index", "인덱스"],
  ["hook", "hooks", "훅"],
  ["config", "configuration", "설정"],
  ["deploy", "deployment", "배포"],
];

/** Max members per expanded group (original word + synonyms). */
const GROUP_CAP = 8;

const TERM_TO_GROUP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) TERM_TO_GROUP.set(term.toLowerCase(), group);
}

/**
 * Expand query words into OR-groups of matchable terms. Words arrive with their
 * original case because symbol judgment needs it (`CI` vs a bare `ci`
 * fragment); every emitted term text is lowercase.
 *
 * The original word always leads its group, so the excerpt anchor and density
 * scoring still prefer what the user actually typed. Unknown words become
 * singleton groups. Members are deduped case-insensitively and capped at
 * GROUP_CAP.
 */
export function expandQueryWords(words: string[]): QueryGroup[] {
  return words.map((word) => {
    const boundary = isSymbolWord(word);
    const lower = word.toLowerCase();
    const texts: string[] = [lower];
    const push = (candidate: string) => {
      const c = candidate.toLowerCase();
      if (c !== "" && !texts.includes(c)) texts.push(c);
    };

    for (const member of TERM_TO_GROUP.get(lower) ?? []) {
      if (texts.length >= GROUP_CAP) break;
      push(member);
    }

    return texts.slice(0, GROUP_CAP).map((text): QueryTerm => ({ text, boundary }));
  });
}
