# 010c — Owner A/B round 3 (Apple-KR copy) and hero alignment survey (2026-11-21)

## Round 3 results

| # | Variable | Winner |
|---|---|---|
| r01 | "에이전트는 어디서든. 결정은 손안에서." vs round-2 winner "AI 에이전트 운영의 새로운 기준" | **Apple-KR parallel pair** |
| r02 | "GOAT. 모든 기기를 한 팀으로." vs the parallel pair | **name + beat** |
| r03 | noun list "모든 기기. 모든 에이전트. 하나의 화면." vs parallel pair | **parallel pair** |
| r04 | "어디서든, 일하다." vs "어디서든 일하는 에이전트." | **"-다." literary verb** |
| r05 | wit "막히면? 폰으로 승인. 끝." vs plain "막히면, 휴대폰으로 승인." | **plain** |
| r06 | headline only vs headline + one-line sub | **headline + sub** |
| r07 | near-no-copy (name + button + product screen) vs copy + product screen | **copy + product** |
| r08 | period vs no period | **no period** (differs from Apple, which uses a period on 85%) |
| r09 | EN "Every agent. Every machine. One screen." vs "The AI-native orchestration platform for modern teams." | **category line** |
| r10 | "다운로드 / 더 알아보기" vs "맥용 다운로드 / 문서 보기" | **short Apple-style** |

The owner's Korean marketing register as of round 3:

- **Ranking:** name + beat > parallel pair > noun list; all three beat the abstract
  "새로운 기준" line.
- **Endings:** literary "-다." is fine; no trailing period; plain rather than witty.
- **Amount of copy:** one short sub-line; the copy sits next to the product, not replaced by
  it.
- **Buttons:** short two-word labels ("다운로드", "더 알아보기").
- **English:** a category line still beats Apple-style fragments. Recorded as is; English
  rules stay looser.

## Hero alignment survey

**Owner observation (2026-11-21):** "중앙정렬 식이 더 대세인거 같은데 왼쪽 정렬에는 뭔가 있어야되고".

**Method.**

- Data: the probe-v2 headline box for all 254 captures from 007.
- Centered: computed `text-align: center`, or a headline box starting at x ≥ 240 with its
  center within 60px of the viewport center.
- The first, looser test called wide left-aligned headlines centered (Krafton, Tenet,
  Standard Signal). Those 22 were re-checked by eye.
- Every non-centered first viewport was hand-labeled from its screenshot (147 pages):
  - **S**: split, a visual on the right.
  - **B**: full-bleed photo or video behind the text.
  - **P**: product UI or a visual directly below.
  - **T**: type alone, nothing beside or below in the first viewport.
  - **X**: portal, carousel or centered visual; not a left hero.
- Labels are in session `tmp/cap/left_labels.json`.
- A pixel-busyness heuristic was tried first and rejected: full-bleed photos read as
  "empty".

**Results.**

| | YC P26 | Korea | Foreign |
|---|---|---|---|
| Pages with a hero (portals excluded) | 188 | 17 | 33 |
| Centered | **84 (45%)** | **10 (59%)** | **19 (58%)** |
| Left-aligned | 104 | 7 | 14 |
| ... with a visual on the right (S) | 48 | 2 | 4 |
| ... over a full-bleed photo or video (B) | 32 | 2 | 1 |
| ... with product UI below (P) | 12 | 3 | 9 |
| ... type alone (T) | 12 | **0** | **0** |

Across the 125 left heroes the mix is:

| Split (S) | Full-bleed (B) | Product below (P) | Type alone (T) |
|---|---|---|---|
| 43% | 28% | 19% | **10%** |

The 12 type-alone pages are all YC, mostly dark "tech" heroes: Arlo, Astraea, Soria,
Result, Instaagent, Kelai, Incandor, Rudus, Perfectbit, Stablebrowse, Hedge, Linzumi.

**Reading. The owner's observation holds on both counts.**

1. **Centered is the majority** among established companies (58 to 59%) and close to half
   of YC P26.
2. **Left alignment almost always has a counterweight.** 90% of left heroes have one:
   - a visual on the right
   - a full-bleed image behind the text
   - the product directly below (Linear, Cursor, Supabase, Clerk, Ramp)

   No Korean or foreign leader ships a left headline alone.

Web writing agrees (practitioner articles, 2026, not measured studies). A centered hero
suits short messages and pages with no image; left alignment suits longer copy or a visual
to balance it. The owner's short Apple-KR copy (round 3) fits centered by that logic. One
article cites a "CXL 2026 benchmark" (left beats centered by 17% on CTA clicks); it is
unverified and not used.

**Conflicts with current codexclaw rules.** Both rules ban the majority patterns. Both are
**left unchanged until round 4 settles them**.

- `aesthetics.md` "ANTI-CENTER BIAS": a centered hero is BANNED when DESIGN_VARIANCE > 4,
  with two narrow carve-outs.
- `anti-slop.md` FE-HERO-SPLIT-01: "left bold headline + right boxed screenshot" is an
  exhausted template. That is 43% of left heroes on shipped sites.

## Round 4 (running)

7 layout tests at `artifacts/abtest/index4.html`. Copy is fixed to the round-3 winners, and
variants render at 1280x800 then scale down so both sides show the same layout. The pairs:

1. Centered with product below vs left with product right.
2. Copy only: centered vs left (empty right).
3. Left: product UI vs decorative graphic on the right.
4. Left: product below vs product right.
5. Centered: with product vs copy only.
6. Split ratio 55/45 vs 50/50.
7. Centered vs left, with the product below in both.
