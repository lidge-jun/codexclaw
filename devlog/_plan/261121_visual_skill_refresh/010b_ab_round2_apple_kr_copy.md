# 010b — Owner A/B round 2 (copy, one variable at a time) and Apple Korea copy study (2026-11-21)

## Round 2 results (10 tests, one variable each)

| # | Variable | Winner |
|---|---|---|
| c01 | H1 brand-only vs value sentence | **neither**. Note: "지금 카피라이팅이 뭔가 마음에 안들어 아예 카피라이팅 없는거나 더 간단하게 애플의 한국 카피라이팅을봐봐" |
| c02 | "AI 에이전트 운영의 새로운 기준" vs "모든 기기의 에이전트를 한 화면에서" | **abstract "새로운 기준"** |
| c03 | factual sub vs "더 이상 ~마세요 / 단 하나의 / 혁신적인" sub | **promotional sub** |
| c04 | two-fact sub vs one-fact sub | **short** |
| c05 | "…한 화면에, GOAT" vs no brand | **no brand** |
| c06 | "~하세요" vs "~합니다" | **imperative** |
| c07 | "도구가 아니라, 에이전트 운영 체계" vs direct | **contrast frame** |
| c08 | EN category "AI-native platform…" vs outcome "Run any agent…" | **category** |
| c09 | EN factual sub vs "Unlock seamless… Not just a tool" | **buzzword** |
| c10 | EN "Every agent, every machine." vs full sentence | **short two-fragment** |

## Reading

The owner's choices are consistent once the variables are isolated:

- shorter
- more rhythmic and confident
- more "marketing"

The literal, factual, dense lines lost every time. Three of the moves the OSS copy-tell lists
ban won: two-fragment headlines, contrast frames and imperative mood. Two consequences:

1. **The second-generation copy-tell bans from taste-skill and avoid-ai-design do not match
   this owner.** wp2 must not encode them as bans or WARN lint for this owner's surfaces. At
   most they belong in a "generic agent copy" register that a brief can select. This confirms
   008 C2 and goes further: those devices are the owner's preferred register.
2. **The owner's reference is Apple Korea** (c01 note). The test that matters next is Apple-KR
   style against the round-2 winners, not clean against slop.

## Apple Korea copy study

**Method**
- 29 pages on apple.com/kr: home, iPhone, iPhone Air, Mac, MacBook Air/Pro, iMac, iPad,
  iPad Pro, Watch, AirPods, AirPods Pro, Vision Pro, Apple Intelligence, privacy and others.
- Captured with headless Chrome at 1440x900, ko-KR, scrolled.
- Kept visible text of 17px or more outside nav and footer.
- Display headlines: 40px or more, containing Hangul, 60 characters or fewer, footnote
  fragments removed. n = 241.
- Raw data: session `tmp/cap/applekr.json`, `applekr_heads.json`.

**Numbers**

| Measure | Value |
|---|---|
| Ends with a period (or ?) | **205/241 (85%)**, fragments included |
| Median length | **14 characters, 4 eojeol** |
| Weight | 600 on 211/241; 700 on Vision Pro |
| Tracking | `normal` on 238/241 |
| Two or more sentences in one headline | 43 |
| Polite ending (요, 니다, 세요) | 18 (7%) |
| "-다." literary verb ending | 20 |
| CTAs | "더 알아보기" 119, "구입하기" 78; generic, two words |

Patterns, with examples from the capture:

1. **Name + period + one beat.**
   - "M5. 쾌속으로 질주하다."
   - "Apple Intelligence. 수고는 덜고, 능력은 더하고."
   - "개인정보 보호. Apple이니까."
   - "Magic Keyboard. 손끝으로. 정교하게."
2. **Noun-phrase fragments, each with a period.**
   - "놀라운 Mac. 놀라운 실속."
   - "엄청난 얇기. 놀라운 가벼움. 타협 없는 견고함."
   - "초스피드. 초효율."
   - "차원이 다른 성능. 아이코닉한 디자인."
3. **Parallel pairs (대구).**
   - "수고는 덜고, 능력은 더하고."
   - "겉은 슬림, 속은 프로."
   - "촬영하고, 편집하고, 바로 공유하고."
4. **Literary "-다." verbs.**
   - "창조하다. 가속하다."
   - "당신과 함께 움직이다."
   - "강력하게. 비상하다."
5. **Wit and spoken Korean.**
   - "오오오오오. 파워."
   - "Mac은 뭐든 척척."
   - "천생연분"
   - "절친 목록."
   - "아침부터 저녁까지 열일 중."
   - "제대로 눈 호강하는 법."
6. **Question, then answer.**
   - "업그레이드할 만한가요? 그럼요."
   - "선명한 사진에 프로 스타일의 동영상까지 찍고 싶다고요? 네, 잘 오셨습니다."
7. **Numbers as big figures with small labels** in performance sections: "9.5배", "18시간",
   "2.2배 더 빠른".
8. **One idea per headline, almost no sub-copy at hero level.** The product image carries
   the rest.

Implications for the skills:

- **Korean marketing register.** Apple-KR style becomes the default for owner-facing Korean
  marketing surfaces: short (about 14 characters), period-terminated fragments, parallel
  pairs, name + beat, little or no sub-copy.
- **Rules that change.**
  - The "two-fragment cap" and "contrast cap" lose their WARN for this register.
  - The period rule flips: Apple ends 85% of Korean headlines with a period.
  - So does the Korean "no trailing period" proposal (Neon in 008).
- **Tracking.** Apple keeps `normal` on large Hangul, while the owner preferred -0.035em
  (010a). The owner's choice governs owner surfaces; Apple is recorded as the counterexample.
- **CTAs.** Apple uses generic "더 알아보기 / 구입하기"; the owner chose specific labels in
  t16. Round 3 r10 retests this against Apple.

## Round 3 (running)

10 Apple-KR-style GOAT variants are at `artifacts/abtest/index3.html`:

- the parallel pair "에이전트는 어디서든. 결정은 손안에서." vs the round-2 winner
- name + beat
- noun list
- "-다." vs nominal ending
- wit vs plain
- headline only vs headline + sub
- near-no-copy (name + button + product screen)
- period vs none
- EN Apple style vs the round-2 winner
- Apple CTA vs specific CTA

wp2 copy rules wait for its results.
