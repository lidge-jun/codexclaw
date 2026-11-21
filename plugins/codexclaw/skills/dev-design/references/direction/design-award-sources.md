# Design Award Source Guide

Use this guide to choose evidence before setting a visual direction. The tiers describe the source's role, not its prestige: start with the narrowest source that answers the design question, then cross-check award-level originality against section-level usability. Counts and interface notes reflect the 2026-07-14 research crawl and may drift.

## Sourcing protocol

1. Define the lookup axis first: aesthetic, composition, behavior, domain/type, page purpose, or section anatomy. Do not compare unlike tags as if they were peer styles.
2. Use at least two galleries for a reusable pattern claim. Promotion into skill vocabulary requires evidence from at least 3 sites across at least 2 galleries.
3. Capture the live site, not only the gallery thumbnail. Record hero function, motion model, navigation, typography, palette, and layout independently.
4. Treat gallery counts as retrieval aids, not market-share evidence. Award sites overrepresent immersive motion; landing galleries overrepresent conversion sequences.
5. Preserve accessibility and domain gates. A winner is evidence that a device can work in context, not permission to copy hidden navigation, viewport locks, or continuous motion without alternatives.

## Domain/type retrieval families

Normalize gallery domain labels into these retrieval families before selecting examples:

- **Creator/organization:** agency, consultancy, studio, portfolio, showcase, production, freelance.
- **Digital product:** SaaS, application/software, AI, technology, productivity, dev/design tools, no-code, open source, hosting, CMS.
- **Commerce/product:** ecommerce, marketplace, product, hardware, wearable, automotive, furniture/interiors.
- **Finance/web3:** finance, fintech, cryptocurrency, blockchain, DeFi, ventures, insurance.
- **Culture/media:** art, photography, illustration, motion, music, film, game, entertainment, culture, exhibitions, dance/theatre.
- **Publishing/knowledge:** blog, news, magazine, editorial, print, book/literature, education/course/resource, annual report.
- **Lifestyle/vertical:** architecture, property, fashion, beauty, health, food/drink, travel/outdoors, sport, wedding, children.
- **Campaign/community:** advertising, event/conference/festival, fundraising, community, awards, coming soon.

**Category-error guard:** Domains drive gates and example retrieval, never visual style. Choose aesthetic, composition, palette, treatment, and behavior on their own axes after domain constraints are known.

## Tier 1 — Award sites

Use Tier 1 to study authored systems, high-variance composition, and the relationship between concept, motion, and implementation.

### Awwwards

- **URL:** <https://www.awwwards.com/>
- **Best for:** Highest-quality curated winners, especially Site of the Day and Site of the Year work with cinematic staging, custom motion, and distinctive art direction.
- **Search/filter:** Browse winners and collections, then narrow with **Category**, **Technology**, **Font**, and **Color** filters. Cross-check the award page against the live site.
- **Key value:** Strongest source for seeing one governing visual idea carried through hero, navigation, motion, typography, and proof. It is particularly useful for experiential and media-led surfaces.
- **DOM accessibility:** Listing metadata and filter labels are generally extractable, but important evidence often lives in screenshots, embedded media, or the external winner. Client rendering, consent layers, and canvas/WebGL can obscure text-only inspection; use a browser snapshot and inspect the live site. Never infer motion or interaction from the card DOM alone.

### CSS Design Awards (CSSDA)

- **URL:** <https://www.cssdesignawards.com/>
- **Best for:** Scored analysis of **UI**, **UX**, and **Innovation**, plus Website of the Day examples where interaction systems can be compared against explicit judging dimensions.
- **Search/filter:** Browse WOTD/WOTM winners and nominees; use the UI, UX, and Innovation scores as comparison prompts, then inspect the linked live experience.
- **Key value:** Useful when the agent must explain why a visually unusual site succeeds beyond surface styling. The separate scores encourage evaluation of interface quality, experience coherence, and novelty rather than a single beauty judgment.
- **DOM accessibility:** Winner titles, scores, and outbound links are usually available in page structure, while loaders, canvas scenes, cursor behavior, and scroll choreography require rendered inspection. Some live sites intercept wheel input or keep native `scrollY` fixed, so verify state changes visually and provide keyboard/reduced-motion checks.

## Tier 2 — Section galleries

Use Tier 2 when the question is about a page section, persuasion sequence, or interaction component rather than a whole-site aesthetic.

### Land-book

- **URL:** <https://land-book.com/>
- **Best for:** Complete landing-page sequences and balanced examples of common blocks such as hero, value proposition, features, process, testimonials, pricing, FAQ, CTA, footer, about, case study, and resources.
- **Search/filter:** Open the **Sections** subcategory and choose the target anatomy. The research snapshot exposed 20 examples for each inspected section category, making it a practical first pass for variety.
- **Key value:** Shows how individual sections coexist in credible landing-page rhythm, rather than presenting isolated component specimens only.
- **DOM accessibility:** Category labels and card metadata are suitable for semantic retrieval, but page imagery carries much of the visual evidence. Open the source site for responsive behavior and interaction; do not treat a gallery screenshot as proof of accessible structure.

### One Page Love

- **URL:** <https://onepagelove.com/>
- **Best for:** High-volume section comparison—**8,180 page sections** in the research snapshot—with especially deep coverage of social proof, pricing, FAQ, lead capture, CTA, mockups, testimonials, navigation, and forms.
- **Search/filter:** Browse **Page Sections** and narrow to a concrete subtype, not a broad aesthetic. Useful examples include Testimonials, Client Logos, Pricing Table, FAQ/Accordion, Lead Capture, Device Mockup, Screenshots, Timeline, and Header Navigation.
- **Key value:** Best breadth source for comparing many solutions to the same conversion problem and separating a reusable section pattern from a one-off art direction.
- **DOM accessibility:** Taxonomy names and counts are text-accessible, while previews are image-led and may lazy-load. Use the category DOM for discovery, then inspect linked pages for hierarchy, focus order, form behavior, and mobile adaptation. Counts are time-sensitive.

### Lapa.ninja

- **URL:** <https://www.lapa.ninja/>
- **Best for:** Section references plus behavior-specific examples and **video recordings** of complete landing pages.
- **Search/filter:** Start with **Sections**, then use Elements/Motion libraries for **Loading**, **Menu**, **Hover**, **Mouse Interaction**, **Gallery**, **Footer**, and **Text Effect**. Use recordings when the original page has changed or motion sequencing matters.
- **Key value:** Bridges static section sourcing and interaction study; it is the strongest Tier 2 source for loaders, menus, pointer behavior, and text effects.
- **DOM accessibility:** Category and item metadata can support search, but screenshots and recordings are primary evidence. Video is not a substitute for semantic inspection: verify the live page's controls, keyboard path, reduced-motion behavior, and non-hover alternative whenever available.

## Tier 3 — Taxonomy and vocabulary

Use Tier 3 to translate a vague brief into searchable terms. Its labels are retrieval facets, not a flat design system: style, page type, subject, platform, palette, and behavior must remain separate axes.

### SiteInspire

- **URL:** <https://www.siteinspire.com/>
- **Best for:** Four-axis discovery through **Styles**, **Types**, **Subjects**, and **Platforms**, with particularly strong portfolio, editorial, and unusual-layout references.
- **Search/filter:** Select one facet per question—for example, a Style for visual treatment, a Type for page purpose, or a Platform for implementation context. Use **Unusual Layout** when conventional section anatomy is intentionally being replaced.
- **Key value:** Its four-axis model helps prevent category errors such as treating “Agency,” “Minimal,” and “Responsive” as equivalent kinds of style.
- **DOM accessibility:** Facet labels and project metadata are generally useful in the DOM, but project previews are visual and outbound sites may be highly interactive. Capture the taxonomy path used, then inspect the live site for spatial navigation, hover-only discovery, and mobile fallbacks.

### Recent / Godly

- **URL:** <https://recent.design/> and <https://godly.website/>
- **Best for:** Current high-polish references organized into **12 design categories**, especially editorial, typography, product, motion, and experimental web work.
- **Search/filter:** Choose the closest design category first, then compare whole-site records and open the live examples. Use the category as a discovery tag, not as proof that every example shares one compositional model.
- **Key value:** A useful bridge between award winners and contemporary production references; it surfaces newer visual and motion signals without relying only on annual award cycles.
- **DOM accessibility:** Feed cards and labels are discoverable, but previews may be media-heavy, lazy-rendered, or sparse in text. Confirm names and links from the DOM, then use rendered inspection for hover, scroll, canvas, and adaptive-overlay behavior.

### Httpster

- **URL:** <https://httpster.net/>
- **Best for:** **Styles** and **Types** browsing with a restrained, refined editorial and typographic bias. Also useful as a discovery path to focused destinations such as Footer Design Gallery.
- **Search/filter:** Combine a Style with a Type to narrow tone and purpose—for example editorial treatment plus portfolio or magazine. Use its taxonomy for calibration, not section-count claims; Httpster is primarily a whole-site gallery.
- **Key value:** Counterbalances immersive award-site bias with quieter, highly edited examples where typography, spacing, and content structure do more work than effects.
- **DOM accessibility:** Taxonomy and project links are comparatively straightforward to inspect, though thumbnails still carry substantial evidence. Open the live site to validate type behavior, navigation, and responsive structure. Do not infer a broad section library from a dedicated gallery found through Httpster.

## Quick source chooser

| Need | Start here | Cross-check |
|---|---|---|
| Highest-variance authored concept | Awwwards | CSSDA score dimensions |
| Explain UI/UX/innovation quality | CSSDA | Live winner + Awwwards peer |
| Standard landing-page sequence | Land-book | One Page Love variants |
| Many variants of one section | One Page Love | Land-book in-page context |
| Loader, menu, hover, pointer, or text motion | Lapa.ninja | CSSDA/Awwwards live behavior |
| Search vocabulary across independent axes | SiteInspire | Httpster or Recent/Godly |
| Current editorial/motion signal | Recent/Godly | Awwwards/CSSDA persistence |
| Restrained editorial calibration | Httpster | SiteInspire taxonomy |
