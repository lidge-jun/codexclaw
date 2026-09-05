import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// This unit-local verifier checks extracted values against filesystem/Git facts.
// It does not grade policy prose or certify external standards compliance.
const base = '048ae759c715051f2fde807624e85cf1ec6c6d55';
const allowed = /^devlog\/_(plan|fin)\/260905_dev_skill_audit\//;
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const docs = ['000_plan.md', '001_inventory.md', '002_findings.md', '003_sources.md',
  '004_interview.md', '010_docs_delivery.md', '011_audit.md', '012_verification.md'];

function validate(facts) {
  const errors = [];
  const expected = [...facts.actualNames].sort();
  if (JSON.stringify([...facts.coveredNames].sort()) !== JSON.stringify(expected)) errors.push('COVERAGE');
  if (facts.hashes.some(x => x.expected !== x.actual)) errors.push('HASH');
  if (facts.citations.some(x => !x.exists || x.line < 1 || x.line > x.lines)) errors.push('CITATION');
  if (facts.sources.some(s => s.status === 'verified' &&
    (!s.proof?.excerpt || !s.proof?.surface || !s.proof?.toolOk || !/^https:\/\//.test(s.url)))) errors.push('SOURCE');
  if (facts.changed.some(p => !allowed.test(p))) errors.push('SCOPE');
  return errors;
}

function selfTest() {
  const valid = { actualNames: ['dev', 'dev-testing'], coveredNames: ['dev', 'dev-testing'],
    hashes: [{ expected: 'expected-hash', actual: 'expected-hash' }],
    citations: [{ exists: true, line: 4, lines: 9 }],
    sources: [{ status: 'verified', url: 'https://example.org/spec',
      proof: { excerpt: 'independent fixture', surface: 'fixture', toolOk: true } }],
    changed: ['devlog/_fin/260905_dev_skill_audit/001_inventory.md'] };
  assert.deepEqual(validate(valid), []);
  const mutations = {
    COVERAGE: x => x.coveredNames.pop(),
    HASH: x => { x.hashes[0].actual = 'different-hash'; },
    CITATION: x => { x.citations[0].exists = false; },
    SOURCE: x => { delete x.sources[0].proof; },
    SCOPE: x => x.changed.push('plugins/codexclaw/skills/dev/SKILL.md'),
  };
  for (const [code, mutate] of Object.entries(mutations)) {
    const fixture = structuredClone(valid);
    mutate(fixture);
    assert.deepEqual(validate(fixture), [code]);
    console.log(`negative ${code}: rejected as expected`);
  }
  console.log('SELF-TEST PASS: valid fixture + 5 independent negative fixtures');
}

function verify(unit) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const read = f => fs.readFileSync(path.join(unit, f), 'utf8');
  for (const f of docs) assert.ok(read(f).trim().length, `empty document: ${f}`);
  const inventory = JSON.parse(read('evidence/inventory.json'));
  assert.equal(inventory.baseline, base);
  const sources = JSON.parse(read('evidence/sources.json'));
  const actualNames = fs.readdirSync(path.join(root, 'plugins/codexclaw/skills'))
    .filter(n => /^dev($|-)/.test(n)).sort();
  const actualFiles = actualNames.flatMap(n => {
    const dir = `plugins/codexclaw/skills/${n}`;
    return fs.readdirSync(path.join(root, dir), { recursive: true })
      .filter(f => fs.statSync(path.join(root, dir, f)).isFile()).map(f => `${dir}/${f}`);
  }).sort();
  assert.deepEqual(inventory.files.map(f => f.path).sort(), actualFiles, 'inventory file list drift');
  const coveredNames = [...read('001_inventory.md').matchAll(/^## (dev(?:-[a-z-]+)?)$/gm)].map(m => m[1]);
  const allText = docs.map(read).join('\n');
  const citations = [...allText.matchAll(/`((?:plugins\/|structure\/|\/Users\/jun\/\.codex\/)[^`\s]+):(\d+)`/g)]
    .map(m => {
      const p = path.isAbsolute(m[1]) ? m[1] : path.join(root, m[1]);
      return { path: m[1], line: Number(m[2]), exists: fs.existsSync(p),
        lines: fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trimEnd().split('\n').length : 0 };
    });
  assert.ok(citations.length >= actualNames.length, 'missing citation coverage');
  const gitPaths = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const changed = [...new Set([...gitPaths(['diff', '--name-only', '-z', base]),
    ...gitPaths(['ls-files', '--others', '--exclude-standard', '-z'])])];
  const facts = { actualNames, coveredNames, citations, sources, changed,
    hashes: inventory.files.map(f => ({ expected: f.sha256, actual: sha(path.join(root, f.path)) })) };
  const errors = validate(facts);
  for (const c of citations.filter(c => !c.exists || c.line > c.lines)) console.error(c);
  assert.deepEqual(errors, [], `document integrity errors: ${errors.join(',')}`);
  const found = [...read('002_findings.md').matchAll(/^## (F\d+) —/gm)].map(m => m[1]);
  const refs = [...allText.matchAll(/\bF\d{2}\b/g)].map(m => m[0]);
  assert.equal(new Set(found).size, found.length, 'duplicate finding ID');
  for (const id of refs) assert.ok(found.includes(id), `unknown finding: ${id}`);
  for (const id of new Set([...allText.matchAll(/\bS\d{2}\b/g)].map(m => m[0])))
    assert.ok(sources.some(s => s.id === id), `unknown source: ${id}`);
  execFileSync('git', ['diff', '--check', base], { cwd: root });
  // Git diff does not cover untracked files; inspect delivered prose separately.
  for (const f of docs) assert.ok(!read(f).split('\n').some(l => /[\t ]+$/.test(l)), `trailing whitespace: ${f}`);
  console.log(`DOCS PASS: ${actualNames.length} routers; ${actualFiles.length} source hashes; ${citations.length} citations; ${found.length} findings; ${sources.length} sources; ${changed.length} scoped paths`);
}

try {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    assert.ok(process.argv[2], 'unit path argument required');
    verify(path.resolve(process.argv[2]));
  }
} catch (error) {
  console.error(`DOCS FAIL: ${error.message}`);
  process.exitCode = 1;
}
