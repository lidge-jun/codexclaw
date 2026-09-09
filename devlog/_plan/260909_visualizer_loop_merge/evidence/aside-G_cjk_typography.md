# CJK Print Typography for Chromium HTML-to-PDF (A4 Reports)

Research date opened for all web sources: 2026-09-09.
Scope: Korean (ko), Japanese (ja), Simplified/Traditional Chinese (zh-CN/zh-TW); horizontal writing only; Chromium print (`@page A4`, headless/PDF).

## 1. Findings

### 1.1 Korean (ko)

**K1. klreq line breaking: character- or word-based, author chooses.**
W3C klreq says line breaking for Hangul runs is decided per paragraph or whole document: "If a line ends in Hangul, line breaking is done on character or word basis. The user can decide which approach to use on a paragraph-by-paragraph basis, or for the whole document." <citation refs="t-ugYYZFQHAmftJUnm4Nq">If a line ends in Hangul, line breaking is done on character or word basis</citation>
CSS mapping: character-based = default CJK breaking (`word-break: normal`); word-based = `word-break: keep-all` (breaks only at spaces). MDN defines keep-all as "Word breaks should not be used for Chinese/Japanese/Korean (CJK) text. Non-CJK text behavior is the same as for `normal`." <citation refs="rZDVCIS6E1FbjDY-Y8H8S">Word breaks should not be used for Chinese/Japanese/Korean (CJK) text</citation> For formal Korean reports, `keep-all` is the standard recommendation because breaking mid-word (글자단위) looks sloppy in body text; character-based breaking is reserved for narrow columns.

**K2. Line-start prohibition exists in Korean too.**
klreq: "Lines cannot start with closing parenthesis (cl2), hyphen (cl5), dividing punctuation marks (cl6), middle dots (cl7), periods and commas (cl8~9), iteration marks (cl11), or prolonged sound marks (cl12)." <citation refs="t-ugYYZFQHAmftJUnm4Nq">Lines cannot start with closing parenthesis (cl2), hyphen (cl5), dividing punctuation marks (cl6), middle dots (cl7)</citation> The OOXML/ECMA reference character lists for Korean are concrete: line-start forbidden `*!%),.:;?]}¢°'""′′′°C〉》」』】〕!%),.:;?]}¢` and line-end forbidden `*$([\{£¥'"〈《「『【〔$([{£¥₩`. <citation refs="6P51lwYAOMICpj_7rHfVo">Characters that are not allowed at the start of a line: *!%),.:;?]}¢°'""′′′°C〉》」』】〕!%),.:;?]}¢</citation> Chromium handles this via `line-break: strict/normal` plus UAX #14 classes; `strict` is the strictest prohibition set. <citation refs="Qzwh1Z3ZBTsUtXtJojI3R">Break text using the most stringent line break rule</citation>

**K3. First-line indent is one full character width; hanging punctuation is an open question.**
klreq: "Indentation, by emptying the beginning of a line when a new paragraph starts, is applied so that the division into paragraphs is shown clearly. The value of the character width in the specific paragraph is used as the default unit for indentation." <citation refs="t-ugYYZFQHAmftJUnm4Nq">The value of the character width in the specific paragraph is used as the default unit for indentation</citation> CSS: `p { text-indent: 1em; }`. klreq explicitly lists "Does Korean use hanging punctuation at line start/end?" as open issue w3c/klreq#62 with no conclusion, so there is no klreq basis either for or against hanging punctuation in Korean; the safe Chromium choice is to keep punctuation inside the measure (hanging-punctuation is unsupported in Chrome anyway). <citation refs="t-ugYYZFQHAmftJUnm4Nq">Does Korean use hanging punctuation at line start/end?</citation> klreq does normatively cover widow handling (§7.2.3.5 위도우 처리).

**K4. Horizontal Korean punctuation: half-width `.` `,` plus full-width quotes/brackets.**
klreq: "CJK 전각 기호와 문장부호(CJK Symbols and Punctuation; U+3008~U+300F)를 기본으로 사용한다. 단, 구독점의 경우, 가로짜기에는 반각 문장 부호(반점(쉼표); U+002C, 온점(마침표); U+002E)를, 세로짜기에는 전각 문장 부호(모점; U+3001, 고리점; U+3002) 사용을 기본값으로 한다." <citation refs="t-ugYYZFQHAmftJUnm4Nq">가로짜기에는 반각 문장 부호(반점(쉼표); U+002C, 온점(마침표); U+002E)를, 세로짜기에는 전각 문장 부호(모점; U+3001, 고리점; U+3002) 사용을 기본값으로 한다</citation> In practice: horizontal Korean body uses ASCII `.` `,` `?` `!` with proportional Latin glyphs, and full-width `「」『』〈〉《》` families plus `·` (가운뎃점, U+00B7) for lists. klreq horizontal-vs-vertical quote default: 가로짜기 `" " ' '`, 세로짜기 `「」 『』`. Authoritative punctuation semantics come from 문화체육관광부 고시 한글 맞춤법 (시행 2017. 3. 28) and its 문장부호 annex, served on the 국립국어원 Korean norms page. <citation refs="00TT2GxKeCxp4hj7-GS2e">한글 맞춤법[시행 2017. 3. 28.] 문화체육관광부 고시 제2017-12호</citation> The 2015/2017 revision was organised around 가로쓰기 (policy briefing: "가로쓰기를 기준으로 문장 부호 용법을 정비... 고리점과 모점이 제외됐다"). Key rules: 마침표 `.` ends statements and marks dates in principle as `3.1 운동` / `8.15 광복`, with 가운뎃점 `3·1 운동` explicitly allowed as substitute; 쉼표 `,` (= 반점) lists, pairs, clauses, and inserted phrases (15 sub-rules; no comma before 줄임표); 가운뎃점 `·` groups listed items (`민수·영희`), pairs (`한·이 양국`), and shared-component compounds (`상·중·하위권`, substitutable with 쉼표) - it marks enumeration, never a range (ranges take `~`); book/newspaper titles take 겹낫표 『 』 or 겹화살괄호 ≪ ≫ with 큰따옴표 " " allowed as substitute; sub-titles and artwork names take 홑낫표 「 」 or 홑화살괄호 〈 〉 with 작은따옴표 ' ' allowed as substitute; direct speech/quoted text takes 큰따옴표, quote-in-quote and inner thought take 작은따옴표.

**K5. Korean body-text metric convention (practice, not W3C normative).**
klreq §7.4.1 shows proportional line spacing with an example figure of 160% ("Certain percentage of the character size: 160%"), but 160-180% is not a klreq normative range, and klreq §8.1 lists type size only as a layout element with no pt values — so the widely used Korean publishing/report convention of body 9.5-10.5pt with 160-180% line height (행간, = Word 1.6-1.8) must be labelled "Korean print practice", not klreq. klreq's normative statements here: 양끝 정렬 (justified) is the default, applied with inter-character adjustment only for proportional-width runs (Latin, numerals, mixed sizes, kinsoku); CJK characters default to letter-spacing 0 with 좁혀짜기/넓혀짜기/양끝 맞추기 as adjustments; no separate 어간 (word-gap) value is specified. Use `line-height: 1.7; letter-spacing: 0; text-indent: 1em; text-align: justify` with `text-justify: inter-word` as the printable baseline.

### 1.2 Japanese (ja)

**J1. kinsoku shori (禁則処理) per JIS X 4051 / jlreq.**
"line breaking rules of Japanese language are determined by JIS X 4051 ... called kinsoku shori (禁則処理, literally prohibition rules processing)". <citation refs="6P51lwYAOMICpj_7rHfVo">called kinsoku shori (禁則処理, literally prohibition rules processing)</citation> W3C jlreq is explicitly "mainly based on a standard for Japanese layout, JIS X 4051". <citation refs="5ePhUBY8oE-itA74kHBsm">mainly based on a standard for Japanese layout, JIS X 4051</citation>

**J2. 行頭禁則 (cannot start a line).** Closing brackets `*)]}〕〉》」』】〙〗〟'"⦆»`, small kana `ヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖ...々〻`, hyphens `-゠-〜`, delimiters `? ! !! ?? ?! !?`, mid-sentence `・、:;,` and sentence-ending `。.` <citation refs="6P51lwYAOMICpj_7rHfVo">Characters not permitted on the start of a line</citation>. Note "kinsoku shori does not apply to Japanese characters while one line contains not enough characters." <citation refs="6P51lwYAOMICpj_7rHfVo">kinsoku shori does not apply to Japanese characters while one line contains not enough characters</citation>

**J3. 行末禁則 (cannot end a line).** Opening brackets `([{〔〈《「『【〘〖〝'"⦅«`. <citation refs="6P51lwYAOMICpj_7rHfVo">Characters not permitted at the end of a line</citation> Plus never-split sequences `-.....〳〴〵`, numbers, and ruby-mapped kanji groups. <citation refs="6P51lwYAOMICpj_7rHfVo">Characters that cannot be separated</citation>

**J4. Processing methods: burasage / oidashi / oikomi.**
"Burasage (Hanging punctuation): Move punctuation character to the end of the previous line. Oidashi (Wrap to next): Send characters not permitted at the end of a line to the next line, increase tracking to pad out first line. Oikomi (Squeeze): Reduce tracking on the first line to pull a character not permitted at the start of a line from being the first character on the second line." <citation refs="6P51lwYAOMICpj_7rHfVo">Move punctuation character to the end of the previous line</citation> CSS mapping: `line-break: strict` enforces the prohibition set; `text-spacing-trim: normal` performs the punctuation squeeze/collapse; `hanging-punctuation: allow-end` would be burasage but is NOT available in Chromium (see 1.4).

**J5. Headings: phrase-boundary breaking.**
Chrome 119+ supports `word-break: auto-phrase` for Japanese Bunsetsu phrase breaking, but "Currently, Chrome supports this feature only for Japanese" and "`lang="ja"` is required". <citation refs="ntykWz5A5hpMRzwTBywk5">Currently, Chrome supports this feature only for Japanese</citation> Use it on short ja headings only, with manual `<wbr>` overrides: "窓ぎわの<wbr>トットちゃん". <citation refs="ntykWz5A5hpMRzwTBywk5">窓ぎわの<wbr>トットちゃん</citation>

### 1.3 Chinese (zh)

**C1. 避头尾 (avoid line start/end) with three rule levels.**
clreq defines prohibition rules for line start/end with GB, Big5-style, and none levels; the rules are styling: "行首行尾禁则规定属于排版风格" (line start/end prohibitions are a matter of typesetting style). <citation refs="_LNbmwXOLbqx9_oQjC7_B">行首行尾禁则规定属于排版风格</citation> Simplified lists: line-start forbidden `!%),.:;?]}¢°·'"†‡›°C∶、。〃〆〕〗〞)}!"%'),.:;?!]}~`, line-end forbidden `$(£¥·'"〈《「『【〔〖〝({$(.[{£¥`. <citation refs="6P51lwYAOMICpj_7rHfVo">Line breaking rules for Chinese language have been described in the reference of Office Open XML</citation> Extra rule: em-dashes and ellipses must not appear at a line start: "再增加规定破折号、省略号不能出现在一行的开头". <citation refs="_LNbmwXOLbqx9_oQjC7_B">破折号、省略号不能出现在一行的开头</citation>

**C2. 标点挤压 (punctuation squeeze) before prohibition handling.**
"在处理禁则之前,应优先按照排版风格处理,因为标点挤压处理会影响换行位置" (before processing prohibitions, handle punctuation squeeze first, because squeeze affects break positions). <citation refs="_LNbmwXOLbqx9_oQjC7_B">因为标点挤压处理会影响换行位置</citation> Principle "先挤进,后推出": first squeeze the offending punctuation onto the prior line; only if no squeeze opportunity exists, push a character from the prior line down. <citation refs="_LNbmwXOLbqx9_oQjC7_B">先挤进,后推出</citation> CSS mapping: `text-spacing-trim: normal` (kerning/collapse of adjacent CJK punctuation) <citation refs="chCpTtFcz16Fj3lgPKsCi">Collapses spacing between punctuation characters</citation>; Chromium support is partial (see 1.4).

**C3. 孤字 (orphan) rule.**
"若段落末行仅有一个汉字,或一个汉字加上标点符号,即为 [孤字]" (a last line with a single hanzi, or single hanzi plus punctuation, is an orphan); fix by pulling one character from the previous line with even spacing, deleting, or adding text. <citation refs="_LNbmwXOLbqx9_oQjC7_B">若段落末行仅有一个汉字,或一个汉字加上标点符号</citation> CSS has no automatic orphan control for CJK; handle by copy-editing or `text-wrap: pretty` where available.

**C4. Indent and line gap.**
Chinese body uses 首行缩进 (first-line indent, 2em conventionally); clreq discusses 首行缩进 in the Bopomofo/grid-alignment context. <citation refs="_LNbmwXOLbqx9_oQjC7_B">首行缩进</citation> For line gap, clreq notes vertical-Bopomofo paragraphs "通常需要基字尺寸1.5倍以上的行距" (normally need 1.5x or more line gap), and body text line gap "多半介於字型大小的50%-100%之間" (mostly 50-100% of font size on top, i.e. line-height 1.5-2.0). <citation refs="_LNbmwXOLbqx9_oQjC7_B">版心的行距多半介於字型大小的50%-100%之間</citation> Practical A4 zh body: `line-height: 1.75; text-indent: 2em`.

### 1.4 CSS Text 3/4 properties and Chromium support (print-relevant)

**T1. Always language-tag.** CSS spec: "Authors should accurately language-tag their content for the best typographic behavior" and "language-specific typographic tailorings are only applied when the content language is known (declared)." <citation refs="JS5Z94gUcqHHLcDjnOgpv">Authors should accurately language-tag their content for the best typographic behavior</citation> Use `<html lang="ko">` / `lang="ja"` / `lang="zh-CN"`.

**T2. `word-break: keep-all` - safe everywhere.** Baseline Widely available, "available across browsers since July 2015". <citation refs="rZDVCIS6E1FbjDY-Y8H8S">available across browsers since July 2015</citation> Use for ko body; do NOT use for ja/zh body (would freeze all breaking to spaces).

**T3. `line-break` - safe everywhere.** Baseline Widely available, "available across browsers since July 2020". <citation refs="Qzwh1Z3ZBTsUtXtJojI3R">available across browsers since July 2020</citation> Values `loose` (least restrictive, newspapers/short lines), `normal` (most common), `strict` (most stringent). <citation refs="Qzwh1Z3ZBTsUtXtJojI3R">Break text using the least restrictive line break rule</citation> Recipe: ko body `strict` + `keep-all`; ja/zh body `strict`; captions/tables `normal`.

**T4. `text-autospace` (inter-script spacing) - newly Baseline 2025, Chromium subset shipped.**
MDN: "Since November 2025, this feature works across the latest devices and browser versions" (Baseline 2025). <citation refs="GNi9sU12HfmNL15r_3C56">Since November 2025, this feature works across the latest devices and browser versions</citation> Definition: "specify the space applied between Chinese/Japanese/Korean (CJK) and non-CJK characters". <citation refs="GNi9sU12HfmNL15r_3C56">specify the space applied between Chinese/Japanese/Korean (CJK) and non-CJK characters</citation> Chromium history: behind flag in Chrome 120 ("Inter-script spacing with the `text-autospace` property" behind Experimental Web Platform features flag) <citation refs="ntykWz5A5hpMRzwTBywk5">Behind a flag from Chrome 120: Inter-script spacing with the text-autospace property</citation>; Intent to Ship covered "the following subset: `text-autospace: normal | no-autospace`" plus the `text-spacing` shorthand. <citation refs="uIcgQwUMzlNL8lJC4mWNk">The initial implementation supports the following subset: text-autospace: normal | no-autospace</citation> Print advice: leave default (`normal`) on for mixed-script body; set `text-autospace: no-autospace` on verbatim/code and tight tables.

**T5. `text-spacing-trim` (CJK punctuation kerning) - experimental, partial in Chromium.**
MDN: "Limited availability ... This is an experimental technology. Check the Browser compatibility table carefully before using this in production." <citation refs="chCpTtFcz16Fj3lgPKsCi">This is an experimental technology</citation> Definition: "controls the internal spacing set on CJK punctuation characters between adjacent characters (kerning) and at the start or end of text lines". <citation refs="chCpTtFcz16Fj3lgPKsCi">controls the internal spacing set on CJK punctuation characters between adjacent characters</citation> Chrome status at writing: "under development, with the aim that it will be enabled by default" <citation refs="ntykWz5A5hpMRzwTBywk5">Under development: Chinese, Japanese, and Korean (CJK) punctuation kerning</citation>; adjacency kerning already on Android 13 / ChromeOS 90 with Noto CJK fonts. <citation refs="ntykWz5A5hpMRzwTBywk5">already available on Android and ChromeOS when the used font is Noto CJK</citation> Requires OpenType `halt` and/or `chws` in the font: "fonts must have the OpenType Alternate Half Widths (`halt`) feature, the Contextual Half-width Spacing (`chws`) feature, or both. If the font doesn't have either feature, `text-spacing-trim` is disabled." <citation refs="chCpTtFcz16Fj3lgPKsCi">fonts must have the OpenType Alternate Half Widths (halt) feature</citation> Print advice: declare `text-spacing-trim: normal` (the initial value) and embed a CJK font with halt/chws (Noto CJK / Source Han); do not rely on it for layout-critical alignment yet.

**T6. `hanging-punctuation` - do NOT rely on in Chromium.**
MDN: "Limited availability ... does not work in some of the most widely-used browsers." <citation refs="RSqau4Nk2eiokeNNC0XLO">does not work in some of the most widely-used browsers</citation> caniuse (Aug 2026 data): Chrome 4-155 "Not supported", Safari partial only. <citation refs="7zohBGt015aL4CUSjrTan">Chrome ... 4 - 151: Not supported</citation> Definition covers `first` (opening bracket/quote hangs), `last`, and `allow-end` (CJK stops/commas U+3001/3002/FF0C/FF0E etc. hang if they do not fit). <citation refs="RSqau4Nk2eiokeNNC0XLO">A stop or comma at the end of a line hangs if it does not otherwise fit</citation> Print advice: omit from the Chromium recipe; achieve edge alignment via `text-spacing-trim` + justification instead.

**T7. `text-spacing` shorthand.** The CSS Text 4 `text-spacing` shorthand now groups `text-spacing-trim` + `text-autospace`; Chromium's autospace ship "also includes the `text-spacing` shorthand, as now all longhands are available". <citation refs="uIcgQwUMzlNL8lJC4mWNk">This feature also includes the text-spacing shorthand</citation> Prefer longhands in report CSS for clarity.

### 1.5 Korean report font pairings (practice)

Real Korean office/report practice: internal drafts commonly use 프리텐다드 or KoPub for readability ("프리텐다드, kopub 이 가독성이 좋아서 그냥 내부 보고 같은 경우는 해당 폰트 썼구요"), while submissions to institutions use 신명조/휴먼명조 serif faces. <citation refs="xprlvyaqpzytulhkAPySS">프리텐다드, kopub 이 가독성이 좋아서 그냥 내부 보고 같은 경우는 해당 폰트 썼구요</citation> Public-sector digital standard is Pretendard GOV: KRDS (행정안전부/한국지능정보사회진흥원) states its standard style uses Pretendard GOV for both Korean and English. KoPub (한국출판인회의) ships Dotum/Batang in 3 weights each, TTF for documents and OTF for design output ("TTF(True Type Font) : 일반 문서작업에 적합; OTF(Open Type Font) : 그래픽 디자인 출력에 적합"), free for print/ebook/ad/online commercial use, but server-embed/web-service use needs separate approval ("서체를 서버에 탑재한 후 웹서비스 및 프로그램 내 서비스 등 임베이딩하여 사용할 경우 별도의 승인이 필요합니다"). <citation refs="KVpPPqShcFGxdrw60Pe9N">TTF(True Type Font) : 일반 문서작업에 적합</citation> <citation refs="KVpPPqShcFGxdrw60Pe9N">서체를 서버에 탑재한 후 웹서비스 및 프로그램 내 서비스 등 임베이딩하여 사용할 경우 별도의 승인이 필요합니다</citation> Recommended pairings: body sans Pretendard (GOV for public-sector) / Noto Sans KR + headings Pretendard Bold; formal serif body Nanum Myeongjo/Noto Serif KR/KoPub Batang + headings Noto Sans KR Bold. Caveat: no primary source was found naming securities-firm report typefaces, so any "증권사 리포트 = 나눔/본고딕" claim should be labelled industry practice, not sourced fact.

## 2. CSS recipe for ko/ja/zh body text in Chromium print

Assumptions: horizontal writing, `@page { size: A4; margin: 20mm 18mm; }`, fonts embedded via `@font-face` (WOFF2 subset), `lang` attribute set. `hanging-punctuation` deliberately excluded (unsupported in Chromium).

```css
/* ===== base: A4 print ===== */
@page { size: A4; margin: 20mm 18mm 20mm 18mm; }
:root { color-scheme: light; }
body {
  font-size: 10pt;            /* ko: 9.5-10.5pt; ja/zh: 9-10.5pt */
  line-height: 1.7;           /* ko 1.6-1.8; zh 1.7-1.8; print sweet spot */
  letter-spacing: 0;
  text-align: justify;
  text-justify: inter-word;
  widows: 2; orphans: 2;
  font-kerning: normal;
  font-feature-settings: "halt" 1, "chws" 1; /* enable CJK half-width squeeze where font has it */
}

/* ===== Korean ===== */
:lang(ko) body, .body-ko {
  font-family: "Pretendard", "Noto Sans KR", "Source Han Sans K",
    "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  word-break: keep-all;       /* word (eojeol) based breaking */
  line-break: strict;         /* enforce line-start prohibitions */
  overflow-wrap: break-word;  /* long URLs/English safety valve */
  text-indent: 1em;           /* 1 full character */
  text-autospace: normal;     /* CJK-Latin inter-script spacing (Chrome subset) */
  text-spacing-trim: normal;  /* punctuation kerning where supported */
}
/* formal Korean serif option */
.body-ko-serif {
  font-family: "Noto Serif KR", "Source Han Serif K", "KoPub Batang",
    "Nanum Myeongjo", serif;
}

/* ===== Japanese ===== */
:lang(ja) body, .body-ja {
  font-family: "Noto Sans JP", "Source Han Sans JP", "Hiragino Kaku Gothic ProN",
    "Yu Gothic", sans-serif;
  word-break: normal;         /* character-based breaking (kinsoku via line-break) */
  line-break: strict;
  overflow-wrap: break-word;
  text-indent: 1em;
  text-autospace: normal;
  text-spacing-trim: normal;
}
:lang(ja) h1, :lang(ja) h2, .heading-ja {
  word-break: auto-phrase;    /* Chrome 119+, ja only; needs lang="ja" */
  line-break: strict;
}
/* manual phrase control: 窓ぎわの<wbr>トットちゃん */

/* ===== Chinese (Simplified / Traditional) ===== */
:lang(zh) body, .body-zh {
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC",
    "Microsoft YaHei", sans-serif;
}
:lang(zh-TW) body, .body-zh-tw {
  font-family: "Noto Sans TC", "Source Han Sans TC", "PingFang TC",
    "Microsoft JhengHei", sans-serif;
}
.body-zh, .body-zh-tw {
  word-break: normal;
  line-break: strict;         /* 避头尾 prohibitions */
  overflow-wrap: break-word;
  text-indent: 2em;           /* 首行缩进 two full characters */
  text-autospace: normal;
  text-spacing-trim: normal;  /* 标点挤压 kerning where supported */
}

/* ===== punctuation / quotes ===== */
/* ko horizontal: ASCII . , ? ! + full-width 「」『』《》〈〉· (U+00B7) */
/* Keep quote chars in the CJK font so halt/chws applies; do not fake hanging
   with negative margins in Chromium (hanging-punctuation unsupported). */
q:lang(ko) { quotes: """ """ "'" "'"; }
q:lang(ja) { quotes: "「" "」" "『" "』"; }
q:lang(zh) { quotes: """ """ "'" "'"; }

/* ===== verbatim / tables (disable autospace) ===== */
pre, code, .tight-table {
  text-autospace: no-autospace;
  line-break: normal;
  text-spacing-trim: space-all; /* keep full advances in code/tables */
  text-align: left;
}
```

Print checklist: set `lang`, embed one CJK family per language (subset WOFF2), keep `halt`/`chws` on, proof line edges for 禁則/避头尾 orphans (single hanzi + punctuation on last line), never use `line-break: anywhere` on body (it disregards all prohibitions).

## 3. Font table (embedding-safe choices)

All rows: embedding in PDF allowed. SIL OFL 1.1 core term: "The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software" and "The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives." <citation refs="q5Lp7spLGtu8cB1rjXfgp">can be bundled, embedded, redistributed and/or sold with any software</citation> OFL also forbids selling the font by itself and reserves font names in derivatives.

| Family | License | Embedding in PDF | Weights | Download |
|---|---|---|---|---|
| Pretendard (sans, ko-optimized, Inter-based) | SIL OFL 1.1 ("This Font Software is licensed under the SIL Open Font License, Version 1.1" with Reserved Font Name 'Pretendard') <citation refs="JxHPaaQijjlAWXh3Tqz73">This Font Software is licensed under the SIL Open Font License, Version 1.1</citation> | Yes (OFL embed allowed; subset for PDF) | 100-900 (Thin/ExtraLight/Light/Regular/Medium/SemiBold/Bold/ExtraBold/Black), static + variable + dynamic subset <citation refs="LSNyaRQYG1RukyggMo_VN">Pretendard-Black.otf ... Pretendard-Thin.otf</citation> | https://github.com/orioncactus/pretendard (official); mirror https://github.com/fonts-archive/Pretendard |
| Noto Sans KR | SIL OFL 1.1 (Google Fonts; "SIL Open Font License") | Yes | Variable 100-900 ("Supports weights 100-900") <citation refs="bSnb8d0Ux04a78ry42CKn">Supports weights 100-900</citation>; static Thin 100/Light 300/Regular 400/Medium 500/Bold 700/Black 900 | https://fonts.google.com/noto/specimen/Noto+Sans+KR <citation refs="4V3bNynmQyxHrIhjoAtDF">Noto Sans KR is an unmodulated (sans serif) design for the Korean language</citation>; self-host via Fontsource `@fontsource-variable/noto-sans-kr` |
| Noto Serif KR (formal ko body) | SIL OFL 1.1 ("License SIL Open Font License", "On Google Fonts since 2018") <citation refs="2Jyoea87VapfjXL2WbA0x">License SIL Open Font License</citation> | Yes | Variable 200-900 ("200-900 Weight Range") <citation refs="2Jyoea87VapfjXL2WbA0x">200-900 Weight Range</citation> | https://fonts.google.com/noto/specimen/Noto+Serif+KR <citation refs="2FgN8jCJWDtw-NbzH6aLr">Noto Serif KR is a modulated (serif) design for the Korean language</citation> |
| Noto Sans JP / Noto Sans SC / Noto Sans TC | SIL OFL 1.1 (same Noto program) | Yes | Variable 100-900 | https://fonts.google.com/noto (JP/SC/TC specimens); GitHub google/fonts, notofonts repos |
| Source Han Sans K/JP/SC/TC = 본고딕 (Adobe+Google) | SIL OFL 1.1 ("This Font Software is licensed under the SIL Open Font License, Version 1.1") <citation refs="q5Lp7spLGtu8cB1rjXfgp">This Font Software is licensed under the SIL Open Font License, Version 1.1</citation>; Adobe confirms GitHub versions may be self-hosted ("you can get the fonts from GitHub and self-host them or use them however you'd like") <citation refs="a0aL4DdtZ95xLFsGUl7hg">you can get the fonts from GitHub and self-host them or use them however you'd like</citation> | Yes | 7 weights (ExtraLight/Light/Normal/Regular/Medium/Bold/Heavy) per regional subset (K/JP/SC/TC/HK); Korean name 본고딕 <citation refs="nDhlylyjGMi2xDUmYLxKx">파일명 본고딕 / Source Han Sans K</citation> | https://github.com/adobe-fonts/source-han-sans (OTF + WOFF2 variable) |
| Source Han Serif K = 본명조 | SIL OFL 1.1 (same program) | Yes | 7 weights per region | https://github.com/adobe-fonts/source-han-serif |
| IBM Plex Sans KR | OFL-1.1 ("License: OFL-1.1 license") <citation refs="PWHI0qwdo8aWlQFHeksk9">License: OFL-1.1 license</citation>; Google Fonts lists it as the corporate open-source face ("an open-source project ... following the Open Font License (OFL)") | Yes | 7 styles: Thin/ExtraLight/Light/Regular/Medium/SemiBold/Bold (each ~12188 glyphs, TTF ~3MB) <citation refs="qYNak7C-gI4ZokmVUI_sJ">IBMPlexSansKR-Bold.ttf |3 MB |12188</citation> | https://github.com/ibm/plex <citation refs="PWHI0qwdo8aWlQFHeksk9">The package of IBM's typeface, IBM Plex</citation>; https://fonts.google.com/specimen/IBM+Plex+Sans+KR <citation refs="HEXuQuhToNqHRnu4dh_Kb">IBM Plex Sans KR. IBM Plex is the corporate typeface for IBM worldwide</citation> |
| Nanum Gothic / Nanum Myeongjo (네이버 나눔) | SIL OFL 1.1 ("Copyright (c) 2010, NHN Corporation ... This Font Software is licensed under the SIL Open Font License, Version 1.1") <citation refs="Vs6FVZPok646TOP0cxrPm">This Font Software is licensed under the SIL Open Font License, Version 1.1</citation>; "The Nanum fonts are unicode fonts designed especially for the Korean-language script, The publisher is Naver" <citation refs="IaTaaodZh0nhG4trF_iFP">designed especially for the Korean-language script</citation> | Yes | Gothic: Regular/Bold/ExtraBold; Myeongjo: Regular/Bold/ExtraBold (+ Eco variants) | https://fonts.google.com/specimen/Nanum+Gothic; https://hangeul.naver.com (Naver) |
| KoPub Dotum/Batang/World (한국출판인회의) | Free for print/ebook/online commercial use with registration; NOT plain OFL - server/web-service embedding needs separate approval ("서체를 서버에 탑재한 후 웹서비스 및 프로그램 내 서비스 등 임베이딩하여 사용할 경우 별도의 승인이 필요합니다") <citation refs="KVpPPqShcFGxdrw60Pe9N">서체를 서버에 탑재한 후 웹서비스 및 프로그램 내 서비스 등 임베이딩하여 사용할 경우 별도의 승인이 필요합니다</citation> | PDF print yes; @font-face web serving needs approval | 3 weights each (Light/Medium/Bold equivalents); 11,172 Hangul + 4,888 Hanja + KS symbols | https://www.kopus.org/biz-electronic-font2-2 (TTF for documents, OTF for design) <citation refs="KVpPPqShcFGxdrw60Pe9N">KoPub 2.0 - 한국출판인회의</citation> |

Notes: (a) For Chromium PDF output prefer WOFF2 subsets per language (KR/JP/SC/TC) to keep files small. (b) Source Han regional subsets matter: use K for ko, JP for ja, SC for zh-CN, TC for zh-TW, or Han unification differences (骨/直 etc.) render in the wrong regional glyph. (c) Verify `halt`/`chws` presence in the chosen build before relying on `text-spacing-trim`. (d) Nanum on Google Fonts is OFL; Naver's own distribution page carries an additional descriptive notice ("free to all users ... free to modify and redistribute") <citation refs="ru7mSe-4f8y-3hCB4TFAb">available for free to all users, including individual and corporate users</citation> - follow the OFL text inside the font package.

## 4. Sources (URL, title, publisher, date opened)

1. https://www.w3.org/TR/klreq/ - "Requirements for Hangul Text Layout and Typography" - W3C Internationalization WG (Group Note Draft; original authors 임순범 et al.; 2026 reorganisation Richard Ishida) - opened 2026-09-09.
2. https://www.w3.org/TR/jlreq/ - "Requirements for Japanese Text Layout" (日本語組版処理の要件, JIS X 4051-based) - W3C (Chiba, Edamoto, Ishida et al.) - opened 2026-09-09.
3. https://www.w3.org/TR/clreq/ - "Requirements for Chinese Text Layout" (中文排版需求) - W3C Chinese Layout Task Force (Xue, Ishida) - opened 2026-09-09.
4. https://www.w3.org/TR/css-text-3/ - "CSS Text Module Level 3" - W3C CSS WG - opened 2026-09-09.
5. https://www.w3.org/TR/css-text-4/ (and https://drafts.csswg.org/css-text-4/) - "CSS Text Module Level 4" (`text-spacing`, `text-autospace`, `text-spacing-trim`, `auto-phrase`) - W3C CSS WG - opened 2026-09-09.
6. https://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_languages - "Line breaking rules in East Asian languages" - Wikipedia (tertiary summary of JIS X 4051 / OOXML ECMA kinsoku lists) - opened 2026-09-09.
7. https://developer.chrome.com/blog/css-i18n-features - "Introducing four new international features in CSS" - Chrome for Developers (Jack J) - opened 2026-09-09.
8. https://developer.mozilla.org/en-US/docs/Web/CSS/word-break - "word-break CSS property" - MDN Web Docs - opened 2026-09-09.
9. https://developer.mozilla.org/en-US/docs/Web/CSS/line-break - "line-break CSS property" - MDN Web Docs - opened 2026-09-09.
10. https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace - "text-autospace CSS property" - MDN Web Docs - opened 2026-09-09.
11. https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim - "text-spacing-trim CSS property" - MDN Web Docs - opened 2026-09-09.
12. https://developer.mozilla.org/en-US/docs/Web/CSS/hanging-punctuation - "hanging-punctuation CSS property" - MDN Web Docs - opened 2026-09-09.
13. https://caniuse.com/css-hanging-punctuation - "CSS hanging-punctuation" support table - Can I Use - opened 2026-09-09.
14. https://groups.google.com/a/chromium.org/g/blink-dev/c/gwRvkPJ5pws - "Intent to Ship: Insert CJK inter-script spacing (text-autospace)" - blink-dev - opened 2026-09-09.
15. https://korean.go.kr/kornorms/regltn/regltnView.do — "한글 맞춤법 (문화체육관광부 고시 제2017-12호)" norms viewer — 국립국어원 — opened 2026-09-09.
16. https://www.law.go.kr/LSW/admRulLinkProc.do — 「한글 맞춤법」 부록 [문장 부호] full text (행정규칙, 2017.3.28 시행) — 법제처/문화체육관광부 — opened 2026-09-09.
17. https://www.korean.go.kr/front/etcData/etcDataView.do?etc_seq=431 — 「문장 부호 해설」 (2015.2.13, 어문연구과) — 국립국어원 — opened 2026-09-09.
18. https://www.krds.go.kr/html/site/outline/outline_05.html — KRDS standard style uses Pretendard GOV — 행정안전부/한국지능정보사회진흥원 — opened 2026-09-09.
19. https://hangeul.naver.com — 나눔글꼴 distribution — NAVER — opened 2026-09-09.
16. https://github.com/orioncactus/pretendard/blob/main/LICENSE - Pretendard LICENSE (SIL OFL 1.1) - orioncactus - opened 2026-09-09.
17. https://github.com/adobe-fonts/source-han-sans/blob/master/LICENSE.txt - Source Han Sans LICENSE.txt (SIL OFL 1.1) - Adobe - opened 2026-09-09.
18. https://github.com/ibm/plex - "The package of IBM's typeface, IBM Plex" (OFL-1.1) - IBM - opened 2026-09-09.
19. https://fonts.google.com/specimen/IBM+Plex+Sans+KR - "IBM Plex Sans KR" - Google Fonts - opened 2026-09-09.
20. https://fonts.google.com/noto/specimen/Noto+Sans+KR - "Noto Sans Korean" - Google Fonts - opened 2026-09-09.
21. https://fonts.google.com/noto/specimen/Noto+Serif+KR - "Noto Serif Korean" - Google Fonts - opened 2026-09-09.
22. https://github.com/google/fonts/blob/main/ofl/nanumpenscript/OFL.txt - Nanum OFL text - google/fonts - opened 2026-09-09.
23. https://www.kopus.org/biz-electronic-font2-2 - "KoPub 2.0" - 한국출판인회의 - opened 2026-09-09.
24. https://github.com/fonts-archive/Pretendard - Pretendard static/dynamic-subset builds + weights list - fonts-archive (mirror; canonical is orioncactus/pretendard, https://cactus.tistory.com/306) - opened 2026-09-09.
