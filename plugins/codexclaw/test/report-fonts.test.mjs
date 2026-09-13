import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {loadFontManifest} from '../skills/dev-visualizer/scripts/report-fonts.mjs';
function fixture(run) {
  const dir=mkdtempSync(join(tmpdir(),'report-fonts-'));
  try {
    // Signature-only unit fixture, not a font. Browser acceptance is covered by the real render.
    const bytes=Buffer.from([0,1,0,0,1,2,3,4]);writeFileSync(join(dir,'face.ttf'),bytes);
    const font={family:'Fixture',path:'face.ttf',weight:400,style:'normal',source:'fixture:local',license:'test-only',
      version:'1',postscriptName:'Fixture-Regular',sha256:createHash('sha256').update(bytes).digest('hex')};
    const spec={schemaVersion:1,roles:{body:'Fixture'},fonts:[font]},path=join(dir,'fonts.json');
    const save=()=>writeFileSync(path,JSON.stringify(spec));save();run({dir,path,spec,save,bytes});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('local hashes seal without returning font bytes in public metadata',()=>fixture(({path,bytes})=>{
  const m=loadFontManifest(path);assert.equal(m.fonts[0].sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(m.roles.body,'Fixture');assert.ok(m.faces[0].dataUrl.startsWith('data:'));
  assert.equal('dataUrl' in m.metadata[0],false);assert.equal('path' in m.metadata[0],false);
}));
for(const [name,mutate] of [
  ['changed hash',s=>s.fonts[0].sha256='0'.repeat(64)],['missing hash',s=>delete s.fonts[0].sha256],
  ['duplicate face',s=>s.fonts.push({...s.fonts[0]})],['missing license',s=>delete s.fonts[0].license],
  ['invalid weight',s=>s.fonts[0].weight=0],['unknown role family',s=>s.roles.heading='missing'],['bad schema',s=>s.schemaVersion=2]
]) test('reject '+name,()=>fixture(({spec,path,save})=>{mutate(spec);save();assert.throws(()=>loadFontManifest(path));}));
test('sealing creates a hash, verification never trusts an omitted hash',()=>fixture(({spec,path,save})=>{delete spec.fonts[0].sha256;save();assert.equal(loadFontManifest(path,{seal:true}).metadata[0].sha256.length,64);}));
test('truncated font fails at the boundary',()=>fixture(({dir,path})=>{writeFileSync(join(dir,'face.ttf'),'x');assert.throws(()=>loadFontManifest(path),/signature/);}));
