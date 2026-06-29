import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { codexclawApiPlugin } from "./src/server/middleware.ts";

// codexclaw dashboard. The API plugin serves /api/* from the node-side handlers
// (L24 store, L25 catalog, L23 detection) so the browser never shells out to ocx.
export default defineConfig({
  plugins: [react(), codexclawApiPlugin()],
  server: { port: 4173, strictPort: false },
  build: { outDir: "dist" },
});
