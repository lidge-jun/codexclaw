# DIFFLEVEL-ROADMAP-01 — wp3 paged report layout and SVG QA

This phase fixes the paged report template's narrow contents-number column and adds bounded checks for locale literals and SVG text crossed by later-painted connectors. It is for cxc-dev-visualizer maintainers and report authors. wp2 lands first: D3.4 reuses wp2's runTool stdout capture and timeout/process ownership.

This document implements accepted decisions D3.1, D3.2, D3.3, and D3.4 for issue #241. Locale and SVG checks are P2 review heuristics. Missing `lang`, DOM failure, malformed output (including any invalid finding entry), timeout, or sampling cap is recorded as a nonblocking `report.notes` object and never as `report.notRun` or `FAIL`. `--qa-only` has no HTML and records the DOM check as a note. The DOM pass runs against the final filled print HTML. `report.notRun` remains reserved for the existing receipt checks because `quality-gate.mjs:31-34` treats any nonempty array as `BLOCKED`; the same current source ignores unknown fields, so `report.notes` stays in JSON without changing the quality-gate verdict. D2.1-D2.3 remain wp2.

## File change map

| Disposition | Path |
|---|---|
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/assets/paged-report.html` |
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs` |
| MODIFY | `plugins/codexclaw/test/fixtures/visualizer-export-tools.mjs` |
| MODIFY | `plugins/codexclaw/test/report-export.test.mjs` |
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/SKILL.md` |
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/reference/english-authoring.md` |
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/reference/print-provenance.md` |
| MODIFY | `plugins/codexclaw/skills/dev-visualizer/reference/report-pipeline.md` |
| NEW | None |
| DELETE | None |

### MODIFY plugins/codexclaw/skills/dev-visualizer/assets/paged-report.html

Current anchors: contents grid :71, page literals :25-26, sample SVG :193-214.

D3.1:

~~~diff
-  .toc li { display: grid; grid-template-columns: 10mm 1fr 8mm; column-gap: 3mm; align-items: baseline; padding: 2.4mm 0; border-bottom: 0.4pt solid var(--rule) }
+  .toc li { display: grid; grid-template-columns: max-content minmax(0, 1fr) 8mm; column-gap: 3mm; align-items: baseline; padding: 2.4mm 0; border-bottom: 0.4pt solid var(--rule) }
~~~

Insert this comment immediately above @page. Keep the literals source-owned; do not generate a second @page rule:

~~~css
/* TRANSLATOR: keep the running-header title/date and matching cover date
   synchronized when this template is localized. Chromium lacks
   string-set/string(), so these values remain source-owned literals. */
@page {
~~~

The matching cover date is the current line 138.

D3.3 replaces the current line/grid ordering in the sample chart. The connector/grid group is painted before all labels:

~~~html
      <g font-size="14" fill="#444">
        <!-- Connectors and grid lines are painted before labels. -->
        <g aria-hidden="true">
          <line x1="60" y1="190" x2="700" y2="190" stroke="#1a1a1a" stroke-width="1"/>
          <line x1="60" y1="130" x2="700" y2="130" stroke="#c9c9c9" stroke-width="0.6"/>
          <line x1="60" y1="70" x2="700" y2="70" stroke="#c9c9c9" stroke-width="0.6"/>
        </g>
        <g font-size="13" fill="#6b6b6b" text-anchor="end">
          <text x="52" y="194">0%</text><text x="52" y="134">5%</text><text x="52" y="74">10%</text>
        </g>
        <rect x="90" y="41.2" width="70" height="148.8" fill="#0b3d5c"/>
~~~

Retain the existing remaining rectangles and label groups after this block. A future label crossing uses a paper-coloured halo with paint-order: stroke or moves clear; a halo cannot protect text from a connector painted later.

### MODIFY plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs

Current anchors: runTool :108-146, printPdf :183-197, analyzeLayout :274-298, finish :302-347, main two-pass flow :440-482. wp2 changes runTool/printPdf first.

Add constants beside CHECK_IDS:

~~~js
const DOM_QA_SCRIPT_ID = "cxc-svg-geometry-result-v1";
const DOM_QA_SCHEMA_VERSION = 1;
const DOM_QA_TIMEOUT_MS = 10_000;
~~~

Add these complete locale functions after collectTargets. They scan only content declarations inside @page blocks, including nested margin boxes; they do not infer language from body text. Missing language is an informational note because `quality-gate.mjs` blocks nonempty `report.notRun`:

~~~js
function extractBalancedBlocks(source, marker) {
  const blocks = [];
  let from = 0;
  while (from < source.length) {
    marker.lastIndex = 0;
    const found = marker.exec(source.slice(from));
    if (!found) break;
    const start = from + found.index;
    const open = source.indexOf("{", start);
    if (open < 0) break;
    let depth = 0;
    let quote = null;
    let closed = false;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === quote && source[index - 1] !== "\\") quote = null;
        continue;
      }
      if (character === "'" || character === '"') { quote = character; continue; }
      if (character === "{") depth += 1;
      if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(open + 1, index));
          from = index + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  return blocks;
}

function pageContentLiterals(html) {
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1]).join("\n");
  const pages = extractBalancedBlocks(styles, /@page\b[^{]*/gi);
  return pages.flatMap((page) => [...page.matchAll(
    /content\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gi,
  )].map((match) => match[1].slice(1, -1)));
}

function analyzePageLocale(report, html) {
  const language = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html)?.[1]?.toLowerCase();
  if (!language) {
    report.notes.push({
      id: "page-locale",
      message: "<html lang> is missing; language was not inferred.",
    });
    return;
  }
  if (language === "ko" || language.startsWith("ko-")) return;
  const suspect = pageContentLiterals(html).find(
    (literal) => /[\uAC00-\uD7A3]/u.test(literal)
      || /\b\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\./u.test(literal),
  );
  if (suspect) report.qa.push({
    level: "P2", page: null,
    msg: "@page content contains Korean/date literal for lang=" + language
      + ': "' + suspect + '"; translate source-owned page furniture and cover date',
  });
}
~~~

Call analyzePageLocale(report, sourceHtml) immediately after sourceHtml is read at current main :388.

Add this complete bounded DOM implementation after analyzePageLocale. It injects one versioned JSON script, compares text boxes only with later-painted stroked line/polyline/path nodes, transforms samples through getScreenCTM, shrinks text boxes by one pixel, and caps samples. A sampled point must be strictly inside the shrunk box; touching an edge is not a crossing. Validate the entire envelope, including every finding, before emitting any P2 finding. Any unexpected probe error returns a nonblocking reason to the caller:

~~~js
function domMeasurementScript() {
  return "<script>\n" +
    "(() => {\n" +
    "const result = {schemaVersion:" + DOM_QA_SCHEMA_VERSION +
      ",kind:'svg-text-crossings',findings:[],capped:false};\n" +
    "const visible = n => { const s=getComputedStyle(n); return s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>0; };\n" +
    "const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);\n" +
    "const hit=(p,q,r,s)=>{const a=cross(p,q,r),b=cross(p,q,s),c=cross(r,s,p),d=cross(r,s,q);return ((a>0&&b<0)||(a<0&&b>0))&&((c>0&&d<0)||(c<0&&d>0));};\n" +
    "const crossed=(a,b,x)=>{if(a.x>x.left&&a.x<x.right&&a.y>x.top&&a.y<x.bottom)return true;if(b.x>x.left&&b.x<x.right&&b.y>x.top&&b.y<x.bottom)return true;const e=[[[x.left,x.top],[x.right,x.top]],[[x.right,x.top],[x.right,x.bottom]],[[x.right,x.bottom],[x.left,x.bottom]],[[x.left,x.bottom],[x.left,x.top]]];return e.some(v=>hit(a,b,{x:v[0][0],y:v[0][1]},{x:v[1][0],y:v[1][1]}));};\n" +
    "const point=(s,x,y)=>{const p=s.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(s.getScreenCTM());};\n" +
    "const points=(s,n,b)=>{if(n.localName==='line')return[point(s,n.x1.baseVal.value,n.y1.baseVal.value),point(s,n.x2.baseVal.value,n.y2.baseVal.value)];if(n.localName==='polyline')return[...n.points].map(v=>point(s,v.x,v.y));const l=n.getTotalLength(),c=Math.max(1,Math.min(256,Math.ceil(l/4),b));return Array.from({length:c+1},(_,i)=>{const p=n.getPointAtLength(l*i/c);return point(s,p.x,p.y);});};\n" +
    "for(const svg of document.querySelectorAll('svg')){const nodes=[...svg.querySelectorAll('text,line,polyline,path')];let budget=5000;for(let ti=0;ti<nodes.length;ti+=1){const text=nodes[ti];if(text.localName!=='text'||!visible(text))continue;const r=text.getBoundingClientRect(),box={left:r.left+1,right:r.right-1,top:r.top+1,bottom:r.bottom-1};if(box.right<=box.left||box.bottom<=box.top)continue;for(let gi=ti+1;gi<nodes.length;gi+=1){const g=nodes[gi];if(!visible(g)||!['line','polyline','path'].includes(g.localName))continue;const st=getComputedStyle(g);if(st.stroke==='none'||Number.parseFloat(st.strokeWidth||'0')<=0)continue;let ps;try{ps=points(svg,g,budget);}catch{continue;}budget-=ps.length;if(budget<0){result.capped=true;break;}for(let i=1;i<ps.length;i+=1)if(crossed(ps[i-1],ps[i],box)){result.findings.push({svg:svg.id||null,text:text.id||null,geometry:g.id||null,geometryType:g.localName});break;}}if(result.capped)break;}if(result.capped)break;}\n" +
    "const out=document.createElement('script');out.id=" + JSON.stringify(DOM_QA_SCRIPT_ID) + ";out.type='application/json';out.textContent=JSON.stringify(result);document.documentElement.appendChild(out);\n" +
    "})();</script>";
}

function injectDomMeasurement(html) {
  const script = domMeasurementScript();
  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, script + "</body>") : html + script;
}

function parseDomMeasurement(stdout) {
  const escapedId = DOM_QA_SCRIPT_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    "<script[^>]*\\bid=[\"']" + escapedId
      + "[\"'][^>]*>([\\s\\S]*?)<\\/script>", "i",
  );
  const match = pattern.exec(stdout);
  if (!match) return { ok: false, reason: "stdout did not contain " + DOM_QA_SCRIPT_ID };
  try {
    const value = JSON.parse(match[1]);
    if (value?.schemaVersion !== DOM_QA_SCHEMA_VERSION
      || value.kind !== "svg-text-crossings"
      || !Array.isArray(value.findings) || typeof value.capped !== "boolean"
      || !value.findings.every((finding) => finding !== null
        && typeof finding === "object" && !Array.isArray(finding)
        && ["svg", "text", "geometry"].every((key) => finding[key] === null
          || typeof finding[key] === "string")
        && ["line", "polyline", "path"].includes(finding.geometryType))) {
      return { ok: false, reason: "DOM result has an invalid schema" };
    }
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: "DOM result was not valid JSON: " + error.message };
  }
}

async function runSvgCrossingProbe(chrome, htmlPath, report, timeoutMs, tempFiles) {
  try {
    const html = readFileSync(htmlPath, "utf8");
    const probePath = writeTempHtml(htmlPath, injectDomMeasurement(html), tempFiles);
    const result = await runTool(chrome, [
      "--headless=new", "--disable-gpu", "--no-first-run",
      "--no-default-browser-check", "--dump-dom",
      "--virtual-time-budget=" + DOM_QA_TIMEOUT_MS,
      pathToFileURL(probePath).href,
    ], timeoutMs);
    if (!result.ok) return { ok: false, reason: "DOM probe " + result.reason };
    const parsed = parseDomMeasurement(result.stdout || "");
    if (!parsed.ok) return parsed;
    if (parsed.value.capped) return { ok: false, reason: "DOM probe sampling budget was exhausted" };
    const findings = parsed.value.findings.map((finding) => ({
      level: "P2", page: null,
      msg: "SVG text box is crossed by later-painted " + finding.geometryType
        + " (svg=" + (finding.svg || "anonymous") + ", text="
        + (finding.text || "anonymous") + ", geometry=" + (finding.geometry || "anonymous") + ")",
    }));
    report.qa.push(...findings);
    return { ok: true, findings: findings.length };
  } catch (error) {
    return { ok: false, reason: "DOM probe failed: " + (error?.message || String(error)) };
  }
}
~~~

Add `notes: []` beside `notRun` and add `svgGeometry: { schemaVersion: DOM_QA_SCHEMA_VERSION, status: "NOT_RUN", findings: 0 }` to the report object at current main :354-360. After the second-pass branch and before analyzeLayout at current :492, add:

~~~js
  if (flags.qaOnly) {
    report.notes.push({
      id: "svg-geometry",
      message: "--qa-only has no HTML source for DOM geometry.",
    });
  } else if (retainedHtml) {
    const dom = await runSvgCrossingProbe(chrome, retainedHtml, report, flags.timeoutMs, tempFiles);
    if (dom.ok) report.svgGeometry.status = dom.findings ? "REVIEW" : "PASS";
    else {
      report.svgGeometry.status = "NOT_RUN";
      report.notes.push({
        id: "svg-geometry",
        message: dom.reason + "; rendered-page inspection remains required.",
      });
    }
    report.svgGeometry.findings = report.qa.filter((item) => item.msg.startsWith("SVG text box is crossed")).length;
  }
~~~

A crossing enters existing report.qa and makes the existing pagination check REVIEW. finish needs no new verdict branch. The probe is supplementary evidence for final HTML, not PDF coordinate proof.

D2.3's wp2 summary change must print each FAIL/BLOCKED/NOT_RUN check ID and reason once. Preserve it and print notes separately under `notes:` so D3.4 diagnostics remain visible without activating the quality gate:

~~~js
for (const item of report.checks) {
  if (["FAIL", "BLOCKED", "NOT_RUN"].includes(item.status)) {
    console.log("  " + item.status + "  " + item.id + "  " + item.reason);
  }
}
if (report.notes.length) {
  console.log("notes:");
  for (const note of report.notes) console.log("  " + note.id + ": " + note.message);
}
~~~

This summary extension belongs to wp2's `finish` change in `010_export_completion.md`; it composes after the existing check and `report.notRun` lines. The JSON branch already serializes the full report, so `notes` remains available to consumers. Do not copy these note messages into `report.notRun`.

### MODIFY plugins/codexclaw/test/fixtures/visualizer-export-tools.mjs

Current Chrome dispatch starts at :39. Insert before if (printArg):

~~~js
if (args.includes("--dump-dom")) {
  if (mode === "dump-dom-fail") { console.error("fixture dump-dom failed"); process.exit(11); }
  if (mode === "dump-dom-malformed") {
    console.log('<!doctype html><script type="application/json" id="cxc-svg-geometry-result-v1">{invalid-json</script>');
    process.exit(0);
  }
  if (mode === "dump-dom-no-marker") {
    console.log("<!doctype html><p>fixture dump-dom result marker absent</p>");
    process.exit(0);
  }
  if (mode === "dump-dom-null-finding" || mode === "dump-dom-bad-geometry-type") {
    const invalidFinding = mode === "dump-dom-null-finding" ? null
      : { svg: "fixture-svg", text: "fixture-label", geometry: "fixture-line", geometryType: "circle" };
    const validFinding = { svg: "fixture-svg", text: "valid-label", geometry: "valid-line", geometryType: "line" };
    const result = { schemaVersion: 1, kind: "svg-text-crossings",
      findings: [validFinding, invalidFinding], capped: false };
    console.log("<!doctype html><script type=\"application/json\" id=\"cxc-svg-geometry-result-v1\">"
      + JSON.stringify(result) + "</script>");
    process.exit(0);
  }
  const result = mode === "dump-dom-crossing"
    ? { schemaVersion: 1, kind: "svg-text-crossings",
        findings: [{ svg: "fixture-svg", text: "fixture-label",
          geometry: "fixture-line", geometryType: "line" }], capped: false }
    : mode === "dump-dom-cap"
      ? { schemaVersion: 1, kind: "svg-text-crossings", findings: [], capped: true }
      : { schemaVersion: 1, kind: "svg-text-crossings", findings: [], capped: false };
  console.log("<!doctype html><script type=\"application/json\" id=\"cxc-svg-geometry-result-v1\">"
    + JSON.stringify(result) + "</script>");
  process.exit(0);
}
~~~

The fixture is deterministic and does not execute injected browser code. The real-Chrome smoke covers actual dump-dom.

### MODIFY plugins/codexclaw/test/report-export.test.mjs

Add after the current layout test :237-250:

~~~js
test("dump-dom crossing becomes a P2 pagination REVIEW", () => {
  const { root } = sandbox();
  try {
    const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode: "dump-dom-crossing" }));
    assert.equal(report.svgGeometry.status, "REVIEW");
    assert.equal(report.svgGeometry.findings, 1);
    assert.equal(report.verdict, "REVIEW");
    assert.ok(report.qa.some((finding) => finding.level === "P2" && /later-painted line/.test(finding.msg)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("dump-dom failure is named NOT_RUN and does not block the PDF", () => {
  const { root } = sandbox();
  try {
    const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode: "dump-dom-fail" }));
    assert.equal(report.svgGeometry.status, "NOT_RUN");
    assert.equal(report.verdict, "PASS");
    assert.ok(report.notes.some((note) => note.id === "svg-geometry" && /DOM probe exited with status 11/.test(note.message)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("malformed, invalid-entry, or absent dump-dom results become notes without P2 findings", () => {
  const { root } = sandbox();
  try {
    for (const mode of ["dump-dom-malformed", "dump-dom-no-marker",
      "dump-dom-null-finding", "dump-dom-bad-geometry-type"]) {
      const report = parseReport(run(root, exportArgs(writeInput(root), join(root, "report.pdf")), { mode }));
      assert.equal(report.svgGeometry.status, "NOT_RUN");
      assert.equal(report.verdict, "PASS");
      assert.ok(report.notes.some((note) => note.id === "svg-geometry"
        && /DOM result was not valid JSON|stdout did not contain cxc-svg-geometry-result-v1|DOM result has an invalid schema/.test(note.message)));
      assert.equal(report.qa.filter((finding) => finding.level === "P2").length, 0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--qa-only names DOM geometry as NOT_RUN", () => {
  const { root } = sandbox();
  try {
    const pdf = join(root, "existing.pdf");
    writeFileSync(pdf, "%PDF-1.4\nfixture-paper=A4\n");
    const report = parseReport(run(root, ["--qa-only", pdf, "--pdfinfo", TOOLS, "--pdftotext", TOOLS, "--json"]));
    assert.equal(report.svgGeometry.status, "NOT_RUN");
    assert.equal(report.verdict, "PASS");
    assert.ok(report.notes.some((note) => note.id === "svg-geometry" && /--qa-only has no HTML source/.test(note.message)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
~~~

Add locale tests with minimal HTML fixtures: Korean lang; English lang plus Korean @page content; English dotted date; counter(page); and missing lang. Assert exact P2/notes behavior and that body Korean text alone does not trigger a finding. Add dump-dom-cap coverage; the matrix above covers malformed JSON, absent marker, an envelope containing a valid finding followed by null, and one containing a valid finding followed by invalid geometryType. The latter two prove no partial P2 output. Each diagnostic failure asserts a note, an unchanged `report.verdict` of PASS when the PDF checks pass, and zero P2 findings. Add one opt-in real-Chrome smoke, skipped with an explicit reason unless CXC_REAL_CHROME=1, using the installed Chrome path and tiny SVG HTML. The default suite stays fixture-backed.

### MODIFY plugins/codexclaw/skills/dev-visualizer/SKILL.md

Current anchors: layout :116-119, render verification :166-180, syntax :189-191.

Replace the layout paragraph with:

> Use semantic, editable source. Keep text-bearing HTML in normal responsive Grid/Flex flow; derive SVG connector endpoints from rendered bounds if needed (DIAGRAM-LAYOUT-01). Paint connectors before labels they pass behind. A label placed on a connector needs a paper-coloured halo with paint-order: stroke, or it must move clear; a halo cannot cover a connector painted later. Standalone SVG is a vector document: geometric coordinates are appropriate, but size/wrap labels from actual text metrics and inspect the result.

After DIAGRAM-RENDER-VERIFY-01 add:

> The paged-report exporter may run a bounded --dump-dom SVG crossing diagnostic on the final filled HTML. It is supplementary P2 review evidence: a crossing is a review finding, while a timeout, malformed result, or sampling cap is recorded in `report.notes` and does not change the PDF verdict; the PDF page remains the authority for print inspection.

### MODIFY plugins/codexclaw/skills/dev-visualizer/reference/english-authoring.md

After :15 add:

> The paged-report exporter checks @page content literals against explicit <html lang>. Korean or dotted date literals in a non-Korean document are P2 review findings. Missing lang records an unresolved assumption; language is not inferred from body text.

### MODIFY plugins/codexclaw/skills/dev-visualizer/reference/print-provenance.md

After :16 add:

> **Measured 2026-09-24, installed Google Chrome on macOS.** --headless=new --dump-dom --virtual-time-budget=5000 on temporary HTML whose script appends an application/json script exited 0 in approximately 1,283 ms; stdout contained the serialized element. Chromium emitted repeated CVDisplayLinkCreateWithCGDisplay errors on stderr, but DOM output was produced. This is feasibility evidence for the bounded diagnostic, not a guarantee for other versions or hosts.

### MODIFY plugins/codexclaw/skills/dev-visualizer/reference/report-pipeline.md

After wp2 replaces the current :116-121 paragraph as specified in `010_export_completion.md:285-300`, append this text immediately after its final `explicit choice independent of output language.` sentence:

> When HTML is available, export also attempts the bounded SVG text/connector diagnostic on final filled print HTML. `--qa-only` records it as a `report.notes` entry because it has no HTML source; DOM process failure does not invalidate an otherwise passing PDF receipt, and the note remains visible in JSON and under `notes:` in human output.

### No change: structure/40_enforcement_methods.md and structure/INDEX.md

No architecture boundary, hook surface, or enforcement catalog entry changes in wp3. structure/INDEX.md:28 already maps to 40_enforcement_methods.md.

## PLAN-FIELD-CHAIN-01

| Field/value | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| report.svgGeometry | Exporter report initializer :354-360; schemaVersion 1, status NOT_RUN/PASS/REVIEW, findings number | Existing JSON output in finish :338 | Existing test parseReport :69-74; additive field needs no migration | Focused tests and human readers; quality-gate does not consume it |
| DOM result fields | Injected browser and fixture | application/json script id cxc-svg-geometry-result-v1 in stdout | parseDomMeasurement validates schemaVersion, kind, capped, and every finding's object shape, nullable string identifiers, and line/polyline/path geometryType before any finding is consumed | runSvgCrossingProbe; malformed or absent values become `report.notes`, never P2 findings |
| report.notes | Exporter report initializer :358; locale/DOM branches append `{id, message}` | Existing JSON branch and wp2 human summary under `notes:` | No revival or migration; absent in older reports is treated as an empty optional array by consumers | Human output and tests; `quality-gate.mjs:31-34` does not read it and ignores this unknown field |
| notRun reasons | Existing `report.notRun` :358; existing receipt branches only | Existing JSON and summary | Existing quality-gate behavior at quality-gate.mjs:31-34 | Existing receipt gate; D3.4 does not append here |
| public flag/enum | N/A: internal Chrome --dump-dom only; public exporter invocation unchanged | N/A | N/A | runSvgCrossingProbe owns internal argument |

## C-ACTIVATION-GROUNDING-01

| Conditional path | Activation scenario C uses | Observable effect |
|---|---|---|
| Missing lang | Minimal HTML without lang | Named page-locale note; no inference and no gate block |
| Non-Korean lang plus Hangul/date in @page | lang=en with Korean title or 2026. 9. 9. | P2 finding naming language/literal; pagination REVIEW |
| Korean or clean English furniture | lang=ko template, or English literals | No locale finding |
| Clean DOM | dump-dom-clean fixture or no-crossing SVG | svgGeometry PASS, zero findings |
| Later-painted crossing | dump-dom-crossing fixture | P2 finding with IDs; svgGeometry REVIEW |
| Earlier-painted overlap | Connector occurs before text | Ignored by design |
| Hidden/unstroked/zero-width geometry | CSS hidden, stroke none, or width zero | Ignored |
| Sampling cap | dump-dom-cap or pathological SVG | svgGeometry NOT_RUN; `report.notes` reason; no FAIL or P2 |
| Chrome nonzero/timeout/no marker | dump-dom-fail, timeout, or absent marker | `report.notes`; PDF checks continue with no P2 |
| Invalid or malformed schema | Wrong version/kind/field types, invalid JSON, a null finding, or geometryType=circle inside an otherwise valid envelope | Entire DOM result is rejected into `report.notes`; no findings trusted and no P2 |
| Unexpected probe exception | Read/inject/run/parse/mapping error | `runSvgCrossingProbe` returns a reason caught by the caller; `report.notes` records it without entering the fatal exporter catch |
| qa-only | Existing PDF with no HTML | `report.notes` names unavailable HTML; PDF verdict is unchanged |
| Boundary contact | Sampled segment only touches the one-pixel-shrunk box edge | Ignored; strict point-in-box comparisons do not report a crossing |
| Final filled HTML | TOC input requiring second pass | Probe uses retained final HTML after refill |

## PLAN-BYPASS-NAMED-01

| Check | Tier | Executing surface | Known bypass | Residual risk | Wording |
|---|---|---|---|---|---|
| @page locale lint | E8 | Exporter and focused Node tests | Omit/change lang, use CSS outside scan, or use unrecognized locale/date | Checks selected literals, not translation quality, prose, fonts, or semantics | P2 review finding; never “enforced” |
| SVG crossing diagnostic | E8 | Local Chrome dump-dom, fixture, opt-in smoke | Narrow sampled crossing, glyph whitespace, unsupported SVG, omitted probe, malformed result or unexpected probe exception | May miss geometry or report harmless box intersection; whole-result validation prevents partially trusted findings | Supplementary P2 evidence; every probe failure is a `report.notes` entry |
| Paint-order guidance | E7 | Skill prose and template comment | Future author paints connector after label or omits halo | No runtime enforcement | Guidance/review/inspect wording |
| Tests | E8 | Focused runner | Real smoke skipped without opt-in; fixture does not prove Chrome | Host/version compatibility remains open | Skipped smoke is NOT RUN |

## Verifier commands and fresh evidence

These were run on the current tree before writing. They verify current source and fixtures, not the proposed D3.4 implementation.

| Command | Exit | Evidence |
|---|---:|---|
| node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/report-export.test.mjs' | 0 | 37 passed, 0 failed; reads exporter, quality gate, and visualizer fixture |
| node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/report-locale.test.mjs' | 0 | 51 passed, 0 failed; reads locale renderer/examples, not proposed page lint |
| node --check plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs && node --check plugins/codexclaw/test/fixtures/visualizer-export-tools.mjs | 0 | Parses both current JavaScript targets |
| rg -n 'grid-template-columns: 10mm 1fr 8mm|content: "가온리테일|content: "2026\\. 9\\. 9\\."|DIAGRAM-LAYOUT-01|--dump-dom' plugins/codexclaw/skills/dev-visualizer | 0 | Confirms old grid/literals, current layout rule, and no current dump-dom implementation |

The requested Mac feasibility measurement used this exact temporary HTML and wrapper. Observed exit 0, elapsed 1283.4 ms, stdout_contains_probe=True. Stderr had repeated CVDisplayLinkCreateWithCGDisplay errors that did not prevent output:

~~~python
import subprocess, tempfile, time, os
source = """<!doctype html>
<html><body>
<script>
  const result = document.createElement("script");
  result.type = "application/json";
  result.id = "cxc-dump-dom-probe";
  result.textContent = JSON.stringify({ ready: true, title: document.title, bodyText: document.body.innerText.trim() });
  document.documentElement.appendChild(result);
</script>
</body></html>
"""
fd, path = tempfile.mkstemp(prefix="cxc-dump-dom-probe-", suffix=".html", dir="/tmp")
os.write(fd, source.encode())
os.close(fd)
started = time.monotonic()
p = subprocess.run(
    ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
     "--headless=new", "--dump-dom", "--virtual-time-budget=5000", path],
    capture_output=True, text=True, timeout=20,
)
elapsed = (time.monotonic() - started) * 1000
print(f"exit={p.returncode}")
print(f"elapsed_ms={elapsed:.1f}")
print("stdout_contains_probe=" + str('id="cxc-dump-dom-probe"' in p.stdout))
print("stdout=" + p.stdout)
print("stderr=" + p.stderr)
os.unlink(path)
~~~

New tests are NOT RUN until implementation. Required commands:

~~~sh
node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/report-export.test.mjs'
CXC_REAL_CHROME=1 node plugins/codexclaw/scripts/test.mjs 'plugins/codexclaw/test/report-export.test.mjs'
~~~

The first command is a current pass above but the new cases do not exist yet; the second is NOT RUN (new opt-in test).

## Docs and SoT sync

| Source | Current anchor/text | Exact after text |
|---|---|---|
| skills/dev-visualizer/SKILL.md:116-119 | Existing DIAGRAM-LAYOUT-01 paragraph | Add connector-before-label, halo, and later-paint limitation above |
| skills/dev-visualizer/SKILL.md:166-180 | Page render/collision guidance | Add bounded DOM diagnostic paragraph above |
| skills/dev-visualizer/reference/english-authoring.md:15 | Explicit locale config | Add lang/@page lint and missing-language behavior above |
| skills/dev-visualizer/reference/print-provenance.md:13-16 | Chromium margin-box/counter measurement | Add 2026-09-24 dump-dom measurement above |
| skills/dev-visualizer/reference/report-pipeline.md:116-121 | wp2 replaces the timeout/output paragraph per `010_export_completion.md:285-300` | Append final-HTML diagnostic and qa-only `report.notes` behavior after wp2's replacement; do not restore the old timeout sentence |
| structure/40_enforcement_methods.md:18-32 | E1-E8 ladder | No edit; used to classify E8/E7 and wording |
| structure/INDEX.md:21-35 | Structure map | No edit; no boundary change |

Exact reference sync text:

* `SKILL.md:116-119` before: `Use semantic, editable source. Keep text-bearing HTML in normal responsive Grid/Flex flow; derive SVG connector endpoints from rendered bounds if needed (DIAGRAM-LAYOUT-01). Standalone SVG is a vector document: geometric coordinates are appropriate, but size/wrap labels from actual text metrics and inspect the result.` After: the same sentence with `Paint connectors before labels they pass behind. A label placed on a connector needs a paper-coloured halo with paint-order: stroke, or it must move clear; a halo cannot cover a connector painted later.` inserted before `Standalone SVG`.
* `SKILL.md:166-180` before: `DIAGRAM-RENDER-VERIFY-01 — for the computed and exported tiers, and for any artifact you have reason to doubt: render the final artifact, read the screenshot/page, fix clipping, collisions, empty charts and runtime errors.` After: retain that paragraph and append `The paged-report exporter may run a bounded --dump-dom SVG crossing diagnostic on the final filled HTML. It is supplementary P2 review evidence: a crossing is a review finding, while a timeout, malformed result, or sampling cap is recorded in report.notes and does not change the PDF verdict; the PDF page remains the authority for print inspection.`
* `reference/english-authoring.md:15` before: `The six JSON examples under assets/report-examples/ carry these fields in localeConfig. Korean examples use A4 and English examples use Letter to exercise both paths; this is fixture coverage, not a rule tying paper size to language.` After: retain it and append `The paged-report exporter checks @page content literals against explicit <html lang>. Korean or dotted date literals in a non-Korean document are P2 review findings. Missing lang records an unresolved assumption; language is not inferred from body text.`
* `reference/print-provenance.md:13-16` before: `- string-set and target-counter() are not supported.` After: retain the bullet and append `Measured 2026-09-24, installed Google Chrome on macOS: --headless=new --dump-dom --virtual-time-budget=5000 on temporary HTML whose script appends an application/json script exited 0 in approximately 1,283 ms and stdout contained the serialized element. Repeated CVDisplayLinkCreateWithCGDisplay stderr errors did not prevent DOM output; this is host/version-specific feasibility evidence.`
* `reference/report-pipeline.md:116-121` before wp2: `A timed-out tool fails even when a useful draft PDF exists; verify that file separately with --qa-only and record which engine actually completed the export.` After wp2: use the replacement beginning `An incomplete or changing stage fails at the deadline` and ending `an explicit choice independent of output language.` from `010_export_completion.md:285-300`. After wp3: retain that entire wp2 paragraph and append `When HTML is available, export also attempts the bounded SVG text/connector diagnostic on final filled print HTML. --qa-only records it as a report.notes entry because it has no HTML source; DOM process failure does not invalidate an otherwise passing PDF receipt, and the note remains visible in JSON and under notes: in human output.`

## Scope and risks

IN: assigned template, exporter, fixture, focused exporter tests, and four visualizer guidance/provenance references; bounded local DOM pass; source anchors; no public CLI flag.

OUT: wp2 completion/cleanup implementation, CDP, browser installation, PDF geometry inference, font certification, semantic translation review, full publication assurance, quality-gate changes, enforcement-catalog changes, and Aside port.

Risks are renderer drift, incomplete SVG coverage, sampled crossings missing narrow intersections, and glyph-whitespace false positives. The DOM pass is fail-open and review-level. The Mac probe proves stdout feasibility on this installed Chrome only.

Main decision on the writer's open question: no `--no-svg-geometry` opt-out in this phase. The pass is bounded by its own timeout and sampling cap and can only add P2 findings or a named `report.notes` entry, never a FAIL, so a large report loses nothing it needs. An opt-out can be added later if a real report shows the cost.

## Reflection round 1 folds

- Gap 1: missing `lang` and every DOM-pass failure go to the nonblocking `report.notes` array, never `report.notRun`, because quality-gate.mjs:31-34 blocks on a nonempty `notRun`.
- Gap 2: the point-in-box and edge tests use strict comparisons, so a connector that only touches the shrunk box is not a crossing.
- Gap 3: fixture modes `dump-dom-malformed` and `dump-dom-no-marker` exist, and their test asserts a note and no P2 finding.

The fold writer (01a0d174-8b96-7530-8632-e6f2b652649a) stopped on a model-capacity error after editing the body; main verified the three folds in the text above and wrote this section.

## Audit round 1 folds

- Finding 1: `parseDomMeasurement` now escapes the marker ID and builds its quote-matching regex with valid JavaScript string quoting. The complete proposed exporter helper block (constants, locale functions, DOM functions) was extracted to `/tmp/cxc-wp3-exporter-helpers.mjs`; `node --check` exited 0.
- Finding 2: envelope validation now rejects every non-object finding, non-string/non-null `svg`, `text`, or `geometry`, and every geometry type outside `line`, `polyline`, or `path` before emitting any P2. `runSvgCrossingProbe` catches unexpected errors and returns a reason for `report.notes`. The fixture and test matrix include a valid finding followed by `null` and a valid finding followed by `geometryType: "circle"`; both must yield `NOT_RUN`, a note, PASS PDF verdict, and zero P2. A temporary harness against the extracted helpers passed those envelope cases and an unexpected read error; proposed repository tests are still NOT RUN until implementation.
- Finding 12: the `report-pipeline.md` edit now appends the DOM guidance to wp2's replacement paragraph from `010_export_completion.md:285-300`. It does not reinstate the old `A timed-out tool fails even when...` sentence.

Syntax checks after the final snippet edit: `node --check /tmp/cxc-wp3-exporter-helpers.mjs`, `node --check /tmp/cxc-wp3-fixture.mjs`, and `node --check /tmp/cxc-wp3-tests.mjs` all exited 0. These files were extracted from the three changed JavaScript blocks in this plan. `node /tmp/cxc-wp3-parser-harness.mjs` exited 0 with `parser valid/invalid envelopes and unexpected probe error: PASS`. Current source anchors were rechecked: exporter helpers and `analyzeLayout` at `export-paged-report.mjs:258,274,492`, fixture Chrome dispatch at `visualizer-export-tools.mjs:39`, focused test insertion at `report-export.test.mjs:237`, template grid at `paged-report.html:71`, and existing timeout paragraph at `report-pipeline.md:116-121`. The repository implementation and its new tests remain future wp3 work.

## wp3 P revalidation (2026-09-24)

Continuity: wp2 D (cdf1540c) delivered the reworked `runTool` (options object with `completionPath`, `killTree`, `postKillGraceMs`, `env`; results carry `completedBy`), `report.printPasses`, and the new text-summary block in `finish`. It named wp3 as the next cycle. The direction is unchanged.

Stale check: since d66dfcf2, wp2 changed export-paged-report.mjs, report-pipeline.md, report-export.test.mjs and the fixture. Line anchors in this document that point into those files are shifted by wp2's insertions. The builder re-locates each anchor by function name (`collectTargets`, `analyzeLayout`, `finish`, `main`, the report initializer), not by line number. The DOM pass calls `runTool(chrome, args, timeoutMs)` without `completionPath`, so the stage probe stays off for it. The `notes:` lines go after wp2's check-reason block and before the verdict line. The report-pipeline.md edit extends wp2's committed replacement text.

Builder write scope: paged-report.html, SKILL.md (DIAGRAM-LAYOUT-01 and DIAGRAM-RENDER-VERIFY-01 sentences), reference/report-pipeline.md, reference/english-authoring.md only if this document edits it, scripts/export-paged-report.mjs, test/report-export.test.mjs, test/fixtures/visualizer-export-tools.mjs, and a new test file only if this document names one.

Scope amendment after architect reflection: reference/print-provenance.md is also in the builder write scope (this document edits it at the SoT section).

## wp3 A round 1 folds (override earlier text)

- Finding 1: in `finish`, insert only the `notes:` block (the `if (report.notes.length) { console.log("  notes:"); for (...) console.log("  " + note.id + ": " + note.message); }` lines) after wp2's existing check-reason loop and `report.notRun` loop, immediately before the verdict line. Do not copy the check loop from the snippet above; wp2 already prints each check reason once.
- Finding 2: add fixture behavior for the `--dump-dom` branch: when `CXC_VISUALIZER_DOM_CAPTURE` is set, the fixture copies the HTML file named by its file-URL argument to that path before emitting its normal clean result. New test `the SVG probe reads the final filled HTML after a contents refill` uses the existing two-pass contents input (the shape used by "successful two-pass generation promotes only the final candidate"), sets `CXC_VISUALIZER_DOM_CAPTURE`, and asserts that the captured HTML contains the refilled page number that the second pass wrote into the contents entry and the injected measurement script id `cxc-svg-geometry-result-v1`'s producer script, and that `report.passes === 2`.
