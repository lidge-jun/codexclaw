import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// codexclaw dashboard dev/build config. The dev server prints its own URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 4173, strictPort: false },
  build: { outDir: "dist" },
});
