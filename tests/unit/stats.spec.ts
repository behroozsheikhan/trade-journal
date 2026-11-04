import { describe, expect, it } from "vitest";
import { computeStats } from "../../shared/stats";
import type { Trade } from "../../shared/types";

let seq = 0;
function trade(patch: Partial<Trade>): Trade {
  seq += 1;
  const day = String(seq).padStart(2, "0");
  return {
    id: `t${seq}`,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    entryDate: `2026-01-${day}`,
    entryTime: "10:00",
    exitDate: `2026-01-${day}`,
    exitTime: "12:00",
    symbol: "BTC/USDT",
    exchange: "Binance",
    marketType: "spot",
    direction: "long",
    mode: "day",
    timeframe: "1h",
    leverage: null,
    entryPrice: 100,
    stopLoss: 90,
    takeProfit1: 110,
    takeProfit2: null,
    quantity: 1, // risk = 10 USD per trade
    riskPercent: 1,
    fees: 0,
    funding: 0,
    setup: patch.setup ?? "breakout",
    signalSource: "self",
    entryReason: "",
    marketCondition: null,
    session: null,
    emotionBefore: patch.emotionBefore ?? null,
    emotionDuring: null,
    emotionAfter: null,
    confidence: null,
    followedPlan: patch.followedPlan ?? "yes",
    mistakeTags: [],
    exitPrice: 100, // patched below
    exitReason: null,
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

/** exit price chosen so that R = r (long, risk = 10) */
function withR(r: number, patch: Partial<Trade> = {}): Trade {
  return trade({ ...patch, exitPrice: 100 + r * 10 });
}

describe("computeStats", () => {
  it("handles empty input", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.expectancyR).toBeNull();
    expect(s.profitFactor).toBe(0);
    expect(s.maxDrawdownR).toBe(0);
    expect(s.equityCurve).toEqual([]);
  });

  it("computes win rate, profit factor, expectancy", () => {
    // 4 wins of +2R, 6 losses of -1R  => winRate .4, expectancy = .4*2 - .6*1 = +0.2R
    const trades = [
      ...Array.from({ length: 4 }, () => withR(2)),
      ...Array.from({ length: 6 }, () => withR(-1)),
    ];
    const s = computeStats(trades);
    expect(s.total).toBe(10);
    expect(s.closed).toBe(10);
    expect(s.wins).toBe(4);
    expect(s.losses).toBe(6);
    expect(s.winRate).toBeCloseTo(0.4);
    expect(s.avgWinR).toBeCloseTo(2);
    expect(s.avgLossR).toBeCloseTo(-1);
    expect(s.expectancyR).toBeCloseTo(0.2);
    expect(s.netR).toBeCloseTo(8 - 6);
    // pnl per trade: win = 2*10=20, loss = -10 -> gross 80 / 60 -> PF 1.3333
    expect(s.profitFactor).toBeCloseTo(80 / 60);
    expect(s.netPnl).toBeCloseTo(20);
  });

  it("profit factor is Infinity when there are no losses", () => {
    const s = computeStats([withR(1), withR(2)]);
    expect(s.profitFactor).toBe(Infinity);
  });

  it("max drawdown on cumulative R", () => {
    // sequence: +2, -1, -1, +2, -1  => cumR: 2,1,0,2,1 -> maxDD = 2 (from 2 to 0)
    const s = computeStats([withR(2), withR(-1), withR(-1), withR(2), withR(-1)]);
    expect(s.maxDrawdownR).toBe(2);
  });

  it("max consecutive losses", () => {
    const s = computeStats([withR(1), withR(-1), withR(-1), withR(-1), withR(2)]);
    expect(s.maxConsecutiveLosses).toBe(3);
  });

  it("equity curve is cumulative and chronological", () => {
    const s = computeStats([withR(2), withR(-1), withR(1)]);
    expect(s.equityCurve.map((p) => p.cumR)).toEqual([2, 1, 2]);
  });

  it("breaks down by setup and emotion", () => {
    const trades = [
      withR(2, { setup: "breakout", emotionBefore: "calm" }),
      withR(-1, { setup: "breakout", emotionBefore: "calm" }),
      withR(-1, { setup: "reversal", emotionBefore: "fomo" }),
    ];
    const s = computeStats(trades);
    expect(s.bySetup.find((b) => b.key === "breakout")?.netR).toBeCloseTo(1);
    expect(s.bySetup.find((b) => b.key === "reversal")?.netR).toBeCloseTo(-1);
    expect(s.byEmotion.find((b) => b.key === "fomo")?.wins).toBe(0);
    expect(s.bestSetup).toBe("breakout");
    expect(s.worstSetup).toBe("reversal");
  });

  it("rule adherence counts only answered trades", () => {
    const s = computeStats([withR(1, { followedPlan: "yes" }), withR(-1, { followedPlan: "no" }), withR(1, { followedPlan: null })]);
    expect(s.ruleAdherence).toBeCloseTo(0.5);
  });

  it("calendar aggregates pnl per day", () => {
    const s = computeStats([withR(1), withR(-1)]); // same day? different days (seq)
    expect(Object.keys(s.calendar).length).toBe(2);
  });

  it("open trades are counted but excluded from R stats", () => {
    const open = trade({ status: "open", exitPrice: null, exitDate: null, exitTime: null });
    const s = computeStats([withR(1), open]);
    expect(s.total).toBe(2);
    expect(s.open).toBe(1);
    expect(s.closed).toBe(1);
    expect(s.netR).toBeCloseTo(1);
  });
});
