import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePdfInfo,parsePdfFonts,resolveToc,automatedVerdict,runTool} from '../skills/dev-visualizer/scripts/report-pdf-tools.mjs';
test('parse positive PDF page geometry',()=>assert.deepEqual(parsePdfInfo('Pages: 7\nPage size: 595.28 x 841.89 pts (A4)'),{pages:7,size:{w:595.28,h:841.89,name:'A4'}}));
for(const output of ['', 'Pages: 0\nPage size: 595 x 842 pts', 'Pages: 1\nPage size: 0 x 842 pts', 'Pages: 1\nPage size: 5..9 x 842 pts'])
  test('invalid PDF metadata fails '+output,()=>assert.throws(()=>parsePdfInfo(output)));
test('font parser handles variable-width type labels',()=>{
  const header='name type encoding emb sub uni object ID\n--------------------\n';
  const out=parsePdfFonts(header+'ABCDEF+Pretendard-Regular CID TrueType Identity-H yes yes yes 12 0\nUnembedded Type 1 Custom no no no 14 0\n');
  assert.deepEqual(out,[{name:'Pretendard-Regular',embedded:true,unicode:true},{name:'Unembedded',embedded:false,unicode:false}]);
});
test('full TOC heading resolves after contents, never to contents',()=>{
  const r=resolveToc([{id:'s1',text:'Evidence changes the decision'}],['s1'],['Cover','Contents\nEvidence changes the decision','Evidence changes\nthe decision']);
  assert.equal(r.toc[0].page,3);assert.deepEqual(r.qa,[]);
});
for(const [name,targets,slots,pages] of [
  ['missing target',[{id:'s1',text:'No such heading'}],['s1'],['Cover','Contents','Other']],
  ['ambiguous target',[{id:'s1',text:'Repeated'}],['s1'],['Cover','Contents','Repeated','Repeated']],
  ['missing slot',[{id:'s1',text:'Heading'}],[],['Cover','Contents','Heading']],
  ['unknown slot',[],['absent'],['Cover','Contents']],
  ['no contents',[{id:'s1',text:'Heading'}],['s1'],['Cover','Heading']],
  ['duplicate id',[{id:'x',text:'A'},{id:'x',text:'B'}],['x'],['Cover','Contents','A B']],
  ['prefix collision',[{id:'x',text:'A sufficiently long heading prefix about a failed result'}],['x'],['Cover','Contents','A sufficiently long heading prefix about a passed result']]
]) test('TOC rejects '+name,()=>assert.ok(resolveToc(targets,slots,pages).qa.some(q=>q.level==='P0')));
test('NFC-equivalent Korean titles resolve',()=>{const title='근거가 판단을 바꾼다';assert.equal(resolveToc([{id:'x',text:title}],['x'],['표지','목차',title.normalize('NFD')]).toc[0].page,3);});
test('subprocess failure is not empty successful extraction',()=>assert.throws(()=>runTool(process.execPath,['-e','process.exit(9)']),/exit 9/));
for(const [qa,notRun,expected] of [[[],[],'PASS'],[[],['absent'],'BLOCKED'],[[{level:'P2'}],[],'REVIEW'],[[{level:'P0'}],['absent'],'FAIL']])
  test('automated verdict '+expected,()=>assert.equal(automatedVerdict({qa,notRun}),expected));
