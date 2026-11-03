import { defineConfig } from "vite";

// Electron main process -> dist-electron/main.js (CJS, node target)
export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    target: "node20",
    minify: false,
    sourcemap: true,
    lib: { entry: "electron/main.ts", formats: ["cjs"], fileName: () => "main.js" },
    rollupOptions: {
      external: ["electron", "better-sqlite3", /^node:/, "fs", "path", "crypto", "os", "util", "events", "stream", "url", "zlib", "buffer", "tty", "assert"],
    },
  },
});
