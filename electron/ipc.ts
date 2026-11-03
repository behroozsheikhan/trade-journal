// IPC handlers: maps the shared JournalAPI contract onto the JournalDB + OS dialogs.

import { app, dialog, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { IPC_CHANNELS } from "../shared/api";
import type { ExportFormat } from "../shared/types";
import type { JournalDB } from "./db";

export function registerIpc(db: JournalDB, getVersion: () => string): void {
  ipcMain.handle(IPC_CHANNELS.tradesList, (_e, filters) => db.listTrades(filters));
  ipcMain.handle(IPC_CHANNELS.tradesGet, (_e, id: string) => db.getTrade(id));
  ipcMain.handle(IPC_CHANNELS.tradesCreate, (_e, input) => db.createTrade(input));
  ipcMain.handle(IPC_CHANNELS.tradesUpdate, (_e, { id, input }) => db.updateTrade(id, input));
  ipcMain.handle(IPC_CHANNELS.tradesDelete, (_e, id: string) => db.deleteTrade(id));

  ipcMain.handle(IPC_CHANNELS.settingsGetAll, () => db.getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSet, (_e, patch) => db.setSettings(patch));

  ipcMain.handle(IPC_CHANNELS.imagesSave, (_e, { tradeId, name, data }: { tradeId: string; name: string; data: Uint8Array }) =>
    db.saveImage(tradeId, name, data),
  );
  ipcMain.handle(IPC_CHANNELS.imagesGet, (_e, id: string) => db.getImage(id));
  ipcMain.handle(IPC_CHANNELS.imagesDelete, (_e, id: string) => db.deleteImage(id));

  ipcMain.handle(IPC_CHANNELS.dataExport, async (_e, format: ExportFormat) => {
    const content = format === "csv" ? db.exportCSV() : db.exportJSON();
    const defaultName = format === "csv" ? `trade-journal-${new Date().toISOString().slice(0, 10)}.csv` : `trade-journal-${new Date().toISOString().slice(0, 10)}.json`;
    const res = await dialog.showSaveDialog({
      title: "Export journal",
      defaultPath: path.join(app.getPath("documents"), defaultName),
      filters: format === "csv" ? [{ name: "CSV", extensions: ["csv"] }] : [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePath) return { ok: false };
    fs.writeFileSync(res.filePath, content, "utf-8");
    return { ok: true, path: res.filePath, count: db.listTrades().length };
  });

  ipcMain.handle(IPC_CHANNELS.dataImport, async () => {
    const res = await dialog.showOpenDialog({
      title: "Import journal",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, imported: 0 };
    const file = res.filePaths[0];
    const result = db.importJSON(fs.readFileSync(file, "utf-8"));
    return { ok: true, imported: result.imported, path: file };
  });

  ipcMain.handle(IPC_CHANNELS.dataImportString, (_e, content: string) => {
    const result = db.importJSON(content);
    return { ok: true, imported: result.imported };
  });

  ipcMain.handle(IPC_CHANNELS.dataBackup, async () => {
    const dest = path.join(app.getPath("userData"), "backups");
    return { ok: true, path: await db.backup(dest) };
  });

  ipcMain.handle(IPC_CHANNELS.appInfo, () => ({
    version: getVersion(),
    dbPath: db.dbPath,
    platform: `${process.platform} ${process.arch}`,
    isElectron: true,
  }));
}
