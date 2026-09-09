# Report writing — storyline, headings, paragraphs, exhibits

Use this reference for any multi-page report a person will read to decide
something: client progress reports, research reports, proposals, review
documents. `dev/references/reader-documents.md` (READER-DOC-01..05) owns the
reader contract and answer-first structure; this file owns what a report needs
on top of that so it reads like a professional publication rather than a
transcript of the work. Rule IDs are REPORT-*. STRICT rules are checked before
delivery; DEFAULT rules are followed unless the user or a supplied template says
otherwise.

Sources inspected 2026-09-09 (ledger: `devlog/_plan/260909_visualizer_report_quality/`):
Minto Pyramid Principle and McKinsey/Bain public report PDFs; KOFIA 조사분석자료
규정 and Samsung/SK/Kyobo Securities research PDFs; KDI, Bank of Korea issue notes;
행정안전부 행정업무운영 편람 and 대통령비서실 보고서 작성 매뉴얼; Japanese securities
analyst guidance and 白書 formats; GAO/GOV.UK/World Bank report anatomy; patina
(`devswha/patina`, MIT) Korean AI-writing signs; textlint/Vale rule packages.

## REPORT-STORY-01 The document is one argument (STRICT)

Answer-first (두괄식) and a felt storyline are not in tension. The answer opens
the document; the sections then walk the reader from the situation they already
accept to the decision being asked of them. Build the storyline before writing
any section:

| Beat | What it carries | Typical section |
|---|---|---|
| Situation | Facts the reader already accepts, in their own terms | 배경 / 지금 상황 |
| Complication | What changed or what blocks the goal, with numbers | 확인된 문제 |
| Answer | The governing claim, stated once, early | 한 장 요약 |
| Reasoning | Why the answer holds: evidence, mechanism, comparison | 본문 2–4개 절 |
| Plan | What happens, when, who owns it, how success is measured | 실행 계획 / 지표 |
| Ask | The decisions the reader must make, and what each one costs | 요청 사항 |

Start from the reader's problem, never from the author's arrival or activity
("우리 팀이 왔다", "커밋 67건"). Input metrics such as commits, PRs, hours or
meetings are not outcomes; use them only when the reader asked for them, and then
in an appendix. Each beat appears once; do not restate the same paragraph in the
summary, a body section and a figure caption. A report that lists what was done in
the order it was done fails this rule even if every sentence is true.

Write the storyline as a dot-dash outline before any HTML: one dot per section
holding its claim heading, dashes under it naming the evidence (figure, table,
number with period) that proves the dot. Minto's three tests apply to the outline:
each heading summarizes what is under it, siblings are the same kind of idea, and
their order is deductive, chronological, structural or by importance, chosen on
purpose. Fix the outline until the dots alone persuade; only then write prose.

## REPORT-STORY-02 Headings are claims that read in sequence (STRICT)

Every H2 (section) and every exhibit title states the finding of that unit as a
sentence a reader could disagree with. Topic labels ("지금 숫자가 말하는 것",
"주차별 계획", "Market overview") and questions ("왜 AX팀이 왔는가") are not
headings. Test the horizontal logic: read only the H2s from top to bottom; they
must narrate the whole argument and end at the ask. Keep a heading to one line at
heading size (roughly 15 English words or 30 Korean characters); put the number,
period and scope in it when the claim depends on them.

| Label heading | Claim heading |
|---|---|
| 2. 지금 숫자가 말하는 것 | 2. 소재를 바꾸자 ROAS가 119%에서 220%로 올랐다 |
| 4. 도입 단계에서 확인된 제약 | 4. 제작은 되는데 저장·선별 자리가 없어 양산이 막힌다 |
| 9. 얼라인이 필요한 것 | 9. 이번 주에 정해야 할 결정은 세 가지다 |

Section numbers are fine and help cross-reference; they do not replace the claim.
Sub-headings (H3) may be shorter, but still say what, not merely about what.

## REPORT-SUMMARY-01 The summary decides alone (STRICT)

Right after the contents page, one page states the whole argument for a reader
who reads nothing else: situation and complication in one paragraph, the answer
in one sentence, three to five supporting claims each with its number and period,
and the decisions requested with the consequence of not deciding. Write it as
prose or numbered claims, not fragment bullets copied from section titles. No
jargon the reader did not bring (ACP, BM 로직, CDN): name the effect instead.
Korean securities reports call this "Investment Summary / What's the story";
GAO calls it "Highlights"; the function is the same. The summary page is full,
not four boxes above a half-page of white.

## REPORT-PARA-01 Paragraphs carry one idea, sentences carry one clause each (DEFAULT)

- First sentence states the paragraph's claim; the rest supports it. A reader who
  reads only first sentences gets the argument.
- Three to six sentences per paragraph; a single-sentence paragraph is a signal,
  used rarely. Prose, not bullet fragments, for anything that argues; bullets only
  for parallel items the reader will scan or count.
- Korean sentence: two to three printed lines at most (about 50–80 syllables);
  split at 100. Prefer 한 문장 = 한 주장. No double passives (되어진다, 보여진다);
  no chained ~하고/~하며 beyond two clauses; no formula sentences repeated across
  sections; no staccato runs of 20-character declaratives either.
- Anchor: every sentence with a number, comparison or causal claim resolves to a
  source line, an appendix anchor or a stated assumption (READER-DOC-04). State the
  baseline before the change ("7.6%에서 10.6%로"), the period, and the denominator.
- Do not lecture the reader ("대신 해주면 원래대로 돌아갑니다") or hedge to avoid a
  number. If a target is not set, say what will be measured and when it becomes a
  target.
- No em dashes (—) in Korean prose, headings or captions: they are the most
  visible AI tell in a printed page and Korean typography has no use for them.
  Use a comma, a period, parentheses or a colon. Reserve the en dash for numeric
  ranges (9/7–9/13). The same goes for bold-label bullets (**항목:** 설명) and
  three-item lists produced by reflex.

## REPORT-REGISTER-01 One register, chosen on purpose (STRICT)

Pick the register from the reader relationship and hold it through every page,
including captions, table cells and the cover subtitle:

| Register | Use when | Endings |
|---|---|---|
| 평서체 (해라체) | Research, analysis, policy, anything published to many readers; the securities/think-tank default | ~다, ~된다, ~로 판단된다 |
| 합쇼체 | A report or proposal addressed to a named reader or client | ~습니다, ~입니다 |
| 개조식 | Government/administrative reports that follow 행안부 편람 | 명사형 종결 (~수립, ~완료) |

Mixing registers (합니다 in body, ~다 in captions) is a defect. Dates in Korean
administrative style are `2026. 9. 9.`; elsewhere `2026년 9월 9일` or ISO. Use
Arabic numerals, thin spaces or commas consistently, and one unit style
(억 원 / 만 원, not 천원 for large figures).

## REPORT-EXHIBIT-01 Every exhibit is numbered, titled as a claim, sourced (STRICT)

- Number figures and tables separately and sequentially (그림 1, 표 1 / Figure 1,
  Table 1); refer to them by number in the text.
- The title is the takeaway ("그림 2. 랜딩 교체 후 전환율이 7.6%→10.6%로 올랐다"),
  not the subject ("전환율 추이").
- A source line sits directly under the exhibit: `자료: 마케팅팀 성과 기록
  (2026-08-24~09-07), AX팀 정리` with period and any estimation marked.
- Units, denominators and truncated axes are stated on the exhibit.
- Do not draw a figure that restates a table on the same page; a diagram earns its
  place by showing structure, flow or comparison the table cannot.
- Print legibility floor is in `visual-design.md` (REPORT-VIZ-01): text inside an
  SVG must print at 8.5pt or larger with body-text contrast.
- Choose the chart by the comparison it proves (component, item, time series,
  distribution, correlation); label data directly; give the one series that
  carries the claim the only strong color.

## REPORT-BRAND-01 The issuer is named the way the reader knows it (STRICT)

The cover names the organization that stands behind the document as the reader
recognizes it (the company or brand: "Devfiance"), with the internal team in the
author line, never the reverse. Brand tokens (organization name, mark, palette,
type stack, header text) live in one block at the top of the template so a house
style can replace them without touching content. A report for a client carries
both the issuer and the recipient on the cover; confidentiality and version sit
with the date. Consistent identity across every document the reader receives is
part of what makes work look finished; inconsistent naming between the cover and
the running header reads as careless.

## REPORT-ANATOMY-01 Page furniture of a report (DEFAULT)

For anything over about four pages, the delivered document has, in order:

1. **Cover**: organization/eyebrow, title as the governing claim, subtitle with
   scope and period, author/team, date, recipient, version and confidentiality.
   No running header or page number on the cover.
2. **Contents**: section numbers, claim headings, page numbers. Add a one-line
   result under each entry only if it is different from the heading. Lists of
   figures/tables when there are more than about six.
3. **Summary** (REPORT-SUMMARY-01), one full page.
4. **Body** sections in storyline order (REPORT-STORY-01), each opening with its
   claim heading and a first paragraph that states the section's answer.
5. **Limits and next steps**: what the document does not cover; who does what by when.
6. **Appendix**: evidence anchors, methodology, data tables, access lists, glossary.
7. **Notice**: sources, confidentiality, contact; for securities-style reports the
   analyst certification and conflict disclosures required by the regulator.

Running header on every body page: document title (left) and date or
section (right); page number at the bottom; A4 unless the recipient's standard is
Letter. Mechanics and engine limits are in `document-pdf.md` (REPORT-PRINT-01).

What the traditions share and where they differ (inspected 2026-09-09; details in
the evidence ledger):

| Tradition | Front matter | Summary | Headings | Exhibits and notices |
|---|---|---|---|---|
| McKinsey / Bain / BCG, MGI | Cover, detailed contents, preface | Answer first; Bain "At a Glance" box per chapter | Action titles that read through in sequence | Numbered exhibits with claim titles and a source line; methodology appendix |
| 한국 증권사 리서치 | 1쪽 대시보드: 투자의견·목표주가·핵심 지표·애널리스트 | 1쪽 "Investment Summary / What's the story" | 주장형 문장 | `<표 1>`, `<그림 1>`, `자료: ○○증권 리서치센터`; 마지막 쪽 컴플라이언스 고지 (금투협 규정) |
| 한국 정책연구·공공 | 시리즈 표지, 발간사, 목차·표목차·그림목차 | 요약 1–3쪽 | 장·절 주제형 (연구) / 두괄식 개조식 (행정) | 자료: 줄, 공공누리; 저자 개인 견해 고지 |
| 日本 セルサイド・白書・NRI/MRI | 1쪽 통합 대시보드 (셀사이드) / 総目次+目次+凡例 (白書) | 要旨·サマリー; 白書は概要 별책 | 헤드라인은 주장형, 白書는 주제형; NRI는 提言① 형식 | 図表 번호, 出所: 줄, 免責事項 |
| US GAO, GOV.UK, World Bank/IMF | Standard cover with document ID; contents with lists of figures/tables | GAO "Highlights" page: why / what we found / what we recommend | Full declarative sentences (GAO); topical (multilateral) | Figure/table numbering, source notes, abbreviations list |

The shared core is what REPORT-* encodes: a summary that decides alone, headings
that carry the finding, numbered and sourced exhibits, and a notice page. Adopt the
securities dashboard cover only when the document really has a rating-style
verdict; otherwise the consulting cover (claim title, scope subtitle, meta) fits.

## REPORT-POLISH-01 Polish after structure, and keep the numbers (DEFAULT)

Order of work: storyline and headings (this file) → paragraph structure → sentence
polish → layout → render check. Sentence polish for Korean is `$cxc-kwrite` (four
passes: register, translationese/AI idioms, mechanical structure, rhythm). Use the
patina Korean signs list as a second checklist: inflated significance, ~적 suffix
stacking, three-item enumerations, connector openers (이러한 맥락에서, 이를 통해),
bold-label bullets, throat-clearing openers, excessive hedging. If `patina` is
installed, its deterministic detector may run on the Markdown or extracted text;
its fidelity check (numbers, polarity, causation must survive a rewrite) is the
standard for any polish pass, whether or not the tool runs. A polish pass that
changed a number, a direction or a cause is rolled back.

## REPORT-FRESH-01 A stranger reads it before the reader does (STRICT for delivered reports)

READER-DOC-05 applies with a report-specific script: the fresh reader (a subagent
with no task context, or a different model) reads the rendered PDF pages, not the
HTML, and reports the answer, the reason to believe it, the ask, the page where
they stopped, and every heading that did not state a claim. Fix structure before
sentences. Record who read, what they stumbled on and what changed in the
evidence section.
