#!/usr/bin/env node
/** Trusted local HTML -> PDF. Automated PASS is not a delivery certificate.
 * Exit 0 automated PASS, 1 FAIL, 2 REVIEW, 3 BLOCKED. No dependency installation.
 * Optional installed Playwright verifies readiness; CLI fallback is an unverified draft.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,statSync,realpathSync,renameSync,unlinkSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFontManifest,sha256} from './report-fonts.mjs';
import {installedChromium,openReport} from './report-browser.mjs';
import {validateClaims,validateBindings,reviewVoice} from './report-contract.mjs';
import {findExecutable,inspectPdf,resolveToc,checkPdfFonts,layoutFindings,automatedVerdict} from './report-pdf-tools.mjs';

const usage='usage: export-paged-report.mjs <in.html> <out.pdf> [--chrome <path>] [--engine auto|playwright|chromium-cli] [--font-manifest <json>] [--contract <json>] [--allow-network] [--keep-html] [--json]\n       export-paged-report.mjs --qa-only <pdf> [--font-manifest <json>] [--json]';
function parseArgs(args) {
  const flags={chrome:process.env.CHROME_PATH||'',engine:'auto',json:false,keepHtml:false,qaOnly:false,allowNetwork:false},positions=[];
  const values={'--chrome':'chrome','--engine':'engine','--font-manifest':'fontManifest','--contract':'contract'};
  const booleans={'--json':'json','--keep-html':'keepHtml','--qa-only':'qaOnly','--allow-network':'allowNetwork'};
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(Object.hasOwn(values,arg)) {if(!args[i+1]||args[i+1].startsWith('--')) throw new Error(arg+' requires a path or value');flags[values[arg]]=args[++i];}
    else if(Object.hasOwn(booleans,arg)) flags[booleans[arg]]=true;
    else if(arg.startsWith('--')) throw new Error('unknown option: '+arg);
    else positions.push(arg);
  }
  if(positions.length!==(flags.qaOnly?1:2)) throw new Error(usage);
  if(!['auto','playwright','chromium-cli'].includes(flags.engine)) throw new Error('unknown engine');
  if(flags.qaOnly&&(flags.contract||flags.keepHtml||flags.allowNetwork||flags.engine!=='auto')) throw new Error('--qa-only cannot run HTML/engine options');
  return {...flags,input:resolve(positions[0]),output:resolve(positions[flags.qaOnly?0:1])};
}
function chromePath(explicit) {
  if(explicit) {const path=findExecutable(explicit);if(!path) throw new Error('requested Chrome executable is absent');return path;}
  return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium','google-chrome','google-chrome-stable','chromium','chromium-browser',
    ...(process.platform==='win32'?[join(process.env.PROGRAMFILES??'','Google/Chrome/Application/chrome.exe')]:[])]
    .map(findExecutable).find(Boolean);
}
async function main() {
  const report={scope:'automated-pdf-checks',deliveryReady:false,passes:0,toc:[],qa:[],notRun:[]};
  let flags,browser,staged;
  try {
    flags=parseArgs(process.argv.slice(2));
    const {input,output}=flags;Object.assign(report,{input,output});
    if(!existsSync(input)||!statSync(input).isFile()) throw new Error('input file not found');
    if(!flags.qaOnly) for(const source of [input,flags.fontManifest,flags.contract].filter(Boolean)) {
      if(resolve(source)===output||(existsSync(output)&&realpathSync(source)===realpathSync(output)))
        throw new Error('input and output paths must differ; cannot overwrite a source or manifest');
    }
    const tools={pdfinfo:findExecutable('pdfinfo'),pdftotext:findExecutable('pdftotext'),pdffonts:findExecutable('pdffonts')};
    const manifest=flags.fontManifest?loadFontManifest(resolve(flags.fontManifest)):null;
    if(manifest) report.fontManifest={sha256:manifest.manifestSha256,faces:manifest.metadata,roles:manifest.roles};
    let model;
    if(flags.contract) {
      const bytes=readFileSync(flags.contract);model=JSON.parse(bytes.toString());
      report.contractSha256=sha256(bytes);report.qa.push(...validateClaims(model));
      if(report.qa.length) return finish(report,flags);
    }
    let structure={targets:[],slots:[]};
    if(!flags.qaOnly) {
      report.inputSha256=sha256(readFileSync(input));
      const chromium=flags.engine==='chromium-cli'?null:await installedChromium();
      if(!chromium&&flags.engine==='playwright') {report.notRun.push('Playwright not installed; no installation attempted');return finish(report,flags);}
      const chrome=chromePath(flags.chrome);
      staged=join(dirname(output),'.'+basename(output)+'.'+randomUUID()+'.pdf');
      if(chromium) {
        browser=await openReport(chromium,input,{chrome,fontManifest:manifest,allowNetwork:flags.allowNetwork});
        structure=browser.structure;
        Object.assign(report,{engine:'playwright',rendererVersion:browser.version,readiness:structure.readiness});
        if(model) report.qa.push(...validateBindings(model,structure.bindings));
        report.qa.push(...reviewVoice(structure.voice));
        await browser.print(staged);
      } else {
        report.engine='chromium-cli';
        report.notRun.push('Explicit font/image/chart readiness and DOM/TOC inspection not run in Chromium CLI fallback');
        if(manifest||model) throw new Error('font manifest and report contract require the installed Playwright adapter');
        if(!chrome) throw new Error('no Chromium executable; provide --chrome');
        const profile=mkdtempSync(join(tmpdir(),'cxc-report-chrome-'));
        try {
          const r=spawnSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-pdf-header-footer','--virtual-time-budget=10000',
            '--print-to-pdf='+staged,pathToFileURL(input).href],{encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
          if(r.error||r.status!==0) throw new Error('Chrome print failed: '+(r.error?.message||r.stderr));
        } finally {rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
      }
      if(!existsSync(staged)||readFileSync(staged).subarray(0,5).toString()!=='%PDF-') throw new Error('no fresh PDF was generated');
      report.passes=1;
    }
    const candidate=staged??output;
    if(!tools.pdfinfo||!tools.pdftotext) report.notRun.push('pdftotext/pdfinfo missing: contents page numbers and layout QA NOT RUN');
    else {
      let info=inspectPdf(candidate,tools);
      if(structure.targets.length||structure.slots.length) {
        const first=resolveToc(structure.targets,structure.slots,info.texts);
        report.toc=first.toc;report.qa.push(...first.qa);
        if(!first.qa.length) {
          await browser.fill(first.toc);await browser.print(candidate);report.passes=2;
          info=inspectPdf(candidate,tools);
          const second=resolveToc(structure.targets,structure.slots,info.texts);report.qa.push(...second.qa);
          for(const entry of first.toc) if(second.toc.find(t=>t.id===entry.id)?.page!==entry.page)
            report.qa.push({level:'P0',id:entry.id,msg:'Contents page number drifted after refill'});
        }
      }
      report.pages=info.pages;report.pageSize=info.size;report.qa.push(...layoutFindings(candidate,info,tools));
      if(tools.pdffonts) {const fontQA=checkPdfFonts(candidate,tools.pdffonts,manifest);report.fonts=fontQA.fonts;report.qa.push(...fontQA.qa);}
      else if(manifest) report.notRun.push('pdffonts missing: required face/embedding verification NOT RUN');
    }
    if(flags.keepHtml&&browser) {
      const path=join(dirname(output),'.'+basename(input,'.html')+'.toc-pass.html');
      // Diagnostic snapshot only; FontFace bytes/current canvas pixels are not serialized.
      const base='<base href="'+pathToFileURL(dirname(input)+'/').href+'">';
      const html=(await browser.html()).replace(/<head>/i,'<head>'+base);
      writeFileSync(path,html,{flag:'wx'});report.filledHtml=path;
    }
    if(staged) {renameSync(staged,output);staged=null;}
    report.artifact_sha256=sha256(readFileSync(output));return finish(report,flags);
  } catch(error) {
    report.qa.push({level:'P0',id:'export',msg:error.message});return finish(report,flags??{json:process.argv.includes('--json')});
  } finally {
    if(browser) await browser.close();
    if(staged&&existsSync(staged)) unlinkSync(staged);
  }
}
function finish(report,flags) {
  report.verdict=automatedVerdict(report);
  if(flags.json) console.log(JSON.stringify(report,null,2));
  else {
    console.log('export-paged-report: '+(report.output??''));
    for(const finding of report.qa) console.error(finding.level+' '+(finding.id??'page '+finding.page)+': '+finding.msg);
    for(const missing of report.notRun) console.error('NOT RUN: '+missing);
    console.log('automated verdict: '+report.verdict+'; final delivery requires quality-gate.mjs receipts');
  }
  process.exitCode={PASS:0,FAIL:1,REVIEW:2,BLOCKED:3}[report.verdict];return report;
}
await main();
