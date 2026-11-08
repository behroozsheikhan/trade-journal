// Pure trade-math. No I/O, no Electron — unit-tested directly with Vitest.

import type { Direction } from "./enums";
import type { Trade } from "./types";

export interface DerivedTrade {
  notional: number | null; // entryPrice * quantity (quote currency)
  marginUsed: number | null; // notional / leverage (futures) or notional (spot)
  riskUsd: number | null; // |entry - stopLoss| * quantity  → this is "1R"
  plannedRR: number | null; // |tp - entry| / |entry - sl|
  pnlUsd: number | null; // realised, net of fees & funding; null while open
  pnlPct: number | null; // pnl / notional * 100
  roePct: number | null; // pnl / marginUsed * 100
  rMultiple: number | null; // pnlUsd / riskUsd
  liquidationPrice: number | null; // futures only
  durationMinutes: number | null;
}

export function sideSign(direction: Direction): 1 | -1 {
  return direction === "long" ? 1 : -1;
}

export function notionalOf(entryPrice: number, quantity: number): number {
  return entryPrice * quantity;
}

/** Dollar amount risked = distance from entry to stop × size. This is 1R. */
export function riskUsdOf(entryPrice: number, stopLoss: number | null, quantity: number): number | null {
  if (stopLoss == null || stopLoss <= 0 || quantity <= 0) return null;
  const dist = Math.abs(entryPrice - stopLoss);
  if (dist === 0) return null;
  return dist * quantity;
}

/** Planned reward:risk using TP1 (fall back to TP2). */
export function plannedRROf(
  entryPrice: number,
  stopLoss: number | null,
  takeProfit: number | null,
): number | null {
  if (stopLoss == null || stopLoss <= 0 || stopLoss === entryPrice) return null;
  if (takeProfit == null || takeProfit <= 0) return null;
  const reward = Math.abs(takeProfit - entryPrice);
  return reward / Math.abs(entryPrice - stopLoss);
}

export function pnlUsdOf(args: {
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  fees?: number;
  funding?: number;
}): number {
  const gross = sideSign(args.direction) * (args.exitPrice - args.entryPrice) * args.quantity;
  return gross - (args.fees ?? 0) - (args.funding ?? 0);
}

export function pnlPctOf(pnlUsd: number, notional: number): number | null {
  if (notional <= 0) return null;
  return (pnlUsd / notional) * 100;
}

export function roePctOf(pnlUsd: number, marginUsed: number): number | null {
  if (marginUsed <= 0) return null;
  return (pnlUsd / marginUsed) * 100;
}

export function rMultipleOf(pnlUsd: number, riskUsd: number | null): number | null {
  if (riskUsd == null || riskUsd <= 0) return null;
  return pnlUsd / riskUsd;
}

/**
 * Approximate isolated-margin liquidation price for perpetual futures.
 * long:  entry * (1 - 1/leverage + mmr)
 * short: entry * (1 + 1/leverage - mmr)
 */
export function liquidationPriceOf(
  entryPrice: number,
  leverage: number | null,
  direction: Direction,
  maintenanceMarginRate = 0.005,
): number | null {
  if (!leverage || leverage < 1 || entryPrice <= 0) return null;
  const mmr = maintenanceMarginRate;
  return direction === "long"
    ? entryPrice * (1 - 1 / leverage + mmr)
    : entryPrice * (1 + 1 / leverage - mmr);
}

/** Position size so that a stop-out costs exactly `riskUsd`. */
export function suggestedQuantityOf(riskUsd: number, entryPrice: number, stopLoss: number | null): number | null {
  if (stopLoss == null || entryPrice <= 0) return null;
  const dist = Math.abs(entryPrice - stopLoss);
  if (dist === 0) return null;
  return riskUsd / dist;
}

/** Per-trade risk % falls back to the account default when unset. */
export function effectiveRiskPercent(riskPercent: number | null, defaultPercent: number): number {
  return riskPercent != null && riskPercent > 0 ? riskPercent : defaultPercent;
}

/** Dollar risk for a given % of the account balance. */
export function riskUsdFromPercent(balance: number, percent: number): number {
  return (balance * percent) / 100;
}

export function durationMinutesOf(
  entryDate: string,
  entryTime: string,
  exitDate: string | null,
  exitTime: string | null,
): number | null {
  if (!exitDate) return null;
  const a = new Date(`${entryDate}T${entryTime || "00:00"}:00`);
  const b = new Date(`${exitDate}T${exitTime || "00:00"}:00`);
  const ms = b.getTime() - a.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

export function entryTimestamp(t: Pick<Trade, "entryDate" | "entryTime">): number {
  return new Date(`${t.entryDate}T${t.entryTime || "00:00"}:00`).getTime();
}

/** Compute every derived number for a stored trade. */
export function deriveTrade(t: Trade, maintenanceMarginRate = 0.005): DerivedTrade {
  const notional = t.entryPrice > 0 && t.quantity > 0 ? notionalOf(t.entryPrice, t.quantity) : null;
  const lev = t.marketType === "futures" || t.marketType === "margin" ? t.leverage : null;
  const marginUsed =
    notional != null ? (lev && lev > 0 ? notional / lev : notional) : null;
  const riskUsd = riskUsdOf(t.entryPrice, t.stopLoss, t.quantity);
  const tp = t.takeProfit1 ?? t.takeProfit2;
  const plannedRR = plannedRROf(t.entryPrice, t.stopLoss, tp);
  const closed = t.status === "closed" && t.exitPrice != null && t.exitPrice > 0;
  const pnlUsd = closed
    ? pnlUsdOf({
        direction: t.direction,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice as number,
        quantity: t.quantity,
        fees: t.fees,
        funding: t.funding,
      })
    : null;
  const pnlPct = pnlUsd != null && notional != null ? pnlPctOf(pnlUsd, notional) : null;
  const roePct = pnlUsd != null && marginUsed != null ? roePctOf(pnlUsd, marginUsed) : null;
  const rMultiple = pnlUsd != null ? rMultipleOf(pnlUsd, riskUsd) : null;
  const liquidationPrice = liquidationPriceOf(t.entryPrice, lev, t.direction, maintenanceMarginRate);
  const durationMinutes = durationMinutesOf(t.entryDate, t.entryTime, t.exitDate, t.exitTime);
  return { notional, marginUsed, riskUsd, plannedRR, pnlUsd, pnlPct, roePct, rMultiple, liquidationPrice, durationMinutes };
}
