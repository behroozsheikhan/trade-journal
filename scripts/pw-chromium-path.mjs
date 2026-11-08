// Prints a chromium executable path for sandboxes where the Playwright CDN is
// unreachable: extracts the npm-shipped @sparticuz/chromium binary and prints it.
// Usage: PW_CHROMIUM_PATH=$(node scripts/pw-chromium-path.mjs) npx playwright test
const mod = await import("@sparticuz/chromium");
const chromium = mod.default ?? mod;
const p = await chromium.executablePath();
console.log(p);
