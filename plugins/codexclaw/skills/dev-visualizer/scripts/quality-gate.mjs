#!/usr/bin/env node
/** Final-PDF receipt gate. Hashes bind versions, not truth; producers must be trusted.
 * Exit 0 PASS, 1 FAIL, 2 REVIEW, 3 BLOCKED. Never manufactures review evidence. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const REQUIRED=Object.freeze(['pdf-parse','text-integrity','font-and-glyphs','pagination','visual-pages','claim-evidence','editorial-review']);
const STATES=new Set(['PASS','FAIL','REVIEW','NOT_RUN','BLOCKED']), HASH=/^[a-f0-9]{64}$/i;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
export function evaluateReport(input) {
  const findings=[], add=(level,id,message)=>findings.push({level,id,message});
  if(!object(input)||!HASH.test(input.artifact_sha256??'')||!Array.isArray(input.checks))
    return {verdict:'FAIL',exitCode:1,findings:[{level:'FAIL',id:'input',message:'Expected artifact_sha256 and checks array.'}]};
  if(input.notRun!==undefined) {
    if(!Array.isArray(input.notRun)) add('FAIL','legacy-notRun','notRun must be an array.');
    else if(input.notRun.length) add('BLOCKED','legacy-notRun','Unresolved legacy NOT RUN findings.');
  }
  const seen=new Map();
  for(const check of input.checks) {
    if(!object(check)||!nonempty(check.id)||!STATES.has(check.status)) {add('FAIL','schema','Each check needs a non-empty id and recognized status.');continue;}
    if(seen.has(check.id)) {add('FAIL',check.id,'Duplicate check IDs are ambiguous.');continue;}
    seen.set(check.id,check);
    if(check.status==='PASS') {
      if(check.artifact_sha256!==input.artifact_sha256) add('FAIL',check.id,'PASS receipt is not bound to this final artifact.');
      if(!nonempty(check.evidence)) add('BLOCKED',check.id,'PASS needs an evidence locator from the check producer.');
    }
    if(check.status==='FAIL') add('FAIL',check.id,'A check reported a defect.');
    else if(check.status==='REVIEW') add('REVIEW',check.id,'A review finding remains unresolved.');
  }
  for(const id of REQUIRED) {
    const check=seen.get(id);
    if(!check) add('BLOCKED',id,'Required check is absent.');
    else if(check.status==='NOT_RUN'||check.status==='BLOCKED') add('BLOCKED',id,'Required check has not completed.');
  }
  const verdict=findings.some(f=>f.level==='FAIL')?'FAIL':findings.some(f=>f.level==='BLOCKED')?'BLOCKED':findings.some(f=>f.level==='REVIEW')?'REVIEW':'PASS';
  return {verdict,exitCode:{PASS:0,FAIL:1,REVIEW:2,BLOCKED:3}[verdict],findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if(process.argv.length!==4) throw new Error('usage: node quality-gate.mjs <final.pdf> <qa.json>');
    const pdf=readFileSync(process.argv[2]);
    if(pdf.subarray(0,5).toString()!=='%PDF-') throw new Error('not a PDF');
    const input=JSON.parse(readFileSync(process.argv[3],'utf8'));
    if(input?.artifact_sha256!==createHash('sha256').update(pdf).digest('hex')) throw new Error('receipt does not match actual PDF bytes');
    const result=evaluateReport(input);console.log(JSON.stringify(result,null,2));process.exitCode=result.exitCode;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
