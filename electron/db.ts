// SQLite persistence layer. Deliberately free of any `electron` imports so it
// can be unit-tested under plain Node with Vitest (pass any db file path).

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { deriveTrade } from "../shared/calc";
import { DEFAULT_SETTINGS, type ImageRef, type Settings, type Trade, type TradeFilters, type TradeInput } from "../shared/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  entryDate TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  rMultiple REAL,
  pnlUsd REAL
);
CREATE INDEX IF NOT EXISTS idx_trades_entryDate ON trades(entryDate);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  tradeId TEXT NOT NULL,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
`;

function nowIso(): string {
  return new Date().toISOString();
}

export class JournalDB {
  private db: Database.Database;
  readonly imagesDir: string;

  constructor(readonly dbPath: string, imagesDir?: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.imagesDir = imagesDir ?? path.join(path.dirname(dbPath), "screenshots");
    fs.mkdirSync(this.imagesDir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  // ---------- trades ----------

  listTrades(filters: TradeFilters = {}): Trade[] {
    let rows: { data: string }[];
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status && filters.status !== "all") {
      where.push("status = ?");
      params.push(filters.status);
    }
    if (filters.direction && filters.direction !== "all") {
      where.push("direction = ?");
      params.push(filters.direction);
    }
    if (filters.from) {
      where.push("entryDate >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      where.push("entryDate <= ?");
      params.push(filters.to);
    }
    if (filters.search) {
      where.push("symbol LIKE ?");
      params.push(`%${filters.search.trim()}%`);
    }
    const sql = `SELECT data FROM trades${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY entryDate DESC, rowid DESC`;
    rows = this.db.prepare(sql).all(...params) as { data: string }[];
    let trades = rows.map((r) => JSON.parse(r.data) as Trade);
    if (filters.setup) trades = trades.filter((t) => t.setup === filters.setup);
    if (filters.emotion) trades = trades.filter((t) => t.emotionBefore === filters.emotion || t.emotionDuring === filters.emotion || t.emotionAfter === filters.emotion);
    return trades;
  }

  getTrade(id: string): Trade | null {
    const row = this.db.prepare("SELECT data FROM trades WHERE id = ?").get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Trade) : null;
  }

  createTrade(input: TradeInput): Trade {
    const trade: Trade = { ...input, id: crypto.randomUUID(), createdAt: nowIso(), updatedAt: nowIso() };
    this.insertTrade(trade);
    return trade;
  }

  updateTrade(id: string, input: TradeInput): Trade {
    const existing = this.getTrade(id);
    if (!existing) throw new Error(`trade not found: ${id}`);
    const trade: Trade = { ...input, id, createdAt: existing.createdAt, updatedAt: nowIso() };
    this.db
      .prepare("UPDATE trades SET data = ?, status = ?, entryDate = ?, symbol = ?, direction = ?, rMultiple = ?, pnlUsd = ? WHERE id = ?")
      .run(
        JSON.stringify(trade),
        trade.status,
        trade.entryDate,
        trade.symbol,
        trade.direction,
        trade.status === "closed" ? deriveTrade(trade).rMultiple : null,
        trade.status === "closed" ? deriveTrade(trade).pnlUsd : null,
        id,
      );
    return trade;
  }

  deleteTrade(id: string): void {
    const imgs = this.db.prepare("SELECT id FROM images WHERE tradeId = ?").all(id) as { id: string }[];
    for (const img of imgs) this.deleteImage(img.id);
    this.db.prepare("DELETE FROM trades WHERE id = ?").run(id);
  }

  private insertTrade(t: Trade): void {
    const d = deriveTrade(t);
    this.db
      .prepare("INSERT INTO trades (id, data, status, entryDate, symbol, direction, rMultiple, pnlUsd) VALUES (?,?,?,?,?,?,?,?)")
      .run(t.id, JSON.stringify(t), t.status, t.entryDate, t.symbol, t.direction, t.status === "closed" ? d.rMultiple : null, t.status === "closed" ? d.pnlUsd : null);
  }

  // ---------- settings ----------

  getSettings(): Settings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
    return { ...DEFAULT_SETTINGS, ...stored } as Settings;
  }

  setSettings(patch: Partial<Settings>): Settings {
    const up = this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    const tx = this.db.transaction((p: Partial<Settings>) => {
      for (const [k, v] of Object.entries(p)) up.run(k, JSON.stringify(v));
    });
    tx(patch);
    return this.getSettings();
  }

  // ---------- images ----------

  saveImage(tradeId: string, name: string, data: Uint8Array): ImageRef {
    const id = crypto.randomUUID();
    const ext = (path.extname(name || "") || ".png").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".png";
    const filename = `${id}${ext}`;
    fs.writeFileSync(path.join(this.imagesDir, filename), Buffer.from(data));
    this.db.prepare("INSERT INTO images (id, tradeId, name, filename, createdAt) VALUES (?,?,?,?,?)").run(id, tradeId, name, filename, nowIso());
    return { id, name };
  }

  getImage(id: string): { name: string; data: Uint8Array } | null {
    const row = this.db.prepare("SELECT name, filename FROM images WHERE id = ?").get(id) as { name: string; filename: string } | undefined;
    if (!row) return null;
    const file = path.join(this.imagesDir, row.filename);
    if (!fs.existsSync(file)) return null;
    return { name: row.name, data: new Uint8Array(fs.readFileSync(file)) };
  }

  deleteImage(id: string): void {
    const row = this.db.prepare("SELECT filename FROM images WHERE id = ?").get(id) as { filename: string } | undefined;
    if (row) {
      const file = path.join(this.imagesDir, row.filename);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    this.db.prepare("DELETE FROM images WHERE id = ?").run(id);
  }

  // ---------- export / import / backup ----------

  exportJSON(): string {
    const trades = this.listTrades();
    const settings = this.getSettings();
    const imgs = this.db.prepare("SELECT id, tradeId, name, filename FROM images").all() as { id: string; tradeId: string; name: string; filename: string }[];
    const images = imgs.map((im) => {
      const file = path.join(this.imagesDir, im.filename);
      const b64 = fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : "";
      return { id: im.id, tradeId: im.tradeId, name: im.name, dataBase64: b64 };
    });
    return JSON.stringify({ app: "trade-journal", version: 1, exportedAt: nowIso(), settings, trades, images }, null, 2);
  }

  exportCSV(): string {
    const trades = this.listTrades().sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    const cols = [
      "id", "entryDate", "entryTime", "exitDate", "exitTime", "symbol", "exchange", "marketType", "direction", "mode",
      "timeframe", "leverage", "entryPrice", "stopLoss", "takeProfit1", "takeProfit2", "quantity", "fees", "funding",
      "setup", "signalSource", "entryReason", "marketCondition", "session", "emotionBefore", "emotionDuring", "emotionAfter",
      "confidence", "followedPlan", "mistakeTags", "exitPrice", "exitReason", "status", "pnlUsd", "rMultiple", "plannedRR",
      "riskUsd", "notional", "durationMinutes", "whatHappened", "wentRight", "wentWrong", "lesson", "notes",
    ];
    const esc = (v: unknown): string => {
      if (v == null) return "";
      const s = Array.isArray(v) ? v.join(";") : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    for (const t of trades) {
      const d = deriveTrade(t);
      const row: Record<string, unknown> = {
        ...t,
        mistakeTags: t.mistakeTags,
        screenshotsBefore: undefined,
        screenshotsAfter: undefined,
        pnlUsd: d.pnlUsd,
        rMultiple: d.rMultiple,
        plannedRR: d.plannedRR,
        riskUsd: d.riskUsd,
        notional: d.notional,
        durationMinutes: d.durationMinutes,
      };
      lines.push(cols.map((c) => esc(row[c])).join(","));
    }
    return lines.join("\n");
  }

  importJSON(json: string): { imported: number } {
    const parsed = JSON.parse(json) as {
      trades?: Trade[];
      settings?: Partial<Settings>;
      images?: { id: string; tradeId: string; name: string; dataBase64: string }[];
    };
    if (!parsed || !Array.isArray(parsed.trades)) throw new Error("Invalid journal file: no trades array");
    let imported = 0;
    const tx = this.db.transaction(() => {
      for (const t of parsed.trades as Trade[]) {
        if (!t || typeof t !== "object" || !t.id) continue;
        const clean: Trade = {
          ...t,
          createdAt: t.createdAt || nowIso(),
          updatedAt: nowIso(),
          mistakeTags: Array.isArray(t.mistakeTags) ? t.mistakeTags : [],
          screenshotsBefore: Array.isArray(t.screenshotsBefore) ? t.screenshotsBefore : [],
          screenshotsAfter: Array.isArray(t.screenshotsAfter) ? t.screenshotsAfter : [],
        };
        this.db.prepare("INSERT OR REPLACE INTO trades (id, data, status, entryDate, symbol, direction, rMultiple, pnlUsd) VALUES (?,?,?,?,?,?,?,?)").run(
          clean.id,
          JSON.stringify(clean),
          clean.status,
          clean.entryDate,
          clean.symbol,
          clean.direction,
          clean.status === "closed" ? deriveTrade(clean).rMultiple : null,
          clean.status === "closed" ? deriveTrade(clean).pnlUsd : null,
        );
        imported += 1;
      }
      if (parsed.settings) this.setSettings(parsed.settings);
      for (const im of parsed.images ?? []) {
        if (!im?.id || !im.dataBase64) continue;
        const filename = `${im.id}.png`;
        fs.writeFileSync(path.join(this.imagesDir, filename), Buffer.from(im.dataBase64, "base64"));
        this.db
          .prepare("INSERT OR REPLACE INTO images (id, tradeId, name, filename, createdAt) VALUES (?,?,?,?,?)")
          .run(im.id, im.tradeId, im.name, filename, nowIso());
      }
    });
    tx();
    return { imported };
  }

  /** Online-backup the SQLite file (safe while the app is running). better-sqlite3's backup is async. */
  async backup(destDir: string): Promise<string> {
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, `trade-journal-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
    await this.db.backup(dest);
    return dest;
  }
}
