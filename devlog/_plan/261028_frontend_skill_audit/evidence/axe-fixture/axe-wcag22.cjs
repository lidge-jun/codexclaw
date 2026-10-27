// axe-wcag22.cjs — run: node axe-wcag22.cjs <url-or-file-url>
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(process.argv[2]);
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  console.log(JSON.stringify(r.violations.map(v => ({ id: v.id, nodes: v.nodes.length }))));
  await browser.close();
  process.exit(r.violations.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
