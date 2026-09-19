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
