import { defineConfig } from "vite";

// Electron preload script -> dist-electron/preload.js (CJS)
export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    target: "node20",
    minify: false,
    sourcemap: true,
    lib: { entry: "electron/preload.ts", formats: ["cjs"], fileName: () => "preload.js" },
    rollupOptions: {
      external: ["electron", /^node:/],
    },
  },
});
