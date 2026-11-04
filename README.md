# Trade Journal — ژورنال ترید کریپتو

A fully **offline** desktop app for professional crypto trade journaling (Windows), with a **Persian (RTL) UI**.
All data (SQLite + screenshots) stays on your own machine.

یک نرم‌افزار دسکتاپ کاملاً آفلاین برای ژورنال‌نویسی حرفه‌ای معاملات کریپتو؛ تمام داده‌ها فقط روی دستگاه شما ذخیره می‌شوند.

---

## Features

- **Complete trade record** — everything a professional journal needs:
  - **Identity**: entry/exit date & time, symbol (BTC/USDT), exchange, market type (spot/futures/margin/paper), direction (long/short), mode (scalp/day/swing), timeframe, leverage + **auto liquidation-price estimate**
  - **Plan**: entry price, SL, TP1, TP2, quantity, notional, **risk (1R)**, % risk of balance, **planned R:R**, one-click **suggested position size**, fees, funding
  - **Per-trade risk %**: each trade can override the account default (e.g. 0.5% or 0.8% instead of the default 1%) — used for the position-size suggestion and shown on the trade
  - **Context**: setup tag, signal source, market condition, session, **entry reason (confluence)**, **chart screenshots before entry**
  - **Psychology**: emotion before/during/after, confidence (1–10), "did you follow the plan?", mistake tags (FOMO, moved stop, oversized, …)
  - **Outcome**: exit price/time/reason, auto-computed **P&L / % / ROE / R-multiple**, screenshots after the trade
  - **Review**: what actually happened, what went right/wrong, the **lesson learned**, free notes
- **Analytics dashboard**: equity curve (USD or R), monthly P&L heatmap, win rate, **expectancy (R)**, profit factor, avg R, max drawdown, consecutive losses, rule-adherence %
- **Breakdowns**: performance by setup, symbol, emotion, direction, hour of day, market type
- **Trade list** with search + filters, **CSV / JSON export & import**, database **backup**
- **Screenshots** stored as the original file, or re-encoded to **WebP** (configurable quality) to save disk space
- Dark/light theme, fully local, no accounts, no telemetry

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 33 (main + preload with `contextIsolation`) |
| UI | React 18 + TypeScript, HashRouter (works from `file://`) |
| Bundler | Vite 6 (renderer, main, preload bundles) |
| Local DB | better-sqlite3 (WAL) in `app.getPath('userData')` |
| Pure logic | `shared/calc.ts`, `shared/stats.ts` (no I/O → unit-testable) |
| Logic tests | Vitest 3 (+ jsdom + Testing Library for components) |
| UI tests | Playwright (headless) against `vite preview` with a localStorage mock of the same `JournalAPI` |
| Installer | electron-builder → NSIS `Setup.exe` + portable, built on GitHub Actions `windows-latest` |

```
electron/   main.ts (window + db) · preload.ts (contextBridge) · db.ts (SQLite) · ipc.ts (handlers)
shared/     types.ts · enums.ts · labels.ts (Persian labels) · calc.ts (trade math) · stats.ts (metrics) · api.ts (IPC contract)
src/        React UI — Dashboard · Trades · TradeForm · TradeDetail · Settings
tests/      unit (calc, stats, db) · components (jsdom) · e2e (Playwright)
```

## Development

```bash
npm install
npm run dev        # Vite dev server + watch-build of main/preload + Electron
```

> Headless sandboxes without access to GitHub release assets / nodejs.org:
> ```bash
> ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --ignore-scripts
> npm_config_nodedir="$(dirname "$(dirname "$(readlink -f "$(which node)")")")" npm rebuild better-sqlite3
> npm run test          # `pretest` re-ensures the Node-ABI build automatically
> npm run test:e2e:sandbox   # uses the npm-shipped @sparticuz/chromium binary
> ```
>
> Note: `postinstall` rebuilds better-sqlite3 for Electron's ABI (needed to *run* the app).
> Set `TJ_ELECTRON_REBUILD=0` to keep the Node ABI (that is what the CI test job does);
> `npm run test` always re-ensures the Node ABI via its `pretest` hook.

## Tests

```bash
npm run test        # Vitest: math, stats, real SQLite db layer (tmp file), React components
npm run test:e2e    # Playwright headless: full UI flow on the production build (vite preview + mock API)
```

The Playwright suite runs the built renderer in `vite preview`. When the Electron preload is
absent, the app automatically falls back to a localStorage implementation of the exact same
`JournalAPI` interface, so UI tests are fully headless and hermetic. In CI, the official
Playwright chromium is installed (`npx playwright install --with-deps chromium`).

## Build the Windows installer

```bash
npm run dist:win    # build + electron-builder → release/TradeJournal-Setup-<version>.exe
```

Automated in `.github/workflows/build.yml`:
- `test` job: typecheck + Vitest + Playwright on `ubuntu-latest`
- `build-windows` job: builds `Setup.exe` on `windows-latest`, uploads artifacts, and publishes
  to GitHub Releases when a Release event occurs

## Privacy & data location

- **Installed app (Setup.exe)**: data lives in `%APPDATA%/trade-journal/` (i.e. `C:\Users\<you>\AppData\Roaming\trade-journal\`)
  - Database: `trade-journal.db` (+ `-wal`/`-shm`)
  - Screenshots: `screenshots/` — stored with their original format (PNG/JPG/…) unless WebP is enabled in Settings, in which case they are re-encoded to `.webp`
  - Backups: `backups/`
- **Portable build** (`TradeJournal-Portable-<version>.exe`): runs directly from any folder/USB **without installation**; data is stored in a `data/` folder **next to the exe**.
- The exact database path is shown in **Settings → app info**.
- Nothing is ever sent to a server. Never store seed phrases / private keys / API secrets in the journal or its screenshots.

## Key math

- **1R = |entry − SL| × quantity** — every result is recorded as an R-multiple so trades of different sizes are comparable.
- **Expectancy = winRate × avgWinR − lossRate × avgLossR** — the single most important edge metric.
- **Profit factor = grossProfit / |grossLoss|** — above 1.5 is healthy.
- **Liquidation ≈ entry × (1 ∓ 1/leverage ± maintenanceMargin)** — long uses `1 − 1/lev + mmr`, short `1 + 1/lev − mmr`.
