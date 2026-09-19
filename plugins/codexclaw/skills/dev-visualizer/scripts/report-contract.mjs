/** Evidence-led report checks. Structural validation is not semantic fact checking. */
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
const kinds=new Set(['observation','inference','hypothesis','recommendation','attribution']);
export function validateClaims(model) {
  const issues=[], fail=(id,msg)=>issues.push({level:'P0',id,msg});
  if(!object(model)||model.schemaVersion!==1||!text(model.question)||!text(model.audience)||
      !text(model.answerClaimId)||!Array.isArray(model.claims)||!model.claims.length||!Array.isArray(model.sources)) {
    fail('model','Expected schemaVersion:1, audience, question, answerClaimId, claims and sources');return issues;
  }
  const sources=new Map();
  for(const source of model.sources) {
    if(!object(source)||!text(source.id)||!text(source.locator)||!text(source.observedAt)) {fail('source','Source requires id, locator and observedAt');continue;}
    if(sources.has(source.id)) fail(source.id,'Duplicate source id');
    sources.set(source.id,source);
  }
  const ids=new Set();
  for(const claim of model.claims) {
    if(!object(claim)||!text(claim.id)||!text(claim.text)||!kinds.has(claim.kind)||!Array.isArray(claim.sourceRefs)||
        !Array.isArray(claim.limitations)||!claim.limitations.every(text)) {fail('claim','Claim requires id, text, kind, sourceRefs and limitations');continue;}
    if(ids.has(claim.id)) fail(claim.id,'Duplicate claim id');
    ids.add(claim.id);
    if(!claim.sourceRefs.length&&claim.kind!=='hypothesis') fail(claim.id,'Claim requires evidence references');
    if(claim.kind==='hypothesis'&&!claim.limitations.length) fail(claim.id,'Hypothesis requires a visible limitation');
    for(const ref of claim.sourceRefs) if(!text(ref)||!sources.has(ref)) fail(claim.id,'Unknown evidence reference: '+String(ref));
    if(claim.kind==='attribution'&&(!text(claim.actor)||!text(claim.attributedStatement)))
      fail(claim.id,'Intent attribution requires actor and directly attributable statement');
  }
  if(!ids.has(model.answerClaimId)) fail('answer','answerClaimId does not resolve to a claim');
  return issues;
}
/** A phrase match is an advisory review location, never an automatic rewrite. */
export function reviewVoice(blocks) {
  const pattern=/의도적으로|설계 의도|작성자는|정독했|집필 중|흥미로운 것은|the author intended|intentionally designed/ig;
  return blocks.flatMap(block=>{
    if(['quote','method','notice'].includes(block.role)&&block.source) return [];
    const matches=[...block.text.matchAll(pattern)].map(m=>m[0]);
    return matches.length?[{level:'P2',id:block.id||'voice',msg:'Review attribution/process language in context: '+[...new Set(matches)].join(', ')}]:[];
  });
}
export function validateBindings(model, bindings) {
  const issues=[], claims=new Set(model.claims.map(c=>c.id)), sources=new Set(model.sources.map(s=>s.id));
  for(const id of bindings.claims) if(!claims.has(id)) issues.push({level:'P0',id,msg:'HTML references an unknown claim'});
  for(const id of bindings.sources) if(!sources.has(id)) issues.push({level:'P0',id,msg:'HTML references an unknown source'});
  if(!bindings.claims.includes(model.answerClaimId)) issues.push({level:'P0',id:'answer',msg:'Governing answer is not bound in HTML'});
  for(const claim of model.claims) {
    if(!bindings.claims.includes(claim.id)) continue;
    for(const source of claim.sourceRefs) if(!bindings.sources.includes(source))
      issues.push({level:'P0',id:claim.id,msg:'Cited source is absent from rendered HTML: '+source});
  }
  return issues;
}
