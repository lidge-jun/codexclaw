# SEO, GEO & Social Sharing

## Technical SEO

### Required Meta Tags

```html
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Page Title} — {Site Name}</title>     <!-- ≤60 chars -->
  <meta name="description" content="...">       <!-- ≤160 chars -->
  <link rel="canonical" href="https://...">     <!-- absolute URL -->
</head>
```

- One `<title>` per page, unique across the site
- Description: complete sentence, not keyword stuffing
- Canonical URL resolves www/non-www and trailing slash consistently
- `lang` attribute must match page content language

### Heading Hierarchy

- `<h1>`: one per page, contains primary keyword naturally
- `<h2>`: section headings, each a distinct topic
- `<h3>`: subsections within h2. No skipping (h2 → h4 is invalid)
- Never use heading tags for visual sizing — use CSS classes

### Semantic HTML

Use `<header>`, `<main>` (one per page), `<article>`, `<section>`, `<aside>`, `<footer>`, `<nav>`. Every `<img>` needs `alt` text. Every `<a>` needs discernible text. Use `<time datetime="...">` for dates.

### Structured Data (JSON-LD)

Always JSON-LD in `<head>`, never Microdata or RDFa.

| Page Type | Schema | Required Fields |
|-----------|--------|-----------------|
| Landing/Home | `WebPage` + `Organization` | name, url, logo, description |
| Product | `Product` | name, description, offers |
| Blog post | `BlogPosting` | headline, datePublished, dateModified, author, image |
| FAQ | `FAQPage` + `Question`/`Answer` | each Q&A pair |
| Service | `Service` | name, description, provider, areaServed |
| Breadcrumbs | `BreadcrumbList` | itemListElement with position + name + URL |

- Schema MUST match visible page content — mismatched schema is penalized
- Include `dateModified` on content pages
- FAQPage schema has the highest AI citation lift
- Test with Google Rich Results Test before shipping

### Robots & Sitemap

```
User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml

User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
```

- XML sitemap with `<lastmod>`, `<changefreq>`, `<priority>`
- Allow AI crawlers by default — GEO requires it

## GEO (Generative Engine Optimization)

Optimizing content so AI answer engines (ChatGPT, Perplexity, Gemini, Claude) retrieve and cite your content. GEO is a layer ON TOP of SEO, not a replacement.

### Strategies

1. **Quotable content** — clear factual statements, TL;DR summaries, data tables an LLM can extract verbatim. Primary value proposition in the first 200 words.
2. **FAQPage schema** — highest AI citation lift. Use whenever the page addresses common questions.
3. **Content freshness** — visible "Last updated: YYYY-MM-DD" timestamp.
4. **Authority signals** — original data, proprietary research, expert commentary.
5. **Performance** — faster FCP strongly correlates with higher AI citation likelihood.
6. **AI-generated pages** — always SSR/SSG. Never gate critical text behind client-side JS.

## Social Sharing

### Open Graph (Required)

```html
<meta property="og:title" content="Page Title">        <!-- ≤60 chars -->
<meta property="og:description" content="...">          <!-- ≤160 chars -->
<meta property="og:image" content="https://.../og.png"> <!-- 1200x630px -->
<meta property="og:url" content="https://...">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Site Name">
<meta property="og:locale" content="ko_KR">
```

### Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page Title">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://.../og.png">
```

- OG image: 1200x630px, PNG or JPG, < 1MB, no text smaller than 24px
- For dynamic pages, generate OG images via edge function (Vercel OG, Satori)
- Test with Twitter Card Validator, Facebook Debugger

## Pre-flight

- [ ] `<title>` unique and ≤ 60 chars
- [ ] `<meta name="description">` present and ≤ 160 chars
- [ ] `<link rel="canonical">` with absolute URL
- [ ] `<html lang="...">` matches content language
- [ ] JSON-LD structured data matches page type
- [ ] OG tags present (title, description, image, url)
- [ ] `<h1>` unique, one per page, no skipped levels
- [ ] "Last updated" date visible on content pages
