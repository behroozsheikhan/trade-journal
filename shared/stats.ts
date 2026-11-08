// Pure statistics over a list of trades — the "dashboard brain".
// Everything here is unit-tested with Vitest.

import { deriveTrade, entryTimestamp, type DerivedTrade } from "./calc";
import type { Trade } from "./types";

export interface TradeWithDerived {
  trade: Trade;
  d: DerivedTrade;
}

export interface BreakdownRow {
  key: string;
  trades: number;
  wins: number;
  winRate: number; // 0..1
  netR: number;
  netPnl: number;
  expectancyR: number;
}

export interface EquityPoint {
  date: string; // entry date
  pnl: number; // trade pnl
  r: number; // trade R
  cumPnl: number;
  cumR: number;
}

export interface StatsSummary {
  total: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number; // of closed
  grossProfit: number;
  grossLoss: number; // negative number
  profitFactor: number; // grossProfit / |grossLoss| (Infinity if no losses)
  netPnl: number;
  netR: number;
  avgWinR: number | null;
  avgLossR: number | null;
  expectancyR: number | null; // (winRate*avgWinR) - (lossRate*avgLossR)
  avgR: number | null; // mean R of all closed trades
  avgWinUsd: number | null;
  avgLossUsd: number | null;
  bestR: number | null;
  worstR: number | null;
  maxDrawdownR: number; // largest peak-to-trough drop of cumulative R (>= 0)
  maxDrawdownUsd: number; // same in quote currency (>= 0)
  maxConsecutiveLosses: number;
  avgDurationMinutes: number | null;
  ruleAdherence: number | null; // share of closed trades with followedPlan === "yes"
  bestSetup: string | null;
  worstSetup: string | null;
  bySetup: BreakdownRow[];
  bySymbol: BreakdownRow[];
  byEmotion: BreakdownRow[];
  byDirection: BreakdownRow[];
  byMode: BreakdownRow[];
  byMarketType: BreakdownRow[];
  byHour: BreakdownRow[]; // key = "0".."23"
  byWeekday: BreakdownRow[]; // key = "0".."6" (0 = Sunday)
  equityCurve: EquityPoint[];
  calendar: Record<string, number>; // YYYY-MM-DD -> net pnl that day
}

export function withDerived(trades: Trade[], mmr = 0.005): TradeWithDerived[] {
  return trades.map((trade) => ({ trade, d: deriveTrade(trade, mmr) }));
}

function breakdown(rows: TradeWithDerived[], keyOf: (t: TradeWithDerived) => string | null): BreakdownRow[] {
  const map = new Map<string, TradeWithDerived[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null || k === "") continue;
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  const out: BreakdownRow[] = [];
  for (const [key, arr] of map) {
    const closed = arr.filter((r) => r.trade.status === "closed" && r.d.rMultiple != null);
    const wins = closed.filter((r) => (r.d.rMultiple as number) > 0).length;
    const losses = closed.filter((r) => (r.d.rMultiple as number) < 0).length;
    const netR = closed.reduce((s, r) => s + (r.d.rMultiple as number), 0);
    const netPnl = closed.reduce((s, r) => s + (r.d.pnlUsd ?? 0), 0);
    const winRate = closed.length > 0 ? wins / closed.length : 0;
    const avgWin = wins > 0 ? closed.filter((r) => (r.d.rMultiple as number) > 0).reduce((s, r) => s + (r.d.rMultiple as number), 0) / wins : 0;
    const avgLossMag = losses > 0 ? Math.abs(closed.filter((r) => (r.d.rMultiple as number) < 0).reduce((s, r) => s + (r.d.rMultiple as number), 0) / losses) : 0;
    out.push({
      key,
      trades: arr.length,
      wins,
      winRate,
      netR: round2(netR),
      netPnl: round2(netPnl),
      expectancyR: round2(winRate * avgWin - (closed.length > 0 ? (losses / closed.length) * avgLossMag : 0)),
    });
  }
  return out.sort((a, b) => b.netR - a.netR);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function maxDrawdown(series: number[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDD) maxDD = dd;
  }
  return peak === -Infinity ? 0 : maxDD;
}

export function computeStats(trades: Trade[], maintenanceMarginRate = 0.005): StatsSummary {
  const rows = withDerived(trades, maintenanceMarginRate);
  const closed = rows
    .filter((r) => r.trade.status === "closed" && r.d.rMultiple != null && r.d.pnlUsd != null)
    .sort((a, b) => entryTimestamp(a.trade) - entryTimestamp(b.trade));

  const wins = closed.filter((r) => (r.d.rMultiple as number) > 0);
  const losses = closed.filter((r) => (r.d.rMultiple as number) < 0);
  const breakeven = closed.filter((r) => r.d.rMultiple === 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const grossProfit = wins.reduce((s, r) => s + (r.d.pnlUsd as number), 0);
  const grossLoss = losses.reduce((s, r) => s + (r.d.pnlUsd as number), 0); // negative
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / Math.abs(grossLoss);
  const netPnl = closed.reduce((s, r) => s + (r.d.pnlUsd as number), 0);
  const netR = closed.reduce((s, r) => s + (r.d.rMultiple as number), 0);
  const rs = closed.map((r) => r.d.rMultiple as number);
  const avgWinR = wins.length > 0 ? wins.reduce((s, r) => s + (r.d.rMultiple as number), 0) / wins.length : null;
  const avgLossR = losses.length > 0 ? losses.reduce((s, r) => s + (r.d.rMultiple as number), 0) / losses.length : null;
  const lossRate = closed.length > 0 ? losses.length / closed.length : 0;
  const expectancyR =
    avgWinR != null && avgLossR != null ? winRate * avgWinR - lossRate * Math.abs(avgLossR) : null;
  const avgR = rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  const durations = closed.map((r) => r.d.durationMinutes).filter((d): d is number => d != null);
  const avgDurationMinutes = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  // equity curve over closed trades in chronological order
  let cumPnl = 0;
  let cumR = 0;
  const equityCurve: EquityPoint[] = closed.map((r) => {
    cumPnl += r.d.pnlUsd as number;
    cumR += r.d.rMultiple as number;
    return { date: r.trade.entryDate, pnl: r.d.pnlUsd as number, r: r.d.rMultiple as number, cumPnl: round2(cumPnl), cumR: round2(cumR) };
  });
  const maxDrawdownR = round2(maxDrawdown(equityCurve.map((p) => p.cumR)));
  const maxDrawdownUsd = round2(maxDrawdown(equityCurve.map((p) => p.cumPnl)));

  let maxConsecutiveLosses = 0;
  let streak = 0;
  for (const r of closed) {
    if ((r.d.rMultiple as number) < 0) {
      streak += 1;
      if (streak > maxConsecutiveLosses) maxConsecutiveLosses = streak;
    } else {
      streak = 0;
    }
  }

  const adherencePool = closed.filter((r) => r.trade.followedPlan != null);
  const ruleAdherence =
    adherencePool.length > 0
      ? adherencePool.filter((r) => r.trade.followedPlan === "yes").length / adherencePool.length
      : null;

  const bySetup = breakdown(closed, (r) => (r.trade.setup || "").trim() || null);
  const bySymbol = breakdown(closed, (r) => r.trade.symbol);
  const byEmotion = breakdown(closed, (r) => r.trade.emotionBefore);
  const byDirection = breakdown(closed, (r) => r.trade.direction);
  const byMode = breakdown(closed, (r) => r.trade.mode);
  const byMarketType = breakdown(closed, (r) => r.trade.marketType);
  const byHour = breakdown(closed, (r) => String(new Date(`${r.trade.entryDate}T${r.trade.entryTime || "00:00"}:00`).getHours()));
  const byWeekday = breakdown(closed, (r) => String(new Date(`${r.trade.entryDate}T12:00:00`).getDay()));

  const calendar: Record<string, number> = {};
  for (const r of closed) {
    calendar[r.trade.entryDate] = round2((calendar[r.trade.entryDate] ?? 0) + (r.d.pnlUsd as number));
  }

  return {
    total: trades.length,
    closed: closed.length,
    open: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    profitFactor,
    netPnl: round2(netPnl),
    netR: round2(netR),
    avgWinR: avgWinR != null ? round2(avgWinR) : null,
    avgLossR: avgLossR != null ? round2(avgLossR) : null,
    expectancyR: expectancyR != null ? round2(expectancyR) : null,
    avgR: avgR != null ? round2(avgR) : null,
    avgWinUsd: wins.length > 0 ? round2(wins.reduce((s, r) => s + (r.d.pnlUsd as number), 0) / wins.length) : null,
    avgLossUsd: losses.length > 0 ? round2(losses.reduce((s, r) => s + (r.d.pnlUsd as number), 0) / losses.length) : null,
    bestR: rs.length > 0 ? round2(Math.max(...rs)) : null,
    worstR: rs.length > 0 ? round2(Math.min(...rs)) : null,
    maxDrawdownR,
    maxDrawdownUsd,
    maxConsecutiveLosses,
    avgDurationMinutes: avgDurationMinutes != null ? Math.round(avgDurationMinutes) : null,
    ruleAdherence,
    bestSetup: bySetup.length > 0 ? bySetup[0].key : null,
    worstSetup: bySetup.length > 0 ? bySetup[bySetup.length - 1].key : null,
    bySetup,
    bySymbol,
    byEmotion,
    byDirection,
    byMode,
    byMarketType,
    byHour,
    byWeekday,
    equityCurve,
    calendar,
  };
}
