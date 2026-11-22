#!/usr/bin/env node
// seo-lint.mjs — executable checks for references/build/seo-baseline.md (SEO-*/GEO-*).
// Zero dependencies (Node 22+). Advisory by design: FAIL only for objective breakage (no <title>,
// JSON-LD that does not parse or claims invisible FAQs, search/answer bots blocked); the rest is
// WARN/INFO so copy and layout stay free.
//
//   node seo-lint.mjs <page.html|dir|url>... [robots.txt] [sitemap.xml] [--json]
//
// Reads served HTML as text (what a crawler or a live-fetching answer engine sees before
// any script runs). A directory is walked for .html files; a robots.txt / sitemap.xml next
// to a page, or passed explicitly, is checked too. A check that could not run is reported
// as INFO "not checked", never as a pass.
// Exit: 0 clean, 1 any FAIL, 2 WARN only, 3 could not run.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, dirname, basename, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { lineAt, emit } from "./lint-core.mjs";

const SEARCH_BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
const RETIRED_BOTS = ["anthropic-ai", "Claude-Web"];

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const hangulShare = (s) => { const t = s.replace(/\s/g, ""); return t ? (t.match(/[\uac00-\ud7a3]/g) || []).length / t.length : 0; };
const norm = (s) => decode(String(s)).toLowerCase().replace(/[\s\u00a0]+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i")) || tag.match(new RegExp(`\\s${name}\\s*=\\s*([^\\s>]+)`, "i")); return m ? decode(m[2] ?? m[1]) : null; };

/** Visible text: drop script/style/noscript/template/svg/head and hidden subtrees, strip tags. */
export function visibleText(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<([a-z][\w-]*)\b[^>]*\s(hidden|aria-hidden=["']true["'])[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function jsonLdNodes(data, out = []) {
  if (Array.isArray(data)) { for (const d of data) jsonLdNodes(d, out); return out; }
  if (data && typeof data === "object") {
    if (data["@type"]) out.push(data);
    for (const [k, v] of Object.entries(data)) if (k !== "@context" && typeof v === "object") jsonLdNodes(v, out);
  }
  return out;
}
const types = (n) => [].concat(n["@type"] || []).map(String);

export function lintSeo(file, html) {
  const findings = [];
  const add = (level, id, idx, message) => findings.push({ level, id, file, line: typeof idx === "number" && idx >= 0 ? lineAt(html, idx) : 1, message });
  const find = (re) => { const m = re.exec(html); return m ? m.index : -1; };
  const text = visibleText(html);
  const textN = norm(text);
  const ko = hangulShare(text) > 0.3;

  // SEO-META-01
  const htmlTag = (html.match(/<html\b[^>]*>/i) || [""])[0];
  if (!attr(htmlTag, "lang")) add("WARN", "SEO-META-01", find(/<html\b/i), "<html> has no lang attribute");
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decode(titleM[1]).replace(/\s+/g, " ").trim() : "";
  if (!title) add("FAIL", "SEO-META-01", find(/<head\b/i), "missing or empty <title>");
  else {
    const max = hangulShare(title) > 0.3 ? 30 : 60;
    if ([...title].length > max) add("INFO", "SEO-META-01", find(/<title/i), `title is ${[...title].length} chars (> ${max}); search results truncate it`);
  }
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => ({ tag: m[0], idx: m.index }));
  const meta = (key, val) => metas.find((m) => (attr(m.tag, key) || "").toLowerCase() === val.toLowerCase());
  const desc = meta("name", "description");
  const descV = desc ? (attr(desc.tag, "content") || "").trim() : "";
  if (!descV) add("WARN", "SEO-META-01", find(/<head\b/i), "missing meta description");
  else {
    const max = hangulShare(descV) > 0.3 ? 80 : 160;
    if ([...descV].length > max) add("INFO", "SEO-META-01", desc.idx, `meta description is ${[...descV].length} chars (> ${max})`);
  }
  if (!meta("name", "viewport")) add("WARN", "SEO-META-01", find(/<head\b/i), "missing viewport meta");
  const canon = [...html.matchAll(/<link\b[^>]*>/gi)].find((m) => /rel\s*=\s*["']?canonical/i.test(m[0]));
  if (!canon) add("WARN", "SEO-META-01", find(/<head\b/i), "missing <link rel=canonical>");
  else if (!/^https?:\/\//i.test(attr(canon[0], "href") || "")) add("WARN", "SEO-META-01", canon.index, "canonical href is not an absolute URL");
  for (const p of ["og:title", "og:description", "og:image"]) if (!meta("property", p)) add("INFO", "SEO-META-01", find(/<head\b/i), `missing ${p}`);
  const ogi = meta("property", "og:image");
  if (ogi && !/^https?:\/\//i.test(attr(ogi.tag, "content") || "")) add("WARN", "SEO-META-01", ogi.idx, "og:image must be an absolute URL; most scrapers ignore relative paths");
  if (!meta("name", "twitter:card")) add("INFO", "SEO-META-01", find(/<head\b/i), "no twitter:card (summary_large_image)");
  const robotsMeta = metas.filter((m) => /^(robots|googlebot|bingbot)$/i.test(attr(m.tag, "name") || ""));
  for (const r of robotsMeta) {
    const c = (attr(r.tag, "content") || "").toLowerCase();
    if (/noindex/.test(c)) add("WARN", "SEO-META-01", r.idx, `robots meta "${c}" keeps this page out of search and AI answers; confirm the page is meant to be unlisted`);
    if (/nosnippet|noarchive|nocache|ai-grounding:disallow|max-snippet:\s*0\b/.test(c)) add("WARN", "GEO-VISIBLE-01", r.idx, `robots meta "${c}" removes or limits this page in AI answers/grounding`);
  }

  // SEO-STRUCTURE-01
  const heads = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => ({ lv: +m[1], idx: m.index }));
  const h1 = heads.filter((h) => h.lv === 1);
  if (!h1.length) add("WARN", "SEO-STRUCTURE-01", find(/<body\b/i), "no <h1>");
  else if (h1.length > 1) add("INFO", "SEO-STRUCTURE-01", h1[1].idx, `${h1.length} <h1> elements; use one`);
  for (let i = 1; i < heads.length; i++) if (heads[i].lv > heads[i - 1].lv + 1) { add("INFO", "SEO-STRUCTURE-01", heads[i].idx, `heading level skips from h${heads[i - 1].lv} to h${heads[i].lv}`); break; }
  if (!/<main\b/i.test(html)) add("INFO", "SEO-STRUCTURE-01", find(/<body\b/i), "no <main> landmark");
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (attr(m[0], "alt") === null) { add("WARN", "SEO-STRUCTURE-01", m.index, `<img${(attr(m[0], "src") || "").slice(0, 40) ? ` src="${(attr(m[0], "src") || "").slice(0, 40)}"` : ""}> has no alt (use alt="" for decoration)`); }

  // GEO-AGENT-01: operable by agents (DOM + accessibility tree)
  for (const m of html.matchAll(/<(div|span|li|td|img)\b([^>]*\sonclick\s*=[^>]*)>/gi))
    if (!/\srole\s*=/.test(m[2])) add("WARN", "GEO-AGENT-01", m.index, `clickable <${m[1]}> without role/tabindex; use <button> or <a href>`);
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const inner = visibleText(m[2]) + (m[2].match(/alt\s*=\s*["']([^"']+)/i)?.[1] || "");
    if (!inner.trim() && !/aria-label(ledby)?\s*=\s*["'][^"']+/.test(m[1]) && !/title\s*=\s*["'][^"']+/.test(m[1])) add("WARN", "GEO-AGENT-01", m.index, "link with no accessible name");
    if (!/\shref\s*=/.test(m[1]) && /onclick/.test(m[1])) add("WARN", "GEO-AGENT-01", m.index, "<a> without href driven by onclick; crawlers and agents cannot follow it");
  }
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const a = m[2]; const type = (attr(m[0], "type") || "").toLowerCase();
    if (/^(hidden|submit|button|reset|image)$/.test(type)) continue;
    const id = attr(m[0], "id");
    const labelled = /aria-label(ledby)?\s*=/.test(a) || (id && new RegExp(`<label\\b[^>]*for\\s*=\\s*["']?${id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["'\\s>]`, "i").test(html)) || /<label\b(?:(?!<\/label>)[\s\S])*$/i.test(html.slice(0, m.index));
    if (!labelled) add("WARN", "GEO-AGENT-01", m.index, `<${m[1]}${id ? ` id="${id}"` : ""}> has no label (label for=, wrapping label, or aria-label)`);
  }

  // GEO-VISIBLE-01: facts in visible, server-rendered text
  const words = ko ? Math.round(text.replace(/\s/g, "").length / 2.5) : text.split(/\s+/).filter(Boolean).length;
  if (words < 40 && /<script\b(?![^>]*application\/ld\+json)/i.test(html)) add("WARN", "GEO-VISIBLE-01", find(/<body\b/i), `served HTML has ~${words} words of visible text and relies on scripts; crawlers and live-fetching answer engines see an empty page (SSR/SSG it)`);

  // GEO-ANSWER-01: a literal sub line under the H1
  if (h1.length) {
    const after = html.slice(h1[0].idx);
    const p = after.match(/<\/h1>[\s\S]{0,800}?<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const sub = p ? visibleText(p[1]) : "";
    const short = hangulShare(sub) > 0.3 ? sub.replace(/\s/g, "").length < 15 : sub.split(/\s+/).filter(Boolean).length < 8;
    if (short) add("INFO", "GEO-ANSWER-01", h1[0].idx, "no literal sub line under the H1 (what it is, for whom, the differentiator); answer engines quote that paragraph");
  }

  // SEO-JSONLD-01
  const ld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!ld.length) add("INFO", "SEO-JSONLD-01", find(/<head\b/i), "no JSON-LD (optional: Organization/WebSite on the home page, Article/SoftwareApplication/BreadcrumbList where they apply)");
  for (const m of ld) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { add("FAIL", "SEO-JSONLD-01", m.index, `JSON-LD does not parse: ${String(e.message).slice(0, 60)}`); continue; }
    for (const n of jsonLdNodes(data)) {
      const t = types(n);
      if (t.includes("FAQPage")) {
        add("INFO", "SEO-JSONLD-01", m.index, "FAQPage markup: Google stopped showing FAQ rich results on 2026-05-07; keep only if the questions are visible and real");
        for (const q of [].concat(n.mainEntity || [])) if (q && q.name && !textN.includes(norm(q.name))) add("FAIL", "SEO-JSONLD-01", m.index, `FAQPage question not visible on the page: "${String(q.name).slice(0, 50)}"`);
      }
      if (t.some((x) => /AggregateRating|Review/.test(x)) || n.aggregateRating) add("WARN", "SEO-JSONLD-01", m.index, "AggregateRating/Review markup: only with sourced, visible ratings");
      if (t.some((x) => /^(Question|Answer|ListItem|ImageObject|WebPage)$/.test(x))) continue;
      const facts = [["name", n.name], ["headline", n.headline]].filter(([, v]) => typeof v === "string" && v.length > 2);
      for (const o of [].concat(n.offers || [])) if (o && o.price != null && +o.price > 0) facts.push(["price", String(o.price)]);
      for (const [k, v] of facts) {
        const ok = k === "price" ? new RegExp(`(^|[^\\d])${String(v).replace(/\.0+$/, "").replace(".", "[.,]")}([^\\d]|$)`).test(text.replace(/,(?=\d{3})/g, "")) : textN.includes(norm(v));
        if (!ok) add("WARN", "GEO-VISIBLE-01", m.index, `JSON-LD ${t[0] || "node"} ${k} "${String(v).slice(0, 50)}" does not appear in visible text; answer engines that fetch the page will not see it`);
      }
    }
  }
  return findings;
}

/** robots.txt: search/answer bots must be allowed; retired tokens flagged; sitemap declared. */
export function lintRobots(file, txt) {
  const findings = [];
  const add = (level, id, line, message) => findings.push({ level, id, file, line, message });
  const groups = []; let cur = null, lastWasAgent = false, sitemap = false;
  txt.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, "").trim(); if (!line) return;
    const [k, ...rest] = line.split(":"); const key = k.trim().toLowerCase(), val = rest.join(":").trim();
    if (key === "user-agent") { if (!lastWasAgent || !cur) { cur = { agents: [], rules: [], line: i + 1 }; groups.push(cur); } cur.agents.push(val.toLowerCase()); lastWasAgent = true; return; }
    lastWasAgent = false;
    if (key === "sitemap") sitemap = true;
    if ((key === "allow" || key === "disallow") && cur) cur.rules.push({ type: key, path: val, line: i + 1 });
  });
  for (const g of groups) for (const a of g.agents) { const r = RETIRED_BOTS.find((b) => b.toLowerCase() === a); if (r) add("INFO", "SEO-CRAWL-01", g.line, `\`${r}\` is a retired token; Anthropic uses ClaudeBot (training), Claude-SearchBot (search), Claude-User (fetch)`); }
  for (const bot of SEARCH_BOTS) {
    const g = groups.find((x) => x.agents.includes(bot.toLowerCase())) || groups.find((x) => x.agents.includes("*"));
    if (!g) continue;
    const blockAll = g.rules.find((r) => r.type === "disallow" && r.path === "/");
    const allowAll = g.rules.some((r) => r.type === "allow" && (r.path === "/" || r.path === "/*"));
    if (blockAll && !allowAll) add("FAIL", "SEO-CRAWL-01", blockAll.line, `${bot} is blocked from the whole site (group "${g.agents.join(", ")}"); that removes the site from ${bot === "Googlebot" ? "Google Search and AI Overviews" : bot === "Bingbot" ? "Bing and Copilot" : "that engine's answers"}`);
  }
  if (!sitemap) add("WARN", "SEO-DISCOVERY-01", 1, "robots.txt declares no Sitemap:");
  return findings;
}

/** sitemap.xml: real lastmod; changefreq/priority are ignored by Google. */
export function lintSitemap(file, xml) {
  const findings = [];
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)];
  const noLast = urls.filter((u) => !/<lastmod>/i.test(u[1])).length;
  if (!urls.length) findings.push({ level: "WARN", id: "SEO-DISCOVERY-01", file, line: 1, message: "sitemap has no <url> entries" });
  if (noLast) findings.push({ level: "WARN", id: "SEO-DISCOVERY-01", file, line: 1, message: `${noLast}/${urls.length} sitemap URLs without <lastmod>` });
  if (/<(changefreq|priority)>/i.test(xml)) findings.push({ level: "INFO", id: "SEO-DISCOVERY-01", file, line: 1, message: "<changefreq>/<priority> are ignored by Google; keep accurate <lastmod> instead" });
  return findings;
}

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!n.startsWith(".") && n !== "node_modules") walk(join(p, n), out); }
  else out.push(p);
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (!targets.length) { process.stderr.write("usage: seo-lint.mjs <page.html|dir|url>... [robots.txt] [sitemap.xml] [--json]\n"); process.exit(3); }
  const findings = [];
  const pages = [], robots = new Set(), sitemaps = new Set(); let urls = 0;
  for (const t of targets) {
    if (/^https?:/.test(t)) {
      try {
        const r = await fetch(t, { headers: { "user-agent": "Mozilla/5.0 (compatible; seo-lint; +codexclaw)" } });
        findings.push(...lintSeo(t, await r.text())); urls++;
        const origin = new URL(t).origin;
        const rb = await fetch(origin + "/robots.txt").catch(() => null);
        if (rb && rb.ok) findings.push(...lintRobots(origin + "/robots.txt", await rb.text()));
        else findings.push({ level: "INFO", id: "SEO-CRAWL-01", file: origin + "/robots.txt", line: 0, message: "robots.txt not found or not fetched (not checked)" });
      } catch (e) { process.stderr.write(`could not fetch ${t}: ${e.message}\n`); process.exit(3); }
      continue;
    }
    if (!existsSync(t)) { process.stderr.write(`not found: ${t}\n`); process.exit(3); }
    const files = []; walk(t, files);
    for (const f of files) {
      const b = basename(f).toLowerCase();
      if (/\.html?$/.test(b)) pages.push(f);
      else if (b === "robots.txt") robots.add(f);
      else if (/^sitemap.*\.xml$/.test(b)) sitemaps.add(f);
    }
  }
  for (const f of pages) {
    const rel = relative(process.cwd(), f) || f;
    findings.push(...lintSeo(rel, readFileSync(f, "utf8")));
    const rb = join(dirname(f), "robots.txt"), sm = join(dirname(f), "sitemap.xml");
    if (existsSync(rb)) robots.add(rb); else if (!robots.size) findings.push({ level: "INFO", id: "SEO-CRAWL-01", file: rel, line: 0, message: "no robots.txt next to this page (not checked)" });
    if (existsSync(sm)) sitemaps.add(sm);
  }
  for (const f of robots) findings.push(...lintRobots(relative(process.cwd(), f) || f, readFileSync(f, "utf8")));
  for (const f of sitemaps) findings.push(...lintSitemap(relative(process.cwd(), f) || f, readFileSync(f, "utf8")));
  const code = emit(findings, { json, label: "seo-lint" });
  if (!pages.length && !urls && !robots.size && !sitemaps.size) process.exit(3);
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
