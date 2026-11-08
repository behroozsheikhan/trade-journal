import { SUGGESTED_EXCHANGES, SUGGESTED_SETUPS } from "./enums";
import type {
  Direction,
  MarketType,
  TradeMode,
  TradeStatus,
  Emotion,
  MarketCondition,
  Session,
  ExitReason,
  SignalSource,
  FollowedPlan,
} from "./enums";

/** A stored screenshot attached to a trade. `id` is the storage key. */
export interface ImageRef {
  id: string;
  name: string;
}

/** A journal = one independent workspace (e.g. "real day trading" vs "backtest"). */
export interface Journal {
  id: string;
  name: string;
  createdAt: string; // ISO
}

/**
 * A user-managed dropdown entry (setups / exchanges).
 * `label` is the exact value stored on trades; `enabled` items show in dropdowns.
 */
export interface ManagedItem {
  id: string;
  label: string;
  enabled: boolean;
}

/** One journalled trade — the full record, exactly as persisted in SQLite (JSON column). */
export interface Trade {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  journalId: string; // which journal (workspace) this trade belongs to

  // --- Identity / timing ---
  entryDate: string; // YYYY-MM-DD
  entryTime: string; // HH:mm (local)
  exitDate: string | null;
  exitTime: string | null;

  // --- Instrument ---
  symbol: string; // e.g. BTC/USDT
  exchange: string;
  marketType: MarketType; // spot | futures | margin | paper
  direction: Direction; // long | short
  mode: TradeMode | null; // scalp | day | swing
  timeframe: string; // e.g. 15m, 4h
  leverage: number | null; // futures only

  // --- Prices & risk plan (recorded BEFORE the outcome is known) ---
  entryPrice: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  quantity: number; // position size in base asset
  riskPercent: number | null; // planned risk for THIS trade as % of balance (null → settings default)
  fees: number; // total fees in quote currency
  funding: number; // funding paid (positive) / received (negative)

  // --- Plan / context ---
  setup: string;
  signalSource: SignalSource | null;
  entryReason: string; // why this trade — confluence
  marketCondition: MarketCondition | null;
  session: Session | null;

  // --- Psychology ---
  emotionBefore: Emotion | null;
  emotionDuring: Emotion | null;
  emotionAfter: Emotion | null;
  confidence: number | null; // 1..10
  followedPlan: FollowedPlan | null;
  mistakeTags: string[];

  // --- Execution / outcome (filled when the trade closes) ---
  exitPrice: number | null;
  exitReason: ExitReason | null;
  status: TradeStatus;

  // --- Review ---
  screenshotsBefore: ImageRef[];
  screenshotsAfter: ImageRef[];
  whatHappened: string; // what actually happened
  wentRight: string;
  wentWrong: string;
  lesson: string; // the one thing learned
  notes: string;
}

/** Payload for create/update — everything except server-managed fields. */
export type TradeInput = Omit<Trade, "id" | "createdAt" | "updatedAt">;

export interface TradeFilters {
  journalId?: string; // scope to one journal/workspace
  search?: string;
  exchange?: string;
  status?: TradeStatus | "all";
  direction?: Direction | "all";
  setup?: string;
  emotion?: string;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
}

export interface Settings {
  accountBalance: number; // used for risk% and position-size suggestions
  baseCurrency: string; // e.g. USDT
  defaultRiskPercent: number; // % of balance risked per trade by default
  maintenanceMarginRate: number; // e.g. 0.005 for liquidation estimate
  takerFeeRate: number; // e.g. 0.001
  makerFeeRate: number; // e.g. 0.0005
  theme: "dark" | "light";
  imageFormat: "original" | "webp"; // how screenshots are stored on disk
  webpQuality: number; // 0..1, used when imageFormat is "webp"
  setups: ManagedItem[]; // manageable setup dropdown (add / remove / enable-disable)
  exchanges: ManagedItem[]; // manageable exchange dropdown
}

export const DEFAULT_SETTINGS: Settings = {
  accountBalance: 10_000,
  baseCurrency: "USDT",
  defaultRiskPercent: 1,
  maintenanceMarginRate: 0.005,
  takerFeeRate: 0.001,
  makerFeeRate: 0.0005,
  theme: "dark",
  imageFormat: "original",
  webpQuality: 0.8,
  setups: SUGGESTED_SETUPS.map((s) => ({ id: s, label: s, enabled: true })),
  exchanges: SUGGESTED_EXCHANGES.map((s) => ({ id: s, label: s, enabled: true })),
};

export const DEFAULT_JOURNAL_NAME = "ژورنال اصلی";

export type ExportFormat = "json" | "csv";

export interface AppInfo {
  version: string;
  dbPath: string;
  platform: string;
  isElectron: boolean;
}
