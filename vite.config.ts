import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cloudflare Pages serves /dist (static SPA) + /functions (API).
// Local `vite dev` proxies /api to `wrangler pages dev` if you run one;
// on this machine we build in the cloud, so dev server is optional.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
