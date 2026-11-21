# Copy process

Read before writing or rewriting any visible words: hero headline, sub line, CTA, section
headings, microcopy, empty and error states. The register (how it sounds) lives in
[copy-registers.md](copy-registers.md); the checks live in [copy-tells.md](copy-tells.md);
product microcopy rules for Korean live in [ux-writing-ko.md](../build/ux-writing-ko.md).

## Copy process (FE-COPY-PROCESS-01, DEFAULT)

Copy is drafted from facts the brief supplies, in a register chosen on purpose, then checked.
Style rules alone do not produce good copy: a model told only what to avoid reaches for the
nearest substitute (a ban on hype words breeds "calm" virtue words; a ban on em dashes breeds
comma splices). The specific has to come from the input.

A brief or the client's own copy overrides every default below. Copy the client wrote is kept
word for word unless they asked for a rewrite.

### 1. Fact sheet

Before drafting, list what the brief actually states: what the product does, for whom, the
real numbers (price, count, time, limit) with their units, real names (product, place,
customer), real proof (logos, quotes, figures) that the brief or the repo supplies.

- Every specific number, name, date, quote or claim on the page comes from this sheet.
- No sheet entry for it means no specific: write a plainer line instead. Never invent "38%
  faster", "Batch No. 047", "10,000+ teams", a testimonial or a customer name to make a line
  feel concrete. Invented specifics are the strongest current tell (copy-invented-figure in
  [copy-tells.md](copy-tells.md)).
- Placeholders that the user must fill are marked visibly in the draft (`[가격 확인 필요]`)
  and listed in the report, never disguised as real content.

### 2. Register

Pick one register from [copy-registers.md](copy-registers.md) and write it down in one line
(voice, person, sentence shape, headline ending). Owner-facing Korean marketing surfaces use
the owner register by default. One register per page; microcopy may be plainer than the hero.

### 3. Shape from the reader's questions

Order sections by what a first-time reader asks, not by a template (eyebrow, claim, lede,
three cards in every section):

1. What is it and is it for me? (hero: headline + one sub line + CTA)
2. How does it work, shown on the real product? (product visual, short steps only if the
   product really has steps)
3. Can I trust it? (only proof the fact sheet holds)
4. What does it cost / what do I do next? (plain zone: price, FAQ, booking in plain words)

Drop a section the fact sheet cannot fill rather than padding it.

### 4. Draft

- **Headline**: one idea. In the owner register about 14 Hangul characters, 4 eojeol, no
  trailing period.
- **Sub line**: one short line that adds the fact the headline left out. Not a paragraph.
- **CTA**: short and generic is fine in the owner register ("다운로드", "더 알아보기");
  in product UI the label names the action ([ux-writing-ko.md](../build/ux-writing-ko.md)).
- **Copy sits next to the product visual.** The owner rejected near-no-copy heroes (name +
  button + screenshot) in favor of headline + sub + product (A/B 2026-11-21, r07).
- **Microcopy** (forms, empty, error, success) is written in the same pass, not left as
  framework defaults.

### 5. Device budget (per page)

Rhetorical devices are fine in moderation and tells in repetition. Count them across the page:

| Device | Budget per page |
|---|---|
| Parallel pair or two-fragment headline ("A는 어디서든. B는 손안에서") | hero + at most 2 section headings |
| Contrast frame ("A가 아니라 B", "not X but Y", "instead of", "without the") | 2, counted together |
| Imperative headline ("~하세요") | 1 headline; never 3 or more in a row |
| Rhetorical question then answer | 1 |
| Negation run ("No forms, no calls") | 1 |
| Witty or punchline line | 0 in the hero for the owner register (plain beat wit, r05); microcopy may carry it |

Budgets are WARN-level in [copy-tells.md](copy-tells.md); exceeding one needs a reason in the
report, not an automatic rewrite.

### 6. Check

1. Read every visible string against [copy-tells.md](copy-tells.md). FAIL-level tells are
   fixed; WARN-level tells are fixed or kept with a stated reason.
2. Run `node scripts/copy-lint.mjs <page>` from the skill folder if present. An unrun lint is
   reported as "not run", never as passed.
3. Korean prose longer than a few lines (about pages, docs, reports): polish with
   [kwrite](../../../kwrite/SKILL.md), meaning-exact.
4. Self-describing copy (text narrating the layout or the design system) is removed per
   FE-METACOPY-01 in [anti-slop.md](../build/anti-slop.md).

Report: the register line, the fact sheet, which specifics are placeholders, and any device
budget kept on purpose.

## Worked example (Korean, owner register)

Brief: GOAT runs coding agents (Codex, Claude) across the user's machines (laptop, office
server, cloud VMs) in one view; when a run is blocked by a login or OTP the user approves on
the phone. Mac app download. No customer metrics supplied.

**Fact sheet**

| Fact | Source |
|---|---|
| Agents run on MacBook, servers, cloud VMs | brief |
| One screen lists every machine's runs | brief |
| Blocked runs (login, OTP) are approved from the phone | brief |
| Mac download exists | brief |
| Numbers, customers, testimonials | **none** → no stat strip, no logo wall, no quotes |

**Register line**: owner register; name + beat or parallel pair; plain; no trailing period;
one sub line; generic CTA.

**Hero (owner A/B winners, 2026-11-21)**

```text
GOAT. 모든 기기를 한 팀으로
맥북에서 서버, 클라우드까지. 막히는 순간엔 휴대폰으로
[다운로드]  [더 알아보기]
```

Alternative headline of the same register (also won its test): `에이전트는 어디서든. 결정은 손안에서`.

**Section headings** (reader questions → one line each, budget: 2 parallel pairs used):

```text
기기마다 따로 볼 필요 없이        ← how it works, over the real product screen
막히면, 휴대폰으로 승인           ← plain beat (wit version "막히면? 폰으로 승인. 끝." lost)
누가 무엇을 승인했는지 남아요     ← trust from a real feature, no invented figures
```

**Rejected drafts and why**

| Draft | Why not |
|---|---|
| "AI 에이전트 운영의 새로운 기준" | Not a tell for this owner, but lost to the parallel pair in r01; keep as a fallback |
| "15개 팀이 선택한 GOAT" | Invented figure (no fact-sheet entry) |
| "에이전트를 실행하세요. 승인하세요. 확인하세요." | Imperative chain of 3 |
| "아래에서 GOAT의 기능을 살펴보세요" | Self-describing copy |
| "GOAT." with a trailing period | Owner chose no trailing period (r08) |

Evidence: owner blind A/B rounds 1 to 3 in the devlog (`010a`, `010b`, `010c` under
`devlog/_plan/261121_visual_skill_refresh/`).
