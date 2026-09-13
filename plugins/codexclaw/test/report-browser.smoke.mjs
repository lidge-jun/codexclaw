/** Explicit optional-browser smoke: node --test plugins/codexclaw/test/report-browser.smoke.mjs
 * Not part of the dependency-free suite. Missing browser/driver fails, never silently skips. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {installedChromium,openReport} from '../skills/dev-visualizer/scripts/report-browser.mjs';
const chromium=await installedChromium();
assert.ok(chromium,'Install/authorize a supported browser separately before running this smoke');
async function fixture(body,run,{root='',...options}={}) {
  const dir=mkdtempSync(join(tmpdir(),'report-browser-'));
  try {
    const input=join(dir,'report.html');writeFileSync(input,`<!doctype html><html ${root}><head><meta charset="utf-8"></head><body>${body}</body></html>`);
    await run({input,dir,options});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('one loaded page retains selected state across TOC printing',()=>fixture(
  '<p data-claim="C1">선택 값: 7</p><p data-source="S1">자료: 시험</p><span data-toc-for="s1"></span><h2 id="s1" data-toc="검증 결과">검증 결과</h2>',async({input,dir})=>{
    const browser=await openReport(chromium,input);
    try {
      assert.equal(browser.structure.readiness.fonts,'loaded');assert.deepEqual(browser.structure.bindings.claims,['C1']);
      await browser.fill([{id:'s1',page:3}]);await browser.print(join(dir,'result.pdf'));
      assert.ok((await browser.html()).includes('선택 값: 7'));assert.ok((await browser.html()).includes('data-toc-for="s1">3<'));
      assert.equal(readFileSync(join(dir,'result.pdf')).subarray(0,5).toString(),'%PDF-');
    } finally {await browser.close();}
  }));
for(const [name,body,expected] of [
  ['false promise','<script>window.__REPORT_READY__=Promise.resolve(false)</script><p>report</p>',/resolved false/],
  ['invalid ready value','<script>window.__REPORT_READY__=42</script><p>report</p>',/must be true or a promise/],
  ['missing image','<p>report</p><img src="does-not-exist.png">',/decode|EncodingError|resource failed/],
  ['page exception','<script>throw new Error("fixture page failure")</script><p>report</p>',/fixture page failure/],
  ['canvas without completion signal','<p>report</p><canvas></canvas>',/canvas report requires/],
  ['forbidden network dependency','<p>report</p><img src="https://example.invalid/image.png">',/decode|EncodingError|resource failed/]
]) test('reject '+name,()=>fixture(body,async({input})=>{await assert.rejects(()=>openReport(chromium,input),expected);}));
test('declared completion promise supports a rendered canvas',()=>fixture('<p>report</p><canvas></canvas><script>window.__REPORT_READY__=Promise.resolve(true)</script>',async({input})=>{
  const browser=await openReport(chromium,input);try {assert.equal(browser.structure.readiness.declared,'promise');} finally {await browser.close();}
}));
