# Asset Requirements

Visual surfaces need real visual evidence. Abstract backgrounds, blobs, and generic icons are not enough when users need to understand a product, place, object, workflow, game, or state.

## Asset Decision Table

| Surface | Required Asset Type |
| --- | --- |
| Product / object / venue / person page | real or generated bitmap showing the subject |
| Marketing / landing page | concrete product, scene, screenshot, or generated hero image |
| Dashboard / tool | real state preview, chart, table, workflow screenshot, or diagram |
| AI tool | process state, provenance, result preview, permission boundary, or diagram |
| Education / kids / community | illustration, character, or guided visual allowed |
| Fintech / gov / B2B | restrained screenshot, data view, trust visual, or high-polish semantic 3D |
| Game | game assets mandatory |
| Documentation | screenshots or diagrams when they clarify a task |

## What Does Not Count

- abstract gradient mesh
- decorative blob/orb
- generic icon row
- fake dashboard with random numbers
- low-polish AI image
- stock photo unrelated to the task
- public 3D icon pack used without brand adaptation
- integration/partner logo wall using generic icons instead of brand SVGs (see `brand-asset-sourcing.md`)

## Asset Sourcing Workflow

Try each source in order. Stop at the first that produces a usable asset.

| Priority | Source | When to Use |
|----------|--------|-------------|
| 1 | Project existing assets | `images/`, `public/`, `assets/` in the repo |
| 2 | Built-in image generation tool, or `ima2 --help` if available | Hero images, product shots, custom illustrations. Use only when the tool is confirmed working |
| 3 | Stock photo API | `source.unsplash.com/800x600/?coffee`, Pexels. Always include `alt` text and credit |
| 4 | CSS device frame + screenshot | App mockup heroes (Toss/카카오 style). Pure CSS phone/laptop frame wrapping a real screenshot or UI |
| 5 | Placeholder service (last resort) | `picsum.photos/800/600`, `placehold.co`. Mark as TODO for replacement |

### Korean Service Patterns

Korean product pages almost always use concrete visual evidence in the first viewport:

| Pattern | Example | Implementation |
|---------|---------|---------------|
| Device mockup hero | Toss, 카카오뱅크, 당근 | CSS device frame (`border-radius: 40px`, `box-shadow`) + app screenshot inside |
| Real product photo | 배민, 무신사, 마켓컬리 | Full-bleed or contained product image, not a gradient placeholder |
| App screenshot carousel | 토스, 네이버 | Horizontal scroll of actual app screens |
| Data visualization hero | 토스증권, 뱅크샐러드 | Real (or realistic) chart/graph as primary visual |

Never ship a Korean-facing product page with only SVG icons and text. If no image source is available, state the gap explicitly rather than filling with gradients or decorative shapes.

## Rules

- Use the repo's existing asset system first.
- If no asset exists and the surface needs one, follow the sourcing workflow above.
- For external or generated assets, record provenance/licensing in the dev note, PR description, or project asset manifest when one exists.
- Make the first viewport identify the product/place/object when relevant.
- Do not obscure text or primary actions with visuals.
- Verify assets render on mobile and desktop.
- Verify intrinsic dimensions, aspect ratio, crop, alt text, and loading behavior.
- Optimize heavy media; do not ship huge 3D/video assets without a reason.
