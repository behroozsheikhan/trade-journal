import type { JournalAPI } from "../shared/api";
import { MockApi } from "./mockApi";

declare global {
  interface Window {
    tradeJournal?: JournalAPI;
    __TJ__?: { api: JournalAPI; seedDemo: (n?: number) => Promise<void>; isMock: boolean };
  }
}

let cached: JournalAPI | null = null;

/**
 * Returns the journal API. Inside Electron this is the IPC bridge exposed by
 * the preload script; in a plain browser (vite preview / Playwright e2e) it
 * falls back to a localStorage-backed mock with the exact same contract.
 */
export function getApi(): JournalAPI {
  if (!cached) {
    cached = window.tradeJournal ?? new MockApi();
  }
  return cached;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.tradeJournal;
}
