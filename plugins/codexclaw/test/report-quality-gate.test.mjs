import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {evaluateReport} from '../skills/dev-visualizer/scripts/quality-gate.mjs';
// Deliberately not imported from the implementation: this is the delivery contract oracle.
const ids=['pdf-parse','text-integrity','font-and-glyphs','pagination','visual-pages','claim-evidence','editorial-review'];
const hash='a'.repeat(64);
const receipt=()=>({artifact_sha256:hash,checks:ids.map(id=>({id,status:'PASS',artifact_sha256:hash,evidence:'review://'+id}))});
test('all seven completed, hash-bound checks pass',()=>assert.equal(evaluateReport(receipt()).verdict,'PASS'));
for(const id of ids) test('missing '+id+' blocks delivery',()=>{const r=receipt();r.checks=r.checks.filter(c=>c.id!==id);assert.equal(evaluateReport(r).exitCode,3);});
for(const status of ['NOT_RUN','BLOCKED','REVIEW','FAIL']) test('propagate '+status,()=>{const r=receipt();r.checks[0].status=status;assert.equal(evaluateReport(r).verdict,status==='NOT_RUN'?'BLOCKED':status);});
for(const input of [null,[],{}, {artifact_sha256:hash,checks:'bad'}]) test('reject bad receipt '+JSON.stringify(input),()=>assert.equal(evaluateReport(input).verdict,'FAIL'));
test('stale PASS receipt cannot certify changed artifact',()=>{const r=receipt();r.checks[0].artifact_sha256='b'.repeat(64);assert.equal(evaluateReport(r).verdict,'FAIL');});
test('evidence locator cannot be empty',()=>{const r=receipt();r.checks[0].evidence=' ';assert.equal(evaluateReport(r).verdict,'BLOCKED');});
test('duplicate check ids fail even when both say PASS',()=>{const r=receipt();r.checks.push({...r.checks[0]});assert.equal(evaluateReport(r).verdict,'FAIL');});
test('legacy notRun survives aggregation',()=>{const r=receipt();r.notRun=['poppler unavailable'];assert.equal(evaluateReport(r).verdict,'BLOCKED');});
test('invalid state is not silently treated as PASS',()=>{const r=receipt();r.checks[0].status='SKIP';assert.equal(evaluateReport(r).verdict,'FAIL');});
test('CLI binds the receipt to bytes on disk',()=>{
  const dir=mkdtempSync(join(tmpdir(),'report-receipt-'));
  try {
    const pdf=join(dir,'report.pdf'),json=join(dir,'qa.json'),bytes=Buffer.from('%PDF-1.7\n%%EOF\n');
    writeFileSync(pdf,bytes);const r=receipt();const actual=createHash('sha256').update(bytes).digest('hex');
    r.artifact_sha256=actual;r.checks.forEach(c=>c.artifact_sha256=actual);writeFileSync(json,JSON.stringify(r));
    const run=()=>spawnSync(process.execPath,[resolve('plugins/codexclaw/skills/dev-visualizer/scripts/quality-gate.mjs'),pdf,json],{encoding:'utf8',timeout:10000});
    assert.equal(run().status,0);writeFileSync(pdf,Buffer.concat([bytes,Buffer.from('changed')]));
    const bad=run();assert.equal(bad.status,1);assert.match(bad.stderr,/actual PDF bytes/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('equivalent uppercase digest is accepted, not treated as a different version',()=>{const r=receipt();r.checks[0].artifact_sha256=hash.toUpperCase();assert.equal(evaluateReport(r).verdict,'PASS');});
test('placeholder evidence cannot satisfy a completed review',()=>{const r=receipt();r.checks[0].evidence='-';assert.equal(evaluateReport(r).verdict,'BLOCKED');});

// Assurance profiles. Reading rendered pages is the expensive half of this gate, so the
// caller states how much assurance the artifact is being given. The oracle below is the
// contract that a cheaper profile may reduce what is REQUIRED and may never turn an
// unexecuted check into a pass, hide an observed defect, or let a draft read as published.
const only=ids=>({artifact_sha256:hash,checks:ids.map(id=>({id,status:'PASS',artifact_sha256:hash,evidence:'review://'+id}))});
const structural=['pdf-parse','text-integrity','pagination'];

test('an unnamed profile is still the full publication receipt',()=>{
  const r=evaluateReport(receipt());
  assert.equal(r.profile,'publication');
  assert.deepEqual(r.omitted,[]);
});
test('draft certifies what it ran without requiring the visual checks',()=>{
  const r=evaluateReport(only(['pdf-parse']),{profile:'draft'});
  assert.equal(r.verdict,'PASS');
  assert.equal(r.exitCode,0);
  assert.equal(r.profile,'draft');
});
test('a draft pass names every publication check it did not run',()=>{
  const r=evaluateReport(only(['pdf-parse']),{profile:'draft'});
  assert.deepEqual(r.omitted,ids.filter(id=>id!=='pdf-parse'));
});
test('standard requires the structural checks and no more',()=>{
  assert.equal(evaluateReport(only(structural),{profile:'standard'}).verdict,'PASS');
  assert.deepEqual(evaluateReport(only(structural),{profile:'standard'}).omitted,ids.filter(id=>!structural.includes(id)));
});
test('standard still blocks when a structural check is absent',()=>{
  const r=evaluateReport(only(structural.filter(id=>id!=='pagination')),{profile:'standard'});
  assert.equal(r.exitCode,3);
});
test('a lighter profile cannot hide an observed defect',()=>{
  const r=only(['pdf-parse']);r.checks.push({id:'visual-pages',status:'FAIL',artifact_sha256:hash,evidence:'review://clipped'});
  assert.equal(evaluateReport(r,{profile:'draft'}).verdict,'FAIL');
});
test('a NOT_RUN check outside the profile is reported omitted, never passed',()=>{
  const r=only(['pdf-parse']);r.checks.push({id:'visual-pages',status:'NOT_RUN'});
  const out=evaluateReport(r,{profile:'draft'});
  assert.equal(out.verdict,'PASS');
  assert.ok(out.omitted.includes('visual-pages'));
});
test('an unknown profile fails instead of falling back to a lighter one',()=>{
  const r=evaluateReport(receipt(),{profile:'quick'});
  assert.equal(r.exitCode,1);
  assert.equal(r.profile,null);
  assert.match(r.findings[0].message,/Unknown assurance profile/);
});
test('the receipt may declare its own profile',()=>{
  const r=only(['pdf-parse']);r.profile='draft';
  assert.equal(evaluateReport(r).verdict,'PASS');
});
test('an explicit argument outranks the profile written into the receipt',()=>{
  const r=only(['pdf-parse']);r.profile='draft';
  assert.equal(evaluateReport(r,{profile:'publication'}).exitCode,3);
});
test('CLI --profile selects the assurance level and rejects an unknown one',()=>{
  const dir=mkdtempSync(join(tmpdir(),'report-profile-'));
  try {
    const pdf=join(dir,'report.pdf'),json=join(dir,'qa.json'),bytes=Buffer.from('%PDF-1.7\n%%EOF\n');
    writeFileSync(pdf,bytes);
    const actual=createHash('sha256').update(bytes).digest('hex');
    const r=only(['pdf-parse']);r.artifact_sha256=actual;r.checks.forEach(c=>c.artifact_sha256=actual);
    writeFileSync(json,JSON.stringify(r));
    const run=(...extra)=>spawnSync(process.execPath,[resolve('plugins/codexclaw/skills/dev-visualizer/scripts/quality-gate.mjs'),pdf,json,...extra],{encoding:'utf8',timeout:10000});
    assert.equal(run().status,3,'the default profile still wants the full receipt');
    const draft=run('--profile','draft');
    assert.equal(draft.status,0);
    assert.equal(JSON.parse(draft.stdout).profile,'draft');
    assert.match(run('--profile','quick').stdout,/Unknown assurance profile/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
