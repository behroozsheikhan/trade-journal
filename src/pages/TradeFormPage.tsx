import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deriveTrade, effectiveRiskPercent, riskUsdFromPercent, suggestedQuantityOf } from "../../shared/calc";
import {
  EMOTIONS,
  EXIT_REASONS,
  FOLLOWED_PLAN_OPTIONS,
  MARKET_CONDITIONS,
  MARKET_TYPES,
  MISTAKE_TAGS,
  POPULAR_SYMBOLS,
  SESSIONS,
  SIGNAL_SOURCES,
  SUGGESTED_EXCHANGES,
  SUGGESTED_SETUPS,
  TIMEFRAMES,
  TRADE_MODES,
  TRADE_STATUSES,
  DIRECTIONS,
  type Direction,
  type Emotion,
  type ExitReason,
  type FollowedPlan,
  type MarketCondition,
  type MarketType,
  type Session,
  type SignalSource,
  type TradeMode,
  type TradeStatus,
} from "../../shared/enums";
import {
  DIRECTION_LABELS,
  EMOTION_LABELS,
  EXIT_REASON_LABELS,
  FOLLOWED_PLAN_LABELS,
  MARKET_CONDITION_LABELS,
  MARKET_TYPE_LABELS,
  MISTAKE_LABELS,
  SESSION_LABELS,
  SIGNAL_SOURCE_LABELS,
  TRADE_MODE_LABELS,
  STATUS_LABELS,
  setupLabel,
} from "../../shared/labels";
import type { Settings, Trade, TradeInput } from "../../shared/types";
import { getApi } from "../api";
import { useJournal } from "../journal";
import { fmtMoney, fmtNum, fmtPct, fmtR, nowLocal, pnlClass, todayLocal } from "../format";
import { ImagePicker } from "../components/ImagePicker";
import { ChipGroup, ConfirmDialog, Field, MultiChip, Section, Segmented, Spinner, useToast } from "../components/ui";

function emptyInput(journalId: string): TradeInput {
  return {
    journalId,
    entryDate: todayLocal(),
    entryTime: nowLocal(),
    exitDate: null,
    exitTime: null,
    symbol: "",
    exchange: "Binance",
    marketType: "futures",
    direction: "long",
    mode: "day",
    timeframe: "1h",
    leverage: 10,
    entryPrice: 0,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    quantity: 0,
    riskPercent: null,
    fees: 0,
    funding: 0,
    setup: "",
    signalSource: "self",
    entryReason: "",
    marketCondition: null,
    session: null,
    emotionBefore: null,
    emotionDuring: null,
    emotionAfter: null,
    confidence: 5,
    followedPlan: null,
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
  };
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function TradeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeId } = useJournal();
  const [input, setInput] = useState<TradeInput | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const api = getApi();
    void api.getSettings().then(setSettings);
    if (id) {
      void api.getTrade(id).then((t) => {
        if (!t) {
          toast("معامله پیدا نشد", "err");
          navigate("/trades");
          return;
        }
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = t;
        setInput(rest);
      });
    } else {
      setInput(emptyInput(activeId ?? ""));
    }
  }, [id, activeId, navigate, toast]);

  const set = <K extends keyof TradeInput>(k: K, v: TradeInput[K]) => setInput((prev) => (prev ? { ...prev, [k]: v } : prev));

  const previewTrade = useMemo((): Trade | null => {
    if (!input) return null;
    return { ...input, id: id ?? "preview", createdAt: "", updatedAt: "" };
  }, [input, id]);

  const d = useMemo(() => (previewTrade && settings ? deriveTrade(previewTrade, settings.maintenanceMarginRate) : null), [previewTrade, settings]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!input) return false;
    if (!input.symbol.trim()) e.symbol = "نماد را وارد کن (مثلاً BTC/USDT)";
    if (!input.entryDate) e.entryDate = "تاریخ ورود را وارد کن";
    if (!(input.entryPrice > 0)) e.entryPrice = "قیمت ورود معتبر نیست";
    if (!(input.quantity > 0)) e.quantity = "حجم معامله باید بزرگ‌تر از صفر باشد";
    if (input.status === "closed") {
      if (!input.exitDate) e.exitDate = "تاریخ خروج را وارد کن";
      if (!(input.exitPrice != null && input.exitPrice > 0)) e.exitPrice = "قیمت خروج معتبر نیست";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!input || !validate()) return;
    setSaving(true);
    try {
      const api = getApi();
      if (id) {
        const t = await api.updateTrade(id, input);
        toast("معامله به‌روزرسانی شد");
        navigate(`/trades/${t.id}`);
      } else {
        const t = await api.createTrade(input);
        toast("معامله ثبت شد");
        navigate(`/trades/${t.id}`);
      }
    } catch (err) {
      toast(`خطا در ذخیره: ${(err as Error).message}`, "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    await getApi().deleteTrade(id);
    toast("معامله حذف شد");
    navigate("/trades");
  };

  const suggestQty = () => {
    if (!input || !settings) return;
    const pct = effectiveRiskPercent(input.riskPercent, settings.defaultRiskPercent);
    const risk = riskUsdFromPercent(settings.accountBalance, pct);
    const q = suggestedQuantityOf(risk, input.entryPrice, input.stopLoss);
    if (q != null) set("quantity", Math.round(q * 1e6) / 1e6);
  };

  if (!input || !settings || !d) return <Spinner />;

  const isFutures = input.marketType === "futures" || input.marketType === "margin";
  const riskPctOfBalance = d.riskUsd != null && settings.accountBalance > 0 ? (d.riskUsd / settings.accountBalance) * 100 : null;

  return (
    <div className="page" data-testid="trade-form">
      <div className="page-head">
        <h1>{id ? "ویرایش معامله" : "ثبت معامله جدید"}</h1>
        <div className="row-actions">
          {id && (
            <button className="btn danger" onClick={() => setConfirmDelete(true)} data-testid="btn-delete-trade">
              حذف
            </button>
          )}
          <button className="btn ghost" onClick={() => navigate(-1)} data-testid="btn-cancel">
            انصراف
          </button>
          <button className="btn primary" onClick={() => void save()} disabled={saving} data-testid="btn-save-trade">
            {saving ? "در حال ذخیره…" : "ذخیره معامله"}
          </button>
        </div>
      </div>

      <div className="two-col-form">
        <div className="col">
          <Section title="اطلاعات اصلی" subtitle="چه نمادی را، در چه زمانی و روی چه بازاری باز کردی؟" testId="sec-basics">
            <div className="form-grid">
              <Field label="نماد (Symbol)" error={errors.symbol}>
                <input className="input mono" list="symbols" value={input.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="BTC/USDT" data-testid="field-symbol" />
                <datalist id="symbols">
                  {POPULAR_SYMBOLS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="صرافی (Exchange)">
                <input className="input" list="exchanges" value={input.exchange} onChange={(e) => set("exchange", e.target.value)} data-testid="field-exchange" />
                <datalist id="exchanges">
                  {(settings ? settings.exchanges.filter((e) => e.enabled).map((e) => e.label) : SUGGESTED_EXCHANGES).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <Field label="تاریخ ورود" error={errors.entryDate}>
                <input type="date" className="input" value={input.entryDate} onChange={(e) => set("entryDate", e.target.value)} data-testid="field-entry-date" />
              </Field>
              <Field label="ساعت ورود">
                <input type="time" className="input" value={input.entryTime} onChange={(e) => set("entryTime", e.target.value)} data-testid="field-entry-time" />
              </Field>
              <Field label="وضعیت">
                <Segmented<TradeStatus>
                  options={TRADE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                  value={input.status}
                  onChange={(v) => set("status", v ?? "open")}
                  testId="field-status"
                />
              </Field>
              <Field label="نوع بازار">
                <Segmented<MarketType>
                  options={MARKET_TYPES.map((m) => ({ value: m, label: MARKET_TYPE_LABELS[m] }))}
                  value={input.marketType}
                  onChange={(v) => set("marketType", v ?? "spot")}
                  testId="field-market-type"
                />
              </Field>
              <Field label="جهت معامله">
                <Segmented<Direction>
                  options={DIRECTIONS.map((x) => ({ value: x, label: DIRECTION_LABELS[x] }))}
                  value={input.direction}
                  onChange={(v) => set("direction", v ?? "long")}
                  testId="field-direction"
                />
              </Field>
              <Field label="نوع معامله (Mode)">
                <Segmented<TradeMode>
                  options={TRADE_MODES.map((m) => ({ value: m, label: TRADE_MODE_LABELS[m] }))}
                  value={input.mode}
                  onChange={(v) => set("mode", v)}
                  allowEmpty
                  testId="field-mode"
                />
              </Field>
              <Field label="تایم‌فریم تحلیل">
                <select className="input" value={input.timeframe} onChange={(e) => set("timeframe", e.target.value)} data-testid="field-timeframe">
                  {TIMEFRAMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              {isFutures && (
                <Field label="اهرم (Leverage)" hint={d.liquidationPrice != null ? `قیمت approx liquidation: ${fmtNum(d.liquidationPrice, 2)}` : undefined}>
                  <input type="number" min={1} max={125} className="input mono" value={input.leverage ?? 1} onChange={(e) => set("leverage", num(e.target.value))} data-testid="field-leverage" />
                </Field>
              )}
            </div>
          </Section>

          <Section title="قیمت‌ها و مدیریت ریسک" subtitle="برنامه را قبل از دانستن نتیجه ثبت کن" testId="sec-prices">
            <div className="form-grid">
              <Field label="قیمت ورود" error={errors.entryPrice}>
                <input type="number" step="any" className="input mono" value={input.entryPrice || ""} onChange={(e) => set("entryPrice", num(e.target.value) ?? 0)} data-testid="field-entry-price" />
              </Field>
              <Field label="استاپ لاس (SL)">
                <input type="number" step="any" className="input mono" value={input.stopLoss ?? ""} onChange={(e) => set("stopLoss", num(e.target.value))} data-testid="field-sl" />
              </Field>
              <Field label="حد سود ۱ (TP1)">
                <input type="number" step="any" className="input mono" value={input.takeProfit1 ?? ""} onChange={(e) => set("takeProfit1", num(e.target.value))} data-testid="field-tp1" />
              </Field>
              <Field label="حد سود ۲ (TP2)">
                <input type="number" step="any" className="input mono" value={input.takeProfit2 ?? ""} onChange={(e) => set("takeProfit2", num(e.target.value))} data-testid="field-tp2" />
              </Field>
              <Field label="حجم (Quantity)" error={errors.quantity} hint={settings ? `بودجه ${settings.baseCurrency}: ${fmtMoney(settings.accountBalance, settings.baseCurrency)} — ریسک پیش‌فرض ${settings.defaultRiskPercent}%` : undefined}>
                <div className="input-with-btn">
                  <input type="number" step="any" className="input mono" value={input.quantity || ""} onChange={(e) => set("quantity", num(e.target.value) ?? 0)} data-testid="field-quantity" />
                  <button type="button" className="btn ghost small" onClick={suggestQty} data-testid="btn-suggest-qty" title="حجم پیشنهادی بر اساس ریسک پیش‌فرض">
                    پیشنهاد حجم
                  </button>
                </div>
              </Field>
              <Field label="ریسک این معامله (% از موجودی)" hint={`پیش‌فرض حساب: ${settings.defaultRiskPercent}% — اینجا می‌تونی برای هر معامله جداگانه تغییرش بدی`} error={errors.riskPercent}>
                <div className="input-with-btn">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    className="input mono"
                    placeholder={String(settings.defaultRiskPercent)}
                    value={input.riskPercent ?? ""}
                    onChange={(e) => set("riskPercent", num(e.target.value))}
                    data-testid="field-risk-percent"
                  />
                  <div className="chip-group" style={{ marginInlineStart: 4 }}>
                    {[0.25, 0.5, 1, 2].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`chip${(input.riskPercent ?? settings.defaultRiskPercent) === v ? " active" : ""}`}
                        onClick={() => set("riskPercent", v)}
                        data-testid={`risk-chip-${v}`}
                      >
                        {v}%
                      </button>
                    ))}
                    <button type="button" className="chip" onClick={() => set("riskPercent", null)} data-testid="risk-chip-default" title="استفاده از پیش‌فرض حساب">
                      پیش‌فرض
                    </button>
                  </div>
                </div>
              </Field>
              <Field label={`هزینه‌ها (fees) — ${settings.baseCurrency}`}>
                <input type="number" step="any" className="input mono" value={input.fees || ""} onChange={(e) => set("fees", num(e.target.value) ?? 0)} data-testid="field-fees" />
              </Field>
              <Field label={`فاندینگ (funding) — ${settings.baseCurrency}`}>
                <input type="number" step="any" className="input mono" value={input.funding || ""} onChange={(e) => set("funding", num(e.target.value) ?? 0)} data-testid="field-funding" />
              </Field>
            </div>
            <div className="calc-panel" data-testid="calc-panel">
              <div><span className="muted">Notional:</span> <b data-testid="calc-notional">{fmtMoney(d.notional, settings.baseCurrency)}</b></div>
              <div><span className="muted">Margin:</span> <b data-testid="calc-margin">{fmtMoney(d.marginUsed, settings.baseCurrency)}</b></div>
              <div><span className="muted">Risk (1R):</span> <b data-testid="calc-risk">{fmtMoney(d.riskUsd, settings.baseCurrency)}</b> {riskPctOfBalance != null && <span className="muted">({fmtPct(riskPctOfBalance)} از موجودی)</span>}</div>
              <div><span className="muted">Planned risk:</span> <b data-testid="calc-risk-percent">{effectiveRiskPercent(input.riskPercent, settings.defaultRiskPercent)}%</b> <span className="muted">= {fmtMoney(riskUsdFromPercent(settings.accountBalance, effectiveRiskPercent(input.riskPercent, settings.defaultRiskPercent)), settings.baseCurrency)}</span></div>
              <div><span className="muted">Planned RR:</span> <b data-testid="calc-rr">{d.plannedRR != null ? `${d.plannedRR.toFixed(2)} : 1` : "—"}</b></div>
              {d.liquidationPrice != null && (
                <div><span className="muted">Liquidation ≈</span> <b data-testid="calc-liq">{fmtNum(d.liquidationPrice, 2)}</b></div>
              )}
            </div>
          </Section>

          <Section title="برنامه معامله (قبل از ورود)" testId="sec-plan">
            <div className="form-grid">
              <Field label="ستاپ (Setup)">
                <input className="input" list="setups" value={input.setup} onChange={(e) => set("setup", e.target.value)} placeholder="مثلاً breakout" data-testid="field-setup" />
                <datalist id="setups">
                  {(settings && settings.setups.some((x) => x.enabled)
                    ? settings.setups.filter((x) => x.enabled).map((x) => x.label)
                    : SUGGESTED_SETUPS).map((s) => (
                    <option key={s} value={s}>{setupLabel(s)}</option>
                  ))}
                </datalist>
              </Field>
              <Field label="منبع سیگنال">
                <ChipGroup<SignalSource>
                  options={SIGNAL_SOURCES.map((s) => ({ value: s, label: SIGNAL_SOURCE_LABELS[s] }))}
                  value={input.signalSource}
                  onChange={(v) => set("signalSource", v)}
                  testId="field-signal"
                />
              </Field>
              <Field label="وضعیت بازار">
                <ChipGroup<MarketCondition>
                  options={MARKET_CONDITIONS.map((m) => ({ value: m, label: MARKET_CONDITION_LABELS[m] }))}
                  value={input.marketCondition}
                  onChange={(v) => set("marketCondition", v)}
                  testId="field-condition"
                />
              </Field>
              <Field label="سشن">
                <ChipGroup<Session>
                  options={SESSIONS.map((s) => ({ value: s, label: SESSION_LABELS[s] }))}
                  value={input.session}
                  onChange={(v) => set("session", v)}
                  testId="field-session"
                />
              </Field>
            </div>
            <Field label="علت ورود به معامله (confluence)" wide>
              <textarea className="input textarea" rows={3} value={input.entryReason} onChange={(e) => set("entryReason", e.target.value)} placeholder="مثلاً: شکست ساختار 4H + ریتست حمایت + واگرایی RSI + حجم بالا" data-testid="field-entry-reason" />
            </Field>
            <ImagePicker tradeId={id ?? "draft"} label="اسکرین‌شات نمودار قبل از ورود (با Entry/SL/TP)" value={input.screenshotsBefore} onChange={(v) => set("screenshotsBefore", v)} />
          </Section>
        </div>

        <div className="col">
          <Section title="روان‌شناسی معامله" subtitle="ثبت صادقانه احساسات — لبه واقعی تو اینجاست" testId="sec-psych">
            <Field label="احساس قبل از معامله" wide>
              <ChipGroup<Emotion>
                options={EMOTIONS.map((e) => ({ value: e, label: EMOTION_LABELS[e] }))}
                value={input.emotionBefore}
                onChange={(v) => set("emotionBefore", v)}
                testId="field-emotion-before"
              />
            </Field>
            <Field label="احساس حین معامله" wide>
              <ChipGroup<Emotion>
                options={EMOTIONS.map((e) => ({ value: e, label: EMOTION_LABELS[e] }))}
                value={input.emotionDuring}
                onChange={(v) => set("emotionDuring", v)}
                testId="field-emotion-during"
              />
            </Field>
            <Field label="احساس بعد از معامله" wide>
              <ChipGroup<Emotion>
                options={EMOTIONS.map((e) => ({ value: e, label: EMOTION_LABELS[e] }))}
                value={input.emotionAfter}
                onChange={(v) => set("emotionAfter", v)}
                testId="field-emotion-after"
              />
            </Field>
            <Field label={`اطمینان (confidence): ${input.confidence ?? "—"}/10`} wide>
              <input type="range" min={1} max={10} value={input.confidence ?? 5} onChange={(e) => set("confidence", Number(e.target.value))} data-testid="field-confidence" />
            </Field>
            <Field label="آیا برنامه را رعایت کردی؟" wide>
              <Segmented<FollowedPlan>
                options={FOLLOWED_PLAN_OPTIONS.map((f) => ({ value: f, label: FOLLOWED_PLAN_LABELS[f] }))}
                value={input.followedPlan}
                onChange={(v) => set("followedPlan", v)}
                allowEmpty
                testId="field-followed"
              />
            </Field>
            <Field label="اشتباهات این معامله" wide>
              <MultiChip
                options={MISTAKE_TAGS.map((m) => ({ value: m, label: MISTAKE_LABELS[m] }))}
                values={input.mistakeTags}
                onChange={(v) => set("mistakeTags", v)}
                testId="field-mistakes"
              />
            </Field>
          </Section>

          <Section title="نتیجه معامله" subtitle={input.status === "open" ? "هنوز باز است — بعد از بستن کامل می‌شود" : "خروج واقعی و نتیجه نهایی"} testId="sec-outcome">
            <div className="form-grid">
              <Field label="تاریخ خروج" error={errors.exitDate}>
                <input type="date" className="input" value={input.exitDate ?? ""} onChange={(e) => set("exitDate", e.target.value || null)} data-testid="field-exit-date" />
              </Field>
              <Field label="ساعت خروج">
                <input type="time" className="input" value={input.exitTime ?? ""} onChange={(e) => set("exitTime", e.target.value || null)} data-testid="field-exit-time" />
              </Field>
              <Field label="قیمت خروج" error={errors.exitPrice}>
                <input type="number" step="any" className="input mono" value={input.exitPrice ?? ""} onChange={(e) => set("exitPrice", num(e.target.value))} data-testid="field-exit-price" />
              </Field>
              <Field label="علت خروج">
                <select className="input" value={input.exitReason ?? ""} onChange={(e) => set("exitReason", (e.target.value || null) as ExitReason | null)} data-testid="field-exit-reason">
                  <option value="">—</option>
                  {EXIT_REASONS.map((x) => (
                    <option key={x} value={x}>{EXIT_REASON_LABELS[x]}</option>
                  ))}
                </select>
              </Field>
            </div>
            {input.status === "closed" && (
              <div className="calc-panel result" data-testid="result-panel">
                <div><span className="muted">P&L:</span> <b className={pnlClass(d.pnlUsd)} data-testid="calc-pnl">{fmtMoney(d.pnlUsd, settings.baseCurrency)}</b></div>
                <div><span className="muted">%:</span> <b className={pnlClass(d.pnlPct)} data-testid="calc-pnl-pct">{fmtPct(d.pnlPct)}</b></div>
                <div><span className="muted">ROE:</span> <b className={pnlClass(d.roePct)} data-testid="calc-roe">{fmtPct(d.roePct)}</b></div>
                <div><span className="muted">R:</span> <b className={pnlClass(d.rMultiple)} data-testid="calc-r">{fmtR(d.rMultiple)}</b></div>
                <div><span className="muted">مدت:</span> <b data-testid="calc-duration">{d.durationMinutes != null ? `${d.durationMinutes} min` : "—"}</b></div>
              </div>
            )}
            <ImagePicker tradeId={id ?? "draft"} label="اسکرین‌شات نمودار بعد از معامله" value={input.screenshotsAfter} onChange={(v) => set("screenshotsAfter", v)} />
          </Section>

          <Section title="مرور بعد از معامله" testId="sec-review">
            <Field label="آنچه در واقعیت اتفاق افتاد" wide>
              <textarea className="input textarea" rows={2} value={input.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} data-testid="field-what-happened" />
            </Field>
            <div className="form-grid">
              <Field label="چه چیزی درست بود؟" wide>
                <textarea className="input textarea" rows={2} value={input.wentRight} onChange={(e) => set("wentRight", e.target.value)} data-testid="field-went-right" />
              </Field>
              <Field label="چه چیزی اشتباه بود؟" wide>
                <textarea className="input textarea" rows={2} value={input.wentWrong} onChange={(e) => set("wentWrong", e.target.value)} data-testid="field-went-wrong" />
              </Field>
            </div>
            <Field label="چه درسی از این معامله گرفتی؟ (lesson)" wide>
              <textarea className="input textarea" rows={2} value={input.lesson} onChange={(e) => set("lesson", e.target.value)} data-testid="field-lesson" />
            </Field>
            <Field label="یادداشت آزاد" wide>
              <textarea className="input textarea" rows={2} value={input.notes} onChange={(e) => set("notes", e.target.value)} data-testid="field-notes" />
            </Field>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف معامله؟"
        message="این معامله برای همیشه حذف می‌شود. این عمل قابل بازگشت نیست."
        confirmLabel="حذف"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
