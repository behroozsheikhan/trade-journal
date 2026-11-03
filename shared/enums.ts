// Controlled vocabularies for the trading journal.
// Values are stored in English in the DB; labels.ts maps them to Persian UI text.

export const DIRECTIONS = ["long", "short"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const MARKET_TYPES = ["spot", "futures", "margin", "paper"] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export const TRADE_MODES = ["scalp", "day", "swing"] as const;
export type TradeMode = (typeof TRADE_MODES)[number];

export const TRADE_STATUSES = ["open", "closed"] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const TIMEFRAMES = [
  "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "1w", "1M",
] as const;

export const EMOTIONS = [
  "calm",
  "confident",
  "anxious",
  "fomo",
  "greedy",
  "fearful",
  "revenge",
  "bored",
  "tired",
  "overconfident",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const MISTAKE_TAGS = [
  "fomo",
  "revenge-trade",
  "late-entry",
  "early-entry",
  "chased",
  "moved-stop",
  "no-stop",
  "oversized",
  "early-exit",
  "overtrading",
  "no-plan",
  "news-chasing",
  "tired-trading",
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];

export const MARKET_CONDITIONS = [
  "trend-up",
  "trend-down",
  "range",
  "choppy",
  "high-vol",
  "low-vol",
] as const;
export type MarketCondition = (typeof MARKET_CONDITIONS)[number];

export const SESSIONS = ["asia", "london", "new-york", "overlap"] as const;
export type Session = (typeof SESSIONS)[number];

export const EXIT_REASONS = [
  "tp",
  "stop-loss",
  "manual",
  "time-based",
  "reversal",
  "emotion",
  "partial-tp",
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const SIGNAL_SOURCES = ["self", "paid-group", "free-group", "bot", "alert", "other"] as const;
export type SignalSource = (typeof SIGNAL_SOURCES)[number];

export const FOLLOWED_PLAN_OPTIONS = ["yes", "no", "partial"] as const;
export type FollowedPlan = (typeof FOLLOWED_PLAN_OPTIONS)[number];

/** Suggested setup names — users can also type a custom setup. */
export const SUGGESTED_SETUPS = [
  "breakout",
  "pullback",
  "retest",
  "range-play",
  "reversal",
  "trend-continuation",
  "support-resistance",
  "liquidity-sweep",
  "news-catalyst",
  "other",
] as const;

export const SUGGESTED_EXCHANGES = [
  "Binance",
  "Bybit",
  "OKX",
  "Kraken",
  "KuCoin",
  "Coinbase",
  "Bitget",
  "Hyperliquid",
  "dYdX",
  "other",
] as const;

export const POPULAR_SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "DOGE/USDT",
  "ADA/USDT",
  "AVAX/USDT",
  "LINK/USDT",
  "ARB/USDT",
  "OP/USDT",
  "APT/USDT",
] as const;
