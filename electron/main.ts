import { app, BrowserWindow } from "electron";
import path from "node:path";
import { JournalDB } from "./db";
import { registerIpc } from "./ipc";

// The main bundle is built as CJS, so __dirname is available at runtime.
declare const __dirname: string;
const isDev = !!process.env.VITE_DEV_SERVER_URL;

let db: JournalDB | null = null;

function createWindow(): void {
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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  db = new JournalDB(path.join(userData, "trade-journal.db"), path.join(userData, "screenshots"));
  registerIpc(db, () => app.getVersion());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  db?.close();
});
