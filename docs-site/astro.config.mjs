// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";

// Project GitHub Pages site: https://lidge-jun.github.io/codexclaw
// `site` + `base` make Starlight emit correct absolute URLs and asset paths under the repo subpath.
export default defineConfig({
  site: "https://lidge-jun.github.io",
  base: "/codexclaw",
  trailingSlash: "ignore",
  integrations: [
    mermaid({
      theme: "dark",
      autoTheme: true,
    }),
    starlight({
      title: "codexclaw",
      description:
        "Codex-native development discipline: PABCD workflow, dev skills, subagent config, and an optional opencodex bridge — shipped as one Codex plugin.",
      tagline: "Development discipline for OpenAI Codex.",
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: "https://lidge-jun.github.io/codexclaw/og.png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: "https://lidge-jun.github.io/codexclaw/og.png" } },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/lidge-jun/codexclaw" },
      ],
      editLink: {
        baseUrl: "https://github.com/lidge-jun/codexclaw/edit/main/docs-site/",
      },
      lastUpdated: true,
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Installation", slug: "getting-started/installation" },
            { label: "First Run", slug: "getting-started/first-run" },
            { label: "Quickstart", slug: "getting-started/quickstart" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "How It Works", slug: "concepts/how-it-works" },
            { label: "Plugin Boundary", slug: "concepts/plugin-boundary" },
            { label: "Work Classes (C0-C5)", slug: "concepts/work-classes" },
            { label: "State Model", slug: "concepts/state-model" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Skills", slug: "guides/skills" },
            { label: "PABCD Workflow", slug: "guides/pabcd" },
            { label: "Subagents", slug: "guides/subagents" },
            { label: "OpenCodex Bridge", slug: "guides/opencodex-bridge" },
            { label: "GUI Dashboard", slug: "guides/gui" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Commands", slug: "reference/commands" },
            { label: "Hooks", slug: "reference/hooks" },
            { label: "MCP Tools", slug: "reference/api-mcp" },
            { label: "Plugin Manifest", slug: "reference/plugin-manifest" },
          ],
        },
        {
          label: "Development",
          items: [
            { label: "Dogfood & Dev Symlink", slug: "development/dogfood-dev-symlink" },
            { label: "Build & Test", slug: "development/build-test" },
            { label: "Parity Roadmap", slug: "development/parity-roadmap" },
          ],
        },
        { label: "Troubleshooting", slug: "troubleshooting" },
      ],
    }),
  ],
});
