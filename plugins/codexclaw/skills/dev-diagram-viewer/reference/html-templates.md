# HTML Wrapper Templates

Self-contained HTML templates for rendering diagrams in the browser.
Every template follows these invariants:

- **Dark theme default**: `background: #0f172a; color: #e2e8f0`
- **Responsive**: viewport meta + fluid layout
- **CDN-only**: no local dependencies, all loaded from jsdelivr
- **Error fallback**: `onerror` handlers on every `<script>` tag
- **Zero-config**: opens in any browser with no server

CDN assets that use subresource integrity (SRI) are pinned to exact versions.
Regenerate each `sha384` hash whenever a CDN URL or its content changes; major-version
ranges such as `@4` are not reliable with SRI because they can resolve to new bytes.

## Base Shell

Every diagram HTML file starts with this shell. Replace `{{TITLE}}` and
`{{CONTENT}}` with the specific diagram content.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .container {
    width: 100%;
    max-width: 1200px;
  }
  .error {
    color: #f87171;
    padding: 2rem;
    text-align: center;
    font-size: 1.1rem;
  }
  /* Theme toggle */
  .theme-toggle {
    position: fixed;
    top: 12px;
    right: 12px;
    background: #334155;
    border: 1px solid #475569;
    color: #e2e8f0;
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    z-index: 999;
  }
  .theme-toggle:hover { background: #475569; }
  body.light {
    background: #f8fafc;
    color: #1e293b;
  }
  body.light .theme-toggle {
    background: #e2e8f0;
    border-color: #cbd5e1;
    color: #1e293b;
  }
</style>
</head>
<body>
<button class="theme-toggle" aria-pressed="false" onclick="document.body.classList.toggle('light'); this.setAttribute('aria-pressed', document.body.classList.contains('light')); this.textContent = document.body.classList.contains('light') ? 'Dark' : 'Light'">Light</button>
<div class="container">
  {{CONTENT}}
</div>
</body>
</html>
```

## Template 1: Inline SVG

Wrap raw SVG markup in the base shell. No external dependencies needed.

```html
<!-- {{CONTENT}} replacement -->
<div style="width: 100%; overflow-x: auto;">
  <!-- Paste the <svg viewBox="..."> markup here -->
  <svg viewBox="0 0 680 400" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-labelledby="svg-title">
    <title id="svg-title">Diagram Title</title>
    <!-- SVG content -->
  </svg>
</div>
```

**Notes:**
- SVG `viewBox` width 680 matches cli-jaw convention but can be adjusted
- The container provides horizontal scroll on narrow viewports
- SVG inherits body text color; use explicit fills for colored elements
- For dark/light theme awareness, use CSS classes:

```html
<style>
  .svg-node { fill: #67e8f9; stroke: #06b6d4; stroke-width: 0.5px; }
  .svg-text { fill: #e2e8f0; font-size: 14px; }
  body.light .svg-node { fill: #0891b2; stroke: #0e7490; }
  body.light .svg-text { fill: #1e293b; }
</style>
```

## Template 2: Mermaid

For environments where mermaid is not natively rendered (CLI terminal, etc.).

```html
<!-- Add before </head> -->
<style>
  .mermaid { display: flex; justify-content: center; }
  .mermaid svg { max-width: 100%; height: auto; }
</style>

<!-- {{CONTENT}} replacement -->
<pre class="mermaid">
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Skip]
</pre>

<!-- Add before </body> -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  const isDark = !document.body.classList.contains('light');
  mermaid.initialize({
    startOnLoad: true,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict',
    flowchart: { useMaxWidth: true, htmlLabels: true },
  });
</script>
```

**Theme toggle integration:**
When the user toggles light/dark, re-render mermaid:

```js
document.querySelector('.theme-toggle').addEventListener('click', async () => {
  const isDark = !document.body.classList.contains('light');
  mermaid.initialize({ theme: isDark ? 'dark' : 'default' });
  document.querySelectorAll('.mermaid').forEach(el => {
    el.removeAttribute('data-processed');
    el.innerHTML = el.getAttribute('data-original') || el.textContent;
  });
  await mermaid.run();
});
// Save original content on first load
document.querySelectorAll('.mermaid').forEach(el => {
  el.setAttribute('data-original', el.textContent);
});
```

## Template 3: Chart.js

Bar, line, pie, scatter, doughnut, polar area charts.

```html
<!-- {{CONTENT}} replacement -->
<div style="position: relative; width: 100%; max-width: 800px; margin: 0 auto;">
  <canvas id="chart" role="img" aria-label="Chart description">
    Chart could not be rendered.
  </canvas>
</div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"
  integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ"
  crossorigin="anonymous"
  onerror="document.getElementById('chart').outerHTML='<p class=error>Chart.js failed to load.</p>'">
</script>
<script>
  const isDark = !document.body.classList.contains('light');
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  let chart = new Chart(document.getElementById('chart'), {
    type: 'bar', // or: line, pie, doughnut, scatter, polarArea, radar
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{
        label: 'Series 1',
        data: [12, 19, 3, 5],
        backgroundColor: ['#67e8f9', '#f0abfc', '#86efac', '#fbbf24'],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: textColor } },
        title: { display: true, text: 'Chart Title', color: textColor },
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      }
    }
  });

  // After theme toggle click:
  // chart.destroy();
  // Recreate chart with new colors.
</script>
```

## Template 4: ECharts

Heatmap, sankey, radar, treemap, gauge, funnel, candlestick, chord.

```html
<!-- {{CONTENT}} replacement -->
<div id="echart" role="img" aria-label="Chart" style="width: 100%; height: 500px;"></div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"
  integrity="sha384-C2iskrW/uPW46KzOjrvJIQo4YkV8lkD+QS0CrDN18IIPIpT/g2USu8bTP3nvmIAD"
  crossorigin="anonymous"
  onerror="document.getElementById('echart').innerHTML='<p class=error>ECharts failed to load.</p>'">
</script>
<script>
  const isDark = !document.body.classList.contains('light');
  const container = document.getElementById('echart');
  let chart = echarts.init(container, isDark ? 'dark' : null);

  const option = {
    // ECharts option object
    title: { text: 'Chart Title', textStyle: { color: isDark ? '#e2e8f0' : '#1e293b' } },
    tooltip: {},
    series: [{
      type: 'bar', // or: heatmap, sankey, treemap, gauge, funnel, pie, radar
      data: [120, 200, 150, 80],
    }],
    xAxis: { type: 'category', data: ['A', 'B', 'C', 'D'] },
    yAxis: { type: 'value' },
  };
  chart.setOption(option);

  window.addEventListener('resize', () => chart.resize());

  // After theme toggle:
  // chart.dispose();
  // chart = echarts.init(container, isDark ? 'dark' : null);
  // chart.setOption(option);
</script>
```

## Template 5: D3.js

Custom data visualizations, force graphs, choropleth maps.

```html
<!-- {{CONTENT}} replacement -->
<div id="d3-container" role="img" aria-label="D3 visualization" style="width: 100%; display: flex; justify-content: center;"></div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"
  integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i"
  crossorigin="anonymous"
  onerror="document.getElementById('d3-container').innerHTML='<p class=error>D3.js failed to load.</p>'">
</script>
<script>
  const isDark = !document.body.classList.contains('light');
  const width = 800, height = 500;
  const svg = d3.select('#d3-container')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // D3 visualization code here
  // Use isDark for theme-aware colors
</script>
```

**For choropleth/geo maps with D3 + TopoJSON:**

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"
  integrity="sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i"
  crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"
  integrity="sha384-Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67"
  crossorigin="anonymous"></script>
```

## Template 6: Leaflet Map

Interactive maps with markers, popups, tiles.

```html
<!-- Add to <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css"
  integrity="sha384-b8ANgTJvdlAnWM5YGMpKn7Kodm+1k7NYNG9zdjTCcZcKatzYHwZ0RLdWarbJJVzU"
  crossorigin="anonymous">
<style>
  #map { width: 100%; height: 500px; border-radius: 8px; }
</style>

<!-- {{CONTENT}} replacement -->
<div id="map" role="application" aria-label="Interactive map"></div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"
  integrity="sha384-u5N8qJeJOO2iqNjIKTdl6KeKsEikMAmCUBPc6sC6uGpgL34aPJ4VgNhuhumedpEk"
  crossorigin="anonymous"
  onerror="document.getElementById('map').innerHTML='<p class=error>Leaflet failed to load.</p>'">
</script>
<script>
  const isDark = !document.body.classList.contains('light');
  const map = L.map('map').setView([37.5665, 126.9780], 12); // Seoul default

  // Dark tile layer
  const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const lightTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  L.tileLayer(isDark ? darkTiles : lightTiles, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  // Add markers
  L.marker([37.5665, 126.9780])
    .addTo(map)
    .bindPopup('<b>Seoul</b><br>Capital of South Korea');
</script>
```

## Template 7: Three.js (3D)

3D scenes, models, data visualizations.

```html
<!-- {{CONTENT}} replacement -->
<canvas id="three-canvas" role="img" aria-label="3D scene" style="width: 100%; height: 500px; display: block;"></canvas>

<!-- Add before </body> -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185/build/three.module.min.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185/examples/jsm/"
  }
}
</script>
<script type="module">
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  const canvas = document.getElementById('three-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(3, 3, 3);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  // Lighting
  scene.add(new THREE.AmbientLight(0x404040));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  // Content here (meshes, geometries, etc.)

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  });
</script>
```

## Template 8: p5.js (Creative Coding)

Generative art, simulations, interactive sketches.

> p5.js 2.x uses Promise-based loading with `async setup()` and `await`
> instead of the old `preload()` lifecycle.

```html
<!-- {{CONTENT}} replacement -->
<div id="p5-container" role="img" aria-label="Creative sketch" style="display: flex; justify-content: center;"></div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/p5@2.3.0/lib/p5.min.js"
  integrity="sha384-/gWbWdv0tDGC/S6D6+vhoiCFH1DLsbn1hEt9XZxpW0rh50fPBB9COWT8EpbZCbtY"
  crossorigin="anonymous"
  onerror="document.getElementById('p5-container').innerHTML='<p class=error>p5.js failed to load.</p>'">
</script>
<script>
  const isDark = !document.body.classList.contains('light');

  const sketch = (p) => {
    p.setup = async () => {
      // p5.js 2.x asset loaders return Promises:
      // const texture = await p.loadImage('data:image/png;base64,...');
      const canvas = p.createCanvas(800, 500);
      canvas.parent('p5-container');
      p.background(isDark ? 15 : 248);
    };
    p.draw = () => {
      // p5 drawing code here
    };
  };

  new p5(sketch);
</script>
```

## Template 9: Matter.js (Physics Simulation)

Physics simulations, interactive demos.

```html
<!-- {{CONTENT}} replacement -->
<canvas id="matter-canvas" role="img" aria-label="Physics simulation" style="width: 100%; height: 500px; display: block;"></canvas>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"
  integrity="sha384-ZRKYEXtLBVeqs9z1WxyeKutCqnkqolS/r1EUWuoUpG4ZKbnRAIXnHhHdnNuiB6CL"
  crossorigin="anonymous"
  onerror="document.getElementById('matter-canvas').innerHTML='<p class=error>Matter.js failed to load.</p>'">
</script>
<script>
  const { Engine, Render, World, Bodies, Runner } = Matter;
  const canvas = document.getElementById('matter-canvas');
  const isDark = !document.body.classList.contains('light');

  const engine = Engine.create();
  const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: canvas.clientWidth,
      height: 500,
      wireframes: false,
      background: isDark ? '#0f172a' : '#f8fafc',
    }
  });

  // Add bodies
  const ground = Bodies.rectangle(400, 490, 800, 20, { isStatic: true });
  World.add(engine.world, [ground]);

  // Content: add more bodies here

  Render.run(render);
  Runner.run(Runner.create(), engine);
</script>
```

## Template 10: Tone.js (Audio Visualization)

Audio synthesis + visualization combos.

```html
<!-- {{CONTENT}} replacement -->
<div id="tone-container">
  <button id="tone-start" style="
    background: #334155; border: 1px solid #475569; color: #e2e8f0;
    padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 15px;
    margin-bottom: 1rem;
  ">Start Audio</button>
  <canvas id="tone-viz" role="img" aria-label="Audio visualization" style="width: 100%; height: 300px; display: block;"></canvas>
</div>

<!-- Add before </body> -->
<script src="https://cdn.jsdelivr.net/npm/tone@15.5.27/build/Tone.js"
  integrity="sha384-A0364dGUOl/t1w/Z5dOxwVldvsrsZ4HrSqCx26niOBEFYQ/rqLRCwpADXebUasB2"
  crossorigin="anonymous"
  onerror="document.getElementById('tone-container').innerHTML='<p class=error>Tone.js failed to load.</p>'">
</script>
<script>
  document.getElementById('tone-start').addEventListener('click', async () => {
    await Tone.start();
    // Audio code here
  });
</script>
```

**Note:** Browsers require a user gesture (click) before audio can play.
Always include a start button.

## Template 11: Interactive Controls (Sliders, Toggles)

For diagrams with user-adjustable parameters.

```html
<!-- {{CONTENT}} replacement -->
<div class="controls" style="
  display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;
  padding: 1rem; background: #1e293b; border-radius: 8px;
">
  <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
    Speed
    <input type="range" id="speed" min="1" max="100" value="50"
      style="accent-color: #67e8f9;">
    <span id="speed-val">50</span>
  </label>
  <label style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
    <input type="checkbox" id="toggle" checked style="accent-color: #67e8f9;">
    Enable feature
  </label>
</div>
<div id="viz" style="width: 100%; height: 400px;"></div>

<script>
  const speedSlider = document.getElementById('speed');
  const speedVal = document.getElementById('speed-val');
  speedSlider.addEventListener('input', () => {
    speedVal.textContent = speedSlider.value;
    // Update visualization
  });
</script>
```

**Light theme support for controls:**

```css
body.light .controls { background: #e2e8f0; }
```

## Combining Templates

Multiple diagram types can coexist in one HTML file. Load all needed CDN
scripts and place each diagram in its own `<section>`:

```html
<section style="margin-bottom: 2rem;">
  <h2 style="font-size: 1.2rem; margin-bottom: 1rem;">Architecture</h2>
  <pre class="mermaid">...</pre>
</section>
<section>
  <h2 style="font-size: 1.2rem; margin-bottom: 1rem;">Performance</h2>
  <canvas id="chart"></canvas>
</section>
```

## Color Palette (cli-jaw compatible)

These colors work in both light and dark mode:

| Name | Dark fill | Dark stroke | Light fill | Light stroke | Use |
|---|---|---|---|---|---|
| cyan | `#67e8f9` | `#06b6d4` | `#0891b2` | `#0e7490` | General / info |
| pink | `#f0abfc` | `#c026d3` | `#d946ef` | `#a21caf` | Highlight |
| green | `#86efac` | `#16a34a` | `#22c55e` | `#15803d` | Success |
| amber | `#fbbf24` | `#d97706` | `#f59e0b` | `#b45309` | Warning |
| red | `#f87171` | `#dc2626` | `#ef4444` | `#b91c1c` | Error |
| purple | `#c4b5fd` | `#7c3aed` | `#8b5cf6` | `#6d28d9` | Grouping |
| orange | `#fb923c` | `#ea580c` | `#f97316` | `#c2410c` | Accent |
| slate | `#94a3b8` | `#475569` | `#64748b` | `#334155` | Neutral |
| blue | `#93c5fd` | `#2563eb` | `#3b82f6` | `#1d4ed8` | Informational |
