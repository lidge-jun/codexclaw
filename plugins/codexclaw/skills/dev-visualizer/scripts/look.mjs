#!/usr/bin/env node
/**
 * look.mjs — render an HTML or SVG artifact the way a reader sees it and report what breaks.
 *
 *   node look.mjs <file.html|file.svg> [--out sheet.png] [--widths 390,1280]
 *                 [--print | --screen] [--print-width <mm>] [--chrome <path>] [--json]
 *
 * Checks at each width, after load and fonts: script errors, sideways scroll, text under
 * 12 CSS px as rendered (SVG text is scaled by its transform), overlapping text boxes,
 * SVG text leaving its viewBox or the shape it sits on, headings glued to what follows,
 * and empty figures. Then it writes one contact sheet PNG (first screen plus every figure)
 * for a single look.
 *
 * Print documents (an @page rule that sets `size`, or --print) are checked once, as print
 * media, at the printed column width (default 174mm = A4 minus 18mm margins; --print-width
 * <mm>), with print floors: 8pt for text and 8.5pt for SVG figure text (REPORT-VIZ-01).
 * Add --widths to also check a print document on screen; --screen skips the print pass.
 *
 * Exit 0 = no problem found, 1 = problems found, 2 = usage, 3 = NOT_RUN (no browser).
 * NOT_RUN is never a pass: report it as "not rendered".
 *
 * Zero dependencies of its own. playwright-core is resolved from the caller's environment
 * (normal import, then NODE_PATH / cwd via require). The browser is, in order: --chrome,
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE, playwright's own Chromium, then Google Chrome on macOS.
 */
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve, extname, basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const MIN_LABEL_PX = 12;
const MIN_HEADING_GAP_PX = 4;
const PT = 96 / 72;
const MAX_FINDINGS_SHOWN = 30;

function parseArgs(argv) {
  const a = { widths: null, json: false, print: null, printWidthMm: 174 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--out") a.out = argv[++i];
    else if (k === "--chrome") a.chrome = argv[++i];
    else if (k === "--widths") a.widths = argv[++i].split(",").map(Number).filter(Boolean);
    else if (k === "--json") a.json = true;
    else if (k === "--print") a.print = true;
    else if (k === "--screen") a.print = false;
    else if (k === "--print-width") a.printWidthMm = Number(argv[++i]);
    else if (k === "-h" || k === "--help") a.help = true;
    else if (!a.file) a.file = k;
  }
  return a;
}

async function loadPlaywright() {
  try { return (await import("playwright-core")).default ?? (await import("playwright-core")); } catch {}
  try { return createRequire(join(process.cwd(), "noop.js"))("playwright-core"); } catch {}
  return null;
}

async function launch(pw, chrome) {
  const tries = [];
  if (chrome) tries.push(chrome);
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) tries.push(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE);
  tries.push(undefined);
  if (process.platform === "darwin") tries.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  let last;
  for (const executablePath of tries) {
    if (executablePath && !existsSync(executablePath)) continue;
    try { return await pw.chromium.launch({ executablePath, headless: true }); } catch (e) { last = e; }
  }
  throw last ?? new Error("no browser executable found");
}

/** Runs inside the page. Returns { problems: [{kind, msg}], figures: [{x,y,w,h}] }. */
function inspect({ minText, minFigure, MIN_HEADING_GAP_PX }) {
  const problems = [];
  const vw = document.documentElement.clientWidth;
  const add = (kind, msg) => problems.push({ kind, msg });
  const short = (t) => (t || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const scrollW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (scrollW > vw + 1) add("hscroll", `page scrolls sideways: content ${scrollW}px wide in a ${vw}px viewport`);

  // Text-bearing elements: those with a direct non-empty text node.
  const texts = [];
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE", "DESC"].includes(el.tagName)) continue;
    if (el.closest("[aria-hidden='true'], .sr-only, .visually-hidden")) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el)) continue;
    const isSvg = el instanceof SVGElement;
    let px = parseFloat(getComputedStyle(el).fontSize);
    if (isSvg && el.getScreenCTM) { const m = el.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); }
    // Use a Range so block elements report their text box, not their full width.
    const range = document.createRange(); range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const box = isSvg ? el.getBoundingClientRect() : rects.reduce((u, r) => u ? { left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, null);
    if (!box) continue;
    texts.push({ el, isSvg, px, box, rects: isSvg ? [box] : rects, text: short(el.textContent) });
  }

  for (const t of texts) {
    const floor = t.isSvg ? minFigure : minText;
    if (t.px < floor - 0.25) add("small", `text renders at ${t.px.toFixed(1)}px (floor ${floor.toFixed(1)}px): "${t.text}"`);
  }

  // Overlap: line boxes of two different text elements, neither containing the other.
  const sy = scrollY, sx = scrollX;
  let overlaps = 0;
  for (let i = 0; i < texts.length && overlaps < 40; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.box.right <= b.box.left || b.box.right <= a.box.left || a.box.bottom <= b.box.top || b.box.bottom <= a.box.top) continue;
      let hit = false;
      for (const r of a.rects) { for (const s of b.rects) {
        const w = Math.min(r.right, s.right) - Math.max(r.left, s.left);
        const h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
        if (w > 2 && h > Math.min(r.height, s.height) * 0.35) { hit = true; break; }
      } if (hit) break; }
      if (hit) { overlaps++; add("overlap", `text overlaps text: "${a.text}" / "${b.text}" near (${Math.round(a.box.left + sx)}, ${Math.round(a.box.top + sy)})`); }
    }
  }

  // SVG text must stay inside its svg viewport and inside the shape it starts on.
  for (const t of texts.filter((x) => x.isSvg)) {
    const svg = t.el.ownerSVGElement; if (!svg) continue;
    const s = svg.getBoundingClientRect(), b = t.box;
    if (b.left < s.left - 1 || b.right > s.right + 1 || b.top < s.top - 1 || b.bottom > s.bottom + 1) {
      add("svg-escape", `SVG text leaves its viewBox: "${t.text}"`); continue;
    }
    const anchor = getComputedStyle(t.el).textAnchor;
    const cx = anchor === "middle" ? (b.left + b.right) / 2 : anchor === "end" ? b.right - 2 : b.left + 2;
    const cy = (b.top + b.bottom) / 2;
    const shapes = [...svg.querySelectorAll("rect, circle, ellipse, polygon")].filter((sh) => {
      if (sh.closest("defs, clipPath, mask, pattern, marker")) return false;
      const r = sh.getBoundingClientRect();
      return r.width < s.width * 0.9 && r.height < s.height * 0.9 && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom && r.width * r.height < (b.right - b.left) * (b.bottom - b.top) * 40;
    });
    for (const sh of shapes) {
      const r = sh.getBoundingClientRect();
      if (b.left < r.left - 1 || b.right > r.right + 1) { add("svg-escape", `SVG text runs out of its ${sh.tagName}: "${t.text}"`); break; }
    }
  }

  // Headings glued to the next block.
  for (const h of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    if (!visible(h)) continue;
    let n = h.nextElementSibling;
    while (n && !visible(n)) n = n.nextElementSibling;
    if (!n) continue;
    const gap = n.getBoundingClientRect().top - h.getBoundingClientRect().bottom;
    if (gap < MIN_HEADING_GAP_PX && gap > -200) add("heading-gap", `heading sits ${Math.round(gap)}px above the next block: "${short(h.textContent)}"`);
  }

  // Figures: empty or collapsed.
  const figures = [];
  const figEls = [...document.querySelectorAll("figure, svg[role='img'], body > svg, canvas")].filter((el) => !el.parentElement.closest("figure") || el.tagName === "FIGURE");
  for (const f of figEls) {
    const r = f.getBoundingClientRect();
    const drawn = f.matches("canvas") || f.querySelector("svg *:not(title):not(desc):not(defs), img, canvas, video, table, pre");
    if (!visible(f) || r.height < 20 || !drawn) add("empty-figure", `figure renders empty or collapsed (${Math.round(r.width)}x${Math.round(r.height)}): "${short(f.getAttribute("aria-label") || f.textContent)}"`);
    else figures.push({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height });
  }
  return { problems, figures };
}

async function contactSheet(browser, shots, out) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const cells = shots.map((s) => `<figure><img src="data:image/png;base64,${s.png.toString("base64")}"><figcaption>${s.label}</figcaption></figure>`).join("");
  await page.setContent(`<!doctype html><style>body{margin:0;padding:16px;background:#f4f4f2;font:13px system-ui,sans-serif;color:#222}
main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;background:#fff;border:1px solid #ddd;padding:6px}
img{width:100%;max-height:340px;object-fit:contain;object-position:top;display:block}figcaption{margin-top:4px;color:#555}</style><main>${cells}</main>`);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) { console.log("usage: node look.mjs <file.html|file.svg> [--out sheet.png] [--widths 390,1280] [--print|--screen] [--print-width mm] [--chrome path] [--json]"); process.exit(args.help ? 0 : 2); }
  const file = resolve(args.file);
  if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }
  const out = resolve(args.out ?? join(dirname(file), basename(file, extname(file)) + ".look.png"));

  const pw = await loadPlaywright();
  if (!pw) { console.log("NOT_RUN playwright-core is not resolvable here (npm i --no-save playwright-core, or set NODE_PATH). Report the artifact as not rendered."); process.exit(3); }
  let browser;
  try { browser = await launch(pw, args.chrome); }
  catch (e) { console.log(`NOT_RUN no browser could start (${String(e.message).split("\n")[0]}). Pass --chrome <path> or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.`); process.exit(3); }

  const report = { file, widths: [], sheet: out };
  const shots = [];
  try {
    let print = args.print;
    if (print === null) {
      const probe = await browser.newPage();
      await probe.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 30000 });
      print = await probe.evaluate(() => [...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.type === 6 && /size\s*:/.test(r.cssText)); } catch { return false; } }));
      await probe.close();
    }
    // A print document is checked as print. Pass --widths as well when it is also read on screen.
    const screenRuns = (print && !args.widths ? [] : args.widths ?? [390, 1280]).map((w) => ({ label: String(w), width: w, media: "screen", minText: MIN_LABEL_PX, minFigure: MIN_LABEL_PX }));
    const runs = print
      ? [...screenRuns, { label: `print ${args.printWidthMm}mm`, width: Math.round(args.printWidthMm * 96 / 25.4), media: "print", minText: 8 * PT, minFigure: 8.5 * PT }]
      : screenRuns;
    const widest = Math.max(...runs.map((r) => r.width));
    for (const run of runs) {
      const width = run.width;
      const page = await browser.newPage({ viewport: { width, height: Math.round(width * 0.66) || 800 } });
      await page.emulateMedia({ media: run.media });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().split("\n")[0]); });
      await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 30000 });
      await page.evaluate(() => Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 5000))]));
      await page.waitForTimeout(300);
      const res = await page.evaluate(inspect, { minText: run.minText, minFigure: run.minFigure, MIN_HEADING_GAP_PX });
      for (const e of errors) res.problems.unshift({ kind: "script", msg: `script error: ${e}` });
      report.widths.push({ width: run.label, media: run.media, problems: res.problems });
      shots.push({ label: `${run.label} · first screen`, png: await page.screenshot() });
      if (width === widest) {
        for (const [i, f] of res.figures.entries()) {
          if (shots.length >= 12) break;
          const clip = { x: Math.max(0, f.x - 8), y: Math.max(0, f.y - 8), width: Math.min(width, f.w + 16), height: Math.min(4000, f.h + 16) };
          shots.push({ label: `${run.label} · figure ${i + 1}`, png: await page.screenshot({ clip, fullPage: true }) });
        }
      }
      await page.close();
    }
    await contactSheet(browser, shots, out);
  } finally { await browser.close(); }

  const total = report.widths.reduce((n, w) => n + w.problems.length, 0);
  if (args.json) { console.log(JSON.stringify(report, null, 2)); process.exit(total ? 1 : 0); }
  const kinds = ["script", "hscroll", "small", "overlap", "svg-escape", "heading-gap", "empty-figure"];
  const names = { script: "no script errors", hscroll: "no sideways scroll", small: "no text under its size floor", overlap: "no overlapping text", "svg-escape": "SVG text stays in its viewBox and shapes", "heading-gap": "headings clear of the next block", "empty-figure": "no empty figures" };
  for (const w of report.widths) {
    for (const k of kinds) {
      const hits = w.problems.filter((p) => p.kind === k);
      if (!hits.length) { console.log(`✓ [${w.width}] ${names[k]}`); continue; }
      for (const p of hits.slice(0, MAX_FINDINGS_SHOWN)) console.log(`✗ [${w.width}] ${p.msg}`);
      if (hits.length > MAX_FINDINGS_SHOWN) console.log(`✗ [${w.width}] … and ${hits.length - MAX_FINDINGS_SHOWN} more ${k}`);
    }
  }
  console.log(`${total ? "✗" : "✓"} ${total} problem(s). Contact sheet: ${out} (look at it once).`);
  process.exit(total ? 1 : 0);
}

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(2); });
