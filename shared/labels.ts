// Persian UI labels for the controlled vocabularies in enums.ts

import type {
  Direction,
  MarketType,
  TradeMode,
  TradeStatus,
  Emotion,
  MistakeTag,
  MarketCondition,
  Session,
  ExitReason,
  SignalSource,
  FollowedPlan,
} from "./enums";

export const DIRECTION_LABELS: Record<Direction, string> = {
  long: "لانگ (LONG)",
  short: "شورت (SHORT)",
};

export const MARKET_TYPE_LABELS: Record<MarketType, string> = {
  spot: "اسپات (Spot)",
  futures: "فیوچرز (Futures)",
  margin: "مارجین",
  paper: "کاغذی / دمو",
};

export const TRADE_MODE_LABELS: Record<TradeMode, string> = {
  scalp: "اسکالپ (Scalp)",
  day: "دی‌ترید (Day)",
  swing: "سوئینگ (Swing)",
};


export const STATUS_LABELS: Record<TradeStatus, string> = {
  open: "باز",
  closed: "بسته‌شده",
};

export const EMOTION_LABELS: Record<Emotion, string> = {
  calm: "آرام",
  confident: "مطمئن",
  anxious: "مضطرب",
  fomo: "FOMO",
  greedy: "طمع‌کار",
  fearful: "ترسیده",
  revenge: "انتقام‌جو",
  bored: "کسل",
  tired: "خسته",
  overconfident: "مغرور",
};

export const MISTAKE_LABELS: Record<MistakeTag, string> = {
  fomo: "FOMO",
  "revenge-trade": "معامله انتقامی",
  "late-entry": "ورود دیرهنگام",
  "early-entry": "ورود زودهنگام",
  chased: "دنبال‌کردن قیمت",
  "moved-stop": "جابجایی استاپ",
  "no-stop": "بدون استاپ",
  oversized: "حجم بیش‌از‌حد",
  "early-exit": "خروج زودهنگام",
  overtrading: "overtrading",
  "no-plan": "بدون برنامه",
  "news-chasing": "دنبال خبر",
  "tired-trading": "معامله با خستگی",
};

export const MARKET_CONDITION_LABELS: Record<MarketCondition, string> = {
  "trend-up": "روند صعودی 📈",
  "trend-down": "روند نزولی 📉",
  range: "رنج",
  choppy: "نوسانی (Choppy)",
  "high-vol": "پرنوسان",
  "low-vol": "کم‌نوسان",
};

export const SESSION_LABELS: Record<Session, string> = {
  asia: "سشن آسیا",
  london: "سشن لندن",
  "new-york": "سشن نیویورک",
  overlap: "اورلپ",
};

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  tp: "حد سود (TP)",
  "stop-loss": "استاپ لاس (SL)",
  manual: "دستی",
  "time-based": "بر اساس زمان",
  reversal: "سیگنال معکوس",
  emotion: "تصمیم احساسی",
  "partial-tp": "TP جزئی",
};

export const SIGNAL_SOURCE_LABELS: Record<SignalSource, string> = {
  self: "تحلیل شخصی",
  "paid-group": "گروه VIP",
  "free-group": "گروه رایگان",
  bot: "ربات",
  alert: "آلرت",
  other: "سایر",
};

export const FOLLOWED_PLAN_LABELS: Record<FollowedPlan, string> = {
  yes: "بله، کامل",
  no: "خیر",
  partial: "تا حدی",
};

export const SETUP_LABELS: Record<string, string> = {
  breakout: "بریک‌اوت",
  pullback: "پولبک",
  retest: "Retest",
  "range-play": "بازی در رنج",
  reversal: "ریورسال",
  "trend-continuation": "ادامه روند",
  "support-resistance": "حمایت/مقاومت",
  "liquidity-sweep": "Sweep نقدینگی",
  "news-catalyst": "کاتالیست خبر",
  other: "سایر",
};

export function setupLabel(setup: string): string {
  return SETUP_LABELS[setup] ?? setup;
}
