# Scripts

Utility scripts for React/artifact-based frontend projects.

## Available Scripts

### `init-artifact.sh`
Initializes a new React + TypeScript + Tailwind project aligned with `SKILL.md` §12.

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Creates:
- React 19 + TypeScript via Vite 8 (Rolldown/Oxc default)
- Tailwind CSS v4 through `@tailwindcss/vite`
- CSS-first theme tokens in `src/index.css`
- Path aliases (`@/`) configured
- `cn()` utility and `components.json` compatible with shadcn/ui
- A minimal responsive app with loading, empty, and success state examples

Requirements:
- Node.js 20.19+ or 22.12+
- pnpm

### `bundle-artifact.sh`
Bundles a React app into a single self-contained HTML file.

```bash
bash scripts/bundle-artifact.sh
```

Creates `bundle.html` with all JS, CSS, and dependencies inlined.

**Requirements**: `index.html` in project root.

### `shadcn-components.tar.gz`
Legacy pre-packaged shadcn/ui components. The current scaffold does not extract it by default because Tailwind v4 projects should follow local registry and CSS-token conventions.

## When to Use

- **React/Next.js artifacts**: Use `init-artifact.sh` to scaffold, `bundle-artifact.sh` to package
- **Vanilla HTML**: Not needed — output single `.html` file directly
- **Svelte/Vue**: Not applicable — use framework-specific scaffolding

## Note on Framework Agnosticism

These scripts are React-specific. For other stacks:
- **Next.js**: Use `npx create-next-app@latest`
- **Svelte**: Use `npx sv create`
- **Vue**: Use `npm create vue@latest`
- **Vanilla**: No scaffolding needed — single file output
