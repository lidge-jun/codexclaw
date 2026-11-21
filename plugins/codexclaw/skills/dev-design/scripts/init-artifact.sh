#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: bash scripts/init-artifact.sh <project-name>"
}

if [ "${1:-}" = "" ]; then
  usage
  exit 1
fi

PROJECT_NAME="$1"

node - <<'NODE'
const [major, minor] = process.versions.node.split(".").map(Number);
const ok = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
if (!ok) {
  console.error(`Node.js ${process.versions.node} detected. Vite 7 requires Node.js 20.19+ or 22.12+.`);
  process.exit(1);
}
NODE

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first: corepack enable && corepack prepare pnpm@latest --activate"
  exit 1
fi

echo "Creating React 19 + Vite 7 artifact: $PROJECT_NAME"
pnpm create vite@7 "$PROJECT_NAME" --template react-ts

cd "$PROJECT_NAME"

echo "Installing React 19, Vite 7, Tailwind CSS v4, and UI utilities..."
pnpm install
pnpm add react@^19 react-dom@^19 class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D vite@^7 @vitejs/plugin-react @tailwindcss/vite tailwindcss @types/node

echo "Configuring Vite with @tailwindcss/vite..."
cat > vite.config.ts <<'EOF'
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
EOF

echo "Adding TypeScript path aliases..."
node - <<'NODE'
const fs = require("node:fs");

for (const file of ["tsconfig.json", "tsconfig.app.json"]) {
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .replace(/,(\s*[}\]])/g, "$1");
  const config = JSON.parse(raw);
  config.compilerOptions = config.compilerOptions || {};
  config.compilerOptions.baseUrl = ".";
  config.compilerOptions.paths = { "@/*": ["./src/*"] };
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}
NODE

mkdir -p src/lib
cat > src/lib/utils.ts <<'EOF'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

echo "Writing Tailwind v4 CSS-first theme..."
cat > src/index.css <<'EOF'
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --radius-card: var(--radius-card);
}

:root {
  color-scheme: light;
  --background: oklch(0.985 0.006 230);
  --foreground: oklch(0.18 0.025 245);
  --surface: oklch(1 0 0);
  --surface-2: oklch(0.955 0.012 230);
  --border: oklch(0.86 0.018 230);
  --muted: oklch(0.48 0.025 245);
  --accent: oklch(0.58 0.18 250);
  --accent-foreground: oklch(0.99 0.003 250);
  --radius-card: 8px;
}

.dark {
  color-scheme: dark;
  --background: oklch(0.16 0.025 245);
  --foreground: oklch(0.95 0.006 245);
  --surface: oklch(0.21 0.025 245);
  --surface-2: oklch(0.27 0.025 245);
  --border: oklch(0.34 0.025 245);
  --muted: oklch(0.73 0.015 245);
  --accent: oklch(0.7 0.16 250);
  --accent-foreground: oklch(0.15 0.025 245);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100dvh;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

button,
input,
textarea,
select {
  font: inherit;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
EOF

cat > src/App.tsx <<'EOF'
import { ArrowRight, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

const states = [
  { label: "Loading", detail: "Skeleton and progress states are planned before data arrives.", icon: Loader2 },
  { label: "Empty", detail: "First-use copy gives one clear action instead of a blank panel.", icon: CircleAlert },
  { label: "Success", detail: "Completed work has visible confirmation and a reversible next step.", icon: CheckCircle2 },
];

export default function App() {
  return (
    <main className="min-h-dvh px-5 py-6 sm:px-8">
      <section className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[520px] flex-col justify-between rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div>
            <p className="mb-4 text-sm font-medium text-accent">Operational UI scaffold</p>
            <h1 className="max-w-[14ch] text-balance text-4xl font-semibold tracking-normal sm:text-6xl">
              React 19 surface with real states.
            </h1>
            <p className="mt-5 max-w-[58ch] text-balance text-base leading-7 text-muted">
              This starter favors dense working screens, accessible controls, responsive containment, and Tailwind v4 CSS-first theme tokens.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground">
              Start review <ArrowRight aria-hidden="true" size={16} />
            </button>
            <button className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold">
              View states
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {states.map((state) => {
            const Icon = state.icon;
            return (
              <article key={state.label} className="rounded-card border border-border bg-surface p-5">
                <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-surface-2 text-accent">
                  <Icon aria-hidden="true" size={20} />
                </div>
                <h2 className="text-lg font-semibold">{state.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{state.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
EOF

cat > components.json <<'EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
EOF

echo "Setup complete."
echo "Next:"
echo "  cd $PROJECT_NAME"
echo "  pnpm dev"
