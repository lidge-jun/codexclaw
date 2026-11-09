/**
 * lane-council.mjs — role stances on dispatch packets before a fan-out (LANE-COUNCIL-01).
 *
 * After Quorum (https://github.com/tryquorum/quorum: src/engine/rules.ts decide(),
 * src/engine/dedup.ts, src/engine/roles.ts). Quorum asks four role critics about every
 * proposal before anything runs: CEO (is it needed), Reviewer (duplicate or bug), QA (can
 * it be verified) and CSO (risk). Outbound actions hold for a person and near-duplicate
 * proposals collapse. This module is the deterministic part of that council, applied to
 * the packets a coordinator is about to dispatch.
 *
 * Advisory, like the packet validator it extends: nothing intercepts create_thread. A
 * "pass" means no hold was found. It never means anybody approved the lane, and a field
 * that declares an action records what the packet says; it is not a grant.
 *
 * Pure: no I/O, no clock, no memory. Callers validate packets first.
 */

/** Bump when a rule changes, so a recorded verdict names the rules that produced it. */
export const RULES_VERSION = 1;

/**
 * Character-bigram Dice on normalized objectives at or above this holds a lane. Quorum
 * uses 0.6 on short Korean titles. English lane objectives share more bigrams by default:
 * distinct slices measured 0.63-0.72 ("Fix Windows CI for recall" / "... for state-cli"),
 * reworded copies 0.825-0.923. One distinct pair scored 0.852 ("link-criterion" /
 * "add-criterion"), so a hold costs a coordinator one rewrite; a missed duplicate is the
 * failure this exists for.
 */
export const NEAR_DUPLICATE = 0.8;
/** Normalized objectives shorter than this are never compared (Quorum SAME_TITLE_MIN). */
export const SAME_OBJECTIVE_MIN = 4;
/** One objective inside another is a near duplicate when the shorter has this many chars. */
export const CONTAINMENT_MIN = 12;

/** Actions with their own authority field; authority.outbound may not restate them. */
export const FIELD_DECLARED = { merge: "authority.merge", push: "authority.push", pr: "authority.openPr" };
/** Actions declared only through authority.outbound. */
export const OUTBOUND_LIST_CATEGORIES = ["deploy", "release", "publish", "send", "destroy", "pay"];
export const OUTBOUND_CATEGORIES = [...Object.keys(FIELD_DECLARED), ...OUTBOUND_LIST_CATEGORIES];

export const normObjective = (s) => String(s).normalize("NFC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** 0..1 character-bigram Dice coefficient on normalized text (Quorum dedup.ts similarity). */
export function similarity(a, b) {
  const x = normObjective(a), y = normObjective(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const gx = bigrams(x), gy = bigrams(y);
  let both = 0;
  for (const [g, n] of gx) both += Math.min(n, gy.get(g) || 0);
  return (2 * both) / (x.length - 1 + (y.length - 1));
}

// A Korean action noun followed by a code noun names code, not an action: "결제 모듈
// 리팩터" refactors the payment module, "게시판" is a board, "전송 속도" is a speed; "결제"
// alone pays. A colon or dash between the two words does not change that.
const KO_NOT_ACTION = "(?![\\s:·-]*(?:모듈|기능|화면|로직|코드|버그|테스트|페이지|버튼|흐름|폼|내역|로그|설정|스크립트|단계|노트|문서|알림|판|물|속도|목록|상태|이력|방식|형식|실패|오류|에러|함수|핸들러|엔드포인트|큐|API|api))";
const ko = (...words) => new RegExp("(?:" + words.join("|") + ")" + KO_NOT_ACTION, "gu");
const en = (source) => new RegExp(source, "giu");

// English verbs that double as code words ("the delete endpoint", "send a request",
// "publish the type definitions", "merge the two arrays", "pay attention") are not actions
// when a code noun follows within two words. Deploy targets (docs, site, page, app) and
// "step" are left off this list on purpose: "deploy the docs site" is a deploy, and "never
// skip the deploy step" asks for one.
const CODE_NOUNS = "endpoints?|buttons?|keys?|handlers?|requests?|validation|validators?|events?|methods?|functions?|routes?|quer(?:y|ies)|flags?|logic|modals?|dialogs?|forms?|fields?|icons?|hooks?|utils?|helpers?|types?|typings|definitions?|configs?|attention|arrays?|lists?|objects?|maps?|dicts?|results?|components?|specs?|scripts?|sort|conflicts?|queues?|base|notifications?|speed|rate|timeouts?|retr(?:y|ies)|errors?|counters?|payloads?";
const NOT_CODE = "(?![-\\s]+(?:[\\w'-]+\\s+){0,2}?(?:" + CODE_NOUNS + ")\\b)";
const verb = (forms) => en("\\b(?:" + forms + ")\\b" + NOT_CODE);
// Submitting reaches a form through its object ("submit the application form"), so only a
// code noun right after it ("submit button") makes it code.
const NOT_CODE_NEXT = "(?![-\\s]+(?:" + CODE_NOUNS + ")\\b)";

/**
 * Wording that asks a lane to act outside its checkout. Word boundaries keep camelCase
 * identifiers (mergeLanes, publishConfig) out. Code spans are scanned too, because "run
 * npm publish" in backticks is still an instruction. Unclear wording errs toward a hold.
 */
const PATTERNS = {
  merge: [
    verb("merge|merges|merged|merging"),
    en("\\bgh\\s+pr\\s+merge\\b"),
    en("\\bland(?:s|ed|ing)?\\s+(?:the\\s+|this\\s+|that\\s+|these\\s+|a\\s+)?(?:branch(?:es)?|prs?|pull\\s+requests?|changes?|commits?|fix(?:es)?|patch(?:es)?|work)\\b"),
    ko("머지", "병합"),
  ],
  push: [verb("push|pushes|pushed|pushing"), ko("푸시")],
  pr: [
    en("\\b(?:open|opens|opened|opening|create|creates|created|creating|file|raise|submit)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:draft\\s+)?(?:pr|pull\\s+request)s?\\b"),
    en("\\bgh\\s+pr\\s+create\\b"),
    new RegExp("\\bPR\\s*(?:을|를)?\\s*(?:올리|올려|열|생성)", "giu"),
  ],
  deploy: [
    verb("deploy|deploys|deployed|deploying|deployment"),
    en("\\broll(?:s|ed|ing)?[- ]?out\\b"),
    en("\\bgo(?:es)?\\s+live\\b"),
    verb("ship|ships|shipped|shipping"),
    en("\\bupload(?:s|ed|ing)?\\b[^.;\\n]{0,30}?\\bto\\s+(?:prod|production|staging|live|s3|npm|pypi|the\\s+(?:server|store))\\b"),
    en("\\breleas(?:e|es|ed|ing)\\s+(?:it\\s+|this\\s+|them\\s+|the\\s+[\\w-]+\\s+)?to\\s+(?:prod|production|staging|users|customers)\\b"),
    ko("배포"),
  ],
  release: [
    en("\\b(?:cut|cuts|publish|tag|create|draft|make)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:new\\s+)?release\\b"),
    en("\\bgh\\s+release\\s+create\\b"),
    en("\\bgit\\s+tag\\b"),
    en("\\btag(?:s|ged|ging)?\\s+v?\\d"),
    ko("릴리스", "릴리즈"),
  ],
  publish: [verb("publish|publishes|published|publishing"), ko("게시", "발행")],
  send: [
    verb("send|sends|sending|sent"),
    en("\\be-?mail(?:s|ed|ing)?\\s+(?:to|the|a|an|them|him|her)\\b"),
    en("\\be-?mailed\\b"),
    en("\\bpost(?:s|ed|ing)?\\b[^.;\\n]{0,40}?\\b(?:to|on|in)\\s+(?:slack|discord|teams|twitter|x|linkedin|reddit|github|the\\s+(?:channel|issue|pr|pull\\s+request|forum|thread))\\b"),
    en("\\bapprov(?:e|es|ed|ing)\\s+(?:the\\s+|this\\s+|a\\s+)?(?:pr|pull\\s+request)\\b"),
    en("\\bcomment(?:s|ed|ing)?\\s+on\\s+(?:the\\s+|this\\s+|a\\s+)?(?:pr|pull\\s+request|issue)\\b"),
    // Quorum also holds submit/apply/dm. "submit a PR" is the pr category, and bare
    // "apply" is left out: "apply the patch" is everyday lane wording.
    en("\\bsubmit(?:s|ted|ting)?\\b(?!\\s+(?:a\\s+|an\\s+|the\\s+)?(?:draft\\s+)?(?:pr|pull\\s+request)s?\\b)" + NOT_CODE_NEXT),
    en("\\bappl(?:y|ies|ied|ying)\\s+for\\b"),
    en("\\bdms?\\s+(?:the\\s+|a\\s+|an\\s+)?@?\\w"),
    ko("보내", "보낸", "전송", "발송", "제출", "신청"),
  ],
  destroy: [
    verb("delete|deletes|deleted|deleting|destroy|destroys|destroyed|destroying"),
    en("\\bdrop(?:s|ped|ping)?\\s+(?:the\\s+)?(?:\\w+\\s+)?(?:table|database|schema|column|collection)s?\\b"),
    en("\\brm\\s+-[a-z]*r"),
    en("\\b(?:wipe|wipes|wiped|wiping|purge|purges|purged|purging)\\b"),
    en("\\breset\\s+--hard\\b|\\b(?:hard|state)\\s+reset\\b|\\breset\\s+(?:the\\s+)?(?:state|database|db)\\b"),
    // cxc-dev Safety Rules list cache clearing as Destruction (ESCALATE).
    en("\\bclear(?:s|ed|ing)?\\s+(?:the\\s+)?(?:\\w+\\s+)?caches?\\b"),
    en("\\bforce[- ]?push(?:es|ed|ing)?\\b|\\bpush\\s+(?:--force|-f)\\b"),
    ko("삭제", "초기화", "지우", "지워"),
  ],
  pay: [
    verb("pay|pays|paid|paying|purchase|purchases|purchased|purchasing|buy|buys|bought|buying"),
    en("\\btransfer(?:s|red|ring)?\\s+(?:the\\s+)?(?:funds|money|payments?)\\b"),
    ko("결제", "구매", "송금"),
  ],
};

// Negation counts only when it governs this one verb: directly before it in English
// ("do not merge", "never deploy", "make sure not to deploy", "dont publish"), directly
// after it in English ("merge is not allowed") and Korean ("병합은 하지 마요", "배포 금지").
// "never skip the deploy step" and "do not merge until CI passes, then merge" still hold,
// because another mention stands un-negated.
const EN_NEGATION_BEFORE = /(?:\b(?:do|does|did|must|should|shall|will|can|could|may)\s+not|\b(?:don['’]?t|doesn['’]?t|didn['’]?t|mustn['’]?t|shouldn['’]?t|won['’]?t|can['’]?t|cannot|never|not|without|no)|\bavoid)\s+(?:to\s+)?$/iu;
const EN_NEGATION_AFTER = /^\s+(?:is|are|was|stays?|remains?)\s+(?:not\s+allowed|forbidden|prohibited|out\s+of\s+scope|not\s+in\s+scope|off[- ]limits)\b/iu;
const KO_NEGATION_AFTER = /^\s*(?:은|는|을|를|도|만)?\s*(?:(?:하지|지)\s*(?:마|말|않)|금지|안\s*(?:함|해|한다|하)|(?:하면|해서는)\s*안\s*(?:돼|되|됨|된다))/u;

function negated(text, start, end) {
  const after = text.slice(end, end + 32);
  return EN_NEGATION_BEFORE.test(text.slice(Math.max(0, start - 40), start)) || EN_NEGATION_AFTER.test(after) || KO_NEGATION_AFTER.test(after);
}


/** Un-negated outbound mentions in text: one entry per category, first match kept. */
export function outboundMentions(value) {
  const text = String(value ?? "").normalize("NFC");
  const out = [];
  for (const category of OUTBOUND_CATEGORIES) {
    for (const pattern of PATTERNS[category]) {
      const hit = [...text.matchAll(pattern)].find((m) => !negated(text, m.index, m.index + m[0].length));
      if (hit) { out.push({ category, match: hit[0].trim() }); break; }
    }
  }
  return out;
}

const filled = (v) => typeof v === "string" && v.trim().length > 0;

/** Whether the packet declares a category. Declared is a record, never a grant. */
export function declares(packet, category) {
  const authority = packet?.authority && typeof packet.authority === "object" ? packet.authority : {};
  if (category === "merge") return authority.merge === true;
  if (category === "push") return authority.push === true;
  if (category === "pr") return authority.openPr === true;
  return Array.isArray(authority.outbound) && authority.outbound.some((c) => typeof c === "string" && c.trim() === category);
}

const declaringField = (category) => FIELD_DECLARED[category] ?? "authority.outbound";

function ceo(packet) {
  if (filled(packet.work?.objective)) return [{ role: "ceo", stance: "keep", rule: "CEO-OBJECTIVE", reason: "work.objective states what the lane is for" }];
  return [{ role: "ceo", stance: "escalate", rule: "CEO-NO-OBJECTIVE", reason: "no work.objective: nobody can tell whether this lane is needed or repeats another" }];
}

function reviewer(packet, peers) {
  const mine = packet.work?.objective;
  if (!filled(mine)) return [{ role: "reviewer", stance: "keep", rule: "REVIEWER-NO-OBJECTIVE", reason: "no objective to compare" }];
  const comparable = peers.filter((p) => filled(p.objective));
  if (comparable.length === 0) return [{ role: "reviewer", stance: "keep", rule: "REVIEWER-NO-PEERS", reason: "no other lane to compare" }];
  const key = normObjective(mine);
  if (key.length >= SAME_OBJECTIVE_MIN) {
    const same = comparable.find((p) => normObjective(p.objective) === key);
    if (same) return [{ role: "reviewer", stance: "cut", rule: "REVIEWER-DUPLICATE", reason: "same objective as lane " + same.lane + ": fold the work into that lane or split the objective", peer: same.lane }];
    for (const p of comparable) {
      const other = normObjective(p.objective);
      if (other.length < SAME_OBJECTIVE_MIN) continue;
      const [shorter, longer] = key.length <= other.length ? [key, other] : [other, key];
      if (shorter.length >= CONTAINMENT_MIN && longer.includes(shorter))
        return [{ role: "reviewer", stance: "escalate", rule: "REVIEWER-NEAR-DUPLICATE", reason: "objective overlaps lane " + p.lane + " (one contains the other): confirm they are separate slices", peer: p.lane }];
      const score = similarity(mine, p.objective);
      if (score >= NEAR_DUPLICATE)
        return [{ role: "reviewer", stance: "escalate", rule: "REVIEWER-NEAR-DUPLICATE", reason: "objective is " + Math.round(score * 100) + "% similar to lane " + p.lane + ": confirm they are separate slices", peer: p.lane, score: Math.round(score * 1000) / 1000 }];
    }
  }
  return [{ role: "reviewer", stance: "keep", rule: "REVIEWER-DISTINCT", reason: "no other lane has a matching objective" }];
}

function qa(packet) {
  if (Array.isArray(packet.work?.criteria) && packet.work.criteria.some(filled))
    return [{ role: "qa", stance: "keep", rule: "QA-CRITERIA", reason: "work.criteria define done" }];
  return [{ role: "qa", stance: "keep", rule: "QA-EVIDENCE", reason: "reporting.evidence names what comes back" }];
}

function cso(packet) {
  const work = packet.work ?? {};
  const texts = [work.objective, ...(Array.isArray(work.criteria) ? work.criteria : [])].filter(filled);
  const found = new Map();
  for (const t of texts) for (const m of outboundMentions(t)) if (!found.has(m.category)) found.set(m.category, m.match);
  const stances = [];
  for (const [category, match] of found) {
    if (declares(packet, category)) continue;
    stances.push({ role: "cso", stance: "escalate", rule: "CSO-OUTBOUND-" + category, reason: "\"" + match + "\" asks for " + category + ", which " + declaringField(category) + " does not declare: the user decides before dispatch", category });
  }
  if (stances.length) return stances;
  const declared = [...found.keys()];
  return [{ role: "cso", stance: "keep", rule: declared.length ? "CSO-DECLARED" : "CSO-NONE", reason: declared.length ? "outbound wording matches declared " + declared.join(", ") + " (a record, not a grant)" : "no outbound wording found" }];
}

/** Quorum decide() order adapted: any cut rejects, else any escalate holds, else pass. */
export function decide(stances) {
  if (stances.some((s) => s.stance === "cut")) return "reject";
  if (stances.some((s) => s.stance === "escalate")) return "hold";
  return "pass";
}

/**
 * Stances and verdict for one validated dispatch packet. peers are the other lanes it
 * must not repeat: [{ lane, objective }].
 */
export function councilLane(packet, peers = []) {
  if (!filled(packet?.lane)) throw new TypeError("councilLane needs a validated packet with a lane id; run validateLanePacket first");
  const stances = [...ceo(packet), ...reviewer(packet, peers), ...qa(packet), ...cso(packet)];
  return { lane: packet.lane.trim(), decision: decide(stances), stances };
}

/**
 * Council over validated lanes. Each entry is { packet, mode }. Only dispatch lanes are
 * evaluated: a pending or bound lane already exists, so holding it changes nothing, but it
 * is still a peer a dispatch lane must not repeat. A dispatch lane is compared with every
 * created lane and with the dispatch lanes before it, so the first of two copies survives.
 */
export function councilLanes(entries) {
  const verdicts = [];
  const created = entries.filter((e) => e.mode !== "dispatch").map((e) => ({ lane: e.packet.lane.trim(), objective: e.packet.work?.objective }));
  const earlier = [];
  for (const { packet, mode } of entries) {
    if (mode !== "dispatch") {
      verdicts.push({ lane: packet.lane.trim(), decision: "not-evaluated", reason: mode + " lane already exists", stances: [] });
      continue;
    }
    verdicts.push(councilLane(packet, [...created, ...earlier]));
    earlier.push({ lane: packet.lane.trim(), objective: packet.work?.objective });
  }
  const ids = (d) => verdicts.filter((v) => v.decision === d).map((v) => v.lane);
  return { rulesVersion: RULES_VERSION, verdicts, pass: ids("pass"), hold: ids("hold"), reject: ids("reject"), notEvaluated: ids("not-evaluated") };
}

