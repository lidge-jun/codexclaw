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
 * Korean ending trimming (R2) rides in the same OR-group. Memory search matches
 * by substring, so a query of `배포` already reaches text saying `배포까지`; the
 * failing direction is the opposite one, where a user types `배포까지` and never
 * reaches a document that only says `배포`. Measured ending-attachment rates on
 * the memories corpus are high enough for this to be the common case: 배포 60%,
 * 검색 60%, 스킬 56%, 세션 51% (011_survey_recall_search.md 3.3).
 *
 * Adding the stem as a second group member fixes that without touching the
 * matching, scoring or excerpt code, because the group is already an OR.
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
  ["release", "releases", "릴리스", "릴리즈"],
  ["commit", "commits", "커밋"],
  ["review", "reviews", "리뷰", "검토"],
  ["branch", "branches", "브랜치"],
  // 260910 wp5 seeds: the ko/en pairs the evaluation sentences turned on.
  // `도그 푸딩` (two tokens) is deliberately absent — it already survives as an
  // ordinary two-word AND, and a seed cannot span a space.
  ["dogfooding", "도그푸딩"],
  ["codex", "코덱스"],
  ["restart", "재시작"],
  ["verify", "verification", "verified", "검증", "provenance"],
  ["source", "소스"],
];

/** Max members per expanded group (original word + synonyms). */
const GROUP_CAP = 8;

const TERM_TO_GROUP = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) TERM_TO_GROUP.set(term.toLowerCase(), group);
}

/**
 * Korean particles and verbalizer endings, matched longest-first so `에서는`
 * never loses to `는`. Derived from the measured top endings in the memories
 * corpus (011 3.3, 3.5).
 */
const KOREAN_ENDINGS: string[] = [
  // 3 syllables
  "에서는",
  "으로는",
  // 2 syllables
  "에서",
  "으로",
  "에는",
  "이나",
  "까지",
  "부터",
  "처럼",
  "보다",
  "마다",
  "라고",
  "하고",
  "해서",
  "하는",
  "한테",
  // `소스인지`, `무엇인지` — the interrogative nominalizer. `한` stays out: it
  // would trim `검증한` to `검증` but also every noun ending in 한.
  "인지",
  "들을",
  "들이",
  "에게",
  // 1 syllable
  "을",
  "를",
  "이",
  "가",
  "은",
  "는",
  "의",
  "에",
  "도",
  "과",
  "와",
  "만",
  "로",
].sort((a, b) => b.length - a.length);

/** Hangul-syllable-only words are the only trimming candidates. */
const HANGUL_ONLY = /^[가-힣]+$/;

/**
 * Conjugated 하-verbalizer tail: `결정했지`, `배포하고`, `검색해야` all reduce to
 * their noun stem. The fixed ending list above cannot cover these because the
 * tense and mood suffixes are open-ended, and the roadmap's own Korean
 * verification query (`왜 그렇게 결정했지`) needs the reduction.
 *
 * The stem-length rule below is what keeps this safe: 이해, 오해, 방해, 지하 and
 * every other two-syllable noun that merely ends in 하/해 leaves a one-syllable
 * stem and is rejected.
 */
const HA_VERB_TAIL = /(?:했|하|해)[가-힣]{0,3}$/;

/** A trimmed stem shorter than this is rejected: 검사 → 검 explodes recall. */
const MIN_STEM_SYLLABLES = 2;

/**
 * Korean stem for a query word, or null when nothing safe can be trimmed.
 * Three guards, all from 011 3.6: Hangul-only input, a stem of at least two
 * syllables, and no removal of the original (callers always keep it).
 */
export function koreanStem(word: string): string | null {
  if (!HANGUL_ONLY.test(word)) return null;
  for (const ending of KOREAN_ENDINGS) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, word.length - ending.length);
    if ([...stem].length >= MIN_STEM_SYLLABLES) return stem;
  }
  const ha = HA_VERB_TAIL.exec(word);
  if (ha) {
    const stem = word.slice(0, ha.index);
    if ([...stem].length >= MIN_STEM_SYLLABLES) return stem;
  }
  return null;
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
 *
 * Order matters: the Korean stem is resolved first and then re-looked-up in the
 * synonym table, which is what makes `배포를` reach `deploy`. Looking up only
 * the raw lowercase word (the pre-R2 behavior) missed every inflected form.
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

    const stem = koreanStem(lower);
    if (stem) push(stem);
    // Synonyms of the raw word first, then of the trimmed stem: 배포를 has no
    // table entry of its own but its stem does.
    for (const key of stem ? [lower, stem] : [lower]) {
      for (const member of TERM_TO_GROUP.get(key) ?? []) {
        if (texts.length >= GROUP_CAP) break;
        push(member);
      }
    }

    return texts.slice(0, GROUP_CAP).map((text): QueryTerm => ({ text, boundary }));
  });
}
