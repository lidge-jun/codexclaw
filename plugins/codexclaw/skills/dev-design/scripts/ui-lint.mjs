#!/usr/bin/env node
// ui-lint.mjs — executable checks for the dev-design ban list. Zero dependencies (Node 22+).
//
//   node ui-lint.mjs <file|dir|url>... [--render] [--json]
//
// Static mode reads .html .htm .css .jsx .tsx .vue .svelte text. --render opens .html files
// (and http(s) URLs) in Chrome through playwright-core when it can be imported; when it
// cannot, the render pass prints NOT_RUN and the exit code is 3. An unrun check is never a
// pass. Every finding id is a rule defined in ../references (see scripts/README.md).
// Exit: 0 clean, 1 any FAIL, 2 WARN only, 3 could not run.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCss, inlineStyleRules, colorIn, isChromatic, hue, lineAt, emit, parseColor, contrast } from "./lint-core.mjs";

const EXT = new Set([".html", ".htm", ".css", ".jsx", ".tsx", ".vue", ".svelte"]);
const BUTTONISH = /(^|[\s>+~,(])(button|\.btn[\w-]*|\.button[\w-]*|\.cta[\w-]*|\[role=["']?button["']?\]|input\[type=["']?(submit|button)["']?\]|a\.(btn|button|cta)[\w-]*)(?=$|[\s.:#[>+~,)])/i;
const CARDISH = /\.(card|panel|tile|callout|note|alert|notice|box|feature)[\w-]*/i;
const SIDE_EXEMPT = /(^|[\s>+~,])(hr|td|th|tr|thead|tbody|table|caption)\b|:focus|:focus-visible|:focus-within|\[role=["']?tab["']?\]|\.tab\b|\.tabs?[\w-]*|::?(selection|marker|placeholder|-webkit-scrollbar)|\bcaret\b|\.gutter|\[data-gutter\]|\.divider|\.separator|\.rule\b/i;
const SEMANTIC_TOKEN = /(success|error|danger|warn|warning|info|ok|critical|positive|negative|chart|series|data|focus|ring|link|status|syntax|code|diff|added|removed|insert|delete|ins|del)/i;
const TW_HUES = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

function walkFiles(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const n of readdirSync(p)) if (!n.startsWith(".") && n !== "node_modules") walkFiles(join(p, n), out);
  } else if (EXT.has(extname(p).toLowerCase())) out.push(p);
}

function px(v) {
  if (!v) return 0;
  const m = String(v).match(/(-?\d*\.?\d+)(px|rem|em)?/);
  if (!m) return /thin/.test(v) ? 1 : /medium/.test(v) ? 3 : /thick/.test(v) ? 5 : 0;
  const n = parseFloat(m[1]);
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

/** Resolve per-side border width and color from a rule's declarations. */
function sides(d, tokens) {
  const S = { top: { w: 0, c: null }, right: { w: 0, c: null }, bottom: { w: 0, c: null }, left: { w: 0, c: null } };
  const apply = (side, val) => { if (val == null) return; if (/none|hidden/.test(val) && !/\d/.test(val)) { S[side].w = 0; return; } const w = px(val); if (/\d|thin|medium|thick/.test(val)) S[side].w = w; const c = colorIn(val, tokens); if (c) S[side].c = c; };
  if (d.border) for (const s of Object.keys(S)) apply(s, d.border);
  if (d["border-width"]) {
    const p = d["border-width"].split(/\s+/).map(px);
    const [t, r = t, b = t, l = r] = p; S.top.w = t; S.right.w = r; S.bottom.w = b; S.left.w = l;
  }
  if (d["border-color"]) { const c = colorIn(d["border-color"], tokens); if (c) for (const s of Object.keys(S)) S[s].c = c; }
  const logical = { "inline-start": "left", "inline-end": "right", "block-start": "top", "block-end": "bottom" };
  for (const s of [...Object.keys(S), ...Object.keys(logical)]) {
    const side = logical[s] || s;
    apply(side, d[`border-${s}`]);
    if (d[`border-${s}-width`]) S[side].w = px(d[`border-${s}-width`]);
    if (d[`border-${s}-color`]) { const c = colorIn(d[`border-${s}-color`], tokens); if (c) S[side].c = c; }
  }
  if (d["border-inline"]) { apply("left", d["border-inline"]); apply("right", d["border-inline"]); }
  return S;
}

function colorKey(c) { return c ? `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}` : ""; }

export function lintStatic(file, text) {
  const findings = [];
  const add = (level, id, line, message) => findings.push({ level, id, file, line, message });
  const ext = extname(file).toLowerCase();
  const isMarkup = ext !== ".css";
  // collect css
  let rules = [];
  if (ext === ".css") rules = parseCss(text, 0, text);
  else {
    const re = /<style[^>]*>([\s\S]*?)<\/style>/gi; let m;
    while ((m = re.exec(text))) rules.push(...parseCss(m[1], m.index + m[0].indexOf(m[1]), text));
    rules.push(...inlineStyleRules(text));
  }
  const tokens = {};
  for (const r of rules) for (const [k, v] of Object.entries(r.decls)) if (k.startsWith("--") && /(:root|html|body|\[data-theme|\.light|\.dark|^\s*$)/.test(r.selector) && !(k in tokens)) tokens[k] = v;
  const optIn = /brand-primary\s*:/i.test(text) || /data-brand-primary/i.test(text);
  const buttonHues = new Map();

  for (const r of rules) {
    const sel = r.selector, d = r.decls;
    // FE-SIDE-ACCENT-01: single-side edges on boxes
    if (!SIDE_EXEMPT.test(sel)) {
      const S = sides(d, tokens);
      const names = ["top", "right", "bottom", "left"];
      for (const s of names) {
        const me = S[s], others = names.filter((o) => o !== s).map((o) => S[o]);
        const maxOther = Math.max(...others.map((o) => o.w));
        const vertical = s === "left" || s === "right";
        const thicker = me.w >= 2 && maxOther < me.w / 2 + 0.01 && maxOther <= me.w - 1;
        const colorOnly = me.w >= 1 && others.every((o) => o.w === me.w) && isChromatic(me.c) && others.every((o) => !o.c || colorKey(o.c) !== colorKey(me.c));
        const rounded = px(d["border-radius"]) > 0 || /pill|chip|card/.test(sel);
        const boxy = vertical || rounded || isChromatic(me.c) && me.w >= 3 && (d.background || d["background-color"] || d.padding);
        if ((thicker && boxy && (vertical || me.w >= 3)) || colorOnly) {
          add("FAIL", "FE-SIDE-ACCENT-01", r.line, `one-sided ${colorOnly ? "color-only " : ""}${s} edge (${me.w}px${me.c ? ", " + (isChromatic(me.c) ? "chromatic" : "neutral") : ""}) on \`${sel.slice(0, 60)}\`; use a full perimeter or a neutral surface step`);
          break;
        }
      }
      const sh = d["box-shadow"] || "";
      const insetM = sh.match(/inset\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+0(?:px)?\b/);
      if (insetM && ((Math.abs(+insetM[1]) >= 2 && +insetM[2] === 0) || (Math.abs(+insetM[2]) >= 3 && +insetM[1] === 0 && px(d["border-radius"]) > 0)))
        add("FAIL", "FE-SIDE-ACCENT-01", r.line, `one-sided inset box-shadow rail on \`${sel.slice(0, 60)}\``);
      if (/::?(before|after)/.test(sel) && /absolute|fixed/.test(d.position || "")) {
        const w = px(d.width), h = px(d.height);
        const bg = colorIn(d.background || d["background-color"] || "", tokens) || (/gradient/.test(d.background || "") ? { r: 1, g: 0, b: 0, a: 1 } : null);
        const tall = /100%|^0$/.test(d.height || "") || (d.top != null && d.bottom != null);
        const wide = /100%/.test(d.width || "") || (d.left != null && d.right != null);
        if (bg && ((w >= 2 && w <= 8 && tall) || (h >= 2 && h <= 8 && wide && px(d["border-radius"]) === 0 && /card|callout|note|pill|chip|panel|tile/.test(sel))))
          add("FAIL", "FE-SIDE-ACCENT-01", r.line, `positioned pseudo-element rail on \`${sel.slice(0, 60)}\``);
      }
    }
    // FE-COLOR-RESTRAINT-01: chromatic fills on buttons
    const fill = d["background-color"] || d.background || "";
    if (BUTTONISH.test(sel) && !/:(disabled|focus|focus-visible)/.test(sel)) {
      const c = colorIn(fill, tokens);
      const grad = /gradient/.test(fill);
      if (isChromatic(c)) {
        const fam = Math.round(hue(c) / 40) % 9;
        if (!buttonHues.has(fam)) buttonHues.set(fam, r);
        if (!optIn) add("FAIL", "FE-COLOR-RESTRAINT-01", r.line, `chromatic button fill on \`${sel.slice(0, 60)}\`; primary is ink, others neutral (opt in with a /* brand-primary: <reason> */ comment or data-brand-primary only when the brief names a brand-colored action)`);
      }
      if (grad) add("WARN", "FE-GRADIENT-02", r.line, `gradient fill on button-like \`${sel.slice(0, 60)}\``);
      const lab = colorIn(d.color || "", tokens);
      if (isChromatic(lab) && !optIn && !/link/.test(sel)) add("WARN", "FE-COLOR-RESTRAINT-01", r.line, `chromatic label color on button-like \`${sel.slice(0, 60)}\``);
    } else if (CARDISH.test(sel) && /gradient/.test(fill) && !/radial-gradient\([^)]*transparent/.test(fill)) {
      add("WARN", "FE-GRADIENT-02", r.line, `gradient fill on opaque functional surface \`${sel.slice(0, 60)}\``);
    }
    // FE-GRADIENT-TEXT-01
    if (/text/.test(d["background-clip"] || "") || /text/.test(d["-webkit-background-clip"] || ""))
      add("FAIL", "FE-GRADIENT-TEXT-01", r.line, `gradient text (background-clip: text) on \`${sel.slice(0, 60)}\``);
    // FE-AI-TELL-01 (motion.md: never transition all)
    if (/(^|,|\s)all(\s|$|,)/.test(d.transition || "") || /^all$/.test((d["transition-property"] || "").trim()))
      add("WARN", "FE-AI-TELL-01", r.line, `\`transition: all\` on \`${sel.slice(0, 60)}\`; enumerate properties`);
    // FE-SLOP-CONSENSUS-01: orbs / bokeh
    if ((/radial-gradient/.test(fill) && /blur\(\s*([4-9]\d|\d{3,})px/.test(d.filter || "")) || /\.(orb|blob|bokeh)[\w-]*/i.test(sel) && /blur|radial-gradient/.test(r.body))
      add("WARN", "FE-SLOP-CONSENSUS-01", r.line, `decorative orb/bokeh blob on \`${sel.slice(0, 60)}\``);
  }
  if (optIn && buttonHues.size > 1) {
    const second = [...buttonHues.values()][1];
    add("FAIL", "FE-COLOR-RESTRAINT-01", second.line, `${buttonHues.size} hue families on buttons; a brand-primary opt-in allows exactly one`);
  }
  // accent family budget in tokens
  const fams = new Map();
  for (const [k, v] of Object.entries(tokens)) {
    if (SEMANTIC_TOKEN.test(k)) continue;
    const c = colorIn(v, tokens);
    if (isChromatic(c)) { const f = Math.round(hue(c) / 40) % 9; if (!fams.has(f)) fams.set(f, k); }
  }
  if (fams.size > 1) add("WARN", "FE-COLOR-RESTRAINT-01", 1, `${fams.size} non-semantic accent hue families in tokens (${[...fams.values()].join(", ")}); budget is one`);

  if (isMarkup) {
    const tag = (re, cb) => { let m; while ((m = re.exec(text))) cb(m); };
    // Tailwind / class tokens
    tag(/class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g, (m) => {
      const cls = m[1].split(/\s+/), line = lineAt(text, m.index);
      const before = text.slice(Math.max(0, text.lastIndexOf("<", m.index)), m.index);
      const elTag = (before.match(/<([a-zA-Z][\w-]*)/) || [])[1]?.toLowerCase() || "";
      const isTab = /role=["']tab/.test(before) || cls.some((c) => /^tab/.test(c));
      const side = cls.find((c) => /^border-(l|r|s|e)-(\d+|\[\d+px\])$/.test(c) && parseInt(c.match(/\d+/)[0]) >= 2);
      const sideTop = cls.find((c) => /^border-t-(\d+|\[\d+px\])$/.test(c) && parseInt(c.match(/\d+/)[0]) >= 3) && cls.some((c) => /^rounded/.test(c));
      if ((side || sideTop) && !isTab && !/^(td|th|tr|hr|table)$/.test(elTag)) add("FAIL", "FE-SIDE-ACCENT-01", line, `one-sided border utility \`${side || "border-t-*"}\` on <${elTag}>`);
      const btn = elTag === "button" || cls.some((c) => /^(btn|button|cta)/.test(c)) || /role=["']button/.test(before);
      const hueBg = cls.find((c) => new RegExp(`^(hover:)?bg-(${TW_HUES})-\\d{2,3}$`).test(c));
      if (btn && hueBg && !hueBg.startsWith("hover:") && !optIn) add("FAIL", "FE-COLOR-RESTRAINT-01", line, `chromatic button fill \`${hueBg}\` on <${elTag}>`);
      if (btn && cls.some((c) => /^bg-gradient-|^bg-linear-/.test(c))) add("WARN", "FE-GRADIENT-02", line, `gradient fill utility on button <${elTag}>`);
      if (cls.includes("bg-clip-text")) add("FAIL", "FE-GRADIENT-TEXT-01", line, "gradient text utility `bg-clip-text`");
      if (cls.includes("transition-all")) add("WARN", "FE-AI-TELL-01", line, "`transition-all` utility; enumerate properties");
    });
    // emoji as icons inside controls and headings
    const EMO = /\p{Extended_Pictographic}/u;
    tag(/<(button|a|h[1-6]|li|nav|label)\b[^>]*>([\s\S]{0,200}?)<\/\1>/gi, (m) => {
      const inner = m[2].replace(/<[^>]+>/g, "").trim();
      if (EMO.test(inner) && !/[✓✔✗✕×→←↑↓]/u.test(inner.match(EMO)[0])) add("FAIL", "FE-AI-TELL-01", lineAt(text, m.index), `emoji used as an icon in <${m[1].toLowerCase()}>: "${inner.slice(0, 40)}"`);
    });
    // eyebrow above the H1
    tag(/<(p|span|div|small)\b([^>]*)>([^<]{1,60})<\/\1>\s*(?:<[^h>][^>]*>\s*)*<h1\b/gi, (m) => {
      const attrs = m[2];
      if (/eyebrow|kicker|overline|uppercase|tracking-|letter-spacing|text-transform:\s*uppercase/i.test(attrs) || (m[3] === m[3].toUpperCase() && /[A-Z]{3}/.test(m[3])))
        add("WARN", "FE-SLOP-CONSENSUS-01", lineAt(text, m.index), `eyebrow label above the H1 ("${m[3].trim().slice(0, 40)}")`);
    });
    // nested cards
    const open = [];
    tag(/<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g, (m) => {
      if (/^(br|img|input|meta|link|hr|source|path|circle|rect|line|use)$/i.test(m[2]) || m[4]) return;
      if (m[1]) { const i = open.map((o) => o.tag).lastIndexOf(m[2].toLowerCase()); if (i >= 0) open.splice(i); return; }
      const card = /class(?:Name)?\s*=\s*["'][^"']*\bcard\b/.test(m[3]);
      if (card && open.some((o) => o.card)) add("WARN", "FE-SLOP-CONSENSUS-01", lineAt(text, m.index), "card nested inside a card");
      open.push({ tag: m[2].toLowerCase(), card });
    });
  }
  const tells = new Set(findings.filter((f) => f.level !== "INFO").map((f) => f.id + f.message.slice(0, 18)));
  if (tells.size >= 3) add("INFO", "FE-SLOP-CONSENSUS-01", 1, `${tells.size} distinct tells in one file; three or more in a section means redesign it, not patch`);
  return findings;
}

async function loadChromium() {
  const tries = ["playwright-core", "playwright", process.env.PLAYWRIGHT_CORE_PATH].filter(Boolean);
  for (const t of tries) {
    try { const m = await import(/^([a-zA-Z]:[\\/]|\/)/.test(t) ? pathToFileURL(t).href : t); return (m.default || m).chromium || m.chromium; } catch {}
  }
  return null;
}

/** Runs in the page. Returns raw issues; the caller maps them to rule ids. */
function pageProbe(vw) {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const norm = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "rgba(0,0,0,0)"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }; };
  const chrom = (c) => c.a > 0.15 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 0.12;
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const responsive = !!document.querySelector('meta[name="viewport"][content*="width=device-width"]');
  const sw = document.documentElement.scrollWidth;
  if (sw > innerWidth + 8) out.push({ kind: responsive ? "overflow" : "overflowWarn", msg: `horizontal overflow ${sw}px > ${innerWidth}px${responsive ? "" : " (no responsive viewport meta; desktop-only page)"}` });
  const inView = (r) => r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight * 3 && r.width > 2 && r.height > 2;
  const all = [...document.querySelectorAll("body *")].filter(vis).slice(0, 5000);
  const textEls = all.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  const small = textEls.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12 && inView(e.getBoundingClientRect()) && !e.closest("sup,sub,small,code,kbd,[aria-hidden=true]"));
  if (small.length) out.push({ kind: "small", msg: `${small.length} text elements under 12px, e.g. ${desc(small[0])} "${small[0].textContent.trim().slice(0, 30)}"` });
  const boxes = textEls.map((e) => ({ e, r: e.getBoundingClientRect() })).filter((b) => inView(b.r) && b.r.top < innerHeight && !b.e.closest("[aria-hidden=true],.sr-only,.visually-hidden,.skip-link,[class*=skip]")).slice(0, 400);
  let overlaps = 0, ex = "";
  for (let i = 0; i < boxes.length && overlaps < 5; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 4 && h > 4 && w * h > 0.2 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) {
      const cx = Math.max(a.r.left, b.r.left) + w / 2, cy = Math.max(a.r.top, b.r.top) + h / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && (a.e.contains(hit) || b.e.contains(hit) || hit.contains(a.e) || hit.contains(b.e))) { overlaps++; ex = ex || `${desc(a.e)} / ${desc(b.e)}`; }
    }
  }
  if (overlaps) out.push({ kind: "overlap", msg: `${overlaps} overlapping text boxes, e.g. ${ex}` });
  for (const el of all) {
    if (el.closest("table,hr,[role=tab],[role=tablist],[data-gutter]") || /^(TD|TH|HR|TR)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (r.height < 18 || r.width < 40) continue;
    const cs = getComputedStyle(el);
    const W = ["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs["border" + s + "Width"]) || 0);
    const C = ["Top", "Right", "Bottom", "Left"].map((s) => norm(cs["border" + s + "Color"]));
    for (let i = 0; i < 4; i++) {
      const others = [0, 1, 2, 3].filter((k) => k !== i), maxO = Math.max(...others.map((k) => W[k]));
      const vertical = i === 1 || i === 3, rounded = parseFloat(cs.borderTopLeftRadius) > 0;
      const thick = W[i] >= 2 && maxO <= W[i] / 2 && (vertical ? r.height < 400 : rounded && W[i] >= 3);
      const colorOnly = W[i] >= 1 && others.every((k) => W[k] === W[i]) && chrom(C[i]) && others.every((k) => !chrom(C[k]));
      if ((thick && C[i].a > 0.2) || colorOnly) { out.push({ kind: "side", msg: `${["top", "right", "bottom", "left"][i]} edge ${W[i]}px on ${desc(el)}` }); break; }
    }
    const ins = (cs.boxShadow || "").match(/inset\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+0px/) || (cs.boxShadow || "").match(/rgba?\([^)]*\)\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+0px\s+0px\s+inset/);
    if (ins && Math.abs(+ins[1]) >= 2 && +ins[2] === 0) out.push({ kind: "side", msg: `inset shadow rail ${Math.abs(+ins[1])}px on ${desc(el)}` });
    for (const ps of ["::before", "::after"]) {
      const p = getComputedStyle(el, ps); if (p.content === "none" || p.content === "normal" || p.position !== "absolute") continue;
      const pw = parseFloat(p.width), ph = parseFloat(p.height), bg = norm(p.backgroundColor);
      if (pw >= 2 && pw <= 8 && ph >= r.height * 0.6 && bg.a > 0.3) out.push({ kind: "side", msg: `${ps} rail ${pw}px on ${desc(el)}` });
    }
  }
  const brand = !!document.querySelector("[data-brand-primary]") || /brand-primary\s*:/.test([...document.querySelectorAll("style")].map((s) => s.textContent).join(""));
  const buttons = [...document.querySelectorAll("button,[role=button],input[type=submit],a")].filter(vis).filter((b) => { const cs = getComputedStyle(b); const bg = norm(cs.backgroundColor); const r = b.getBoundingClientRect(); return bg.a > 0.3 && r.height >= 24 && r.height <= 88 && parseFloat(cs.paddingLeft) >= 6; });
  const hues = new Set();
  for (const b of buttons) {
    const bg = norm(getComputedStyle(b).backgroundColor);
    if (chrom(bg)) { hues.add(Math.round((Math.atan2(Math.sqrt(3) * (bg.g - bg.b), 2 * bg.r - bg.g - bg.b) * 180 / Math.PI + 360) % 360 / 40)); if (!brand && !b.closest("[data-brand-primary]")) out.push({ kind: "btnhue", msg: `chromatic fill on ${desc(b)} "${(b.innerText || "").trim().slice(0, 24)}"` }); }
  }
  if (brand && hues.size > 1) out.push({ kind: "btnhue", msg: `${hues.size} hue families on buttons with a brand-primary opt-in` });
  const texty = buttons.filter((b) => (b.innerText || "").trim().length >= 2 && inView(b.getBoundingClientRect()) && b.getBoundingClientRect().top < innerHeight);
  return { out, buttons: texty.slice(0, 12).map((b, i) => { b.setAttribute("data-uilint-btn", String(i)); return i; }) };
}

function effectiveContrastProbe() {
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const norm = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "rgba(0,0,0,0)"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  return (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const fg = norm(getComputedStyle(el).color); let n = el, bg = null;
    while (n && n.nodeType === 1) { const c = norm(getComputedStyle(n).backgroundColor); if (c[3] > 0.5) { bg = c; break; } n = n.parentElement; }
    bg = bg || [255, 255, 255, 1];
    const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const a = L(fg), b = L(bg); return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  };
}

export async function lintRender(targets) {
  const chromium = await loadChromium();
  if (!chromium) return { notRun: "playwright-core is not importable (npm i --no-save playwright-core next to this script, or set PLAYWRIGHT_CORE_PATH)", findings: [] };
  let browser;
  const exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  try { browser = await chromium.launch(process.platform === "darwin" && existsSync(exe) ? { executablePath: exe } : {}); }
  catch (e) { try { browser = await chromium.launch(); } catch (e2) { return { notRun: "could not launch a browser: " + String(e2.message).slice(0, 100), findings: [] }; } }
  const findings = [];
  const ID = { overflow: ["FAIL", "FE-VISUAL-AUDIT-02"], overflowWarn: ["WARN", "FE-VISUAL-AUDIT-02"], small: ["WARN", "FE-TYPO-FLOOR-01"], overlap: ["WARN", "FE-VISUAL-AUDIT-02"], side: ["FAIL", "FE-SIDE-ACCENT-01"], btnhue: ["FAIL", "FE-COLOR-RESTRAINT-01"] };
  for (const t of targets) {
    const url = /^https?:/.test(t) ? t : pathToFileURL(resolve(t)).href;
    for (const vw of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
      try {
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(800);
        const { out, buttons } = await page.evaluate(pageProbe, vw);
        const seen = new Set();
        for (const o of out) { const k = o.kind + o.msg.slice(0, 40); if (seen.has(k)) continue; seen.add(k); const [lv, id] = ID[o.kind]; findings.push({ level: lv, id, file: t, line: 0, message: `@${vw}px ${o.msg}` }); }
        if (vw === 1280) for (const i of buttons) {
          const sel = `[data-uilint-btn="${i}"]`;
          try {
            const rest = await page.evaluate(`(${effectiveContrastProbe.toString()})()(${JSON.stringify(sel)})`);
            await page.hover(sel, { timeout: 1500 }); await page.waitForTimeout(350);
            const cr = await page.evaluate(`(${effectiveContrastProbe.toString()})()(${JSON.stringify(sel)})`);
            await page.mouse.move(0, 0);
            if (cr && rest && rest >= 4.5 && cr < 4.5) findings.push({ level: "FAIL", id: "FE-COLOR-CONTRAST-01", file: t, line: 0, message: `@1280px hovered button ${i} label contrast ${cr.toFixed(2)}:1 < 4.5:1 (rest ${rest.toFixed(2)}:1)` });
          } catch {}
        }
      } catch (e) { findings.push({ level: "WARN", id: "FE-VISUAL-AUDIT-02", file: t, line: 0, message: `@${vw}px could not render: ${String(e.message).slice(0, 80)}` }); }
      await page.close();
    }
  }
  await browser.close();
  return { findings };
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json"), render = args.includes("--render");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (!targets.length) { process.stderr.write("usage: ui-lint.mjs <file|dir|url>... [--render] [--json]\n"); process.exit(3); }
  const files = [], urls = [];
  for (const t of targets) { if (/^https?:/.test(t)) urls.push(t); else if (existsSync(t)) walkFiles(t, files); else { process.stderr.write(`not found: ${t}\n`); process.exit(3); } }
  const findings = [];
  for (const f of files) findings.push(...lintStatic(relative(process.cwd(), f) || f, readFileSync(f, "utf8")));
  let notRun = null;
  if (render) {
    const r = await lintRender([...files.filter((f) => /\.html?$/i.test(f)), ...urls]);
    notRun = r.notRun; findings.push(...r.findings);
  }
  const code = emit(findings, { json, label: "ui-lint" });
  if (notRun) { process.stdout.write(`NOT_RUN render ${notRun}\n`); process.exit(3); }
  if (!files.length && !urls.length) process.exit(3);
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
