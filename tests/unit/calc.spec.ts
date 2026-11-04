import { describe, expect, it } from "vitest";
import {
  deriveTrade,
  effectiveRiskPercent,
  riskUsdFromPercent,
  liquidationPriceOf,
  plannedRROf,
  pnlUsdOf,
  riskUsdOf,
  rMultipleOf,
  sideSign,
  suggestedQuantityOf,
  durationMinutesOf,
} from "../../shared/calc";
import type { Trade } from "../../shared/types";

describe("sideSign / pnlUsdOf", () => {
  it("long profits when price rises", () => {
    expect(pnlUsdOf({ direction: "long", entryPrice: 100, exitPrice: 110, quantity: 2 })).toBe(20);
  });
  it("short profits when price falls", () => {
    expect(pnlUsdOf({ direction: "short", entryPrice: 100, exitPrice: 90, quantity: 2 })).toBe(20);
  });
  it("subtracts fees and funding", () => {
    expect(pnlUsdOf({ direction: "long", entryPrice: 100, exitPrice: 110, quantity: 1, fees: 1.5, funding: 0.5 })).toBe(8);
  });
  it("sideSign", () => {
    expect(sideSign("long")).toBe(1);
    expect(sideSign("short")).toBe(-1);
  });
});

describe("riskUsdOf (1R)", () => {
  it("is |entry - sl| * qty", () => {
    expect(riskUsdOf(100, 95, 2)).toBe(10);
    expect(riskUsdOf(100, 105, 2)).toBe(10); // short: distance is absolute
  });
  it("null when sl missing or equal to entry", () => {
    expect(riskUsdOf(100, null, 2)).toBeNull();
    expect(riskUsdOf(100, 100, 2)).toBeNull();
  });
});

describe("plannedRROf", () => {
  it("reward / risk", () => {
    expect(plannedRROf(100, 95, 110)).toBe(2);
    expect(plannedRROf(100, 105, 90)).toBe(2); // short
  });
  it("null without stop", () => {
    expect(plannedRROf(100, null, 110)).toBeNull();
  });
});

describe("rMultipleOf", () => {
  it("pnl / risk", () => {
    expect(rMultipleOf(250, 100)).toBe(2.5);
    expect(rMultipleOf(-50, 100)).toBe(-0.5);
    expect(rMultipleOf(100, null)).toBeNull();
  });
});

describe("liquidationPriceOf", () => {
  it("long: entry * (1 - 1/lev + mmr)", () => {
    // 60000, 10x, 0.5% -> 54300
    expect(liquidationPriceOf(60000, 10, "long", 0.005)).toBeCloseTo(54300, 6);
  });
  it("short: entry * (1 + 1/lev - mmr)", () => {
    expect(liquidationPriceOf(60000, 10, "short", 0.005)).toBeCloseTo(65700, 6);
  });
  it("higher leverage => closer liquidation", () => {
    const l10 = liquidationPriceOf(60000, 10, "long", 0.005) as number;
    const l50 = liquidationPriceOf(60000, 50, "long", 0.005) as number;
    expect(l50).toBeGreaterThan(l10);
  });
  it("null for spot (no leverage)", () => {
    expect(liquidationPriceOf(60000, null, "long")).toBeNull();
    expect(liquidationPriceOf(60000, 0, "long")).toBeNull();
  });
});

describe("suggestedQuantityOf", () => {
  it("sizes so that stop-out costs exactly riskUsd", () => {
    // risk 100 USD, entry 100, sl 95 -> qty = 100 / 5 = 20
    expect(suggestedQuantityOf(100, 100, 95)).toBe(20);
  });
});

describe("durationMinutesOf", () => {
  it("computes minutes between entry and exit", () => {
    expect(durationMinutesOf("2026-01-01", "10:00", "2026-01-01", "11:30")).toBe(90);
    expect(durationMinutesOf("2026-01-01", "10:00", null, null)).toBeNull();
  });
});

function makeTrade(patch: Partial<Trade>): Trade {
  return {
    id: "t1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    entryDate: "2026-01-01",
    entryTime: "10:00",
    exitDate: "2026-01-01",
    exitTime: "12:00",
    symbol: "BTC/USDT",
    exchange: "Binance",
    marketType: "futures",
    direction: "long",
    mode: "day",
    timeframe: "1h",
    leverage: 10,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit1: 110,
    takeProfit2: 115,
    quantity: 1,
    riskPercent: 1,
    fees: 0,
    funding: 0,
    setup: "breakout",
    signalSource: "self",
    entryReason: "test",
    marketCondition: "trend-up",
    session: "london",
    emotionBefore: "calm",
    emotionDuring: null,
    emotionAfter: null,
    confidence: 7,
    followedPlan: "yes",
    mistakeTags: [],
    exitPrice: 110,
    exitReason: "tp",
    status: "closed",
    screenshotsBefore: [],
    screenshotsAfter: [],
    whatHappened: "",
    wentRight: "",
    wentWrong: "",
    lesson: "",
    notes: "",
    ...patch,
  };
}

describe("deriveTrade", () => {
  it("computes all derived fields for a closed long", () => {
    const d = deriveTrade(makeTrade({}));
    expect(d.notional).toBe(100);
    expect(d.marginUsed).toBe(10); // notional / 10x
    expect(d.riskUsd).toBe(5);
    expect(d.plannedRR).toBe(2);
    expect(d.pnlUsd).toBe(10);
    expect(d.pnlPct).toBe(10);
    expect(d.roePct).toBe(100); // 10 / 10 margin
    expect(d.rMultiple).toBe(2);
    expect(d.liquidationPrice).toBeCloseTo(100 * (1 - 0.1 + 0.005), 6);
    expect(d.durationMinutes).toBe(120);
  });
  it("open trade has null pnl/r", () => {
    const d = deriveTrade(makeTrade({ status: "open", exitPrice: null, exitDate: null, exitTime: null }));
    expect(d.pnlUsd).toBeNull();
    expect(d.rMultiple).toBeNull();
    expect(d.durationMinutes).toBeNull();
  });
  it("spot trade: margin = notional, no liquidation", () => {
    const d = deriveTrade(makeTrade({ marketType: "spot", leverage: null }));
    expect(d.marginUsed).toBe(100);
    expect(d.liquidationPrice).toBeNull();
  });
});

describe("per-trade risk percent", () => {
  it("effectiveRiskPercent falls back to the default", () => {
    expect(effectiveRiskPercent(null, 1)).toBe(1);
    expect(effectiveRiskPercent(0.5, 1)).toBe(0.5);
    expect(effectiveRiskPercent(0.8, 2)).toBe(0.8);
    expect(effectiveRiskPercent(0, 1)).toBe(1); // invalid -> default
  });
  it("riskUsdFromPercent", () => {
    expect(riskUsdFromPercent(10_000, 0.5)).toBe(50);
    expect(riskUsdFromPercent(10_000, 0.8)).toBe(80);
    expect(riskUsdFromPercent(10_000, 1)).toBe(100);
  });
  it("suggestedQuantityOf with a custom per-trade risk %", () => {
    // balance 10k, risk 0.5% -> 50 USD; entry 67000, sl 66000 -> dist 1000 -> qty 0.05
    const risk = riskUsdFromPercent(10_000, effectiveRiskPercent(0.5, 1));
    expect(suggestedQuantityOf(risk, 67000, 66000)).toBeCloseTo(0.05);
    // 0.8% -> 80 USD -> qty 0.08
    const risk2 = riskUsdFromPercent(10_000, effectiveRiskPercent(0.8, 1));
    expect(suggestedQuantityOf(risk2, 67000, 66000)).toBeCloseTo(0.08);
  });
});
