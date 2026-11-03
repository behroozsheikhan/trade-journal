import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Chromium executable resolution (synchronous, config-time):
 *  1. PW_CHROMIUM_PATH env var (used in sandboxes, see scripts/pw-chromium-path.mjs)
 *  2. Playwright's own installed browsers (normal dev machines + CI) -> undefined
 *  3. Otherwise undefined (playwright will report that browsers are missing).
 */
function resolveChromiumExecutable(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const cacheDir = path.join(process.env.HOME || "/tmp", ".cache", "ms-playwright");
  try {
    const has = fs.readdirSync(cacheDir).some((d) => d.startsWith("chromium-") || d.startsWith("chrome-"));
    if (has) return undefined;
  } catch {
    /* no cache dir */
  }
  return undefined;
}

const executablePath = resolveChromiumExecutable();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "npm run build:ui && npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
