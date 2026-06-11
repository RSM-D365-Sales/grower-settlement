import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE is set by the Pages deploy workflow to "/<repo>/" (Docs/PLAN.md §3
// hosting note). Local dev and tests default to "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    // 5174 (not Vite's default 5173 — already in use by another project on
    // this machine). strictPort so a clash fails loudly instead of silently
    // hopping to a port the API's CORS doesn't allow.
    port: 5174,
    strictPort: true,
  },
});
