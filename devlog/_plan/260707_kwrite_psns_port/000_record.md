# 260707 — k-writing port: cxc-kwrite (plugin) + cxc-psns (personal) split

Date: 2026-07-07. Single-cycle port, user-steered mid-turn (interrupt).
Source: cli-jaw private active skill `k-writing`
(`~/.cli-jaw-marketing/skills/k-writing/`, newest copy by mtime; label
`k-thread-gen` is retired — cli-jaw AGENTS.md:47,55). Origin taxonomy:
im-not-ai (epoko77-ai/im-not-ai) via the 260514 Korean-AI-voice research.

## Steering decisions (user, verbatim intent)

1. Generic Korean polishing goes GLOBAL as `cxc-kwrite` in the codexclaw
   plugin ("글로벌을 노리니까") — thread/SNS genre mentions stripped.
2. The hook carries ONLY universal 윤문 guidance ("범용적인 윤문지침
   정도까지만"), no platform routing.
3. SNS/community generation stays PERSONAL as `cxc-psns` in local skills
   ("내껄로 별도로", 배포 금지 — earlier instruction).
4. Routing: 윤문 요청 -> cxc-kwrite; SNS/쓰레드/카드뉴스 요청 -> cxc-psns.

## Diff-level record

### Plugin (distributed)

- NEW `plugins/codexclaw/skills/kwrite/SKILL.md` — name cxc-kwrite, EN
  description + KO/EN triggers (윤문/다듬어/교정/AI투/Korean polish), 4 prime
  directives (meaning frozen, span-only, <=30% change, register preserved),
  4-pass revision protocol (register consistency; translationese+AI idioms
  via taxonomy; mechanical structure/connectives/over-explanation; rhythm +
  abstract endings), scope guard (revision-only; generation belongs to the
  owning surface; Korean-only).
- NEW `skills/kwrite/references/ai-tell-taxonomy.md` — CAT-1..CAT-10
  distilled REGISTER-PRESERVING (문어체/구어체 dual corrections; the k-writing
  original was community-반말 flavored). 수정 원칙 4항 mirrored.
- NEW `skills/kwrite/agents/openai.yaml` — implicit=false (canonical
  implicit-set policy: {dev,search,interview,pabcd,recall,loop} is hardcoded
  in dev/SKILL.md:173 + manifest-policy.test.mjs; same decision as
  cxc-remote).
- `skills/README.md` — kwrite/ entry (on-demand wording).
- `components/cxc-ops/src/map-affordance.ts` — NEW renderKwriteAffordance():
  always-on SessionStart additionalContext line (pointer-not-payload, same
  policy as skill-search line): names the S1 anti-patterns inline
  (번역투 3종, AI 관용구/기대된다 endings, 첫째/둘째, register consistency)
  and points 윤문/long-form Korean at $cxc-kwrite. Genre-free by test.
- `components/cxc-ops/test/map-affordance.test.ts` — new test: affordance
  matches /cxc-kwrite/ + /윤문/, must NOT match /thread|쓰레드|SNS|블로그|DC/i,
  <600 chars, rides every SessionStart envelope (small-repo run).

### Personal (NOT distributed)

- NEW `~/.codex/skills/cxc-psns/` — full copy of k-writing (SKILL.md +
  references{ai-tell-taxonomy, hooking, media-delivery, narrative-flow,
  structure-formats, tone-system, tones/15, tone-layers/3} + scripts/
  ai-tell-check.md + examples/3). Front-matter renamed to cxc-psns with
  routing note: 새 SNS/커뮤니티 글 생성 = psns; 순수 윤문 = $cxc-kwrite.
  Self-references k-writing -> psns renamed. Kept self-contained (own
  taxonomy) so the personal skill works without the plugin.

## Gates

cxc-ops suite 31/31; repo `npm run build` 100 files OK (dist carries the new
affordance line); `npm run gate` OK; manifest-policy 6/6 (implicit set
unchanged).

## Open ends (deliberate)

- cxc-psns tones/examples were ported as-is (not re-verified line-by-line);
  personal skill, personal risk.
- kwrite affordance is always-on for non-Korean sessions too (one sentence
  cost, mirrors skill-search policy); revisit if global users complain.
