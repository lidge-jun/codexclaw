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
/**
 * Research handoff (issue #199). An OPTIONAL `model.research` section recording what was
 * asked, how far the answer was allowed to reach, and what is still unresolved — so the
 * publication step inherits that context instead of rediscovering it from the prose.
 *
 * It extends this model; it does not create a second one. A document without a
 * `research` section stays exactly as valid as it was, and is NEVER reported as
 * research-complete: silence means unknown, not clean.
 *
 * Structural validation is still not semantic fact checking. This can prove a handoff is
 * well formed and that a route's own constraints hold. It cannot prove a source supports
 * the claim attached to it.
 */
export const RESEARCH_ROUTES = new Set(['source-only', 'bounded-lookup', 'deep-research']);
const LOAD_BEARING = new Set(['inference', 'recommendation']);

export function validateResearchHandoff(model) {
  const issues=[], fail=(id,msg)=>issues.push({level:'P0',id,msg});
  if(!object(model)||model.research===undefined) return issues; // not supplied: not an error
  const research=model.research;
  if(!object(research)) {fail('research','research must be an object when present');return issues;}
  if(research.contractVersion!==1) fail('research','research.contractVersion must be 1; an unreadable version is not an upgrade');
  if(!RESEARCH_ROUTES.has(research.route)) fail('research','research.route must be one of '+[...RESEARCH_ROUTES].join(', '));
  if(!text(research.sourceBoundary)) fail('research','research.sourceBoundary is required: what the answer was allowed to read');
  if(!object(research.languages)||!text(research.languages.source)||!text(research.languages.output))
    fail('research','research.languages requires source and output; a translated citation is not the original');
  if(!Array.isArray(research.gaps)||!research.gaps.every(g=>text(g)))
    fail('research','research.gaps must be a list of unresolved points; an empty list is a claim that none remain');
  if(research.stopReason!==undefined&&!text(research.stopReason)) fail('research','research.stopReason must be text when present');

  const claims=new Set(Array.isArray(model.claims)?model.claims.map(c=>c&&c.id):[]);
  if(!Array.isArray(research.questions)||!research.questions.length) fail('research','research.questions is required and must not be empty');
  else for(const question of research.questions) {
    if(!object(question)||!text(question.id)||!text(question.text)||!Array.isArray(question.answeredBy))
      {fail('research','question requires id, text and answeredBy');continue;}
    for(const ref of question.answeredBy) if(!claims.has(ref)) fail(question.id,'Question answered by an unknown claim: '+String(ref));
    // A question with no answering claim is legitimate; it must appear in gaps so the
    // publication step cannot present an unanswered question as covered.
    if(!question.answeredBy.length&&!research.gaps.some(g=>String(g).includes(question.id)))
      fail(question.id,'Unanswered question must be listed in research.gaps');
  }

  const sources=Array.isArray(model.sources)?model.sources:[];
  if(research.route==='source-only')
    for(const source of sources) if(object(source)&&source.discovered===true)
      fail(source.id||'source','source-only route carries a discovered source: '+String(source.id));

  // "Snippets are leads." A search excerpt locates a document; it does not stand in for
  // reading it. A load-bearing claim supported ONLY by snippet-derived sources has not
  // been checked, whatever the route.
  const byId=new Map(sources.filter(object).map(s=>[s.id,s]));
  for(const claim of Array.isArray(model.claims)?model.claims:[]) {
    if(!object(claim)||!LOAD_BEARING.has(claim.kind)||!Array.isArray(claim.sourceRefs)||!claim.sourceRefs.length) continue;
    const resolved=claim.sourceRefs.map(ref=>byId.get(ref)).filter(object);
    if(resolved.length&&resolved.every(s=>s.via==='snippet'))
      fail(claim.id,'Load-bearing claim rests only on snippet-derived sources; snippets are leads, not evidence');
  }
  return issues;
}

/**
 * The receipt producer (matrix row A11). Records what route was taken, which contract
 * and skill versions produced the document, and which checks ran versus were omitted.
 * An omitted check is reported as omitted; it never renders as a pass.
 */
export function researchReceipt(model, {skillVersion='unknown', checks={}}={}) {
  const supplied=object(model)&&object(model.research);
  const completed=Object.entries(checks).filter(([,v])=>v===true).map(([k])=>k).sort();
  const omitted=Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k).sort();
  return {
    kind:'research-handoff',
    supplied,
    route:supplied?model.research.route:null,
    contractVersion:supplied?model.research.contractVersion:null,
    skillVersion,
    questions:supplied&&Array.isArray(model.research.questions)?model.research.questions.length:0,
    gaps:supplied&&Array.isArray(model.research.gaps)?model.research.gaps.length:0,
    completed,
    omitted,
  };
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
