/** Optional installed Playwright adapter; fresh isolated profile, no installation. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function installedChromium() {
  for(const name of ['playwright','playwright-core']) {
    try {return (await import(name)).chromium;}
    catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;}
  }
  return null;
}
/** Keep one page across both passes so selected chart/input state is not reset. */
export async function openReport(chromium,input,{chrome,fontManifest,timeout=30000,allowNetwork=false}={}) {
  const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),timeout});
  const errors=[];
  try {
    const context=await browser.newContext({viewport:{width:1000,height:1400},reducedMotion:'reduce'});
    if(!allowNetwork) await context.route(/^https?:\/\//,route=>route.abort('blockedbyclient'));
    const page=await context.newPage();page.setDefaultTimeout(timeout);
    page.on('pageerror',e=>errors.push('page error: '+e.message));
    page.on('requestfailed',r=>errors.push('resource failed: '+r.url()));
    await page.emulateMedia({media:'print'});
    await page.goto(pathToFileURL(input).href,{waitUntil:'load',timeout});
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}html{font-synthesis:none}'});
    if(fontManifest) await bounded(page.evaluate(async ({faces,roles})=>{
      for(const spec of faces) {
        const face=new FontFace(spec.family,`url(${JSON.stringify(spec.dataUrl)})`,{weight:String(spec.weight),style:spec.style});
        await face.load();document.fonts.add(face);
      }
      if(roles.body) document.documentElement.style.setProperty('--sans',JSON.stringify(roles.body));
      if(roles.heading) document.documentElement.style.setProperty('--serif',JSON.stringify(roles.heading));
    },{faces:fontManifest.faces,roles:fontManifest.roles}),timeout,'required fonts');
    await bounded(page.evaluate(async ()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(image=>image.decode()));
      const ready=document.documentElement.dataset.reportReady;
      if(ready!==undefined&&!['pending','true','false'].includes(ready)) throw new Error('invalid data-report-ready state');
      if(window.__REPORT_READY__!==undefined) {
        const declared=window.__REPORT_READY__;
        if(declared!==true && !(declared&&typeof declared.then==='function')) throw new Error('__REPORT_READY__ must be true or a promise');
        if(await declared===false) throw new Error('report readiness promise resolved false');
      }
      if(ready==='pending') await new Promise(resolve=>{
        const observer=new MutationObserver(()=>{
          if(document.documentElement.dataset.reportReady==='true') {observer.disconnect();resolve();}
        });
        observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-report-ready']});
        if(document.documentElement.dataset.reportReady==='true') {observer.disconnect();resolve();}
      });
      if(document.documentElement.dataset.reportReady==='false') throw new Error('report readiness is false');
      // A renderer may create images after its completion promise resolves.
      await document.fonts.ready;
      await Promise.all([...document.images].map(image=>image.decode()));
    }),timeout,'font/image/chart readiness');
    if(errors.length) throw new Error(errors.join('; '));
    const structure=await page.evaluate(()=>({
      targets:[...document.querySelectorAll('[data-toc]')].map(e=>({id:e.id,text:e.dataset.toc})),
      slots:[...document.querySelectorAll('[data-toc-for]')].map(e=>e.dataset.tocFor),
      bindings:{claims:[...document.querySelectorAll('[data-claim]')].flatMap(e=>e.dataset.claim.split(/\s+/).filter(Boolean)),
        sources:[...document.querySelectorAll('[data-source]')].flatMap(e=>e.dataset.source.split(/\s+/).filter(Boolean))},
      voice:[...document.querySelectorAll('h1,h2,h3,p,figcaption,caption')].map(e=>({id:e.id,text:e.textContent,
        role:e.closest('[data-voice-role]')?.dataset.voiceRole,source:e.closest('[data-source]')?.dataset.source})),
      readiness:{fonts:document.fonts.status,images:document.images.length,
        declared:document.documentElement.dataset.reportReady??(window.__REPORT_READY__!==undefined?'promise':'static')}
    }));
    if(structure.readiness.declared==='static'&&await page.locator('canvas').count())
      throw new Error('canvas report requires data-report-ready or window.__REPORT_READY__');
    return {
      structure,version:browser.version(),
      async print(path) {
        if(errors.length) throw new Error(errors.join('; '));
        await page.pdf({path,format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,tagged:true,outline:true,timeout});
        if(errors.length) throw new Error(errors.join('; '));
        if(readFileSync(path).subarray(0,5).toString()!=='%PDF-') throw new Error('browser returned no PDF');
      },
      async fill(entries) {
        await page.evaluate(entries=>{
          for(const entry of entries) for(const e of document.querySelectorAll('[data-toc-for]'))
            if(e.dataset.tocFor===entry.id) e.textContent=String(entry.page);
        },entries);
      },
      html:()=>page.content(),close:()=>browser.close()
    };
  } catch(error) {await browser.close();throw error;}
}
async function bounded(promise,timeout,label) {
  let timer;
  try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),timeout);})]);}
  finally {clearTimeout(timer);}
}
