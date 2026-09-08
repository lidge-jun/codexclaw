import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { cxcHome, globalStorePath, setRole, readSettings } from '../src/store.ts';

test('explicit CXC home is independent of Codex home and never imports legacy preferences', t => {
  const root = mkdtempSync(join(tmpdir(), 'cxc-home-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const env={CODEX_HOME:join(root,'codex'),CODEXCLAW_HOME:join(root,'cxc')};
  mkdirSync(join(env.CODEX_HOME,'codexclaw'),{recursive:true});
  writeFileSync(join(env.CODEX_HOME,'codexclaw/subagents.json'),JSON.stringify({roles:{explorer:{mode:'model',model:'legacy'}}}));
  assert.equal(cxcHome(env),env.CODEXCLAW_HOME);
  assert.equal(globalStorePath(env),join(env.CODEXCLAW_HOME,'subagents.json'));
  assert.equal(readSettings(root,'global',env).roles.explorer.model,null);
  setRole(root,'reviewer',{effort:'high'},'global',env);
  assert.equal(JSON.parse(readFileSync(globalStorePath(env),'utf8')).roles.reviewer.effort,'high');
});

test('legacy global set/reset writes canonical data, preserves other roles, and never resurrects reset roles', t => {
  const home=mkdtempSync(join(tmpdir(),'cxc-legacy-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
  const env={...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:join(home,'codex')};
  delete env.CODEXCLAW_HOME;
  const script=`
    import assert from 'node:assert/strict';
    import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
    import {join} from 'node:path';
    import {readSettings,setRole,resetRole,globalStorePath} from ${JSON.stringify(new URL('../src/store.ts',import.meta.url).href)};
    const legacy=join(process.env.CODEX_HOME,'codexclaw/subagents.json');
    mkdirSync(join(process.env.CODEX_HOME,'codexclaw'),{recursive:true});
    const bytes=JSON.stringify({extra:'keep',roles:{explorer:{mode:'model',model:'legacy',effort:null},reviewer:{mode:'model',model:'reviewer',effort:'high'}}});
    writeFileSync(legacy,bytes);
    assert.equal(readSettings(process.cwd(),'global').roles.explorer.model,'legacy');
    assert.equal(existsSync(globalStorePath()),false);
    resetRole(process.cwd(),'explorer','global');
    assert.equal(readSettings(process.cwd(),'global').roles.explorer.model,null);
    assert.equal(readSettings(process.cwd(),'global').roles.reviewer.model,'reviewer');
    setRole(process.cwd(),'reviewer',{effort:null},'global');
    resetRole(process.cwd(),'reviewer','global');
    assert.deepEqual(JSON.parse(readFileSync(globalStorePath(),'utf8')),{extra:'keep',roles:{}});
    assert.equal(readFileSync(legacy,'utf8'),bytes);
    assert.equal(readSettings(process.cwd(),'global').roles.explorer.model,null);
  `;
  execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:home,env});
});
