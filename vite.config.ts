import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Renderer (React UI) — served by `vite dev` in development and built to `dist/`
export default defineConfig({
  base: "./", // relative paths so the packaged app works from file://
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
