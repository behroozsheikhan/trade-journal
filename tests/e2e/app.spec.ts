import { expect, test } from "@playwright/test";

// These tests run against `vite preview` (production build of the renderer).
// Without the Electron preload, the app automatically uses the localStorage
// mock implementing the same JournalAPI contract — so they are fully headless.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid="dashboard"]');
});

test("dashboard shows empty state and seeds demo data", async ({ page }) => {
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await page.evaluate(() => window.__TJ__?.seedDemo(20));
  await page.reload();
  await page.waitForSelector('[data-testid="equity-chart"]');
  await expect(page.getByTestId("stat-win-rate")).toContainText("%");
  await expect(page.getByTestId("stat-expectancy")).toBeVisible();
  await expect(page.getByTestId("heatmap")).toBeVisible();
  const setupRows = page.locator('[data-testid="table-setup"] tbody tr');
  await expect(setupRows.first()).toBeVisible();
  // 20 closed + 2 open seeded
  await expect(page.getByTestId("open-trades-banner")).toContainText("2");
});

test("full flow: create trade -> list -> close -> dashboard stats", async ({ page }) => {
  // 1. create a new open trade
  await page.getByTestId("nav-new-trade").click();
  await page.waitForSelector('[data-testid="trade-form"]');
  await page.getByTestId("field-symbol").fill("BTC/USDT");
  await page.getByTestId("field-entry-price").fill("67000");
  await page.getByTestId("field-sl").fill("66000");
  await page.getByTestId("field-tp1").fill("69000");
  // per-trade risk: pick 0.5% and let the app suggest the size -> 10000*0.005/1000 = 0.05
  await page.getByTestId("risk-chip-0.5").click();
  await expect(page.getByTestId("calc-risk-percent")).toContainText("0.5%");
  await page.getByTestId("btn-suggest-qty").click();
  await expect(page.getByTestId("field-quantity")).toHaveValue("0.05");
  // back to an explicit size for the rest of the flow
  await page.getByTestId("field-quantity").fill("0.1");
  await page.getByTestId("field-setup").fill("breakout");
  await page.getByTestId("field-emotion-before-calm").click();
  // live calculations: notional = 6700, planned RR = 2:1, risk = 100
  await expect(page.getByTestId("calc-notional")).toContainText("6,700");
  await expect(page.getByTestId("calc-rr")).toContainText("2.00");
  await expect(page.getByTestId("calc-risk")).toContainText("100");
  await page.getByTestId("btn-save-trade").click();

  // 2. landed on detail page
  await page.waitForSelector('[data-testid="trade-detail"]');
  await expect(page.locator("h1")).toContainText("BTC/USDT");
  await expect(page.locator("h1 .badge")).toContainText("باز");

  // 3. go to list — trade appears
  await page.getByTestId("nav-trades").click();
  await page.waitForSelector('[data-testid="trades-table"]');
  await expect(page.getByTestId("trades-table")).toContainText("BTC/USDT");

  // 4. close the trade with exit at TP (69000) -> +2R
  await page.getByTestId("trade-row").first().click();
  await page.waitForSelector('[data-testid="trade-detail"]');
  await page.getByTestId("btn-edit").click();
  await page.waitForSelector('[data-testid="trade-form"]');
  await page.getByTestId("field-status-closed").click();
  await page.getByTestId("field-exit-date").fill(new Date().toISOString().slice(0, 10));
  await page.getByTestId("field-exit-price").fill("69000");
  await page.getByTestId("btn-save-trade").click();
  await page.waitForSelector('[data-testid="trade-detail"]');
  await expect(page.getByTestId("detail-r")).toContainText("+2.00R");
  await expect(page.getByTestId("detail-pnl")).toContainText("200");

  // 5. dashboard reflects the closed trade: win rate 100%, netR +2
  await page.getByTestId("nav-dashboard").click();
  await page.waitForSelector('[data-testid="stat-win-rate"]');
  await expect(page.getByTestId("stat-win-rate")).toContainText("100.0%");
  await expect(page.getByTestId("stat-net-pnl")).toContainText("200");
  await expect(page.getByTestId("equity-chart")).toBeVisible();
});

test("filters on the trades page", async ({ page }) => {
  await page.evaluate(() => window.__TJ__?.seedDemo(15));
  await page.goto("/#/trades");
  await page.waitForSelector('[data-testid="trades-table"]');
  const allRows = page.locator('[data-testid="trade-row"]');
  await expect(allRows).toHaveCount(17); // 15 closed + 2 open

  await page.getByTestId("filter-status").selectOption("closed");
  await expect(allRows).toHaveCount(15);

  await page.getByTestId("filter-search").fill("BTC");
  const btcCount = await allRows.count();
  expect(btcCount).toBeGreaterThan(0);
  expect(btcCount).toBeLessThan(15);
  for (let i = 0; i < btcCount; i++) {
    await expect(allRows.nth(i)).toContainText("BTC");
  }
});

test("settings persist", async ({ page }) => {
  await page.getByTestId("nav-settings").click();
  await page.waitForSelector('[data-testid="settings-page"]');
  await page.getByTestId("set-balance").fill("25000");
  await page.getByTestId("set-currency").fill("USD");
  await page.getByTestId("btn-save-settings").click();
  await expect(page.getByTestId("toast-ok")).toBeVisible();
  await page.reload();
  await page.getByTestId("nav-settings").click();
  await page.waitForSelector('[data-testid="set-balance"]');
  await expect(page.getByTestId("set-balance")).toHaveValue("25000");
  await expect(page.getByTestId("set-currency")).toHaveValue("USD");
});

test("export produces a downloadable JSON in browser mode", async ({ page }) => {
  await page.evaluate(() => window.__TJ__?.seedDemo(3));
  await page.getByTestId("nav-settings").click();
  await page.waitForSelector('[data-testid="btn-export-json"]');
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("btn-export-json").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/trade-journal-.*\.json/);
});
