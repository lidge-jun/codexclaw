#!/usr/bin/env bash
# diagram-to-html.sh — Wrap diagram content in a browser-ready HTML file
#
# Usage:
#   diagram-to-html.sh <type> <input-file|-> [output-file]
#
# Types: svg, mermaid, chartjs, echarts, d3, leaflet, threejs, p5, matter, tone, raw
#
# Examples:
#   echo '<svg>...</svg>' | diagram-to-html.sh svg -
#   diagram-to-html.sh mermaid diagram.mmd /tmp/codex-diagrams/out.html
#   diagram-to-html.sh chartjs chart.js
#
# When output-file is omitted, writes to /tmp/codex-diagrams/<type>-<timestamp>-<pid>-<random>.html

set -euo pipefail

TYPE="${1:?Usage: diagram-to-html.sh <type> <input-file|-> [output-file]}"
INPUT="${2:?Usage: diagram-to-html.sh <type> <input-file|-> [output-file]}"
OUTDIR="/tmp/codex-diagrams"
mkdir -p "$OUTDIR"

TIMESTAMP=$(date +%s)
OUTPUT="${3:-$OUTDIR/${TYPE}-${TIMESTAMP}-$$-${RANDOM}.html}"

# Read input
if [ "$INPUT" = "-" ]; then
  CONTENT=$(cat)
else
  CONTENT=$(cat "$INPUT")
fi

# Escape for heredoc safety
# (content is inserted raw into HTML — caller is responsible for safe content)

# --- Base shell ---
BASE_HEAD='<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagram — '"$TYPE"'</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #0f172a; color: #e2e8f0;
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem;
  }
  .container { width: 100%; max-width: 1200px; }
  .error { color: #f87171; padding: 2rem; text-align: center; }
  .theme-toggle {
    position: fixed; top: 12px; right: 12px;
    background: #334155; border: 1px solid #475569; color: #e2e8f0;
    border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; z-index: 999;
  }
  .theme-toggle:hover { background: #475569; }
  body.light { background: #f8fafc; color: #1e293b; }
  body.light .theme-toggle { background: #e2e8f0; border-color: #cbd5e1; color: #1e293b; }
</style>'

BASE_BODY_START='</head>
<body>
<button class="theme-toggle" aria-pressed="false" onclick="document.body.classList.toggle('"'"'light'"'"');this.setAttribute('"'"'aria-pressed'"'"',document.body.classList.contains('"'"'light'"'"'));this.textContent=document.body.classList.contains('"'"'light'"'"')?'"'"'Dark'"'"':'"'"'Light'"'"'">Light</button>
<div class="container">'

BASE_BODY_END='</div>
</body>
</html>'

# --- Type-specific wrappers ---
case "$TYPE" in
  svg)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div style="width:100%;overflow-x:auto;">
${CONTENT}
</div>
${BASE_BODY_END}
HTML
    ;;

  mermaid)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
<style>.mermaid{display:flex;justify-content:center;}.mermaid svg{max-width:100%;height:auto;}</style>
${BASE_BODY_START}
<pre class="mermaid">
${CONTENT}
</pre>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({startOnLoad:true,theme:'dark',securityLevel:'strict',flowchart:{useMaxWidth:true}});
</script>
${BASE_BODY_END}
HTML
    ;;

  chartjs)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div style="position:relative;width:100%;max-width:800px;margin:0 auto;">
<canvas id="chart" role="img" aria-label="Chart">Chart could not be rendered.</canvas>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"
  integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ"
  crossorigin="anonymous"
  onerror="document.getElementById('chart').outerHTML='<p class=error>Chart.js failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  echarts)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div id="echart" role="img" aria-label="Chart" style="width:100%;height:500px;"></div>
<script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"
  integrity="sha384-C2iskrW/uPW46KzOjrvJIQo4YkV8lkD+QS0CrDN18IIPIpT/g2USu8bTP3nvmIAD"
  crossorigin="anonymous"
  onerror="document.getElementById('echart').innerHTML='<p class=error>ECharts failed to load.</p>'"></script>
<script>
const chart=echarts.init(document.getElementById('echart'),'dark');
${CONTENT}
window.addEventListener('resize',()=>chart.resize());
</script>
${BASE_BODY_END}
HTML
    ;;

  d3)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div id="d3-container" role="img" aria-label="D3 visualization" style="width:100%;display:flex;justify-content:center;"></div>
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"
  integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i"
  crossorigin="anonymous"
  onerror="document.getElementById('d3-container').innerHTML='<p class=error>D3 failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  leaflet)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css"
  integrity="sha384-b8ANgTJvdlAnWM5YGMpKn7Kodm+1k7NYNG9zdjTCcZcKatzYHwZ0RLdWarbJJVzU"
  crossorigin="anonymous">
<style>#map{width:100%;height:500px;border-radius:8px;}</style>
${BASE_BODY_START}
<div id="map" role="application" aria-label="Interactive map"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"
  integrity="sha384-u5N8qJeJOO2iqNjIKTdl6KeKsEikMAmCUBPc6sC6uGpgL34aPJ4VgNhuhumedpEk"
  crossorigin="anonymous"
  onerror="document.getElementById('map').innerHTML='<p class=error>Leaflet failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  threejs)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<canvas id="three-canvas" role="img" aria-label="3D scene" style="width:100%;height:500px;display:block;"></canvas>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.185/build/three.module.min.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.185/examples/jsm/"}}</script>
<script type="module">
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  p5)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div id="p5-container" role="img" aria-label="Creative sketch" style="display:flex;justify-content:center;"></div>
<script src="https://cdn.jsdelivr.net/npm/p5@2.3.0/lib/p5.min.js"
  integrity="sha384-/gWbWdv0tDGC/S6D6+vhoiCFH1DLsbn1hEt9XZxpW0rh50fPBB9COWT8EpbZCbtY"
  crossorigin="anonymous"
  onerror="document.getElementById('p5-container').innerHTML='<p class=error>p5.js failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  matter)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<canvas id="matter-canvas" role="img" aria-label="Physics simulation" style="width:100%;height:500px;display:block;"></canvas>
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"
  integrity="sha384-ZRKYEXtLBVeqs9z1WxyeKutCqnkqolS/r1EUWuoUpG4ZKbnRAIXnHhHdnNuiB6CL"
  crossorigin="anonymous"
  onerror="document.getElementById('matter-canvas').outerHTML='<p class=error>Matter.js failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  tone)
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
<div id="tone-container">
<button id="tone-start" style="background:#334155;border:1px solid #475569;color:#e2e8f0;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:15px;margin-bottom:1rem;">Start Audio</button>
<canvas id="tone-viz" role="img" aria-label="Audio visualization" style="width:100%;height:300px;display:block;"></canvas>
</div>
<script src="https://cdn.jsdelivr.net/npm/tone@15.5.27/build/Tone.js"
  integrity="sha384-A0364dGUOl/t1w/Z5dOxwVldvsrsZ4HrSqCx26niOBEFYQ/rqLRCwpADXebUasB2"
  crossorigin="anonymous"
  onerror="document.getElementById('tone-container').innerHTML='<p class=error>Tone.js failed to load.</p>'"></script>
<script>
${CONTENT}
</script>
${BASE_BODY_END}
HTML
    ;;

  raw)
    # Raw HTML — wrap in base shell as-is
    cat > "$OUTPUT" <<HTML
${BASE_HEAD}
${BASE_BODY_START}
${CONTENT}
${BASE_BODY_END}
HTML
    ;;

  *)
    echo "Error: unknown type '$TYPE'" >&2
    echo "Valid types: svg, mermaid, chartjs, echarts, d3, leaflet, threejs, p5, matter, tone, raw" >&2
    exit 1
    ;;
esac

echo "$OUTPUT"
