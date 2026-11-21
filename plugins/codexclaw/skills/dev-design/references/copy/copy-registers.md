# Copy registers

Read when choosing how a page sounds, after the fact sheet in
[copy-process.md](copy-process.md). Checks live in [copy-tells.md](copy-tells.md).

## Registers (FE-COPY-REGISTER-01, DEFAULT)

Choose exactly one register per surface and name it in the report. A brief, a brand voice
guide or the client's own copy overrides the defaults here. The house default for
owner-facing Korean marketing surfaces is the owner register below; every other surface uses
the register that matches its job.

## 1. Owner register (Korean marketing, default for owner surfaces)

Validated by the owner in blind A/B rounds 2 and 3 (2026-11-21, devlog `010b`, `010c`).
Isolated one variable at a time, short, rhythmic and confident lines won; literal, factual,
dense lines lost every time.

| Element | Rule | A/B evidence |
|---|---|---|
| Headline shape | Name + beat ("GOAT. 모든 기기를 한 팀으로") first; parallel pair / 대구 ("에이전트는 어디서든. 결정은 손안에서") second; noun list ("모든 기기. 모든 에이전트. 하나의 화면") third | r02 > r01 > r03 |
| Verb ending | Literary "-다" is welcome ("어디서든, 일하다") | r04 |
| Tone | Plain over witty ("막히면, 휴대폰으로 승인" beat "막히면? 폰으로 승인. 끝.") | r05 |
| Trailing period on headlines | **None** (owner choice; Apple KR uses one on 85%) | r08 |
| Length | About 14 Hangul characters / 4 eojeol per headline | Apple KR median, owner short-line wins c04, c10 |
| Sub line | Exactly one short line; not zero, not a paragraph | r06, c04 |
| CTA | Short generic two-word labels ("다운로드", "더 알아보기") | r10 |
| Copy vs visual | Copy sits beside or above the product visual; do not strip copy to name + button | r07 |
| Imperative and contrast | Allowed ("~하세요", "도구가 아니라, ~") within the device budget | c06, c07 |
| Abstract category line | "AI 에이전트 운영의 새로운 기준" is acceptable (won c02) but loses to name + beat and 대구 | c02, r01 |
| Hangul display tracking | -0.02 to -0.035em on 40px+ display (typography, not copy; see [korea-2026.md](../build/korea-2026.md)) | t07 |

Note on the brand closer ("동네를 여는 문, 당근" shape): the owner chose no brand at the end
in c05. Use name + beat (brand first) instead.

### Apple Korea reference (measured 2026-11-21)

29 apple.com/kr pages, 241 display headlines (40px+, Hangul, footnotes removed):

| Measure | Value |
|---|---|
| Ends with a period or "?" | 205/241 (85%) |
| Median length | 14 characters, 4 eojeol |
| Two or more sentences in one headline | 43 |
| Literary "-다." endings | 20 |
| Polite endings (요, 니다, 세요) | 18 (7%) |
| Weight / tracking | 600 on 211; `normal` on 238 |
| Most common CTAs | "더 알아보기", "구입하기" |

Patterns worth borrowing (from the capture):
- Name + beat: "M5. 쾌속으로 질주하다.", "개인정보 보호. Apple이니까."
- Noun fragments: "놀라운 Mac. 놀라운 실속.", "초스피드. 초효율."
- Parallel pairs: "수고는 덜고, 능력은 더하고.", "겉은 슬림, 속은 프로."
- Literary verbs: "창조하다. 가속하다."
- Spoken Korean and wit: "Mac은 뭐든 척척.", "아침부터 저녁까지 열일 중." (Apple uses wit; the owner preferred plain in the hero)
- Question then answer: "업그레이드할 만한가요? 그럼요."

Where the owner differs from Apple: no trailing period, plain over witty, negative tracking
on large Hangul. The owner's choice governs owner surfaces.

## 2. Product and app UI microcopy

Plain, verb-first, specific. Labels name the action ("저장", "초대 보내기"), errors say what
happened and how to fix it next to the field, empty states point forward. Korean rules and
examples: [ux-writing-ko.md](../build/ux-writing-ko.md). No marketing devices in task UI.

## 3. Public and government

KRDS-minded plain Korean: formal enough, action-oriented, no wit, no fragments, no
abstract slogans. Every sentence states a fact or an action. Dates, amounts and deadlines are
exact and repeated where the user acts.

## 4. Developer tools

Literal and dry with proof: what it does, the command or the API call, a real snippet.
Numbers only when the repo or benchmark supplies them. Short headlines are fine; claims need
a link or code. Mono is for code, not for labels.

## 5. English marketing

Kept loose on purpose. In the owner's tests a category line ("The AI-native orchestration
platform for modern teams.") beat both a literal outcome sentence and Apple-style fragments
(c08, r09), and a short two-fragment line ("Every agent, every machine.") beat a full
sentence (c10). Defaults:
- One headline, one sub line, two short CTAs.
- Category lines and two-fragment lines are allowed; the device budget in
  [copy-process.md](copy-process.md) still applies.
- First-generation tells stay FAIL ([copy-tells.md](copy-tells.md)): residue, invented
  figures, default cast names.

## 6. Editorial and reports

Reports, explainers and documents follow the dev-visualizer voice and evidence rules:
[report writing](../../../dev-visualizer/reference/report-writing.md). Answer first, claims
sourced, no marketing devices.
