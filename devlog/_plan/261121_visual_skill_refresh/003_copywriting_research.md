# 003 — Copywriting research (for wp2/wp3)

The user added copy to the scope on 2026-11-21 ("카피라이팅 부분도 손봐야돼"). A parallel
Aside task the same day was redoing a landing page because its copy was weak, so this is a
live pain point, not polish.

## What codexclaw has (2026-11-21)

| Where | What | Gap |
|---|---|---|
| `dev-frontend/references/core/anti-slop.md:193-210` | FE-METACOPY-01 (copy must not narrate its own layout) and a 4-line copy self-audit (em dash, "We believe", placeholder, headline could describe another company) | Good and unique; too short to steer drafting |
| `anti-slop.md:222-236` | Korean slop list (translationese, bureaucratic labels, honorific overuse) | Mostly typography; few copy shapes |
| `anti-slop.md:439-455` | FE-APHORISM-01, FE-CONTENT-REALISM-01 | First-generation tells only |
| `dev-frontend/references/core/ux-writing-ko.md` (62 lines) | Principles, tone by domain, errors, labels | No process, no landing copy |
| `kwrite` skill | Korean prose polish, 11 AI-tell categories | Not routed from dev-frontend (only dev-visualizer's report pipeline names it) |

There is no drafting procedure: nothing says where facts come from, how to choose a voice,
how many devices a page may spend, or how to check a draft.

## What the strongest OSS copy modules do

taste-skill (`references/copy*.md`, 1,253 lines, plus `scripts/copy-lint.mjs` 463 lines):

1. Fact sheet from the brief: every specific (number, name, date, story) must come from the
   input; with none, a plainer line. Invented specifics are the main second-generation tell.
2. Voice card: voice, pairs, person, never-list; then one register chosen per client from
   twelve (facts only, technical with proof, founder's letter, playful, literary, proper
   nouns and restraint, sensory second person, historical scene, activist, refusal and
   narrowness, product as hero, hurried conversational).
3. Shape sections from the reader's questions, not from a template (eyebrow, claim heading,
   lede, three cards).
4. Device budget per page: contrast frames, negation runs, two-fragment headings, number
   pair headings, dry closers each have a cap.
5. Second-generation tells (dated Nov 2026): house voice; invented specifics; stat strip;
   "X. Y." headings; contrast frames and their substitutes ("rather than", "instead of",
   "without the"); virtue words about ourselves; dry closer; footer sign-off; brand-name
   metaphor run into the ground; origin template; polished testimonials; default cast of
   names; section template; response-time promises; unsourced proof figures; perfect
   evenness; unwritten microcopy; process talk; stale year.
6. Over-correction table: each ban breeds a substitute (no em dash -> comma splices; no hype
   -> calm virtue words; avoid threes -> everything in pairs; be specific -> invented
   numbers; short sentences -> fragment drumbeat). Count substitutes together.
7. Not-tells list: plain "is", perfect grammar, a list of three when there are three.
8. Lint: FAIL / WARN / INFO with ids, reads only visible copy, cross-page first-heading
   comparison.

Product microcopy (jakubkrehel better-writing, impeccable clarify): inventory existing
strings first; one vocabulary; verb-first buttons; links name the destination; settings
describe the ON state; errors say how to fix, next to the field; undo beats confirmation;
empty states point forward; placeholders show an example.

## Korean gap (nobody covers it)

No surveyed repo lints Korean landing copy. Candidate second-generation Korean tells to
validate in wp2 against real Korean model output before they become rules:
"~의 새로운 기준", "더 이상 ~하지 마세요", "단 하나의", "~, 이제 ~로", "당신의 ~를 위한",
imperative chains ("~하세요. ~하세요."), "경험하세요", noun-ending fragment pairs
("빠르게. 정확하게."), stacked "~까지" lists, "스마트한/혁신적인/차세대", unsourced
"N만 명이 선택한". wp2 records which ones actually appear in a sample before encoding them;
an untested list is a guess.
