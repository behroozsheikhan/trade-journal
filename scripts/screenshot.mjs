// Dev helper: screenshots the built UI (vite preview) with seeded demo data.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const pkgDir = path.resolve("node_modules/@sparticuz/chromium");
const al2023Dir = path.join(os.tmpdir(), "al2023");
if (!fs.existsSync(path.join(al2023Dir, "lib", "libnss3.so"))) {
  const tar = path.join(os.tmpdir(), "al2023.tar");
  fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(path.join(pkgDir, "bin", "al2023.tar.br"))));
  fs.mkdirSync(al2023Dir, { recursive: true });
  spawnSync("tar", ["-xf", tar, "-C", al2023Dir]);
}
process.env.LD_LIBRARY_PATH = [path.join(al2023Dir, "lib"), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");

const mod = await import("@sparticuz/chromium");
const chromium = mod.default ?? mod;
const executablePath = await chromium.executablePath();

const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  detached: true,
  stdio: "ignore",
  env: process.env,
});
server.unref();
await new Promise((r) => setTimeout(r, 5000));

const { chromium: pwChromium } = await import("playwright-core");
const browser = await pwChromium.launch({ executablePath, headless: true, args: [...(chromium.args ?? []), "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto("http://127.0.0.1:4173/", { timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__TJ__?.seedDemo(28));
  await page.reload();
  await page.waitForSelector('[data-testid="equity-chart"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/shot-dashboard.png", fullPage: true });

  await page.goto("http://127.0.0.1:4173/#/trades/new");
  await page.waitForSelector('[data-testid="trade-form"]', { timeout: 30000 });
  await page.getByTestId("field-symbol").fill("BTC/USDT");
  await page.getByTestId("field-entry-price").fill("67000");
  await page.getByTestId("field-sl").fill("66000");
  await page.getByTestId("field-tp1").fill("69000");
  await page.getByTestId("field-quantity").fill("0.1");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/shot-form.png", fullPage: true });

  await page.goto("http://127.0.0.1:4173/#/trades");
  await page.waitForSelector('[data-testid="trades-table"]', { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/shot-trades.png", fullPage: true });

  console.log("screenshots saved");
} finally {
  await browser.close().catch(() => {});
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
}
