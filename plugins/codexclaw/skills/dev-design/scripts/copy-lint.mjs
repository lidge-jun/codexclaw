#!/usr/bin/env node
// copy-lint.mjs — counts the countable copy tells in references/copy/copy-tells.md
// (FE-COPY-TELLS-01). Zero dependencies, Node 22+.
//
//   node copy-lint.mjs <file|dir>... [--json] [--year 2026]
//
// Reads the copy a visitor reads: visible HTML text (script, style, svg, code, pre,
// noscript, template, [hidden] and aria-hidden parts removed) or .md/.txt drafts (fenced
// code removed). Korean rules apply to segments whose Hangul share is over 30%.
// Owner register (devlog 010b/010c): two-fragment headlines, contrast frames, imperatives and
// abstract category lines ("새로운 기준") are never FAIL; they WARN only over budget.
// Exit: 0 clean, 1 any FAIL, 2 WARN only, 3 could not run.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { lineAt, emit } from "./lint-core.mjs";

const EXT = new Set([".html", ".htm", ".md", ".txt", ".mdx"]);
const blank = (s) => s.replace(/[^\n]/g, " ");
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…", "&middot;": "·", "&rarr;": "→", "&copy;": "©" };
const decode = (s) => s.replace(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi, (e) => ENT[e.toLowerCase()] ?? (e.startsWith("&#x") ? String.fromCodePoint(parseInt(e.slice(3), 16)) : e.startsWith("&#") ? String.fromCodePoint(parseInt(e.slice(2))) : e));
export const isKo = (s) => { const h = (s.match(/[\uac00-\ud7a3]/g) || []).length, l = (s.match(/[A-Za-z\uac00-\ud7a3]/g) || []).length; return l > 0 && h / l > 0.3; };

/** Visible text segments {text, line, tag} in document order. */
export function segmentsOf(file, src) {
  const ext = extname(file).toLowerCase();
  const segs = [];
  if (ext === ".md" || ext === ".mdx" || ext === ".txt") {
    const t = src.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, blank).replace(/<!--[\s\S]*?-->/g, blank);
    t.split("\n").forEach((ln, i) => {
      const s = ln.trim();
      if (!s || /^(voice|pairs|person|never|register)\s*:/i.test(s)) return;
      const h = s.match(/^(#{1,6})\s+(.*)$/);
      segs.push({ text: h ? h[2] : s.replace(/^[-*>]\s+/, ""), line: i + 1, tag: h ? "h" + h[1].length : /^[-*]\s+/.test(s) ? "li" : "p", md: true });
    });
    return segs;
  }
  let t = src.replace(/<!--[\s\S]*?-->/g, blank);
  t = t.replace(/<(script|style|svg|code|pre|noscript|template|textarea|kbd|samp)\b[\s\S]*?<\/\1>/gi, blank);
  t = t.replace(/<([a-z][\w-]*)\b[^>]*\s(hidden|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/\1>/gi, blank);
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(t))) {
    if (m[4] !== undefined) {
      const text = decode(m[4]).replace(/\s+/g, " ").trim();
      if (text) segs.push({ text, line: lineAt(src, m.index + (m[4].length - m[4].trimStart().length)), tag: [...stack].reverse().find((x) => /^(h[1-6]|button|a|li|dd|dt|td|th|caption|small|label|title|figcaption|blockquote|footer)$/.test(x)) || "p" });
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[3] || /^(br|img|input|meta|link|hr|source|wbr)$/.test(tag)) continue;
    if (m[1]) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.splice(i); } else stack.push(tag);
  }
  return segs;
}

const HYPE_EN = /\b(seamless(ly)?|effortless(ly)?|elevate[sd]?|unlock(s|ed)?|unleash(es|ed)?|empower(s|ed|ing)?|supercharge[sd]?|revolutionary|revolutioni[sz]e[sd]?|cutting-edge|game-?chang(ing|er)|world-class|best-in-class|next-generation|next-gen|leverag(e|es|ing)|robust|powerful|delve|tapestry|synergy|holistic|state-of-the-art)\b/i;
const HYPE_KO = /(혁신적인|차세대|스마트한|원활한|획기적인)/;
const STOCK = /(in today'?s fast-paced world|unlock the power of|the future of [\w\s]{1,20} is here|say goodbye to|look no further|\bmade simple\b|at your fingertips|in just a few clicks|one-stop shop|whether you'?re|ready to transform)/i;
const RESIDUE = /(certainly!|i hope this helps|as an ai\b|\[company name\]|\[your [^\]]+\]|\[회사명\]|\{\{[^}]+\}\}|lorem ipsum|\[need\]|\bTODO\b|물론입니다!|도움이 되었길)/i;
const CAST = /\b(acme|northwind|contoso|halcyon|brightloop|jane doe|john doe|priya|okafor|sarah j\.|lena m\.)\b|홍길동|김철수|아무개/i;
const FIG = /(\b\d{1,3}(,\d{3})+\+|\b\d+(\.\d+)?[kKmM]\+|\b9\d\.\d+%|\b\d+(\.\d+)?x (faster|more|better|cheaper|quicker)\b|\b\d+\+\s(teams|companies|customers|users|businesses|brands|developers)\b|\d+\s?(만|천)\s?(명|개|곳|\+)[^.。]{0,12}(선택|사용|이용|신뢰)|\d+(만|천)\+)/i;
const META = /(this section (shows|lists|covers)|below,? you'?ll find|scroll down to|as shown (below|above)|아래 카드에서|이 섹션(에서는|은)|목업입니다|작은 화면에서는|\b390\s?\/\s?768\s?\/\s?1440\b)/i;
const CONTRAST = /(\bnot (just |only |merely )?[\w-]+(\s[\w-]+){0,3},? but\b|\brather than\b|\binstead of\b|\bwithout the\b|\bisn'?t just\b|(가|이) 아니라|대신(에)?\s)/gi;
const TRANSLATIONESE = [/원활한 경험을 제공/, /혁신적인 솔루션/, /처리가 완료되었습니다/, /정상적으로 (조회|처리)되었습니다/, /을 통해 [^.。]{0,20}제공합니다/, /를 통해 [^.。]{0,20}제공합니다/, /에 있어서/, /진행하시겠습니까/, /에 최적화된 솔루션/, /하는 것이 가능합니다/];
const HONOR = /(께서|으시|하시|십시오|드립니다|님께|으십니다)/g;
const SPEC_TAGS = /^(dd|dt|td|th|li|caption|figcaption|small)$/;
const SPEC_VERB_END = /(다|니다|어요|아요|해요|예요|에요|돼요|죠)[.!。]?$/;
const PROOF = /(trusted by|loved by|used by) (over |more than )?\d|\b(testimonial|고객 후기)\b/i;

export function lintCopy(file, src, { year = new Date().getFullYear() } = {}) {
  const segs = segmentsOf(file, src);
  const findings = [];
  const add = (level, id, line, message) => findings.push({ level, id, file, line, message });
  const once = new Set();
  const addOnce = (key, ...a) => { if (!once.has(key)) { once.add(key); add(...a); } };
  let em = [], ex = [], contrast = [], twoFrag = [];
  const sentences = [];
  for (const s of segs) {
    const t = s.text, ko = isKo(t);
    let m;
    if ((m = t.match(RESIDUE))) add("FAIL", "copy-residue", s.line, `residue "${m[0]}"`);
    if (!s.md && /\*\*[^*]+\*\*|(^|\s)#{2,3}\s/.test(t)) add("FAIL", "copy-residue", s.line, "rendered markdown on the page");
    if ((m = t.match(CAST))) add("FAIL", "copy-default-cast", s.line, `default cast name "${m[0]}"`);
    if ((m = t.match(FIG))) add("FAIL", "copy-invented-figure", s.line, `round unsourced figure "${m[0]}"; use fact-sheet figures only`);
    if (PROOF.test(t)) add("FAIL", "copy-fake-proof", s.line, `proof claim "${t.slice(0, 50)}"; waive only if the brief supplies it`);
    if ((m = t.match(/(?:©|copyright|\bas of)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i)) && +m[1] < year) add("FAIL", "copy-stale-year", s.line, `year ${m[1]} older than ${year}`);
    if ((m = t.match(META))) add("FAIL", "copy-meta", s.line, `copy narrates the page itself: "${m[0]}"`);
    if ((m = t.match(HYPE_EN)) && !ko) addOnce("h" + m[0].toLowerCase(), "WARN", "copy-hype-word", s.line, `hype word "${m[0]}"; name the fact it stands for`);
    if ((m = t.match(HYPE_KO))) addOnce("hk" + m[0], "WARN", "copy-hype-word", s.line, `hype word "${m[0]}"`);
    if ((m = t.match(STOCK))) add("WARN", "copy-stock-phrase", s.line, `stock phrase "${m[0]}"`);
    for (const r of TRANSLATIONESE) if ((m = t.match(r))) addOnce("t" + r, "WARN", "copy-translationese-ko", s.line, `translationese "${m[0]}"`);
    for (const x of t.matchAll(/—/g)) em.push(s.line);
    for (const x of t.matchAll(/!/g)) if (s.tag === "p" && !/^[!]/.test(t)) ex.push(s.line);
    const isHead = /^h[1-6]$/.test(s.tag);
    // device budget is about display copy; ordinary prose uses "~가 아니라" grammatically
    if (isHead || t.length <= 80) for (const x of t.matchAll(CONTRAST)) contrast.push([s.line, x[0]]);
    if (isHead && /^[^.。!?]{1,40}[.。]\s+[^.。!?]{1,40}[.。]?$/.test(t)) twoFrag.push(s.line);
    if (s.tag === "h1" || (s.md && s.tag === "h1")) {
      if (/[.。]$/.test(t)) add("INFO", "copy-headline-period", s.line, "trailing period on the display headline (owner register drops it)");
      if (ko && t.replace(/\s/g, "").length > 24) add("INFO", "copy-headline-length-ko", s.line, `Korean headline ${t.replace(/\s/g, "").length} chars (owner register median about 14)`);
    }
    // spec and fact lines (table cells, definition lists, list items, captions) end in nouns
    if (ko && SPEC_TAGS.test(s.tag) && t.length <= 60 && SPEC_VERB_END.test(t)) add("WARN", "copy-spec-ending-ko", s.line, `spec line ends in a verb: "${t.slice(-24)}"; end in a noun ("512GB 이상 권장", "미지원")`);
    if (s.tag === "button" && /^(click here|submit|확인|ok)$/i.test(t)) add("INFO", "copy-vague-cta", s.line, `task button labelled "${t}"`);
    if (ko) for (const sent of t.split(/(?<=[.!?。])\s+/)) {
      if ((sent.match(HONOR) || []).length >= 2) addOnce("hon" + s.line, "WARN", "copy-honorific-overuse-ko", s.line, `stacked honorifics "${sent.slice(0, 40)}"`);
    }
    for (const sent of t.split(/(?<=[.!?。])\s+|\n/)) if (sent.trim()) sentences.push({ text: sent.trim(), line: s.line });
  }
  // imperative chains (Korean): 3+ consecutive sentences ending in ~세요/~십시오
  let run = [];
  for (const s of [...sentences, { text: "", line: 0 }]) {
    if (/(세요|십시오)[.!。]?$/.test(s.text) && isKo(s.text)) run.push(s);
    else { if (run.length >= 3) add("WARN", "copy-imperative-chain-ko", run[0].line, `${run.length} imperative sentences in a row ("${run.map((r) => r.text).join(" ").slice(0, 50)}")`); run = []; }
  }
  if (em.length > 1) add("WARN", "copy-em-dash", em[1], `${em.length} em dashes; budget is 1 per page`);
  if (ex.length > 1) add("WARN", "copy-exclaim", ex[1], `${ex.length} exclamation marks in body copy`);
  if (contrast.length > 2) add("WARN", "copy-contrast", contrast[2][0], `${contrast.length} contrast frames ("${contrast.map((c) => c[1]).join('", "').slice(0, 60)}"); budget is 2`);
  if (twoFrag.length > 3) add("WARN", "copy-two-fragment", twoFrag[3], `${twoFrag.length} two-fragment headings; budget is hero + 2`);
  return findings;
}

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!n.startsWith(".") && n !== "node_modules") walk(join(p, n), out); }
  else if (EXT.has(extname(p).toLowerCase())) out.push(p);
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const yi = args.indexOf("--year"), year = yi >= 0 ? +args[yi + 1] : new Date().getFullYear();
  const targets = args.filter((a, i) => !a.startsWith("--") && !(yi >= 0 && i === yi + 1));
  if (!targets.length) { process.stderr.write("usage: copy-lint.mjs <file|dir>... [--json] [--year N]\n"); process.exit(3); }
  const files = [];
  for (const t of targets) { if (!existsSync(t)) { process.stderr.write(`not found: ${t}\n`); process.exit(3); } walk(t, files); }
  if (!files.length) { process.stdout.write("NOT_RUN no .html/.md/.txt files found\n"); process.exit(3); }
  const findings = [];
  for (const f of files) findings.push(...lintCopy(relative(process.cwd(), f) || f, readFileSync(f, "utf8"), { year }));
  process.exit(emit(findings, { json, label: "copy-lint" }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
