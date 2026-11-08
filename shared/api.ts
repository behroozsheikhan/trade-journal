// The IPC contract between the Electron main process and the React renderer.
// `electron/preload.ts` implements it over ipcRenderer; `src/mockApi.ts`
// implements the same interface with localStorage for browser/e2e runs.

import type { AppInfo, ExportFormat, ImageRef, Journal, Settings, Trade, TradeFilters, TradeInput } from "./types";

export const IPC_CHANNELS = {
  tradesList: "trades:list",
  tradesGet: "trades:get",
  tradesCreate: "trades:create",
  tradesUpdate: "trades:update",
  tradesDelete: "trades:delete",
  settingsGetAll: "settings:getAll",
  settingsSet: "settings:set",
  imagesSave: "images:save",
  imagesGet: "images:get",
  imagesDelete: "images:delete",
  dataExport: "data:export",
  dataImport: "data:import",
  dataImportString: "data:importString",
  dataBackup: "data:backup",
  appInfo: "app:info",
  journalsList: "journals:list",
  journalsCreate: "journals:create",
  journalsUpdate: "journals:update",
  journalsDelete: "journals:delete",
} as const;

export interface ExportResult {
  ok: boolean;
  path?: string; // set when the main process wrote to a user-chosen file
  content?: string; // set by the browser mock so the UI can trigger a download
  count?: number;
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  path?: string;
}

export interface JournalAPI {
  // journals = independent workspaces; trades belong to exactly one
  listJournals(): Promise<Journal[]>;
  createJournal(name: string): Promise<Journal>;
  updateJournal(id: string, patch: Partial<Pick<Journal, "name">>): Promise<Journal>;
  deleteJournal(id: string): Promise<void>;

  listTrades(filters?: TradeFilters): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | null>;
  createTrade(input: TradeInput): Promise<Trade>;
  updateTrade(id: string, input: TradeInput): Promise<Trade>;
  deleteTrade(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;

  /** Store an image for a trade. `data` is the raw file bytes. */
  saveImage(tradeId: string, name: string, data: Uint8Array): Promise<ImageRef>;
  /** Returns raw bytes (renderer turns them into a data: URL). */
  getImage(id: string): Promise<{ name: string; data: Uint8Array } | null>;
  deleteImage(id: string): Promise<void>;

  exportData(format: ExportFormat): Promise<ExportResult>;
  importData(): Promise<ImportResult>;
  /** Import from an already-read JSON string (used by the browser fallback file input). */
  importDataString(content: string): Promise<ImportResult>;
  backup(): Promise<{ ok: boolean; path?: string }>;

  appInfo(): Promise<AppInfo>;
}
