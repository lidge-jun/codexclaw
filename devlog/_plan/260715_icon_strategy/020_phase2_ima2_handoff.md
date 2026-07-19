# 020 — Phase 2: ima2 Icon Pipeline Handoff

Goal: hand the custom domain/brand icon route to `ima2-gen` as an implementation-ready
documentation unit. This phase is documentation-only: it specifies the future CLI and
dependency seams, but does not patch ima2 source, install tools, or generate assets.

Target repository: `/Users/jun/Developer/new/700_projects/ima2-gen`.

## ADD `devlog/_plan/260715_icon_pipeline/000_plan.md`

Create the unit overview with this content shape:

```md
# ima2 Icon Pipeline

Add `ima2 icon` as the vector-icon production route used when a generic UI library
cannot represent a domain concept or brand-specific style. The pipeline owns bitmap
generation through optimized SVG/component output; it does not replace system icon
libraries.

## Pipeline

`ima2 icon generate` → crop/background removal → `vtracer` → `svgo` → optional `svgr`

## Work pages

- `010_cli_design.md` — command tree, flags, interactive flow, outputs, failures
- `020_dependencies.md` — vtracer/SVGO/SVGR adapters, probing, portability, tests

## In

- Single icons and coherent icon-set batches
- Transparent raster source generation and imported source rasters
- Color and monochrome tracing
- Optimized SVG output and optional React component output
- Manifested provenance, prompt, palette, and tool settings

## Out

- Replacing Lucide/Phosphor/etc. for routine system controls
- Logo trademark design or automatic legal clearance
- Font-icon generation
- Runtime UI integration into downstream applications
- Silent installation of Rust/Node dependencies

## Acceptance

1. CLI supports non-interactive and guided flows with deterministic output paths.
2. Missing native/Node tools produce actionable probe/install guidance.
3. Every successful run emits SVG plus a manifest; React output is opt-in.
4. Batch icons share canvas, palette, stroke/fill grammar, and tracing settings.
5. Tests cover command parsing, dependency absence, stage failures, and manifests.
```

The overview must link back to codexclaw's three-layer strategy:
`system library → custom/premium domain icons → custom brand icons`, and state that
`ima2 icon` serves the latter two layers only.

## ADD `devlog/_plan/260715_icon_pipeline/010_cli_design.md`

Write the CLI contract at diff-level detail.

### Command registration

Identify ima2's existing root command registration and add a future `icon` command
without changing current `gen` semantics. The implementation plan must name the exact
source file and parser/handler insertion anchors after re-verifying the ima2 tree.

Specify this command tree:

```text
ima2 icon generate <prompt>
ima2 icon import <input>
ima2 icon batch <spec>
ima2 icon inspect <job-or-manifest>
```

- `generate`: invokes the existing image provider path with an icon-specific prompt
  envelope, then runs the vector pipeline.
- `import`: skips generation and vectorizes an existing PNG/JPEG/WebP.
- `batch`: reads a JSON/YAML icon-set specification and locks style/palette/canvas
  across concepts.
- `inspect`: prints stages, source/output paths, commands/tool versions, warnings,
  and manifest state without mutation.

### Shared flags

```text
--out <path>                 SVG output file or batch directory
--mode <color|mono>          tracing mode; default color
--palette <value>            named palette, comma-separated colors, or palette file
--size <px>                  normalized square canvas; default 24 for UI output
--background <remove|keep>   default remove for generated artwork
--component <none|react>     default none; react runs SVGR
--component-name <name>      required/derived for single React output
--precision <n>              forwarded through the SVGO policy
--preset <system|domain|brand>
--ref <path>                 repeatable style reference for generation
--keep-intermediates         retain raster/cropped/traced pre-optimization files
--force                      allow replacement of existing outputs
--json                       machine-readable progress/result envelope
```

`batch` additionally accepts `--concurrency <n>` and `--fail-fast`. `generate`
retains compatible provider/model/session flags from the existing `ima2 gen` route
rather than defining a second provider abstraction.

### Preset semantics

| Preset | Intended layer | Default behavior |
|--------|----------------|------------------|
| `system` | Exceptional custom control glyph | Mono, restrained silhouette, 24px canvas; warn that a library is usually preferable |
| `domain` | Product concepts/categories/KPIs | Color allowed, shared palette and silhouette grammar, 24/32px target |
| `brand` | Identity-bearing icon/character | Color, stronger style-reference requirement, preserve editable intermediates |

### Interactive flow

When required arguments are missing and the process is attached to a TTY, ask in this
order: source (`generate`/`import`) → concept(s) → layer preset → color/mono → palette
→ reference → output format → output path → confirmation. In non-interactive mode,
fail with the missing argument and an example command; never block waiting for input.

### Output contract

For `ima2 icon generate "sleep score" --preset domain --component react
--out assets/icons/sleep-score`, emit:

```text
assets/icons/sleep-score/
  sleep-score.svg
  SleepScoreIcon.tsx
  sleep-score.icon.json
  intermediates/            # only with --keep-intermediates
```

The manifest records schema version, prompt/source hash, provider/model when generated,
style refs, preset, canvas, palette, trace options, SVGO/SVGR options and versions,
timestamps, output hashes, and warnings. It must not record secrets or raw provider
credentials.

### Failure and safety contract

- Probe all required tools before generation begins when the selected output requires
  them; avoid paying for generation that cannot be converted.
- Refuse to overwrite existing outputs unless `--force` is set.
- Preserve the source/intermediate path in the error envelope when a later stage fails
  so the run can resume without regenerating.
- Reject empty, fully transparent, or unsupported source files before tracing.
- Warn when fine detail will not survive the requested 16/20/24px canvas.
- Keep user prompts and imported files local except for the explicitly selected image
  provider call.

### CLI tests

Plan parser/handler tests for: command help snapshot; generate/import argument
validation; non-TTY missing-argument failure; overwrite refusal/`--force`; JSON
envelope stability; batch style-lock propagation; partial-stage resume; and no-secret
manifest serialization.

## ADD `devlog/_plan/260715_icon_pipeline/020_dependencies.md`

Specify adapters and stage boundaries rather than embedding shell commands throughout
the command handler.

### Dependency adapters

| Stage | Tool | Probe | Required when | Adapter contract |
|-------|------|-------|---------------|------------------|
| Trace | `vtracer` | `vtracer --version` | All SVG output | Raster input + explicit mode/settings → raw SVG; capture stderr and version |
| Optimize | `svgo` | local package resolution, then CLI/version probe | All final SVG output | Raw SVG + checked config → deterministic optimized SVG |
| Component | `@svgr/core` / SVGR CLI | local package resolution/version | `--component react` | Optimized SVG + component name → formatted React component |

The future implementation must prefer project-local Node packages for SVGO/SVGR and
must not auto-install missing dependencies. For vtracer, provide platform-specific
actionable guidance (`cargo install vtracer` where Cargo is available; documented
binary/package alternatives elsewhere) while keeping the process fail-fast.

### Pipeline API seam

Plan one orchestrator with explicit stage results:

```ts
type IconPipelineInput = {
  source: string;
  output: string;
  mode: "color" | "mono";
  component: "none" | "react";
  preset: "system" | "domain" | "brand";
  palette?: string[];
  size: number;
  keepIntermediates: boolean;
};

type IconStageResult = {
  stage: "prepare" | "trace" | "optimize" | "component" | "manifest";
  ok: boolean;
  inputPath: string;
  outputPath?: string;
  tool?: { name: string; version: string };
  warnings: string[];
};
```

The implementation plan must map these types to the repository's actual language and
module conventions after inspection; names above define behavior, not an instruction
to create an isolated abstraction inconsistent with ima2.

### Stage details

1. **Prepare:** decode, crop transparent margins, remove background when requested,
   normalize to a padded square canvas, and retain alpha.
2. **Trace:** invoke vtracer with explicit color mode and pinned arguments. `color`
   preserves the approved palette; `mono` produces a current-color-compatible path.
3. **Optimize:** use a checked-in SVGO configuration. Preserve `viewBox`, semantic
   grouping needed for multi-color icons, and stable IDs; remove editor metadata and
   unsafe/unneeded dimensions.
4. **Component:** run only on request. Generate a typed React component compatible
   with project conventions, forward SVG props/ref where established, preserve
   `currentColor` for mono output, and avoid hard-coded accessibility claims.
5. **Manifest:** write last, atomically, after output hashes are known. A failed run
   writes a separate resumable state/error record rather than a success manifest.

### Consistency and quality gates

- Batch jobs lock canvas, optical padding, palette, stroke/fill grammar, corner style,
  and trace settings before the first icon.
- Render and inspect at 16, 20, 24, and 32px; reject clipped shapes and illegible
  interior detail.
- Compare every traced icon to its approved raster source and flag material silhouette
  or palette drift.
- Optimize deterministically: identical source/settings/tool versions must produce
  byte-identical SVG where tool behavior permits.
- Do not merge arbitrary library SVGs into a custom set or strip third-party license
  metadata without provenance review.

### Dependency and integration tests

Plan unit tests with fake process runners for probe success/failure, vtracer non-zero
exit, malformed SVG, SVGO policy preservation (`viewBox`, colors, IDs), SVGR opt-in,
and atomic output cleanup. Add an integration fixture for one mono and one multi-color
icon; gate real-tool smoke tests on tool availability so ordinary test runs remain
portable.

## BACK-REFERENCE after ima2 capability lands

In the later codexclaw follow-up, re-verify and update only these already-planned
surfaces:

- `plugins/codexclaw/skills/dev-uiux-design/SKILL.md` `UX-ICON-01`: replace any
  future-capability wording with the confirmed `ima2 icon` command contract.
- `plugins/codexclaw/skills/dev-frontend/SKILL.md` `FE-ICON-01`: replace the conceptual
  `ima2 icon → vtracer → svgo → svgr` route with one tested invocation referencing
  the confirmed `ima2 icon` command and its output paths.

## Verification for the ima2 documentation phase

Run from the ima2 repository after creating the three handoff docs:

```sh
test -f devlog/_plan/260715_icon_pipeline/000_plan.md
test -f devlog/_plan/260715_icon_pipeline/010_cli_design.md
test -f devlog/_plan/260715_icon_pipeline/020_dependencies.md
rg -n 'ima2 icon|vtracer|svgo|svgr|manifest|--component' devlog/_plan/260715_icon_pipeline
git diff --check -- devlog/_plan/260715_icon_pipeline
```

Before implementation, re-run repository discovery in ima2 and replace every generic
“identify existing file” instruction with exact source paths, symbols, tests, and build
commands. No ima2 implementation or codexclaw back-reference patch belongs to this
handoff-document phase.

## ima2 Source Grounding (added post-audit)

The ima2 CLI entrypoint is `bin/ima2.ts`. Commands live under `bin/commands/` as
individual `.ts` files (e.g. `gen.ts`, `edit.ts`, `video.ts`). The new icon command
should be registered as `bin/commands/icon.ts` following the same pattern.

Key integration points:
- **Server interaction:** `bin/lib/client.ts` (`resolveServer`, `request`, `normalizeGenerate`) — icon gen reuses the existing server-backed generation flow, then runs local post-processing
- **File I/O:** `bin/lib/files.ts` (`fileToDataUri`, `dataUriToFile`, `defaultOutName`) — reuse for raster input/output
- **CLI args:** `bin/lib/args.ts` (`parseArgs`) — standard flag parsing
- **Output:** `bin/lib/output.ts` (`out`, `die`, `json`) — consistent CLI output
- **Recovery:** `bin/lib/recover-output.ts` — reuse for interrupted icon pipeline runs
- **Config:** `config.ts` (`runtimeConfig.storage`) — generated dir, config dir paths
- **Build:** ima2 uses TypeScript → JS build; `.ts` source lives alongside `.js` built output

The handoff doc written in WP3 will specify the exact file map against these anchors,
but the actual `bin/commands/icon.ts` implementation is out of scope for this session.
