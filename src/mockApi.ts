// Browser fallback for the JournalAPI contract (used by `vite preview` and the
// Playwright e2e suite, where no Electron preload exists). Everything is kept
// in localStorage so e2e tests are fully hermetic and headless.

import type { ExportResult, ImportResult, JournalAPI } from "../shared/api";
import { DEFAULT_JOURNAL_NAME, DEFAULT_SETTINGS, type ImageRef, type Journal, type Settings, type Trade, type TradeFilters, type TradeInput } from "../shared/types";

const LS_KEY = "trade-journal-mock-v1";

interface MockImage {
  tradeId: string;
  name: string;
  dataBase64: string;
}

interface MockStore {
  journals: Journal[];
  trades: Trade[];
  settings: Settings;
  images: Record<string, MockImage>;
}

function load(): MockStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<MockStore>;
      // migrate stores from before multi-journal support
      if (!Array.isArray(s.journals) || s.journals.length === 0) {
        const def: Journal = { id: crypto.randomUUID(), name: DEFAULT_JOURNAL_NAME, createdAt: new Date().toISOString() };
        s.journals = [def];
        s.trades = (s.trades ?? []).map((t) => ({ ...t, journalId: (t as Trade).journalId || def.id }));
      }
      if (!s.settings) s.settings = { ...DEFAULT_SETTINGS };
      if (!Array.isArray(s.settings.setups)) s.settings.setups = DEFAULT_SETTINGS.setups;
      if (!Array.isArray(s.settings.exchanges)) s.settings.exchanges = DEFAULT_SETTINGS.exchanges;
      saveStore(s as MockStore); // persist immediately so generated ids stay stable
      return s as MockStore;
    }
  } catch {
    /* corrupted storage -> start fresh */
  }
  const def: Journal = { id: crypto.randomUUID(), name: DEFAULT_JOURNAL_NAME, createdAt: new Date().toISOString() };
  const fresh: MockStore = { journals: [def], trades: [], settings: { ...DEFAULT_SETTINGS }, images: {} };
  saveStore(fresh); // persist immediately so the default journal id stays stable across reloads
  return fresh;
}

function saveStore(s: MockStore): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function bytesToBase64(data: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) bin += String.fromCharCode(...data.subarray(i, i + chunk));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class MockApi implements JournalAPI {
  private store(): MockStore {
    return load();
  }

  async listJournals(): Promise<Journal[]> {
    return [...this.store().journals];
  }

  async createJournal(name: string): Promise<Journal> {
    const s = this.store();
    const j: Journal = { id: crypto.randomUUID(), name: name.trim() || DEFAULT_JOURNAL_NAME, createdAt: new Date().toISOString() };
    s.journals.push(j);
    saveStore(s);
    return j;
  }

  async updateJournal(id: string, patch: Partial<Pick<Journal, "name">>): Promise<Journal> {
    const s = this.store();
    const i = s.journals.findIndex((j) => j.id === id);
    if (i < 0) throw new Error("journal not found");
    s.journals[i] = { ...s.journals[i], name: patch.name?.trim() || s.journals[i].name };
    saveStore(s);
    return s.journals[i];
  }

  async deleteJournal(id: string): Promise<void> {
    const s = this.store();
    const tradeIds = new Set(s.trades.filter((t) => t.journalId === id).map((t) => t.id));
    s.trades = s.trades.filter((t) => t.journalId !== id);
    for (const [imgId, img] of Object.entries(s.images)) if (tradeIds.has(img.tradeId)) delete s.images[imgId];
    s.journals = s.journals.filter((j) => j.id !== id);
    if (s.journals.length === 0) s.journals.push({ id: crypto.randomUUID(), name: DEFAULT_JOURNAL_NAME, createdAt: new Date().toISOString() });
    saveStore(s);
  }

  async listTrades(filters: TradeFilters = {}): Promise<Trade[]> {
    let trades = [...this.store().trades];
    if (filters.journalId) trades = trades.filter((t) => t.journalId === filters.journalId);
    if (filters.exchange) trades = trades.filter((t) => t.exchange === filters.exchange);
    if (filters.status && filters.status !== "all") trades = trades.filter((t) => t.status === filters.status);
    if (filters.direction && filters.direction !== "all") trades = trades.filter((t) => t.direction === filters.direction);
    const from = filters.from;
    const to = filters.to;
    if (from) trades = trades.filter((t) => t.entryDate >= from);
    if (to) trades = trades.filter((t) => t.entryDate <= to);
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      trades = trades.filter((t) => t.symbol.toLowerCase().includes(q) || t.setup.toLowerCase().includes(q));
    }
    if (filters.setup) trades = trades.filter((t) => t.setup === filters.setup);
    if (filters.emotion)
      trades = trades.filter((t) => t.emotionBefore === filters.emotion || t.emotionDuring === filters.emotion || t.emotionAfter === filters.emotion);
    return trades.sort((a, b) => (b.entryDate + b.entryTime).localeCompare(a.entryDate + a.entryTime));
  }

  async getTrade(id: string): Promise<Trade | null> {
    return this.store().trades.find((t) => t.id === id) ?? null;
  }

  async createTrade(input: TradeInput): Promise<Trade> {
    const s = this.store();
    const trade: Trade = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    s.trades.push(trade);
    saveStore(s);
    return trade;
  }

  async updateTrade(id: string, input: TradeInput): Promise<Trade> {
    const s = this.store();
    const i = s.trades.findIndex((t) => t.id === id);
    if (i < 0) throw new Error("trade not found");
    const trade: Trade = { ...input, id, createdAt: s.trades[i].createdAt, updatedAt: new Date().toISOString() };
    s.trades[i] = trade;
    saveStore(s);
    return trade;
  }

  async deleteTrade(id: string): Promise<void> {
    const s = this.store();
    s.trades = s.trades.filter((t) => t.id !== id);
    for (const [imgId, img] of Object.entries(s.images)) if (img.tradeId === id) delete s.images[imgId];
    saveStore(s);
  }

  async getSettings(): Promise<Settings> {
    return this.store().settings;
  }

  async setSettings(patch: Partial<Settings>): Promise<Settings> {
    const s = this.store();
    s.settings = { ...s.settings, ...patch };
    saveStore(s);
    return s.settings;
  }

  async saveImage(tradeId: string, name: string, data: Uint8Array): Promise<ImageRef> {
    const s = this.store();
    const id = crypto.randomUUID();
    s.images[id] = { tradeId, name, dataBase64: bytesToBase64(data) };
    saveStore(s);
    return { id, name };
  }

  async getImage(id: string): Promise<{ name: string; data: Uint8Array } | null> {
    const img = this.store().images[id];
    if (!img) return null;
    return { name: img.name, data: base64ToBytes(img.dataBase64) };
  }

  async deleteImage(id: string): Promise<void> {
    const s = this.store();
    delete s.images[id];
    saveStore(s);
  }

  async exportData(format: "json" | "csv"): Promise<ExportResult> {
    const s = this.store();
    if (format === "csv") {
      return { ok: true, content: toCsv(s.trades), count: s.trades.length };
    }
    return {
      ok: true,
      content: JSON.stringify({ app: "trade-journal", version: 1, exportedAt: new Date().toISOString(), settings: s.settings, journals: s.journals, trades: s.trades, images: Object.entries(s.images).map(([id, im]) => ({ id, tradeId: im.tradeId, name: im.name, dataBase64: im.dataBase64 })) }, null, 2),
      count: s.trades.length,
    };
  }

  async importData(): Promise<ImportResult> {
    return { ok: false, imported: 0 };
  }

  async importDataString(content: string): Promise<ImportResult> {
    const parsed = JSON.parse(content) as { journals?: Journal[]; trades?: Trade[]; settings?: Partial<Settings>; images?: { id: string; tradeId: string; name: string; dataBase64: string }[] };
    if (!parsed || !Array.isArray(parsed.trades)) throw new Error("Invalid journal file");
    const s = this.store();
    const defJournal = s.journals[0];
    for (const j of parsed.journals ?? []) {
      if (!j?.id || !j?.name) continue;
      const i = s.journals.findIndex((x) => x.id === j.id);
      if (i >= 0) s.journals[i] = j;
      else s.journals.push(j);
    }
    for (const t of parsed.trades) {
      if (t && !(t as Trade).journalId) (t as Trade).journalId = defJournal.id;
      if (!t?.id) continue;
      const i = s.trades.findIndex((x) => x.id === t.id);
      if (i >= 0) s.trades[i] = t;
      else s.trades.push(t);
    }
    if (parsed.settings) s.settings = { ...s.settings, ...parsed.settings };
    for (const im of parsed.images ?? []) if (im?.id) s.images[im.id] = { tradeId: im.tradeId, name: im.name, dataBase64: im.dataBase64 };
    saveStore(s);
    return { ok: true, imported: parsed.trades.length };
  }

  async backup(): Promise<{ ok: boolean; path?: string }> {
    return { ok: true, path: "localStorage (browser demo mode)" };
  }

  async appInfo() {
    return { version: "0.0.0-mock", dbPath: "localStorage", platform: "browser", isElectron: false };
  }
}

function toCsv(trades: Trade[]): string {
  const cols = ["id", "entryDate", "entryTime", "exitDate", "symbol", "direction", "marketType", "mode", "entryPrice", "exitPrice", "stopLoss", "takeProfit1", "takeProfit2", "quantity", "fees", "setup", "emotionBefore", "followedPlan", "status", "exitReason", "lesson"];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join(";") : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...trades.map((t) => cols.map((c) => esc((t as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
}

// ---------- deterministic demo data (used by e2e tests and first-run demo) ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"];
const DEMO_BASE: Record<string, number> = {
  "BTC/USDT": 67000,
  "ETH/USDT": 3500,
  "SOL/USDT": 165,
  "BNB/USDT": 590,
  "XRP/USDT": 0.62,
};
const DEMO_SETUPS = ["breakout", "pullback", "retest", "range-play", "reversal"];
const DEMO_EMOTIONS = ["calm", "confident", "anxious", "fomo", "greedy"] as const;
const DEMO_MISTAKES = ["late-entry", "moved-stop", "fomo", "oversized", "early-exit"];

/** Seed `n` realistic closed trades (+2 open) into the given API. Deterministic. */
export async function seedDemoTrades(api: JournalAPI, n = 24, journalId?: string): Promise<void> {
  const rnd = mulberry32(42);
  const settings = await api.getSettings();
  const journals = await api.listJournals();
  const jid = journalId ?? journals[0]?.id ?? "";
  const defaultExchange = settings.exchanges.find((e) => e.enabled)?.label ?? "Binance";
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const symbol = DEMO_SYMBOLS[Math.floor(rnd() * DEMO_SYMBOLS.length)];
    const base = DEMO_BASE[symbol];
    const direction = rnd() > 0.5 ? "long" : "short";
    const entry = base * (1 + (rnd() - 0.5) * 0.06);
    const slDist = entry * (0.01 + rnd() * 0.02);
    const stopLoss = direction === "long" ? entry - slDist : entry + slDist;
    const plannedRR = 1.5 + rnd() * 2;
    const tp1 = direction === "long" ? entry + slDist * plannedRR : entry - slDist * plannedRR;
    const riskPercent = Math.round((0.5 + rnd() * 1.5) * 10) / 10; // 0.5%..2% per trade
    const qty = (settings.accountBalance * riskPercent) / 100 / slDist;
    const rTarget = rnd() > 0.45 ? 1 + rnd() * 2 : -(0.6 + rnd() * 0.4); // ~55% win rate
    const exit = direction === "long" ? entry + rTarget * slDist : entry - rTarget * slDist;
    const fees = entry * qty * 0.001;
    const daysAgo = Math.floor(rnd() * 60);
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const entryDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entryTime = `${String(8 + Math.floor(rnd() * 12)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`;
    const durH = 1 + Math.floor(rnd() * 20);
    const exitD = new Date(d.getTime() + durH * 3600_000);
    const exitDate = `${exitD.getFullYear()}-${String(exitD.getMonth() + 1).padStart(2, "0")}-${String(exitD.getDate()).padStart(2, "0")}`;
    const exitTime = `${String(exitD.getHours()).padStart(2, "0")}:${String(exitD.getMinutes()).padStart(2, "0")}`;
    const emotion = DEMO_EMOTIONS[Math.floor(rnd() * DEMO_EMOTIONS.length)];
    const mistakes = rnd() > 0.6 ? [DEMO_MISTAKES[Math.floor(rnd() * DEMO_MISTAKES.length)]] : [];
    const followed = mistakes.length === 0 ? "yes" : rnd() > 0.5 ? "partial" : "no";
    await api.createTrade({
      journalId: jid,
      entryDate,
      entryTime,
      exitDate,
      exitTime,
      symbol,
      exchange: defaultExchange,
      marketType: rnd() > 0.3 ? "futures" : "spot",
      direction: direction as "long" | "short",
      mode: (["scalp", "day", "swing"] as const)[Math.floor(rnd() * 3)],
      timeframe: (["15m", "1h", "4h"] as const)[Math.floor(rnd() * 3)],
      leverage: rnd() > 0.3 ? 5 + Math.floor(rnd() * 15) : null,
      entryPrice: round(entry),
      stopLoss: round(stopLoss),
      takeProfit1: round(tp1),
      takeProfit2: round(direction === "long" ? entry + slDist * plannedRR * 1.6 : entry - slDist * plannedRR * 1.6),
      quantity: round6(qty),
      riskPercent,
      fees: round(fees),
      funding: rnd() > 0.5 ? round(fees * 0.2) : 0,
      setup: DEMO_SETUPS[Math.floor(rnd() * DEMO_SETUPS.length)],
      signalSource: "self",
      entryReason: "test setup with confluence on structure + volume",
      marketCondition: (["trend-up", "trend-down", "range"] as const)[Math.floor(rnd() * 3)],
      session: (["asia", "london", "new-york"] as const)[Math.floor(rnd() * 3)],
      emotionBefore: emotion as never,
      emotionDuring: null,
      emotionAfter: null,
      confidence: 3 + Math.floor(rnd() * 8),
      followedPlan: followed as never,
      mistakeTags: mistakes,
      exitPrice: round(exit),
      exitReason: (rTarget > 0 ? "tp" : "stop-loss") as never,
      status: "closed",
      screenshotsBefore: [],
      screenshotsAfter: [],
      whatHappened: "",
      wentRight: "",
      wentWrong: "",
      lesson: "",
      notes: "",
    });
  }
  // two open trades
  for (let i = 0; i < 2; i++) {
    const symbol = DEMO_SYMBOLS[i % DEMO_SYMBOLS.length];
    const entry = DEMO_BASE[symbol] * 1.01;
    await api.createTrade({
      journalId: jid,
      entryDate: today.toISOString().slice(0, 10),
      entryTime: "10:30",
      exitDate: null,
      exitTime: null,
      symbol,
      exchange: defaultExchange,
      marketType: "futures",
      direction: i === 0 ? "long" : "short",
      mode: "day",
      timeframe: "1h",
      leverage: 10,
      entryPrice: round(entry),
      stopLoss: round(i === 0 ? entry * 0.985 : entry * 1.015),
      takeProfit1: round(i === 0 ? entry * 1.03 : entry * 0.97),
      takeProfit2: null,
      quantity: 0.05,
      riskPercent: 1,
      fees: 1.2,
      funding: 0,
      setup: "breakout",
      signalSource: "self",
      entryReason: "open demo position",
      marketCondition: "trend-up",
      session: "london",
      emotionBefore: "calm",
      emotionDuring: null,
      emotionAfter: null,
      confidence: 7,
      followedPlan: "yes",
      mistakeTags: [],
      exitPrice: null,
      exitReason: null,
      status: "open",
      screenshotsBefore: [],
      screenshotsAfter: [],
      whatHappened: "",
      wentRight: "",
      wentWrong: "",
      lesson: "",
      notes: "",
    });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
