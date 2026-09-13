/** Poppler boundaries and conservative text-only diagnostics; visual review stays separate. */
import {spawnSync} from 'node:child_process';
import {accessSync,constants} from 'node:fs';
import {delimiter,join,basename} from 'node:path';
export function findExecutable(name) {
  const candidates=name.includes('/')||name.includes('\\')?[name]:(process.env.PATH??'').split(delimiter).filter(Boolean)
    .flatMap(dir=>(process.platform==='win32'?['','.exe']:['']).map(ext=>join(dir,name+ext)));
  return candidates.find(path=>{try {accessSync(path,constants.X_OK);return true;} catch {return false;}})??null;
}
export function runTool(command,args) {
  const r=spawnSync(command,args,{encoding:'utf8',timeout:30000,maxBuffer:32*1024*1024});
  if(r.error||r.status!==0) throw new Error(basename(command)+' failed: '+(r.error?.message||r.stderr||'exit '+r.status).slice(-600));
  return r.stdout;
}
export function parsePdfInfo(stdout) {
  const n=/Pages:\s+(\d+)/.exec(stdout),s=/Page size:\s+([\d.]+) x ([\d.]+) pts(?: \(([^)]+)\))?/.exec(stdout);
  if(!n||Number(n[1])<1||!s||!Number.isFinite(Number(s[1]))||!Number.isFinite(Number(s[2]))||Number(s[1])<=0||Number(s[2])<=0)
    throw new Error('pdfinfo returned invalid page metadata');
  return {pages:Number(n[1]),size:{w:Number(s[1]),h:Number(s[2]),name:s[3]??null}};
}
export function inspectPdf(pdf,tools) {
  const info=parsePdfInfo(runTool(tools.pdfinfo,[pdf]));
  const texts=Array.from({length:info.pages},(_,i)=>runTool(tools.pdftotext,['-f',String(i+1),'-l',String(i+1),'-layout',pdf,'-']));
  if(texts.every(t=>!t.trim())) throw new Error('PDF has no extractable report text');
  return {...info,texts};
}
const norm=s=>s.normalize('NFC').replace(/\s+/g,'').replace(/[–—-]/g,'-');
/** Full-title matching. Ambiguous targets fail instead of guessing a page. */
export function resolveToc(targets,slots,texts) {
  const qa=[],toc=[],ids=new Set(),titles=new Set();
  const problem=(id,msg)=>qa.push({level:'P0',id,page:null,msg});
  const contents=texts.findIndex(t=>t.split('\n').some(l=>/^(목차|contents|table of contents)$/i.test(l.trim())));
  if(targets.length&&contents<0) problem('toc','No explicit contents page found');
  for(const target of targets) {
    if(!target.id||!target.text?.trim()||ids.has(target.id)||titles.has(norm(target.text))) {problem(target.id,'Empty or duplicate contents target/title');continue;}
    ids.add(target.id);titles.add(norm(target.text));
    if(!slots.includes(target.id)) problem(target.id,'Missing contents slot');
    const matches=[];
    if(contents>=0) texts.forEach((t,i)=>{if(i>contents&&norm(t).includes(norm(target.text))) matches.push(i+1);});
    if(matches.length!==1) problem(target.id,matches.length?'Ambiguous contents target':'Unresolved contents target');
    toc.push({...target,page:matches.length===1?matches[0]:null});
  }
  for(const id of slots) if(!ids.has(id)) problem(id,'Unbound contents slot');
  return {qa,toc};
}
export function parsePdfFonts(stdout) {
  return stdout.split('\n').slice(2).filter(l=>l.trim()).map(line=>{
    const p=line.trim().split(/\s+/);
    if(p.length<8) throw new Error('invalid pdffonts output');
    return {name:p[0].replace(/^[A-Z]{6}\+/,''),embedded:p.at(-5)==='yes',unicode:p.at(-3)==='yes'};
  });
}
export function checkPdfFonts(pdf,pdffonts,manifest) {
  const fonts=parsePdfFonts(runTool(pdffonts,[pdf])),qa=[];
  if(!fonts.length) qa.push({level:'P0',msg:'No PDF fonts were identified'});
  for(const font of fonts) if(!font.embedded) qa.push({level:'P0',msg:'Unembedded PDF font: '+font.name});
  if(manifest) {
    const expected=new Set(manifest.metadata.map(f=>f.postscriptName)),actual=new Set(fonts.map(f=>f.name));
    for(const name of expected) if(!actual.has(name)) qa.push({level:'P0',msg:'Required font was not used in PDF: '+name});
    for(const name of actual) if(!expected.has(name)) qa.push({level:'P0',msg:'Unpinned fallback font used in PDF: '+name});
  }
  return {fonts,qa};
}
export function layoutFindings(pdf,info,tools) {
  const qa=[];
  if(Math.abs(info.size.w-595)>2||Math.abs(info.size.h-842)>2) qa.push({level:'P2',page:null,msg:'Non-A4 page size; confirm recipient standard'});
  info.texts.forEach((text,i)=>{
    if(i===0) return;
    const page=i+1,lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!/\d+(?:\s*\/\s*\d+)?$/.test(lines.at(-1)??'')) qa.push({level:'P1',page,msg:'No page number detected at bottom'});
    const first=lines[0]??'';
    if(first.length<=30&&/[.。!?]$/.test(first)&&!/^\d|부록|요약|Appendix|Summary/.test(first))
      qa.push({level:'P2',page,msg:'Possible orphan fragment at page top: '+first});
    const tail=lines.at(-2)??'';
    if(/^\d+\s+\S/.test(tail)&&tail.length<60&&lines.length>3)
      qa.push({level:'P2',page,msg:'Possible stranded heading at page bottom: '+tail});
    if(page>3&&lines.length<10) qa.push({level:'P2',page,msg:'Low text density; inspect page role, charts and whitespace'});
    if(page<info.pages&&!lines.some(l=>/^(목차|contents|table of contents)$/i.test(l))) {
      const bbox=runTool(tools.pdftotext,['-f',String(page),'-l',String(page),'-bbox',pdf,'-']);
      const ys=[...bbox.matchAll(/<word[^>]*yMin="([\d.]+)"[^>]*yMax="([\d.]+)"/g)]
        .map(m=>({top:Number(m[1]),bottom:Number(m[2])})).filter(w=>w.bottom<info.size.h-46);
      if(ys.length) {
        const bottom=Math.max(...ys.map(w=>w.bottom)),top=Math.min(...ys.map(w=>w.top));
        const fraction=(info.size.h-62-bottom)/(info.size.h-62-top);
        if(fraction>=0.3) qa.push({level:'P2',page,msg:Math.round(fraction*100)+'% below last text; review with page image, not as a density requirement'});
      }
    }
  });
  return qa;
}
export function automatedVerdict(report) {
  if(report.qa.some(q=>q.level==='P0')) return 'FAIL';
  if(report.notRun.length) return 'BLOCKED';
  return report.qa.length?'REVIEW':'PASS';
}
