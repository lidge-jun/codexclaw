// Shared helpers for ui-lint.mjs and copy-lint.mjs. Zero dependencies, Node 22+.
// Colors resolve to sRGB 0-1; "chromatic" means max-min channel spread > 0.12, the same
// threshold the 2026-11-21 site survey used, so lint and survey agree on what counts as hue.

export const LEVELS = ["FAIL", "WARN", "INFO"];

const NAMED = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255],
  orange: [255, 165, 0], purple: [128, 0, 128], teal: [0, 128, 128], navy: [0, 0, 128], gray: [128, 128, 128],
  grey: [128, 128, 128], yellow: [255, 255, 0], pink: [255, 192, 203], indigo: [75, 0, 130], violet: [238, 130, 238],
  crimson: [220, 20, 60], gold: [255, 215, 0], tomato: [255, 99, 71], royalblue: [65, 105, 225], dodgerblue: [30, 144, 255],
  rebeccapurple: [102, 51, 153], silver: [192, 192, 192], whitesmoke: [245, 245, 245], gainsboro: [220, 220, 220],
};

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

function oklchToRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((v) => { v = Math.max(0, Math.min(1, v)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; });
}

const num = (s, pct = 1) => (s.endsWith("%") ? (parseFloat(s) / 100) * pct : parseFloat(s));

/** Parse one CSS color value (no var()). Returns {r,g,b,a} in 0-1 or null. */
export function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  if (v === "transparent" || v === "none" || v === "currentcolor" || v === "inherit") return null;
  let m = v.match(/^#([0-9a-f]{3,8})\b/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  m = v.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return { r: num(p[0], 255) / 255, g: num(p[1], 255) / 255, b: num(p[2], 255) / 255, a: p[3] ? num(p[3]) : 1 };
  }
  m = v.match(/^hsla?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const [r, g, b] = hslToRgb(parseFloat(p[0]), num(p[1]), num(p[2]));
    return { r, g, b, a: p[3] ? num(p[3]) : 1 };
  }
  m = v.match(/^oklch\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean);
    const L = num(p[0]), C = parseFloat(p[1]), H = parseFloat(p[2]) || 0;
    const [r, g, b] = oklchToRgb(L, C, H);
    return { r, g, b, a: p[3] ? num(p[3]) : 1, oklchC: C };
  }
  if (NAMED[v]) { const [r, g, b] = NAMED[v]; return { r: r / 255, g: g / 255, b: b / 255, a: 1 }; }
  return null;
}

export function chroma(c) { return c ? Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) : 0; }
export function isChromatic(c) {
  if (!c || c.a < 0.15) return false;
  if (c.oklchC !== undefined) return c.oklchC > 0.04;
  return chroma(c) > 0.12;
}
export function hue(c) {
  const { r, g, b } = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60);
}
export function luminance(c) {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** First color found inside a declaration value, resolving var(--x) through tokens. */
export function colorIn(value, tokens = {}, depth = 0) {
  if (!value || depth > 5) return null;
  const v = value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (_, n, fb) => tokens[n] ?? fb ?? "");
  const m = v.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|\b(?:black|white|red|green|blue|orange|purple|teal|navy|gray|grey|yellow|pink|indigo|violet|crimson|gold|tomato|royalblue|dodgerblue|rebeccapurple)\b/i);
  if (!m) return v !== value ? colorIn(v, tokens, depth + 1) : null;
  return parseColor(m[0]);
}

/** Byte offset -> 1-based line. */
export function lineAt(text, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * Flatten CSS into leaf rules {selector, decls:{prop:value}, line, body}. Handles nested
 * at-rules by recursing into their bodies; comments are blanked (kept same length so offsets
 * stay valid).
 */
export function parseCss(css, baseOffset = 0, fullText = null) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const rules = [];
  let i = 0;
  const walk = (start, end, prefix) => {
    let j = start, selStart = start;
    while (j < end) {
      const ch = src[j];
      if (ch === "{") {
        const sel = src.slice(selStart, j).trim();
        let depth = 1, k = j + 1;
        while (k < end && depth) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
        const body = src.slice(j + 1, k - 1);
        if (sel.startsWith("@")) {
          if (/^@(media|supports|layer|container|scope)/.test(sel)) walk(j + 1, k - 1, prefix);
        } else if (/{/.test(body)) {
          walk(j + 1, k - 1, sel); // CSS nesting: treat children as their own rules
          const own = body.replace(/[^;{}]*\{[^{}]*\}/g, "");
          rules.push(mk(sel, own, selStart));
        } else {
          rules.push(mk(prefix && !sel.includes("&") ? `${prefix} ${sel}` : sel.replace(/&/g, prefix || ""), body, selStart));
        }
        j = k; selStart = k; continue;
      }
      if (ch === "}" || ch === ";") selStart = j + 1;
      j++;
    }
  };
  const mk = (selector, body, at) => {
    const decls = {};
    for (const d of body.split(";")) {
      const c = d.indexOf(":");
      if (c < 0) continue;
      const p = d.slice(0, c).trim().toLowerCase(), v = d.slice(c + 1).trim();
      if (p) decls[p] = v.replace(/!important/i, "").trim();
    }
    const off = baseOffset + at + (src.slice(at).match(/^\s*/)?.[0].length || 0);
    return { selector, decls, body, line: fullText ? lineAt(fullText, off) : lineAt(css, at) };
  };
  walk(i, src.length, "");
  return rules;
}

/** Inline style="..." attributes as pseudo-rules. */
export function inlineStyleRules(html) {
  const out = [];
  const re = /<([a-zA-Z][\w-]*)([^>]*?)\sstyle\s*=\s*(["'])([\s\S]*?)\3([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2] + " " + m[5];
    const cls = (attrs.match(/class(?:Name)?\s*=\s*["']([^"']*)["']/) || [])[1] || "";
    const role = (attrs.match(/role\s*=\s*["']([^"']*)["']/) || [])[1] || "";
    const sel = `${m[1].toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).join(".") : ""}${role ? `[role="${role}"]` : ""}[style]`;
    const decls = {};
    for (const d of m[4].split(";")) {
      const c = d.indexOf(":");
      if (c > 0) decls[d.slice(0, c).trim().toLowerCase()] = d.slice(c + 1).trim();
    }
    out.push({ selector: sel, decls, body: m[4], line: lineAt(html, m.index), inline: true, attrs });
  }
  return out;
}

export function emit(findings, { json = false, label = "" } = {}) {
  const order = { FAIL: 0, WARN: 1, INFO: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line);
  if (json) process.stdout.write(JSON.stringify({ tool: label, findings }, null, 1) + "\n");
  else for (const f of findings) process.stdout.write(`${f.level} ${f.id} ${f.file}:${f.line} ${f.message}\n`);
  const fail = findings.some((f) => f.level === "FAIL"), warn = findings.some((f) => f.level === "WARN");
  return fail ? 1 : warn ? 2 : 0;
}
