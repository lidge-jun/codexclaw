# Scripts

Utility scripts for React/artifact-based frontend projects.
Copied from Anthropic's `web-artifacts-builder` skill.

## Available Scripts

### `init-artifact.sh`
Initializes a new React + TypeScript + Tailwind + shadcn/ui project.

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Creates:
- React 18 + TypeScript via Vite
- Tailwind CSS 3.4.1 with shadcn/ui theming
- Path aliases (`@/`) configured
- 40+ shadcn/ui components pre-installed
- Parcel configured for bundling

### `bundle-artifact.sh`
Bundles a React app into a single self-contained HTML file.

```bash
bash scripts/bundle-artifact.sh
```

Creates `bundle.html` with all JS, CSS, and dependencies inlined.

**Requirements**: `index.html` in project root.

### `shadcn-components.tar.gz`
Pre-packaged shadcn/ui components for offline installation.

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
