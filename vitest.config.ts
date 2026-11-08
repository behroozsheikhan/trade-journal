import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/unit/**/*.spec.ts", "tests/components/**/*.spec.tsx"],
    environment: "node",
    globals: false,
    setupFiles: ["tests/setup.ts"],
    css: false,
  },
});
