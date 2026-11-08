import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { JournalDB } from "./db";
import { registerIpc } from "./ipc";

// The main bundle is built as CJS, so __dirname is available at runtime.
declare const __dirname: string;
const isDev = !!process.env.VITE_DEV_SERVER_URL;

let db: JournalDB | null = null;

// ---------------------------------------------------------------------------
// Diagnostics: in the packaged app there is no console, so every important
// event (and every failure) is appended to <userData>/main.log, e.g.
//   %APPDATA%\TradeJournal\main.log  on Windows
// ---------------------------------------------------------------------------
function log(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args
    .map((a) => (a instanceof Error ? a.stack ?? String(a) : String(a)))
    .join(" ")}\n`;
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(path.join(app.getPath("userData"), "main.log"), line);
  } catch {
    // never let logging itself crash the app
  }
  console.log(line.trimEnd());
}

function fatal(title: string, err: unknown): void {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  log("FATAL", title, message);
  try {
    dialog.showErrorBox(`TradeJournal — ${title}`, `${message}\n\nLog: ${path.join(app.getPath("userData"), "main.log")}`);
  } catch {
    // ignore
  }
  app.quit();
}

process.on("uncaughtException", (err) => fatal("uncaughtException", err));
process.on("unhandledRejection", (err) => fatal("unhandledRejection", err));

// Only one instance: a second launch focuses the existing window instead of
// spawning another (possibly hidden) process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  log("second instance launched — quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    log("second-instance: focusing existing window");
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

function errorPageHtml(title: string, detail: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
    body{font-family:Tahoma,sans-serif;background:#0b0f17;color:#e5e7eb;display:flex;
    align-items:center;justify-content:center;height:100vh;margin:0}
    .card{max-width:560px;background:#111827;border:1px solid #1f2937;border-radius:12px;
    padding:28px;text-align:center}
    h1{font-size:20px;color:#f87171;margin:0 0 12px}
    p{font-size:14px;line-height:1.9;color:#9ca3af;white-space:pre-wrap;word-break:break-word}
    .log{color:#6b7280;font-size:12px;margin-top:14px}
  </style></head><body><div class="card">
    <h1>${esc(title)}</h1>
    <p>${esc(detail)}</p>
    <p class="log">فایل لاگ: ${esc(path.join(app.getPath("userData"), "main.log"))}</p>
  </div></body></html>`;
}

function createWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  log("createWindow: __dirname=", __dirname, "appPath=", app.getAppPath(), "isPackaged=", app.isPackaged);
  log("createWindow: preload=", preloadPath, "exists=", fs.existsSync(preloadPath));
  log("createWindow: index=", indexPath, "exists=", fs.existsSync(indexPath));

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b0f17",
    title: "ژورنال ترید — Trade Journal",
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Primary path: show as soon as the first frame is ready.
  win.once("ready-to-show", () => {
    log("ready-to-show");
    win.show();
  });

  // Safety nets so the window can NEVER stay hidden forever: if the renderer
  // finishes loading (or fails) without ready-to-show firing, force-show.
  const forceShow = (reason: string) => {
    if (!win.isVisible() && !win.isDestroyed()) {
      log("force-show:", reason);
      win.show();
    }
  };
  win.webContents.on("did-finish-load", () => setTimeout(() => forceShow("did-finish-load"), 1500));
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    log("did-fail-load:", code, desc, url);
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPageHtml("خطا در بارگذاری صفحه", `کد خطا: ${code} — ${desc}\n${url}`))}`).catch((err) => log("error page load failed", String(err)));
    forceShow("did-fail-load");
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    log("render-process-gone:", JSON.stringify(details));
    forceShow("render-process-gone");
  });
  win.webContents.on("console-message", (_e, level, message) => {
    if (level >= 2) log("renderer console:", message);
  });
  setTimeout(() => forceShow("6s timeout"), 6000);

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL as string).catch((err) => log("loadURL failed", String(err)));
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(indexPath).catch((err) => {
      log("loadFile failed:", String(err));
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPageHtml("فایل رابط کاربری یافت نشد", String(err)))}`).catch(() => {});
      forceShow("loadFile rejected");
    });
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    try {
      const userData = app.getPath("userData");
      log("app ready: version=", app.getVersion(), "platform=", process.platform, "userData=", userData);
      const dbPath = path.join(userData, "trade-journal.db");
      db = new JournalDB(dbPath, path.join(userData, "screenshots"));
      log("db opened:", dbPath);
      registerIpc(db, () => app.getVersion());
      log("ipc registered");
      createWindow();
    } catch (err) {
      fatal("خطا در شروع برنامه", err);
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  db?.close();
});
