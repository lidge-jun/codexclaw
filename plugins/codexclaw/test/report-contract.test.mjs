import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateClaims,validateBindings,reviewVoice} from '../skills/dev-visualizer/scripts/report-contract.mjs';
const model=()=>({schemaVersion:1,audience:'Maintainer',question:'Does QA fail closed?',answerClaimId:'C1',
  sources:[{id:'S1',locator:'fixture:reproduction',observedAt:'2026-09-13'}],
  claims:[{id:'C1',kind:'observation',text:'Missing tools block delivery.',sourceRefs:['S1'],limitations:[]}]});
test('accept an evidence-bound report model',()=>assert.deepEqual(validateClaims(model()),[]));
for(const input of [null,[],{}, {schemaVersion:2}]) test('reject malformed model '+JSON.stringify(input),()=>assert.ok(validateClaims(input).length));
for(const [name,mutate] of [
  ['unknown source',m=>m.claims[0].sourceRefs=['absent']],
  ['duplicate claim',m=>m.claims.push({...m.claims[0]})],
  ['duplicate source',m=>m.sources.push({...m.sources[0]})],
  ['missing governing answer',m=>m.answerClaimId='absent'],
  ['unattributed motive',m=>m.claims[0].kind='attribution'],
  ['observation without evidence',m=>m.claims[0].sourceRefs=[]],
  ['hypothesis without limitation',m=>{m.claims[0].kind='hypothesis';m.claims[0].sourceRefs=[];}]
]) test('reject '+name,()=>{const m=model();mutate(m);assert.ok(validateClaims(m).some(q=>q.level==='P0'));});
test('hypothesis may lack a source when explicitly limited',()=>{const m=model();Object.assign(m.claims[0],{kind:'hypothesis',sourceRefs:[],limitations:['Not measured.']});assert.deepEqual(validateClaims(m),[]);});
test('attribution needs source, actor and attributable statement',()=>{const m=model();Object.assign(m.claims[0],{kind:'attribution',actor:'Design note',attributedStatement:'The note states the intent.'});assert.deepEqual(validateClaims(m),[]);});
test('HTML claims and sources resolve independently',()=>{
  assert.deepEqual(validateBindings(model(),{claims:['C1'],sources:['S1']}),[]);
  for(const bindings of [{claims:[],sources:['S1']},{claims:['C1'],sources:[]},{claims:['C1','unknown'],sources:['S1']},{claims:['C1'],sources:['S1','unknown']}])
    assert.ok(validateBindings(model(),bindings).length);
});
test('voice matches request review but never rewrite the text',()=>{
  const block={text:'작성자는 의도적으로 경로를 줄였다.'};
  assert.equal(reviewVoice([block])[0].level,'P2');assert.equal(block.text,'작성자는 의도적으로 경로를 줄였다.');
});
test('only sourced quotation/method exceptions suppress advisory flags',()=>{
  assert.deepEqual(reviewVoice([{text:'설계 의도',role:'quote',source:'S1'}]),[]);
  assert.equal(reviewVoice([{text:'설계 의도',role:'quote'}]).length,1);
  assert.equal(reviewVoice([{text:'설계 의도',role:'body',source:'S1'}]).length,1);
});
