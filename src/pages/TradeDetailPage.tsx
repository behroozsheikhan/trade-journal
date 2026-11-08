import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deriveTrade } from "../../shared/calc";
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
  STATUS_LABELS,
  TRADE_MODE_LABELS,
  setupLabel,
} from "../../shared/labels";
import type { Settings, Trade } from "../../shared/types";
import { getApi } from "../api";
import { fmtDuration, fmtMoney, fmtNum, fmtPct, fmtR, pnlClass } from "../format";
import { ImageGallery } from "../components/ImagePicker";
import { ConfirmDialog, Section, Spinner, useToast } from "../components/ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{children}</span>
    </div>
  );
}

export default function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [trade, setTrade] = useState<Trade | null | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    const api = getApi();
    void api.getTrade(id).then(setTrade);
    void api.getSettings().then(setSettings);
  }, [id]);

  const d = useMemo(() => (trade && settings ? deriveTrade(trade, settings.maintenanceMarginRate) : null), [trade, settings]);

  if (trade === undefined || !settings || !d) return <Spinner />;
  if (!trade) return <div className="page">معامله پیدا نشد <Link to="/trades">بازگشت</Link></div>;

  const remove = async () => {
    await getApi().deleteTrade(trade.id);
    toast("معامله حذف شد");
    navigate("/trades");
  };

  const closeTrade = async () => {
    // quick-close: mark closed with current time; full edit available on the form
    const now = new Date();
    const exitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const exitTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = trade;
    await getApi().updateTrade(trade.id, { ...rest, status: "closed", exitDate, exitTime });
    toast("معامله بسته شد — برای تکمیل قیمت خروج ویرایش کن");
    navigate(`/trades/${trade.id}/edit`);
  };

  return (
    <div className="page" data-testid="trade-detail">
      <div className="page-head">
        <h1>
          <span className="mono strong">{trade.symbol}</span>{" "}
          <span className={`badge ${trade.status}`}>{STATUS_LABELS[trade.status]}</span>{" "}
          <span className={trade.direction === "long" ? "pos" : "neg"}>{DIRECTION_LABELS[trade.direction]}</span>
        </h1>
        <div className="row-actions">
          {trade.status === "open" && (
            <button className="btn" onClick={() => void closeTrade()} data-testid="btn-close-trade">
              بستن معامله
            </button>
          )}
          <Link className="btn primary" to={`/trades/${trade.id}/edit`} data-testid="btn-edit">
            ویرایش
          </Link>
          <button className="btn danger" onClick={() => setConfirmDelete(true)} data-testid="btn-delete-trade">
            حذف
          </button>
        </div>
      </div>

      {trade.status === "closed" && (
        <div className="stat-grid result-grid">
          <div className={`stat-card tone-${(d.pnlUsd ?? 0) >= 0 ? "pos" : "neg"}`} data-testid="detail-pnl">
            <div className="stat-label">P&L</div>
            <div className="stat-value">{fmtMoney(d.pnlUsd, settings.baseCurrency)}</div>
            <div className="stat-sub">{fmtPct(d.pnlPct)} — ROE {fmtPct(d.roePct)}</div>
          </div>
          <div className={`stat-card tone-${(d.rMultiple ?? 0) >= 0 ? "pos" : "neg"}`} data-testid="detail-r">
            <div className="stat-label">R-multiple</div>
            <div className="stat-value">{fmtR(d.rMultiple)}</div>
            <div className="stat-sub">planned RR {d.plannedRR != null ? `${d.plannedRR.toFixed(2)}:1` : "—"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Risk (1R)</div>
            <div className="stat-value">{fmtMoney(d.riskUsd, settings.baseCurrency)}</div>
            <div className="stat-sub">duration {fmtDuration(d.durationMinutes)}</div>
          </div>
        </div>
      )}

      <div className="two-col">
        <Section title="جزئیات ورود" testId="detail-entry">
          <Row label="تاریخ / ساعت ورود">{trade.entryDate} — {trade.entryTime}</Row>
          <Row label="صرافی">{trade.exchange || "—"}</Row>
          <Row label="نوع بازار">{MARKET_TYPE_LABELS[trade.marketType]}</Row>
          <Row label="حالت معامله">{trade.mode ? TRADE_MODE_LABELS[trade.mode] : "—"}</Row>
          <Row label="تایم‌فریم">{trade.timeframe}</Row>
          {trade.leverage != null && <Row label="اهرم">{trade.leverage}x</Row>}
          {d.liquidationPrice != null && <Row label="قیمت approx. liquidation">{fmtNum(d.liquidationPrice, 4)}</Row>}
          <Row label="قیمت ورود">{fmtNum(trade.entryPrice, 8)}</Row>
          <Row label="استاپ لاس">{trade.stopLoss != null ? fmtNum(trade.stopLoss, 8) : "—"}</Row>
          <Row label="حد سود ۱ / ۲">{[trade.takeProfit1, trade.takeProfit2].filter(Boolean).map((v) => fmtNum(v as number, 8)).join(" / ") || "—"}</Row>
          <Row label="حجم">{fmtNum(trade.quantity, 8)}</Row>
          <Row label="ریسک planned این معامله">{trade.riskPercent != null ? `${trade.riskPercent}%` : `پیش‌فرض حساب (${settings.defaultRiskPercent}%)`}</Row>
          <Row label="Notional">{fmtMoney(d.notional, settings.baseCurrency)}</Row>
          <Row label="هزینه‌ها / فاندینگ">{fmtMoney(trade.fees, settings.baseCurrency)} / {fmtMoney(trade.funding, settings.baseCurrency)}</Row>
        </Section>

        <Section title="برنامه و زمینه" testId="detail-plan">
          <Row label="ستاپ">{trade.setup ? setupLabel(trade.setup) : "—"}</Row>
          <Row label="منبع سیگنال">{trade.signalSource ? SIGNAL_SOURCE_LABELS[trade.signalSource] : "—"}</Row>
          <Row label="وضعیت بازار">{trade.marketCondition ? MARKET_CONDITION_LABELS[trade.marketCondition] : "—"}</Row>
          <Row label="سشن">{trade.session ? SESSION_LABELS[trade.session] : "—"}</Row>
          <Row label="علت ورود">{trade.entryReason || "—"}</Row>
        </Section>

        <Section title="روان‌شناسی" testId="detail-psych">
          <Row label="قبل / حین / بعد">{[trade.emotionBefore, trade.emotionDuring, trade.emotionAfter].map((e) => (e ? EMOTION_LABELS[e] : "—")).join(" / ")}</Row>
          <Row label="اطمینان">{trade.confidence != null ? `${trade.confidence}/10` : "—"}</Row>
          <Row label="رعایت برنامه">{trade.followedPlan ? FOLLOWED_PLAN_LABELS[trade.followedPlan] : "—"}</Row>
          <Row label="اشتباهات">{trade.mistakeTags.length ? trade.mistakeTags.map((m) => MISTAKE_LABELS[m as keyof typeof MISTAKE_LABELS] ?? m).join("، ") : "—"}</Row>
        </Section>

        <Section title="نتیجه و خروج" testId="detail-outcome">
          <Row label="تاریخ / ساعت خروج">{trade.exitDate ? `${trade.exitDate} — ${trade.exitTime ?? ""}` : "—"}</Row>
          <Row label="قیمت خروج">{trade.exitPrice != null ? fmtNum(trade.exitPrice, 8) : "—"}</Row>
          <Row label="علت خروج">{trade.exitReason ? EXIT_REASON_LABELS[trade.exitReason] : "—"}</Row>
          <Row label="مدت معامله">{fmtDuration(d.durationMinutes)}</Row>
        </Section>

        <Section title="مرور" testId="detail-review" >
          <Row label="آنچه در واقعیت اتفاق افتاد">{trade.whatHappened || "—"}</Row>
          <Row label="درست بود">{trade.wentRight || "—"}</Row>
          <Row label="اشتباه بود">{trade.wentWrong || "—"}</Row>
          <Row label="درس آموخته‌شده">{trade.lesson || "—"}</Row>
          <Row label="یادداشت">{trade.notes || "—"}</Row>
        </Section>

        <Section title="اسکرین‌شات‌ها" testId="detail-images">
          <h3 className="subhead">قبل از ورود</h3>
          <ImageGallery refs={trade.screenshotsBefore} testId="gallery-before" />
          <h3 className="subhead">بعد از معامله</h3>
          <ImageGallery refs={trade.screenshotsAfter} testId="gallery-after" />
        </Section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف معامله؟"
        message={`${trade.symbol} برای همیشه حذف می‌شود.`}
        confirmLabel="حذف"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
