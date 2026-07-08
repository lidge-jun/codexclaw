---
name: cxc-kwrite
description: "MUST USE for Korean prose polishing (윤문) — revising existing Korean text to read like a person wrote it: removing translationese and AI idioms, fixing register/tone breaks, varying rhythm, replacing abstract endings, while preserving meaning exactly. Applies to docs, articles, announcements, READMEs, UI copy, and any Korean output the agent writes. Triggers: 윤문, 다듬어, 다듬어줘, 자연스럽게, 매끄럽게, 교정, 고쳐줘, AI투, 번역투, Korean polish, kwrite, proofread Korean."
metadata:
  last-verified: "2026-07-07"
  short-description: "Korean prose polishing: AI-tell removal + register consistency + meaning-exact revision."
---

# kwrite — Korean Prose Polishing (윤문)

Use this skill when the task is to REVISE existing Korean text (or polish
Korean text you are about to output): remove the patterns that make it read
machine-written, keep everything it says intact. This is a revision
discipline, not a generation pipeline — genre, format, and audience stay
whatever the source text already is.

## Prime directives

1. **Meaning is frozen.** Facts, claims, numbers, proper nouns, quotes, and
   causal links are preserved to the letter. Ambiguity is never resolved by
   invention.
2. **Edit detected spans only.** Sentences without a detected pattern are not
   touched. Polishing is not rewriting.
3. **No over-polishing.** If more than ~30% of the text changes, stop and
   re-check: you are probably rewriting, not polishing.
4. **Register is part of meaning.** 문어체 stays 문어체, 구어체 stays 구어체,
   존댓말 stays 존댓말. Fix breaks IN the register; never migrate the text to
   a different one.

## Revision protocol (run in order, re-run a pass after fixing it)

### Pass 1 — Register/tone consistency (S1)

- First and last sentence carry the same register and speech level.
- No "~합니다/~입니다" islands inside 반말/평서 text; no "~해/~야" inside
  존댓말 text; no "~하겠습니다" formality spikes in informal prose.

### Pass 2 — Translationese + AI idioms (S1)

Scan against [references/ai-tell-taxonomy.md](references/ai-tell-taxonomy.md)
CAT-1 (번역투), CAT-3 (AI 관용구), CAT-5 (톤 파괴). Anything S1 is fixed
immediately; the taxonomy carries register-preserving corrections.

### Pass 3 — Mechanical structure (S2)

- "첫째/둘째/셋째" enumeration, "A, B, 그리고 C" parallelism, identical
  sentence frames in sequence (CAT-2).
- Sentence-initial connective stacking: 또한/한편/더불어/아울러/이에 따라
  (CAT-4). Default fix is deletion.
- Over-explanation: restating the obvious, "다시 말해"/"즉," repetition,
  parenthetical glossing of things the reader knows (CAT-7).

### Pass 4 — Rhythm + endings (S2)

- Uniform sentence length or repeated final endings three times in a row:
  break with a short sentence, vary the ending (CAT-8).
- Abstract escape-hatch closings — 기대된다/주목된다/~할 것으로
  보인다/귀추가 주목된다 (CAT-6): end on a concrete statement, a specific
  consequence, or simply end.

## Verdict

All four passes clean -> output. Any FAIL -> fix that span, re-run that pass.
Report noteworthy changes briefly when the user asked for 윤문 explicitly;
apply silently when polishing your own outgoing Korean prose.

## Scope guard

- This skill owns revision of existing Korean text. Generating new content
  for a specific platform, audience, or format is a different job — use the
  skill that owns that surface (or plain judgment) and then run this
  protocol on the draft.
- Non-Korean text: out of scope. Mixed-language docs: polish only the Korean
  prose, leave code/English untouched.
