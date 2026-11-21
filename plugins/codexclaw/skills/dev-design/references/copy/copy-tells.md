# Copy tells

Read when checking a draft (step 6 of [copy-process.md](copy-process.md)) and when
implementing `scripts/copy-lint.mjs`. The register chosen in
[copy-registers.md](copy-registers.md) decides which WARN-level devices are intentional.

## Copy tells (FE-COPY-TELLS-01, DEFAULT)

Tells are graded:
- **FAIL**: fix before delivery. One occurrence is a defect (residue, invented content,
  broken placeholders) regardless of register.
- **WARN**: over budget or a weak spot. Fix, or keep with a stated reason in the report.
- **INFO**: look at it; no action required.

One tell proves little; clusters and repetition are the signal. Copy the client wrote and
copy quoted from the brief are exempt: a FAIL on client copy is waived with the brief as the
reason.

Owner note (A/B 2026-11-21, devlog `010b`): this owner's register uses two-fragment
headlines, contrast frames and imperative headlines on purpose. Those devices are WARN only
when they exceed the device budget in [copy-process.md](copy-process.md), never FAIL, and an
abstract category line such as "AI 에이전트 운영의 새로운 기준" is not a tell for this owner.

Defined elsewhere, not redefined here: FE-APHORISM-01 (manufactured short contrasts) and
FE-CONTENT-REALISM-01 (generic names, round vanity metrics) stay in
[anti-slop.md](../build/anti-slop.md); FE-METACOPY-01 (copy narrating its own layout) also
lives there. The ids below are the lint ids that implement them.

## Tell table (lint ids)

| Id | Level | Detects | Fix |
|---|---|---|---|
| `copy-residue` | FAIL | Chatbot or template residue on the page: "Certainly!", "I hope this helps", "As an AI", "[Company Name]", `{{token}}`, lorem ipsum, a left `[NEED]` / `TODO`, rendered markdown (`**`, `##`) | Delete; write the real line or a visible placeholder listed in the report |
| `copy-invented-figure` | FAIL | Specific numbers, percentages, counts, ratings or "N+ teams" not in the fact sheet; round unsourced proof ("10,000+", "99.9%", "3x faster") | Use only fact-sheet figures with units, in a sentence; otherwise a plainer line |
| `copy-fake-proof` | FAIL | Testimonials, quotes, logo walls, case-study counts the brief does not supply | Remove the section, or use supplied proof word for word |
| `copy-default-cast` | FAIL | Default model names: Acme, Northwind, Nexus, Lumen, Apex, Zenith, Halcyon, Jane Doe, John Doe, Priya, Marcus, Sarah J., Lena M.; Latin names in a Korean-first UI | Names from the brief only; mock data uses locale-plausible names |
| `copy-stale-year` | FAIL | Copyright or "as of" year older than the current year | Current year, or drop the year |
| `copy-meta` | FAIL | Copy describing the layout, responsiveness, design system or the agent that built it ("아래 카드에서", "This section shows", "Below you'll find", viewport labels as content) | Delete; rationale belongs in DESIGN.md (FE-METACOPY-01 in anti-slop.md) |
| `copy-hype-word` | WARN | Hype words standing in for a fact: seamless, effortless, elevate, unlock, unleash, empower, supercharge, revolutionary, cutting-edge, game-changing, world-class, next-generation, leverage, robust, powerful, delve, tapestry; KO 혁신적인, 차세대, 스마트한, 원활한 | Replace with the fact the word stands for; literal trade uses pass ("a seamless knit") |
| `copy-stock-phrase` | WARN | "In today's fast-paced world", "Unlock the power of", "The future of X is here", "Say goodbye to", "Look no further", "X made simple", "at your fingertips", "in just a few clicks" | Say what the product does |
| `copy-em-dash` | WARN | Em dash (—) in body or UI copy; more than 1 per page | Comma, colon, parentheses or a new sentence (see over-correction table) |
| `copy-contrast` | WARN | Contrast frames over budget (more than 2 per page): "not X but Y", "X가 아니라 Y", "rather than", "instead of", "without the" counted together | Keep the strongest one; state the positive fact elsewhere |
| `copy-two-fragment` | WARN | Two-fragment headings "X. Y." / 대구 over budget (more than hero + 2 section headings) | Vary the remaining headings: a name with a claim, a verb and its object |
| `copy-imperative-chain-ko` | WARN | Three or more consecutive "~하세요" / "~해보세요" sentences or headings | Merge into one sentence or switch to statements |
| `copy-translationese-ko` | WARN | Translationese and bureaucratic Korean: "원활한 경험을 제공합니다", "혁신적인 솔루션", "처리가 완료되었습니다", "~을 통해", "~에 있어서", "진행하시겠습니까", "~하실 수 있습니다" stacked | Plain spoken Korean: "저장했어요", "다음 단계로 갈까요?" |
| `copy-spec-ending-ko` | WARN | A Korean spec or fact line (table cell, `dd`/`dt`, list item, caption, `<small>`, 60 characters or less) ending in a verb or copula: "~다", "~합니다", "~해요" | End in a noun: "512GB 이상 권장", "미지원", "최근 출소" ([copy registers](copy-registers.md)) |
| `copy-honorific-overuse-ko` | WARN | More than one honorific marker per sentence in product UI ("회원님께서는 ~하실 수 있으십니다") | One polite ending ("~할 수 있어요") |
| `copy-exclaim` | WARN | Exclamation marks in body copy (more than 1 per page) | Period or nothing |
| `copy-vague-cta` | INFO | "Click here", "Submit", "확인" as the only label on a task button | Name the action in product UI; generic two-word marketing CTAs ("더 알아보기") are fine in the owner register |
| `copy-headline-period` | INFO | Trailing period on a display headline | Owner register: remove; other registers: leave |
| `copy-headline-length-ko` | INFO | Korean display headline over 24 characters | Cut to one idea (owner register median about 14) |
| `copy-rhythm` | INFO | Every card or paragraph the same length and arc | Spend words where the brief knows most |

Lint ids are stable: `scripts/copy-lint.mjs` reports exactly these strings, and new ids are
added to this table before the linter uses them.

## Over-correction table

Each ban breeds a substitute. Count the substitute with the original.

| Rule applied | Habit it breeds | Counter |
|---|---|---|
| No em dashes | Comma splices, every sentence cut short | Colons, parentheses, semicolons where natural |
| No "not X but Y" | "rather than", "instead of", "without the", "~대신" | Count them together (`copy-contrast`) |
| No hype words | Calm virtue words: honest, quiet, thoughtful, genuinely, 진정한, 꼼꼼한 | A fact in place of any adjective |
| Be specific | Invented numbers and anecdotes | The fact sheet, or a plainer line |
| Avoid lists of three | Everything in pairs | List as many items as exist |
| Short, punchy sentences | A drumbeat of fragments on every line | Fragments in the hero; normal sentences in the body |
| End strong | A moral or a quip on every paragraph | End on information |
| Add personality | A joke in every section | Plain hero (owner), humour only in microcopy |

## Not tells (leave them alone)

- Perfect grammar, plain "is", "has", "~입니다", "~해요".
- A list of three when there are three things.
- A truthful superlative the brief can prove.
- Title case or sentence case when it is the client's house style.
- A refrain repeated on purpose.
- Selling on a sales page; the test is whether it stands on facts.
- The owner register's devices within budget: name + beat, 대구, "-다." endings, imperative
  or contrast headlines, abstract category lines.
- Short generic CTAs ("다운로드", "더 알아보기") in marketing; Apple and the owner both use
  them.
- Client-written copy, quoted word for word.

## Korean specifics

- Translationese comes from English templates: "~을 통해 ~를 제공합니다", "원활한", "솔루션",
  "~에 최적화된". Rewrite as what the person does: "맥북에서 서버까지 한 화면에서 봐요".
- Bureaucratic completion messages ("처리가 완료되었습니다", "정상적으로 조회되었습니다")
  become short past tense ("저장했어요", "불러왔어요").
- Imperative chains copied from English three-beat headlines ("확인하세요. 비교하세요.
  시작하세요.") read as translation; one imperative per block.
- Honorific stacking is a product-UI tell, not a public/gov one: KRDS-style formality is
  allowed there ([copy-registers.md](copy-registers.md) section 3).
- Product microcopy rules: [ux-writing-ko.md](../build/ux-writing-ko.md).
