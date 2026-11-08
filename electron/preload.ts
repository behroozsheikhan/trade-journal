import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type JournalAPI } from "../shared/api";
import type { ExportFormat, ImageRef, Journal, Settings, Trade, TradeFilters, TradeInput } from "../shared/types";

const api: JournalAPI = {
  listJournals: () => ipcRenderer.invoke(IPC_CHANNELS.journalsList),
  createJournal: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.journalsCreate, name),
  updateJournal: (id: string, patch: Partial<Pick<Journal, "name">>) => ipcRenderer.invoke(IPC_CHANNELS.journalsUpdate, { id, patch }),
  deleteJournal: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.journalsDelete, id),

  listTrades: (filters?: TradeFilters) => ipcRenderer.invoke(IPC_CHANNELS.tradesList, filters),
  getTrade: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.tradesGet, id),
  createTrade: (input: TradeInput) => ipcRenderer.invoke(IPC_CHANNELS.tradesCreate, input),
  updateTrade: (id: string, input: TradeInput) => ipcRenderer.invoke(IPC_CHANNELS.tradesUpdate, { id, input }),
  deleteTrade: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.tradesDelete, id),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetAll),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC_CHANNELS.settingsSet, patch),

  saveImage: (tradeId: string, name: string, data: Uint8Array): Promise<ImageRef> =>
    ipcRenderer.invoke(IPC_CHANNELS.imagesSave, { tradeId, name, data }),
  getImage: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.imagesGet, id),
  deleteImage: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.imagesDelete, id),

  exportData: (format: ExportFormat) => ipcRenderer.invoke(IPC_CHANNELS.dataExport, format),
  importData: () => ipcRenderer.invoke(IPC_CHANNELS.dataImport),
  importDataString: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.dataImportString, content),
  backup: () => ipcRenderer.invoke(IPC_CHANNELS.dataBackup),

  appInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
};

contextBridge.exposeInMainWorld("tradeJournal", api);

export type { JournalAPI };
