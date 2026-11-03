import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JournalDB } from "../../electron/db";
import type { TradeInput } from "../../shared/types";

let dir: string;
let db: JournalDB;

function sampleInput(over: Partial<TradeInput> = {}): TradeInput {
  return {
    entryDate: "2026-03-01",
    entryTime: "10:00",
    exitDate: "2026-03-01",
    exitTime: "11:00",
    symbol: "BTC/USDT",
    exchange: "Binance",
    marketType: "futures",
    direction: "long",
    mode: "day",
    timeframe: "1h",
    leverage: 10,
    entryPrice: 67000,
    stopLoss: 66000,
    takeProfit1: 69000,
    takeProfit2: null,
    quantity: 0.1,
    fees: 6.7,
    funding: 0,
    setup: "breakout",
    signalSource: "self",
    entryReason: "structure break",
    marketCondition: "trend-up",
    session: "london",
    emotionBefore: "calm",
    emotionDuring: null,
    emotionAfter: null,
    confidence: 8,
    followedPlan: "yes",
    mistakeTags: [],
    exitPrice: 69000,
    exitReason: "tp",
    status: "closed",
    screenshotsBefore: [],
    screenshotsAfter: [],
    whatHappened: "",
    wentRight: "",
    wentWrong: "",
    lesson: "wait for retest",
    notes: "",
    ...over,
  };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-db-test-"));
  db = new JournalDB(path.join(dir, "test.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("JournalDB trades CRUD", () => {
  it("creates and reads back a trade", () => {
    const t = db.createTrade(sampleInput());
    expect(t.id).toBeTruthy();
    const got = db.getTrade(t.id);
    expect(got?.symbol).toBe("BTC/USDT");
    expect(got?.lesson).toBe("wait for retest");
  });

  it("lists with filters", () => {
    db.createTrade(sampleInput({ symbol: "BTC/USDT" }));
    db.createTrade(sampleInput({ symbol: "ETH/USDT", direction: "short", status: "open", exitPrice: null, exitDate: null, exitTime: null }));
    expect(db.listTrades()).toHaveLength(2);
    expect(db.listTrades({ status: "closed" })).toHaveLength(1);
    expect(db.listTrades({ direction: "short" })).toHaveLength(1);
    expect(db.listTrades({ search: "eth" })).toHaveLength(1);
    expect(db.listTrades({ from: "2026-03-02" })).toHaveLength(0);
    expect(db.listTrades({ setup: "breakout" })).toHaveLength(2);
    expect(db.listTrades({ emotion: "calm" })).toHaveLength(2);
  });

  it("updates a trade", () => {
    const t = db.createTrade(sampleInput({ status: "open", exitPrice: null, exitDate: null, exitTime: null }));
    const { id, createdAt, updatedAt, ...rest } = db.getTrade(t.id)!;
    const updated = db.updateTrade(t.id, { ...rest, status: "closed", exitPrice: 69000, exitDate: "2026-03-01", exitTime: "12:00" });
    expect(updated.status).toBe("closed");
    expect(db.getTrade(t.id)?.exitPrice).toBe(69000);
  });

  it("deletes a trade and its images", () => {
    const t = db.createTrade(sampleInput());
    const img = db.saveImage(t.id, "chart.png", new Uint8Array([1, 2, 3]));
    expect(db.getImage(img.id)?.data).toEqual(new Uint8Array([1, 2, 3]));
    db.deleteTrade(t.id);
    expect(db.getTrade(t.id)).toBeNull();
    expect(db.getImage(img.id)).toBeNull();
  });
});

describe("JournalDB settings", () => {
  it("returns defaults then persists patches", () => {
    const s0 = db.getSettings();
    expect(s0.baseCurrency).toBe("USDT");
    const s1 = db.setSettings({ accountBalance: 5000, theme: "light" });
    expect(s1.accountBalance).toBe(5000);
    expect(s1.theme).toBe("light");
    expect(db.getSettings().baseCurrency).toBe("USDT"); // untouched keys keep defaults
  });
});

describe("JournalDB images", () => {
  it("saves, reads, deletes image files", () => {
    const t = db.createTrade(sampleInput());
    const ref = db.saveImage(t.id, "shot.png", new Uint8Array([137, 80, 78, 71]));
    expect(ref.id).toBeTruthy();
    const img = db.getImage(ref.id);
    expect(img?.name).toBe("shot.png");
    expect(Array.from(img?.data ?? [])).toEqual([137, 80, 78, 71]);
    expect(fs.existsSync(path.join(db.imagesDir, `${ref.id}.png`))).toBe(true);
    db.deleteImage(ref.id);
    expect(db.getImage(ref.id)).toBeNull();
    expect(fs.existsSync(path.join(db.imagesDir, `${ref.id}.png`))).toBe(false);
  });
});

describe("JournalDB export / import / backup", () => {
  it("round-trips JSON export/import including images", () => {
    const t = db.createTrade(sampleInput());
    db.saveImage(t.id, "a.png", new Uint8Array([9, 9, 9]));
    db.setSettings({ accountBalance: 1234 });
    const json = db.exportJSON();

    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "tj-db-test2-"));
    const db2 = new JournalDB(path.join(dir2, "test2.db"));
    const res = db2.importJSON(json);
    expect(res.imported).toBe(1);
    expect(db2.getTrade(t.id)?.symbol).toBe("BTC/USDT");
    expect(db2.getSettings().accountBalance).toBe(1234);
    const imgs = JSON.parse(json).images;
    expect(db2.getImage(imgs[0].id)?.data).toEqual(new Uint8Array([9, 9, 9]));
    db2.close();
    fs.rmSync(dir2, { recursive: true, force: true });
  });

  it("exports CSV with a header row", () => {
    db.createTrade(sampleInput());
    const csv = db.exportCSV();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("entryDate");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("BTC/USDT");
  });

  it("backup creates a readable db copy", async () => {
    db.createTrade(sampleInput());
    const dest = path.join(dir, "backups");
    const p = await db.backup(dest);
    expect(fs.existsSync(p)).toBe(true);
    const copy = new JournalDB(p);
    expect(copy.listTrades()).toHaveLength(1);
    copy.close();
  });

  it("rejects invalid import JSON", () => {
    expect(() => db.importJSON("not json")).toThrow();
    expect(() => db.importJSON('{"foo": 1}')).toThrow(/trades/);
  });
});
