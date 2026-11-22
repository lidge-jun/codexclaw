# SEO, GEO & Social Sharing

GEO (generative engine optimization) is ordinary SEO plus one hard requirement: **the facts
must be in crawlable, visible, server-rendered text**. Google says its AI Overviews and AI
Mode have "no additional technical requirements" beyond being indexed and snippet-eligible,
and lists llms.txt, "chunking", AI-only rewrites, inauthentic mentions and structured-data
overfocus as things to ignore ([Google, AI features](https://developers.google.com/search/docs/appearance/ai-features),
[Google, optimizing for generative AI](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)).
Bing says the same SEO practices "also support eligibility for AI-generated experiences,
grounding results, and citations" ([Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)).

Statuses read 2026-11-22. Rule ids below are reported by `seo-lint.mjs` ([scripts](../../scripts/README.md)). The lint is
advisory: FAIL only for objective breakage (no `<title>`, JSON-LD that does not parse or marks up
invisible FAQs, search/answer bots blocked). Headlines, page shape and copy stay free; GEO asks
for a literal sub line somewhere near the top, not a formula hero.

## Evidence, not folklore

| Claim you will meet | What the evidence says (2026) | House rule |
|---|---|---|
| "FAQPage schema has the biggest AI citation lift" | Google stopped showing FAQ rich results on 2026-05-07. Ahrefs tracked 1,885 pages adding schema: ChatGPT +2.2%, AI Mode +2.4% (both noise), AI Overviews −4.6%. Toronto (Chen & Koudas, 2026-10): FAQ blocks, schema, author boxes and speed correlate with citations across sites but none is significant within a site | FAQ markup optional; never invent questions to fill it |
| "Schema makes chatbots read your price/date" | A live-fetch test found ChatGPT, Claude, Perplexity, Gemini and AI Mode extracted none of a price placed only in JSON-LD | Every fact in JSON-LD also appears in visible text |
| "You need llms.txt" | Google Search ignores it. Useful for developer docs that agents fetch (OpenAI, Anthropic, Gemini publish one) | Optional, docs/dev products only |
| "Write for AI: chunk it, keyword-stuff variants" | Google: no chunking requirement; AI understands synonyms | Write for the reader |
| What does correlate within a site | Titles and paragraphs that directly answer the questions people ask (+14–16% per SD, the only factor robust in the Toronto study) | GEO-ANSWER-01 |

Sources: [Google FAQPage deprecation](https://developers.google.com/search/docs/appearance/structured-data/faqpage), [Ahrefs schema study 2026-05](https://ahrefs.com/blog/schema-ai-citations), [Toronto study summary](https://www.ktau.ai/research/searched-and-remembered), [Similarweb on JSON-LD at answer time](https://aisearch.similarweb.com/blog/schema-markup-ai-citations), [llms.txt v2](https://llmstxt.org/).

## SEO-META-01 — head essentials

```html
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Specific page title} | {Site}</title>   <!-- ≤60 chars EN, ≤30 Hangul -->
  <meta name="description" content="...">       <!-- ≤160 chars EN, ≤80 Hangul; one plain sentence -->
  <link rel="canonical" href="https://example.com/path">
  <meta property="og:title" content="..."> <meta property="og:description" content="...">
  <meta property="og:image" content="https://example.com/og.png"> <!-- absolute, 1200×630 -->
  <meta property="og:url" content="https://example.com/path"> <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
</head>
```

- One unique `<title>` per page; the title names the thing and the job, not a slogan.
- `lang` matches the content; multilingual sites add `hreflang` alternates both ways.
- Canonical is absolute and self-referencing unless the page is a duplicate.
- `noindex` on a public marketing page is almost always an accident; check the brief.

## SEO-STRUCTURE-01 — headings and semantics

- Exactly one `<h1>`; `h2`/`h3` in order, no skipped levels; headings are never used for size.
- `<header>`, `<nav>`, one `<main>`, `<article>`/`<section>`, `<footer>`; dates as `<time datetime>`.
- Every content `<img>` has `alt`; decorative images use `alt=""`. Every link and button has a
  name. In-page and cross-page navigation uses `<a href>`, not click handlers.

## GEO-VISIBLE-01 — facts live in visible, server-rendered text (DEFAULT)

- Price, plan limits, dates, author, product name and claims are in the HTML response as text,
  not only in JSON-LD, images, canvas, video, tooltips or JS-fetched fragments.
- Static/SSR/SSG for public pages. A client-only shell (`<div id="root"></div>` + scripts)
  reads as an empty page to crawlers and answer engines.
- Scroll reveals keep content visible in the base state ([scroll](scroll-interaction.md)
  FE-SCROLL-BASE-01). Collapsed accordions are fine when the text is in the DOM (`<details>`
  or `hidden="until-found"`).
- Google display controls if needed: `nosnippet`, `data-nosnippet`, `max-snippet`; Bing:
  `NOARCHIVE` removes a page from Copilot grounding, and from 2027-02-01 the page-level
  `<meta name="Bingbot" content="ai-grounding:disallow">` replaces it ([Bing, 2026-10-30](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding)).
  Never ship these by accident on a page meant to be cited.

## GEO-ANSWER-01 — write pages that answer

- Somewhere near the top, a plain paragraph says what the thing is, who it is for, and the
  one differentiator, in sentences an engine can quote. The headline itself can be as
  poetic as the concept wants; the literal line can sit under it or just below the fold.
- Section headings state the question or the answer ("How pricing works", "Runs in your
  VPC"), not mood words.
- Non-commodity content: first-hand data, real numbers with units and dates, comparisons
  with named alternatives, limits and failure cases. Google calls out commodity listicles.
- A visible FAQ with real customer questions is good copy; markup for it is optional.
- Show "Updated YYYY-MM-DD" only when the content actually changed; match `dateModified`.
- Copy rules still apply ([copy tells](../copy/copy-tells.md)): no invented figures.

## SEO-JSONLD-01 — structured data, honest and minimal

JSON-LD in `<head>` or end of `<body>`. It helps rich results that still exist and entity
clarity (Bing says it may support clearer grounding), not citations by itself.

| Page | Type | Required |
|---|---|---|
| Home | `Organization` + `WebSite` | name, url, logo, `sameAs` (real profiles only) |
| Software product | `SoftwareApplication` (or `Product`) | name, description, applicationCategory, `offers` with price/currency when visible |
| Article / post | `Article` / `BlogPosting` | headline, datePublished, dateModified, author, image |
| Docs / nested pages | `BreadcrumbList` | itemListElement with position, name, item |
| Local business | `LocalBusiness` + Google Business Profile | address, hours, phone |

- JSON must parse; values should match visible text (lint warns when a `name`, `price` or
  `headline` is not on the page).
- No `AggregateRating`/`Review` you cannot source. No `FAQPage` whose questions are not visible.
- Commerce: the merchant feed (Google Merchant Center, OpenAI product feed) matters more
  than page markup for AI shopping.

## SEO-CRAWL-01 — let search and answer bots in; decide training separately

Each vendor separates **search/answer** crawlers from **training** crawlers. Blocking the
search one removes you from that engine's answers; blocking training does not.

| Vendor | Search / answer (allow for visibility) | User-triggered fetch | Training (owner's choice) |
|---|---|---|---|
| Google | `Googlebot` (AI Overviews and AI Mode use the Search index) | — | `Google-Extended` (Gemini training/grounding; no effect on Search) |
| Microsoft | `Bingbot` (Bing, Copilot grounding) | — | `__usage_ai-training` (IETF AI-pref, from 2027-02-01) |
| OpenAI | `OAI-SearchBot` | `ChatGPT-User` | `GPTBot` |
| Anthropic | `Claude-SearchBot` | `Claude-User` | `ClaudeBot` |
| Perplexity | `PerplexityBot` | `Perplexity-User` (generally ignores robots.txt) | — |

`anthropic-ai` and `Claude-Web` are retired tokens; writing them does nothing.

```txt
# robots.txt — default: everything allowed, sitemap declared.
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml

# Only if the owner opts out of model training (search visibility unaffected):
# User-agent: GPTBot
# Disallow: /
# User-agent: ClaudeBot
# Disallow: /
# User-agent: Google-Extended
# Disallow: /
```

- A CDN/WAF bot rule (e.g. Cloudflare Bot Fight Mode) can block these bots regardless of
  robots.txt; OpenAI and Perplexity publish IP ranges to allow.
- Robots changes take about 24 h to reach OpenAI and Perplexity.
- Sources: [OpenAI bots](https://platform.openai.com/docs/bots), [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity bots](https://docs.perplexity.ai/guides/bots), [Google crawlers](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers).

## SEO-DISCOVERY-01 — sitemap, IndexNow, measurement

- `sitemap.xml` with accurate `<lastmod>` only (Google ignores `changefreq` and `priority`).
- IndexNow on publish/update/delete for Bing and Copilot freshness; stream, do not batch.
- Crawlable internal links with descriptive anchor text; one URL per piece of content.
- Measure: Search Console Generative AI performance report; Bing Webmaster Tools AI
  Performance (citations, grounding queries, citation share).

## GEO-AGENT-01 — agent-operable pages

Browser agents act from the DOM, the accessibility tree and screenshots
([web.dev](https://web.dev/articles/ai-agent-site-ux)).
- Real `<button>`/`<a>`; a clickable `div` needs `role` and `tabindex`; `<label for>` on inputs.
- No transparent overlays above controls; stable layout; targets at least 8×8 px (24×24 for
  WCAG 2.5.8).
- Optional: `/llms.txt` for docs; WebMCP tools are an origin trial, not a requirement.

## Social sharing

OG image 1200×630, PNG/JPG under 1 MB, text no smaller than 24 px at that size, generated
per page for dynamic routes (Satori / `next/og`). Validate with the platform debuggers.

## Pre-flight

- [ ] `seo-lint.mjs` run on every public page (run, not assumed); no FAIL, remaining WARN/INFO reasoned
- [ ] Title, description, canonical, lang, viewport, OG/Twitter present and specific
- [ ] One H1, ordered headings, alt text, `<a href>` navigation
- [ ] Facts visible and server-rendered; scroll reveals pass FE-SCROLL-BASE-01
- [ ] First paragraph answers what/for whom/why different; headings state the answer
- [ ] JSON-LD parses and matches visible text; no invented ratings or FAQs
- [ ] robots.txt allows search/answer bots; training choice explicit; WAF not blocking them
- [ ] sitemap with real `lastmod`; IndexNow wired where Bing matters
