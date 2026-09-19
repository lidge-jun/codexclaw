#!/usr/bin/env node
/** Final-PDF receipt gate. Hashes bind versions, not truth; producers must be trusted.
 * Exit 0 PASS, 1 FAIL, 2 REVIEW, 3 BLOCKED. Never manufactures review evidence. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const REQUIRED=Object.freeze(['pdf-parse','text-integrity','font-and-glyphs','pagination','visual-pages','claim-evidence','editorial-review']);
/** Assurance profiles. The seven-check receipt certifies a published artifact; reading
 * rendered pages costs real time and tokens, and a draft does not earn that cost. The
 * profile is a CHOICE the caller states, never a discovery: an unnamed profile stays
 * 'publication', and a check the profile does not require is reported as omitted rather
 * than silently counted as a pass. A PASS is only ever a pass AT ITS PROFILE. */
export const PROFILES=Object.freeze({
  draft:Object.freeze([]),
  standard:Object.freeze(['pdf-parse','text-integrity','pagination']),
  publication:REQUIRED,
});
export const DEFAULT_PROFILE='publication';
const STATES=new Set(['PASS','FAIL','REVIEW','NOT_RUN','BLOCKED']), HASH=/^[a-f0-9]{64}$/i;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
export function evaluateReport(input, {profile}={}) {
  const findings=[], add=(level,id,message)=>findings.push({level,id,message});
  if(!object(input)||(!nonempty(input.artifact_sha256)||!HASH.test(input.artifact_sha256))||!Array.isArray(input.checks))
    return {verdict:'FAIL',profile:null,omitted:[],exitCode:1,findings:[{level:'FAIL',id:'input',message:'Expected artifact_sha256 and checks array.'}]};
  const selected=profile??input.profile??DEFAULT_PROFILE;
  if(!Object.prototype.hasOwnProperty.call(PROFILES,selected))
    return {verdict:'FAIL',profile:null,omitted:[],exitCode:1,findings:[{level:'FAIL',id:'profile',message:'Unknown assurance profile: '+String(selected)+'. Choose '+Object.keys(PROFILES).join(', ')+'.'}]};
  const required=PROFILES[selected];
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
      if(!nonempty(check.artifact_sha256)||check.artifact_sha256.toLowerCase()!==input.artifact_sha256.toLowerCase()) add('FAIL',check.id,'PASS receipt is not bound to this final artifact.');
      if(!nonempty(check.evidence)||/^(?:-|none|n\/a|not run)$/i.test(check.evidence.trim())) add('BLOCKED',check.id,'PASS needs an evidence locator from the check producer.');
    }
    if(check.status==='FAIL') add('FAIL',check.id,'A check reported a defect.');
    else if(check.status==='REVIEW') add('REVIEW',check.id,'A review finding remains unresolved.');
  }
  for(const id of required) {
    const check=seen.get(id);
    if(!check) add('BLOCKED',id,'Required check is absent.');
    else if(check.status==='NOT_RUN'||check.status==='BLOCKED') add('BLOCKED',id,'Required check has not completed.');
  }
  // Everything the publication receipt would have covered but this profile did not: absent,
  // or present without completing. Named so a lighter verdict cannot be read as the full one.
  const omitted=REQUIRED.filter(id=>!required.includes(id)&&seen.get(id)?.status!=='PASS');
  const verdict=findings.some(f=>f.level==='FAIL')?'FAIL':findings.some(f=>f.level==='BLOCKED')?'BLOCKED':findings.some(f=>f.level==='REVIEW')?'REVIEW':'PASS';
  return {verdict,profile:selected,omitted,exitCode:{PASS:0,FAIL:1,REVIEW:2,BLOCKED:3}[verdict],findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2), flag=args.indexOf('--profile');
    let profile;
    if(flag!==-1) {profile=args[flag+1];if(!nonempty(profile)) throw new Error('--profile needs a value: '+Object.keys(PROFILES).join(', '));args.splice(flag,2);}
    if(args.length!==2) throw new Error('usage: node quality-gate.mjs <final.pdf> <qa.json> [--profile '+Object.keys(PROFILES).join('|')+']');
    const pdf=readFileSync(args[0]);
    if(pdf.subarray(0,5).toString()!=='%PDF-') throw new Error('not a PDF');
    const input=JSON.parse(readFileSync(args[1],'utf8'));
    if(typeof input?.artifact_sha256!=='string'||input.artifact_sha256.toLowerCase()!==createHash('sha256').update(pdf).digest('hex')) throw new Error('receipt does not match actual PDF bytes');
    const result=evaluateReport(input,{profile});console.log(JSON.stringify(result,null,2));process.exitCode=result.exitCode;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
