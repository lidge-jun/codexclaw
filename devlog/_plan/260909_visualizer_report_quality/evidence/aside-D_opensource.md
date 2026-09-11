# Open-Source Tools and Templates for Professional Report Generation and Prose Polishing

Research report produced on 2026-09-09.

---

## 1. Findings (Structured Rules with Direct Evidence)

### 1.1 Devswha/Patina AI Detection and Deterministic Humanizer
- **Repository**: `https://github.com/devswha/patina` (Publisher: devswha, License: MIT, Opened: 2026-09-09).
- **Core Purpose**: Deterministic, pattern-based humanizer for Korean, English, Chinese, and Japanese. Built for transparent, allowable AI-assisted editing rather than evasion.
- **Architectural Division (Method D vs. Method P)**:
  - *Method D (Deterministic Substrate)*: "Computes its answer from the text with code only: no LLM call, no network, no API key, fully reproducible. Lives in `src/features/*` and the deterministic backstops. This is patina's trust / auditability substrate" (`docs/ARCHITECTURE.md`).
  - *Method P (LLM Transformation)*: "Produces its answer by prompting an LLM — to rewrite, or to narrate a score / audit / diff. Document Type, Persona, and Register may independently shape a rewrite. Method P may change wording but MUST NOT change the underlying claim, numbers, polarity, or causation" (`docs/ARCHITECTURE.md`).
  - *The Binding Invariant*: "No Method-P output ships without a Method-D anchor" (`docs/ARCHITECTURE.md`).
- **Preservation of Numbers and Claims**:
  - In `src/verify.js`, numbers are extracted deterministically via `numbersIn()`:
    ```js
    export function droppedNumbers(original, rewrite) {
      const oNums = numbersIn(String(original ?? ''));
      const rNums = numbersIn(String(rewrite ?? ''));
      return [...oNums].filter((n) => !rNums.has(n));
    }
    ```
  - If numbers vanish from the rewrite, `deterministicMeaningGuard` emits a warning: `"numbers in the source are missing from the rewrite: ..."` (`src/verify.js`).
  - The verification retry appends a strict prompt:
    > "Preserve every claim, number, named entity, polarity, and causal relationship exactly. Prefer leaving a sentence unchanged over altering what it asserts. Only remove AI-pattern wording; never rephrase content whose meaning could shift." (`src/verify.js`)
  - Meaning Preservation Score (MPS) and fidelity floors (default: 70) gate acceptance.
- **Three Independent Axes**:
  - **Document Type**: Owns genre, structural conventions, and pattern policies (e.g., social, report, email).
  - **Persona**: Owns idiolect, vocabulary habits, and rhythm.
  - **Register**: Owns `casual` or `professional` delivery markers.
- **Korean AI Writing Tells (`docs/social/signs-of-ai-writing_KR.md`)**:
  - *Pattern 1 (과도한 중요성 부여 / Grand Paradigm Shifts)*: AI inflates routine actions ("패러다임의 전환을 이끌어냈으며" → "사용자 경험을 크게 바꿨다").
  - *Pattern 3 (과도한 병렬 연결 / Loose Conjunction Stacking)*: Repeated `~하고`, `~하며` chaining ("창의성을 촉진하고, 참여를 도모하며" → "창의성을 키우고 참여를 돕는다").
  - *Pattern 7 (추상적 수식어 결집 / Vague Abstraction Cluster)*: "다양한 혁신적인 접근 방식을 통해" → "여러 새로운 접근으로".
  - *Pattern 8 (~적 접미사 남용 / Suffix Stacking)*: "혁신적이고 전략적인 접근을 통해" → "새롭고 전략을 갖춘 접근 덕분에".
  - *Pattern 10 (3항목 기계적 나열 / Rule-of-Three Enumeration)*: "경제 성장, 사회 통합, 그리고 환경 보전" → "경제 성장과 사회 통합, 환경 보전".
  - *Pattern 13 (문장 첫머리 연결사 남용 / Formulaic Connectors)*: "이러한 맥락에서", "이를 통해", "한편", "이에 따라".
  - *Pattern 15 (불릿마다 볼드 레이블 / Mechanized Bold Bullet Prefixes)*: Mechanical `**Label:**` patterns.
  - *Pattern 22 (의미 없는 서두 지연 / Throat Clearing)*: "주목할 만한 점은 현 시점에서 볼 때 ... 있다는 것이다" → "지금 ... 앞선다".
  - *Pattern 23 (과도한 완화 표현 / Excessive Hedging)*: "판단될 수도 있다는 점에서" → "수 있어".
- **Agent Integration (`docs/agents.md`, `SKILL.md`)**:
  - Designed for coding agents (Claude Code, Codex CLI, Cursor, OpenCode).
  - Default execution path runs the headless CLI helper `bin/patina-skill.js --input <file>`.
  - Three dedicated subagents are defined:
    1. `patina-detector`: Read-only pre-rewrite audit of stylometry, burstiness, and pattern matches.
    2. `patina-fidelity-auditor`: Checks claims, numbers, polarity, causation, and quotes; returns PASS or NEEDS-ROLLBACK.
    3. `patina-naturalness-reviewer`: Inspects rewrite for residual AI tells and assigns grades (A–D).

---

### 1.2 Paged Media Engines: CSS Paged Media (Paged.js, WeasyPrint)
- **W3C CSS Paged Media Module Level 3 & GCPM**:
  - Source: `https://www.w3.org/TR/css-gcpm-3/` & `https://doc.courtbouillon.org/weasyprint/` (Opened: 2026-09-09).
  - *Cover Page Suppression*: Handled via named pages (`@page cover { ... }`) or the pseudo-selector `@page :first`:
    ```css
    @page :first {
      margin: 0;
      @top-center { content: none; }
      @bottom-right { content: none; }
    }
    ```
  - *Table of Contents with Dynamic Page Numbers*: Generated Content for Paged Media Module uses `target-counter()`:
    > "In the CSS, the target-counter property is used within ::before and ::after pseudo-elements... content: target-counter(attr(href), page);" (`https://pagedjs.org/posts/en/build-a-table-of-contents-from-your-html`)
    ```css
    #toc a::after {
      content: leader('.') " " target-counter(attr(href), page);
      float: right;
    }
    ```
  - *Running Headers via Named Strings (`string-set`)*:
    > "Named strings are used to create running headers and footers: they copy text for reuse in margin boxes." (`https://pagedjs.org/en/documentation/7-generated-content-in-margin-boxes`)
    ```css
    h2 { string-set: section-title content(text); }
    @page {
      @top-right { content: string(section-title, first); }
      @bottom-right { content: counter(page) " / " counter(pages); }
    }
    ```
  - *Running Elements (`position: running()`)*: Used when rich HTML (logos, multi-line metadata) must be moved into margin boxes:
    ```css
    header.running-header { position: running(docHeader); }
    @page { @top-center { content: element(docHeader); } }
    ```
  - *Widows, Orphans, and Page Breaks*:
    ```css
    p { orphans: 2; widows: 2; }
    h1, h2, h3 { break-after: avoid; }
    .table-container, .figure-box { break-inside: avoid; }
    ```

---

### 1.3 Typst Report Templates & Universe Packages
- **Platform**: `https://typst.app/docs/` & `https://typst.app/universe/` (Opened: 2026-09-09).
- **Core Document Architecture**:
  - *Modern Project Report (`@preview/modern-project-report:0.1.0`)*: Features dynamic running headers powered by Typst's `context` API, formal cover page blocks, structured outlines via `outline(indent: auto)`, and binding margin offsets.
  - *Basic Report (`@preview/basic-report`)*: Separates frontmatter (cover, Roman numeral page numbers `i`, `ii`) from main matter (Arabic page numbers `1`, `2`) and supports a `compact-mode`.
  - *Biz-Report (`@preview/biz-report:0.3.1`)*: Multi-chapter business report with front/back cover templates, alternating table fills, and callout infoboxes.
- **Page Furniture Implementation in Typst**:
  - *Cover Page & Suppressed Header*:
    ```typst
    #set page(
      paper: "a4",
      margin: (x: 2.5cm, top: 3cm, bottom: 2.5cm),
      header: context {
        let page-num = counter(page).get().first()
        if page-num > 1 [
          #text(9pt, fill: luma(100))[Company Name | Confidential]
          #h(1fr)
          #text(9pt, fill: luma(100))[Strategic Review 2026]
        ]
      },
      footer: context {
        let page-num = counter(page).get().first()
        if page-num > 1 [
          #h(1fr)
          #counter(page).display("1")
        ]
      }
    )
    ```
  - *Frontmatter vs. Mainmatter Numbering Reset*:
    ```typst
    // Frontmatter (TOC, Exec Summary)
    #set page(numbering: "i")
    #counter(page).update(1)
    #outline(indent: auto)
    #pagebreak()

    // Main Body
    #set page(numbering: "1")
    #counter(page).update(1)
    ```
  - *Figure and Table Numbering*: Built-in auto-numbering via `#figure(caption: [...])[...]` with cross-referencing `@fig-label`.

---

### 1.4 Quarto / Pandoc Report Pipelines
- **Source**: `https://github.com/quarto-dev/quarto-cli` (Opened: 2026-09-09).
- **Architecture**: Quarto decomposes Pandoc's template pipeline into partials:
  - `template.typ`: Orchestrates `definitions.typ`, `page.typ`, `typst-show.typ`, `notes.typ`, `biblio.typ`.
  - `page.typ`: Sets page geometry, paper sizes, margins.
  - `typst-template.typ`: Applies document typography, title blocks, author affiliations, and table of contents options (`toc`, `toc_depth`, `toc_title`).
  - Supports LaTeX export via `template.tex` with `\frontmatter`, `\mainmatter`, and `\backmatter` switches, `geometry`, `fancyhdr`, and hyperref configuration.

---

### 1.5 Strategy Consulting "Action Titles" and Storyline (SCQA)
- **Sources**:
  - Slide Science: "Crafting Slide Action Titles Like A Consultant", Daniel Galletta (`https://slidescience.co/action-titles/`, Opened: 2026-09-09).
  - SlideWorks: "How to Write Slide Action Titles Like McKinsey", Alexandra Kampmann & Mats Stigzelius (`https://slideworks.io/resources/how-to-write-action-titles-like-mckinsey`, Opened: 2026-09-09).
- **Definition & Core Rules**:
  - *Action Title vs. Label Title*: A label title names the topic ("Cost Overview"); an action title asserts the finding and insight ("Costs have grown 7% per year over the last 5 years, double our revenue growth").
  - *Anatomy*: Must be a full sentence containing a specific, quantified claim, a timeframe/scope, and active phrasing.
  - *Length*: Maximum 15 words, at most two lines.
  - *Horizontal Logic*: Reading only the top action titles sequentially must narrate the entire argument from start to finish without reading body charts or paragraphs.
  - *Storyline Framework (SCQA)*:
    1. **Situation**: Undisputed context ("Our product leads domestic market share at 42%").
    2. **Complication**: The emerging challenge ("Customer acquisition costs jumped 65% in Q2 due to new entrants").
    3. **Question**: The core decision hurdle ("How can we maintain retention without escalating ad spend?").
    4. **Answer**: The strategic solution ("Reallocate 40% of acquisition budget into automated onboarding").

---

### 1.6 Prose Linters and Writing Style Rules
- **Vale Prose Linter**:
  - Source: `https://github.com/errata-ai/vale` & `https://vale.sh/` (Publisher: errata-ai, License: MIT, Opened: 2026-09-09).
  - Syntax-aware: parses Markdown, AsciiDoc, HTML, and code blocks rather than treating documents as raw text strings.
  - Extension styles: `errata-ai/Google` (Google Developer Documentation Style Guide), `errata-ai/Microsoft` (Microsoft Writing Style Guide), `errata-ai/write-good` (weasel words, passive voice, wordiness).
- **Google Developer Documentation Style Guide**:
  - Source: `https://developers.google.com/style/headings` (Publisher: Google LLC, Opened: 2026-09-09).
  - Headings: Task-based headings must use a bare infinitive / imperative verb ("Create an instance", not "Creating an instance"). Conceptual headings use noun phrases without initial *-ing* ("Migration to Google Cloud", not "Migrating to Google Cloud").
  - Hierarchy: Use exactly one `h1` per document; maintain strict logical nesting without skipping levels.
- **textlint Rule Presets (Japanese & Korean)**:
  - Source: `https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing` (License: MIT, Opened: 2026-09-09).
  - Key technical writing rules:
    - `sentence-length`: Maximum 100 characters per sentence.
    - `max-ten`: Maximum 3 punctuation marks (commas/読点) per sentence.
    - `max-kanji-continuous-len`: Maximum 6 consecutive Kanji characters.
    - `no-doubled-conjunction`: Flags duplicate consecutive conjunctions.
    - `no-doubled-joshi`: Flags repetitive postpositional particles.
    - `ja-no-weak-phrase`: Flags weak hedges like "〜かもしれない" or "〜と思います".

---

## 2. Sample Document Anatomy (Page-by-Page)

A standard 6-part executive/technical report layout configured for professional presentation:

```
[Page 1: Cover] -> [Page 2: Contents] -> [Page 3: Executive Summary] -> [Pages 4-N: Main Body] -> [Appendix] -> [Back Cover / Disclaimers]
```

### Page 1: Cover Page (Title Page)
- **Visual Elements**:
  - Primary organization logo (top left or centered).
  - Document title in large display font (28–36 pt, semi-bold/bold).
  - Action-oriented subtitle stating the document's core thesis (14–16 pt).
  - Metadata block: Author/Team, Target Organization, Classification (e.g., "Confidential / Internal Use Only"), and Publication Date.
- **Page Furniture Mechanics**:
  - Margins: Standard or full-bleed branding.
  - Running Headers & Footers: Strictly suppressed (`content: none` or `if page-num > 1`).
  - Page Numbering: Logical counter unprinted or initialized at 0.

### Page 2: Table of Contents (TOC) & Document Controls
- **Visual Elements**:
  - Heading: "Table of Contents" / "목차".
  - Two-level hierarchical section list with dot leaders connecting titles to page numbers.
  - Optional List of Figures / List of Tables if technical density is high.
  - Document Revision Block (Version, Date, Author, Change Summary).
- **Page Furniture Mechanics**:
  - CSS: `target-counter(attr(href), page)` with `leader('.')`.
  - Typst: `#outline(indent: auto)`.
  - Page Numbering: Lowercase Roman numeral (`i` or `ii`).
  - Header: Document title left-aligned; footer contains Roman numeral.

### Page 3: Executive Summary / Executive Briefing
- **Visual Elements**:
  - Clear SCQA structure laid out on a single standalone page:
    - *Context / Situation*: 1 concise paragraph.
    - *Challenge / Complication*: 1 concise paragraph.
    - *Core Recommendations / Answer*: 3 distinct bullet points with quantified targets.
  - Key Metric Callout Box (e.g., 3 stat callouts: "14% Cost Reduction", "$2.4M ARR Impact", "4-Month Payback").
- **Page Furniture Mechanics**:
  - Running header active: Section Title ("Executive Summary").
  - Running footer active: Roman numeral or transition to Arabic page 1.

### Pages 4–N: Main Report Body
- **Visual Elements**:
  - Each major chapter/section begins with an **Action Heading** (e.g., "Section 2. Infrastructure Costs Rose 48% Following Cloud Migration").
  - Content structured in inverted pyramid: core finding first, followed by evidence paragraphs, followed by data tables/charts.
  - Visual breaks: Every page must contain at least one visual element (table, diagram, or callout box) to anchor reading.
- **Page Furniture Mechanics**:
  - Running Header: Top-left has Document Title, Top-right has dynamic Chapter Name (`string-set` / Typst `context query`).
  - Running Footer: Bottom-left has Confidentiality Notice, Bottom-right has Arabic page number (`counter(page)` or "Page X of Y").
  - Widow/Orphan Protection: Minimum 2 lines kept together; headings have `break-after: avoid`.

### Page N+1: Appendix & Technical Notes
- **Visual Elements**:
  - Detailed methodology descriptions, data sources, calculation assumptions, and raw tabular data.
  - Sub-lettered numbering (Appendix A, Appendix B).
- **Page Furniture Mechanics**:
  - Page numbering continues or resets to alphanumeric (A-1, A-2).

### Page N+2: Back Matter / Disclaimers & Legal Notices
- **Visual Elements**:
  - Standard compliance statements: Non-disclosure notice, forward-looking statements disclaimer, trademark acknowledgments.
  - Contact Information / Support Channels.
- **Page Furniture Mechanics**:
  - Running headers suppressed.
  - Page number suppressed or formatted as backmatter.

---

## 3. Professional Writing Rules

### 3.1 Title and Heading Conventions
1. **Action-Driven H1/H2 Headings**: Headings must declare the substantive finding, not merely describe the subject matter.
   - *Weak*: "Q3 Financial Performance"
   - *Professional*: "Q3 Operating Margin Rose 3.2% Due to Automated Supply Chain Routing"
2. **Imperative Mood for Procedures**: How-to and process documentation headings must begin with a bare infinitive verb.
   - *Standard*: "Deploy the Model to Staging", never "Deploying the Model to Staging".
3. **Noun Phrases for Conceptual Overview**: Explanatory sections use clean noun phrases without leading gerunds.
   - *Standard*: "Architecture Overview", never "Understanding the Architecture".
4. **Length and Scannability**: Action titles must not exceed 15 words or 2 lines.

### 3.2 Paragraph and Sentence Architecture
1. **Inverted Pyramid Construction**: The opening sentence of every paragraph must state the primary conclusion or argument. Supporting evidence, context, and secondary data follow.
2. **Sentence Length Constraints**:
   - English: Average 15–20 words; hard limit 30 words.
   - East Asian (KO/JA): Hard limit 100 characters per sentence (as enforced by `textlint-rule-preset-ja-technical-writing` and Patina).
3. **Punctuation and Clutter Control**:
   - Limit commas to a maximum of 3 per sentence (`max-ten` / `max-comma`).
   - Eliminate robotic bold labeling in bullet lists (Patina Pattern 15).
   - Prohibit stacking of abstract conjunctions (`이를 통해`, `이러한 맥락에서`, `이에 따라`).
4. **Active Voice and Direct Attribution**:
   - Use active voice whenever possible (`write-good` Passive check). State who performed the action.
   - Avoid empty nominalizations ("conduct an investigation of" → "investigate").

### 3.3 Number and Evidence Conventions
1. **Verifiable Anchors**: Every claim must be tied to a specific number, time window, and verified source.
   - *Vague*: "We noticed substantial growth in user engagement recently."
   - *Rigorous*: "Daily active users increased 18.4% between June and August 2026."
2. **Number Preservation Invariant**: When refining or humanizing text, numeric quantities and units must be preserved verbatim (`patina` `droppedNumbers()` check).
3. **Numeral vs. Word Formatting**:
   - Use numerals for countable, quantitative metrics, percentages, currency, and measurements (5 kg, 12%, $400).
   - Use words for idiomatic or non-quantitative figures ("one another", "in first place").
4. **Factual Polarity and Causation Guard**: Never flip the polarity of an outcome or infer causal relationships not substantiated in the primary findings.

---

## 4. Sources and Reference Catalog

All sources opened and verified on 2026-09-09:

1. **devswha/patina**
   - Title: *patina: Strip the AI packaging. Keep the meaning.*
   - Publisher: devswha (GitHub Repository)
   - URL: `https://github.com/devswha/patina`
   - Date opened: 2026-09-09
2. **devswha/patina Architecture Documentation**
   - Title: *patina architecture: the two engine lanes* (`docs/ARCHITECTURE.md`)
   - Publisher: devswha
   - URL: `https://github.com/devswha/patina/blob/main/docs/ARCHITECTURE.md`
   - Date opened: 2026-09-09
3. **devswha/patina Korean AI Writing Signs Guide**
   - Title: *AI가 쓴 글처럼 보이는 신호 10가지* (`docs/social/signs-of-ai-writing_KR.md`)
   - Publisher: devswha
   - URL: `https://github.com/devswha/patina/blob/main/docs/social/signs-of-ai-writing_KR.md`
   - Date opened: 2026-09-09
4. **devswha/patina Verification Engine**
   - Title: *patina verify engine* (`src/verify.js`)
   - Publisher: devswha
   - URL: `https://github.com/devswha/patina/blob/main/src/verify.js`
   - Date opened: 2026-09-09
5. **devswha/patina Agent Orchestrator Documentation**
   - Title: *Patina Subagents — Optional Multi-Agent Strict Flow* (`docs/agents.md`)
   - Publisher: devswha
   - URL: `https://github.com/devswha/patina/blob/main/docs/agents.md`
   - Date opened: 2026-09-09
6. **W3C CSS Generated Content for Paged Media Module Level 3**
   - Title: *CSS Generated Content for Paged Media Module* (W3C Working Draft)
   - Publisher: World Wide Web Consortium (W3C)
   - URL: `https://www.w3.org/TR/css-gcpm-3/`
   - Date opened: 2026-09-09
7. **CourtBouillon WeasyPrint Documentation**
   - Title: *Features — WeasyPrint Documentation*
   - Publisher: CourtBouillon
   - URL: `https://doc.courtbouillon.org/weasyprint/`
   - Date opened: 2026-09-09
8. **Paged.js Table of Contents Guide**
   - Title: *Build a Table of Contents from your HTML*
   - Publisher: Paged Media Initiative / Paged.js
   - URL: `https://pagedjs.org/posts/en/build-a-table-of-contents-from-your-html`
   - Date opened: 2026-09-09
9. **Paged.js Margin Boxes & Generated Content**
   - Title: *Generated Content in Margin Boxes*
   - Publisher: Paged Media Initiative / Paged.js
   - URL: `https://pagedjs.org/en/documentation/7-generated-content-in-margin-boxes`
   - Date opened: 2026-09-09
10. **Typst Documentation: Page Setup Guide**
    - Title: *Page Setup Guide - Typst Documentation*
    - Publisher: Typst GmbH
    - URL: `https://typst.app/docs/guides/page-setup/`
    - Date opened: 2026-09-09
11. **Typst Universe Package: modern-project-report**
    - Title: *modern-project-report: A clean, modern college and university project report template*
    - Publisher: Typst Universe
    - URL: `https://typst.app/universe/package/modern-project-report/`
    - Date opened: 2026-09-09
12. **Typst Universe Package: basic-report**
    - Title: *basic-report – Typst Universe*
    - Publisher: Typst Universe
    - URL: `https://typst.app/universe/package/basic-report`
    - Date opened: 2026-09-09
13. **Typst Universe Package: biz-report**
    - Title: *biz-report – Typst Universe*
    - Publisher: Typst Universe
    - URL: `https://typst.app/universe/package/biz-report/`
    - Date opened: 2026-09-09
14. **Quarto CLI Pandoc-Typst Templates Documentation**
    - Title: *pandoc-quarto-typst-templates.md*
    - Publisher: Posit Software, PBC / quarto-cli
    - URL: `https://github.com/quarto-dev/quarto-cli/blob/main/llm-docs/pandoc-quarto-typst-templates.md`
    - Date opened: 2026-09-09
15. **Slide Science Action Titles Guide**
    - Title: *Crafting Slide Action Titles Like A Consultant [Examples]*
    - Publisher: Slide Science (Daniel Galletta)
    - URL: `https://slidescience.co/action-titles/`
    - Date opened: 2026-09-09
16. **SlideWorks McKinsey Action Titles Guide**
    - Title: *How to Write Slide Action Titles Like McKinsey (With Examples)*
    - Publisher: SlideWorks (Alexandra Kampmann, Mats Stigzelius)
    - URL: `https://slideworks.io/resources/how-to-write-action-titles-like-mckinsey`
    - Date opened: 2026-09-09
17. **Vale CLI Documentation & Repository**
    - Title: *Vale: A markup-aware linter for prose*
    - Publisher: errata-ai (Joseph Kato)
    - URL: `https://github.com/errata-ai/vale` & `https://vale.sh/`
    - Date opened: 2026-09-09
18. **Google Developer Documentation Style Guide**
    - Title: *Headings and titles | Google developer documentation style guide*
    - Publisher: Google LLC
    - URL: `https://developers.google.com/style/headings`
    - Date opened: 2026-09-09
19. **textlint Japanese Technical Writing Rule Preset**
    - Title: *textlint-rule-preset-ja-technical-writing*
    - Publisher: textlint-ja
    - URL: `https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing`
    - Date opened: 2026-09-09
20. **write-good Linter & Vale Implementation**
    - Title: *errata-ai/write-good: A Vale-compatible implementation of the write-good linter*
    - Publisher: errata-ai
    - URL: `https://github.com/errata-ai/write-good`
    - Date opened: 2026-09-09
