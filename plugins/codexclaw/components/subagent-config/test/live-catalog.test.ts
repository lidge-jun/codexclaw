import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readCatalog, parseOcxModels, runOcxModels, CATALOG_TTL_MS } from '../src/live-catalog.ts';
import { readNativeCatalog } from '../src/catalog.ts';

const roster = (id: string) => JSON.stringify([
  {namespaced:id,native:true,reasoningEfforts:['low','high']},
  {namespaced:'provider/disabled',disabled:true},
  {namespaced:'provider/pending',initialSelectionPending:true},
  {namespaced:'provider/no-effort',reasoningEfforts:[]},
  {namespaced:'provider/unknown',reasoningEfforts:null},
]);
function fixture(t: {after: (cb:()=>void)=>void}) {
  const root=mkdtempSync(join(tmpdir(),'cxc-live-catalog-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const env={...process.env,CODEX_HOME:join(root,'codex'),CODEXCLAW_HOME:join(root,'cxc')};
  mkdirSync(env.CODEX_HOME);
  return {root,env};
}

test('OCX array parsing filters disabled/pending and preserves supported, empty and unknown effort ladders',()=>{
  const rows=parseOcxModels(roster('new-native'));
  assert.deepEqual(rows.map(x=>x.id),['new-native','provider/no-effort','provider/unknown']);
  assert.deepEqual(rows.map(x=>x.reasoningEfforts),[['low','high'],[],null]);
  assert.throws(()=>parseOcxModels('{}'),/invalid OCX/);
  assert.throws(()=>parseOcxModels('[{}]'),/invalid OCX/);
  assert.deepEqual(parseOcxModels('[]'),[]);
});

test('shared last-success cache survives a new process, refresh updates it, failures are labeled stale, empty is authoritative',async t=>{
  const {env}=fixture(t);let now=Date.now(),calls=0,current='first';
  const options={env,now:()=>now,runOcx:async()=>{calls++;return roster(current);}};
  assert.equal((await readCatalog(options)).entries[0].id,'first');
  assert.equal((await readCatalog(options)).entries[0].id,'first');assert.equal(calls,1);
  const script=`import {readCatalog} from ${JSON.stringify(new URL('../src/live-catalog.ts',import.meta.url).href)};const c=await readCatalog({runOcx:async()=>{throw Error('cache was not reused')}});console.log(JSON.stringify(c));`;
  const child=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env,encoding:'utf8'}));
  assert.equal(child.status,'fresh');assert.equal(child.entries[0].id,'first');
  current='second';assert.equal((await readCatalog({...options,forceRefresh:true})).entries[0].id,'second');
  now+=CATALOG_TTL_MS+1;
  const failed=await readCatalog({...options,runOcx:async()=>{throw new Error('secret stderr never exposed');}});
  assert.equal(failed.status,'stale');assert.equal(failed.entries[0].id,'second');assert.ok(!failed.message?.includes('secret'));
  const empty=await readCatalog({...options,forceRefresh:true,runOcx:async()=> '[]'});
  assert.equal(empty.status,'fresh');assert.deepEqual(empty.entries,[]);
  assert.deepEqual((await readCatalog(options)).entries,[]);
});

test('coalesces concurrent refreshes; malformed payload without cache never invents defaults',async t=>{
  const {env}=fixture(t);let calls=0;let release!:(value:string)=>void;
  const runOcx=()=>{calls++;return new Promise<string>(resolve=>release=resolve);};
  const a=readCatalog({env,runOcx,forceRefresh:true}),b=readCatalog({env,runOcx,forceRefresh:true});
  release('[]');await Promise.all([a,b]);assert.equal(calls,1);
  rmSync(join(env.CODEXCLAW_HOME,'model-catalog.json'));
  const bad=await readCatalog({env,runOcx:async()=> 'not JSON'});
  assert.equal(bad.status,'unavailable');assert.deepEqual(bad.entries,[]);
});

test('native fallback honors configured model_catalog_json and arbitrary IDs; explicit path wins; no OCX failure fallback',async t=>{
  const {env}=fixture(t);
  writeFileSync(join(env.CODEX_HOME,'config.toml'),`model_catalog_json = 'custom.json' # selected catalog\n[profile]\nmodel_catalog_json = 'wrong.json'\n`);
  writeFileSync(join(env.CODEX_HOME,'custom.json'),JSON.stringify({models:[{slug:'gpt-future',supported_reasoning_levels:[{effort:'high'}]},{slug:'hidden',visibility:'hide'}]}));
  writeFileSync(join(env.CODEX_HOME,'models_cache.json'),JSON.stringify({models:['stale-default']}));
  assert.deepEqual(readNativeCatalog(env)?.map(e=>e.id),['gpt-future']);
  const missing=Object.assign(new Error('not installed'),{code:'ENOENT'});
  const native=await readCatalog({env,runOcx:async()=>{throw missing;}});
  assert.equal(native.source,'native');assert.deepEqual(native.entries[0].reasoningEfforts,['high']);
  const explicit={...env,CODEX_MODELS_CACHE_PATH:join(env.CODEX_HOME,'models_cache.json')};
  assert.equal(readNativeCatalog(explicit)?.[0].id,'stale-default');
  rmSync(join(env.CODEXCLAW_HOME,'model-catalog.json'));
  const failed=await readCatalog({env,runOcx:async()=>{throw new Error('OCX unavailable');}});
  assert.equal(failed.source,'ocx');assert.equal(failed.status,'unavailable');
});

test('real subprocess timeout and oversized stdout are bounded', {skip:process.platform==='win32'}, async t=>{
  const {env,root}=fixture(t);const bin=join(root,'bin');mkdirSync(bin);
  const path=join(bin,'ocx');const childEnv={...env,PATH:bin+':'+process.env.PATH};
  writeFileSync(path,'#!/usr/bin/env node\nprocess.stdout.write("x".repeat(5*1024*1024));\n',{mode:0o700});
  await assert.rejects(runOcxModels(childEnv));
  writeFileSync(path,'#!/usr/bin/env node\nsetInterval(()=>{},1000);\n');
  const started=Date.now();await assert.rejects(runOcxModels(childEnv));
  assert.ok(Date.now()-started<18_000,'timeout failed to stop owned subprocess');
});


test('account selectors merge with live models and disappear after catalog refresh', async t => {
  const {env}=fixture(t);
  const path=join(env.CODEX_HOME,'models_cache.json');
  const account={slug:'main/gpt-daybreak-blue-latest',display_name:'main / Daybreak Blue',opencodex_catalog_kind:'account-selector-v1',supported_reasoning_levels:[{effort:'high'}]};
  writeFileSync(path,JSON.stringify({models:[account,{...account,slug:'second/gpt-daybreak-blue-latest'},{slug:'stale/general'},{...account,slug:'hidden/daybreak',visibility:'hide'}]}));
  const options={env,forceRefresh:true,runOcx:async()=>JSON.stringify([{namespaced:'gpt-daybreak-blue-latest',native:true}])};
  const result=await readCatalog(options);
  assert.deepEqual(result.entries.map(e=>e.id),['gpt-daybreak-blue-latest','main/gpt-daybreak-blue-latest','second/gpt-daybreak-blue-latest']);
  assert.equal(result.entries[1].label,'main / Daybreak Blue');
  assert.deepEqual(result.entries[1].reasoningEfforts,['high']);
  const duplicate=await readCatalog({...options,runOcx:async()=>JSON.stringify([{namespaced:account.slug,native:true}])});
  assert.equal(duplicate.entries.filter(e=>e.id===account.slug).length,1);
  writeFileSync(path,JSON.stringify({models:[]}));
  assert.deepEqual((await readCatalog(options)).entries.map(e=>e.id),['gpt-daybreak-blue-latest']);
});
