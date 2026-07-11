# Reference Capture

Capture reference sites only to learn structure, ground visual judgment, and
provide reference material for concept mockups. Captures are analysis inputs,
not project assets.

Use this workflow when a page, component, brand system, or visual interaction
needs source-grounded study before design synthesis or `ima2 --ref` mockups.

---

## Purpose

### Analysis-Only Capture (FE-CAPTURE-01, STRICT)

Captured third-party HTML, CSS, images, videos, logos, and font references are
analysis-only. They may be used to:

- study layout structure, density, hierarchy, spacing, and interaction shape
- compare DOM/component composition against a target pattern
- ground an `ima2 --ref` concept mockup or style exploration
- document observed behavior in a devlog unit

They must not be copied into shipped source, public assets, production
bundles, marketing exports, or final deliverables.

---

## Mechanics

### Capture Channels (FE-CAPTURE-02, DEFAULT)

Use the least invasive public capture method that gives enough evidence.

| Channel | Use |
| --- | --- |
| In-app browser `pageAssets` capability | List and bundle observed page assets from the rendered page |
| `curl` / `wget` | Fetch public HTML, CSS, JSON, images, or videos needed for analysis |
| DOM snapshot | Record structure, landmarks, role patterns, component nesting, and text density |
| Screenshot | Capture visual state, responsive breakpoints, hover/open states, and motion posters |

Do not bypass auth, paywalls, robots restrictions, private CDNs, signed URLs,
or technical access controls.

### Storage Location (FE-CAPTURE-03, STRICT)

Store captures under the active devlog unit, never under shipped project asset
directories such as `public/`, `assets/`, `images/`, `src/assets/`, or app
static folders.

Recommended shape: `devlog/<active-unit>/captures/manifest.md` plus one
folder per source with captured DOM, CSS, screenshots, and notes.

---

## Legal Boundary

### Never-Ship Rule (FE-CAPTURE-04, STRICT)

Captured third-party assets never ship. This includes copied photographs,
illustrations, videos, icons, logos, CSS artwork, SVGs, and bundled media.

Webfont binaries are never copied. Treat webfonts as license-restricted by
default even when they are publicly downloadable. You may record the font name,
CSS stack, metrics observations, and usage notes for analysis.

Photography, illustrations, videos, and logos are analysis-only unless they are
independently re-sourced through shippable channels. Shippable brand assets
come only from `brand-asset-sourcing.md` channels such as official press kits,
Simple Icons, SVGL, theSVG, or other explicit licensed libraries.

### Mockup Reference Boundary (FE-CAPTURE-05, DEFAULT)

Captured material may be passed to `ima2 --ref` to ground composition, density,
palette, or material exploration. The generated concept mockup remains an
exploration artifact unless all shipped pixels are recreated or sourced through
legal build-asset channels.

Do not crop a captured logo, photo, illustration, or UI region out of a
reference and place it into the build.

---

## Provenance Manifest

### Manifest Required (FE-CAPTURE-06, STRICT)

Every capture set needs a manifest stored next to the captured files, usually
`captures/manifest.md` or `captures/manifest.json` inside the active devlog
unit.

Each capture record must include:

| Field | Required Value |
| --- | --- |
| `source_url` | Original page or asset URL |
| `capture_date` | Date captured, preferably ISO `YYYY-MM-DD` |
| `license_status` | Known license, or `unknown - assume restricted` |
| `intended_use` | `analysis` or `mockup-ref` |
| `storage_path` | Path to the local captured file or folder |

Optional fields: viewport, interaction state, tool used, notes, and
replacement plan for any shippable equivalent.

---

## Ship Gate

### Captured Asset Preflight (FE-CAPTURE-07, STRICT)

Before shipping, verify that no captured third-party asset appears in the
shipped build. The same row belongs in `preflight-full.md`:

```text
No captured third-party asset in the shipped build; capture manifest present
for any reference captures.
```

If a captured reference inspired the final design, document the shippable
replacement source or confirm the final pixels were recreated from scratch.
