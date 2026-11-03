import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { computeStats } from "../../shared/stats";
import type { Settings, Trade } from "../../shared/types";
import { getApi } from "../api";
import { fmtMoney, fmtPct, fmtR, fmtDuration, pnlClass } from "../format";
import { DIRECTION_LABELS, STATUS_LABELS, setupLabel, EMOTION_LABELS } from "../../shared/labels";
import { EquityChart, Heatmap } from "../components/charts";
import { BreakdownTable } from "../components/BreakdownTable";
import { Section, StatCard, EmptyState, Spinner } from "../components/ui";

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const api = getApi();
    void api.listTrades().then(setTrades);
    void api.getSettings().then(setSettings);
  }, []);

  const stats = useMemo(() => (trades ? computeStats(trades, settings?.maintenanceMarginRate ?? 0.005) : null), [trades, settings]);

  if (!trades || !stats || !settings) return <Spinner />;

  const now = new Date();
  const openTrades = trades.filter((t) => t.status === "open");
  const recent = [...trades].sort((a, b) => (b.entryDate + b.entryTime).localeCompare(a.entryDate + a.entryTime)).slice(0, 6);

  return (
    <div className="page" data-testid="dashboard">
      <div className="page-head">
        <h1>داشبورد</h1>
        <Link className="btn primary" to="/trades/new" data-testid="btn-new-trade">
          + معامله جدید
        </Link>
      </div>

      {openTrades.length > 0 && (
        <div className="banner" data-testid="open-trades-banner">
          {openTrades.length} معامله باز داری —{" "}
          <Link to="/trades?status=open">مشاهده</Link>
        </div>
      )}

      <div className="stat-grid">
        <StatCard
          label={`سود/زیان خالص (${settings.baseCurrency})`}
          value={fmtMoney(stats.netPnl, settings.baseCurrency)}
          sub={`${fmtR(stats.netR)} — ${stats.closed} معامله بسته`}
          tone={stats.netPnl > 0 ? "pos" : stats.netPnl < 0 ? "neg" : "neutral"}
          testId="stat-net-pnl"
        />
        <StatCard label="win rate" value={stats.closed ? `${(stats.winRate * 100).toFixed(1)}%` : "—"} sub={`${stats.wins} برد / ${stats.losses} باخت`} testId="stat-win-rate" />
        <StatCard
          label="Expectancy (میانگین R)"
          value={stats.expectancyR != null ? fmtR(stats.expectancyR) : "—"}
          sub={stats.expectancyR != null && stats.expectancyR > 0 ? "مثبت — لبه آماری داری" : stats.expectancyR != null ? "منفی — روی فرایند کار کن" : ""}
          tone={stats.expectancyR != null && stats.expectancyR > 0 ? "pos" : stats.expectancyR != null ? "neg" : "neutral"}
          testId="stat-expectancy"
        />
        <StatCard
          label="Profit factor"
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
          sub="سود ناخالص تقسیم بر مجموع زیان"
          tone={stats.profitFactor > 1.5 ? "pos" : stats.profitFactor > 1 ? "neutral" : "neg"}
          testId="stat-profit-factor"
        />
        <StatCard label="avg R" value={stats.avgR != null ? fmtR(stats.avgR) : "—"} sub={`best ${fmtR(stats.bestR)} / worst ${fmtR(stats.worstR)}`} testId="stat-avg-r" />
        <StatCard label="max drawdown" value={fmtR(stats.maxDrawdownR)} sub={fmtMoney(stats.maxDrawdownUsd, settings.baseCurrency)} tone="neg" testId="stat-max-dd" />
        <StatCard label="رعایت برنامه" value={stats.ruleAdherence != null ? fmtPct(stats.ruleAdherence * 100) : "—"} sub={`${stats.maxConsecutiveLosses} باخت پیاپی`} testId="stat-rule-adherence" />
        <StatCard label="مدت میانگین معامله" value={fmtDuration(stats.avgDurationMinutes)} sub={`${stats.total} معامله — ${stats.open} باز`} testId="stat-duration" />
      </div>

      <Section title="منحنی Equity" subtitle="سود تجمعی بر اساس زمان (معاملات بسته‌شده)" testId="equity-section">
        <EquityChart points={stats.equityCurve} currency={settings.baseCurrency} />
      </Section>

      <div className="two-col">
        <Section title="تقویم ماهانه P&L" subtitle="رنگ روز = مجموع سود/زیان آن روز" testId="calendar-section">
          <Heatmap calendar={stats.calendar} year={now.getFullYear()} month={now.getMonth()} />
        </Section>
        <Section title="عملکرد بر اساس ستاپ" subtitle="کدام ستاپ بیشترین R را می‌دهد؟" testId="by-setup">
          <BreakdownTable rows={stats.bySetup} labelHeader="ستاپ" labelFn={setupLabel} testId="table-setup" />
        </Section>
      </div>

      <div className="grid-4">
        <Section title="بر اساس نماد" testId="by-symbol">
          <BreakdownTable rows={stats.bySymbol} labelHeader="نماد" testId="table-symbol" />
        </Section>
        <Section title="بر اساس احساس قبل از معامله" testId="by-emotion">
          <BreakdownTable rows={stats.byEmotion} labelHeader="احساس" labelFn={(k) => EMOTION_LABELS[k as keyof typeof EMOTION_LABELS] ?? k} testId="table-emotion" />
        </Section>
        <Section title="لانگ vs شورت" testId="by-direction">
          <BreakdownTable rows={stats.byDirection} labelHeader="جهت" labelFn={(k) => DIRECTION_LABELS[k as keyof typeof DIRECTION_LABELS] ?? k} testId="table-direction" />
        </Section>
        <Section title="بر اساس ساعت روز" testId="by-hour">
          <BreakdownTable rows={stats.byHour.map((r) => ({ ...r, key: `${r.key}:00` }))} labelHeader="ساعت" testId="table-hour" />
        </Section>
      </div>

      <Section title="آخرین معاملات" testId="recent-trades">
        {recent.length === 0 ? (
          <EmptyState>
            هنوز معامله‌ای ثبت نکرده‌ای. <Link to="/trades/new">اولین معامله را ثبت کن</Link>
          </EmptyState>
        ) : (
          <table className="table" data-testid="recent-table">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>نماد</th>
                <th>جهت</th>
                <th>ورود</th>
                <th>خروج</th>
                <th>R</th>
                <th>P&L</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => {
                const closed = t.status === "closed";
                const r = closed ? computeStats([t]).netR : null;
                const pnl = closed ? computeStats([t]).netPnl : null;
                return (
                  <tr key={t.id} data-testid="trade-row" onClick={() => (window.location.hash = `#/trades/${t.id}`)}>
                    <td>{t.entryDate} {t.entryTime}</td>
                    <td className="mono">{t.symbol}</td>
                    <td>{DIRECTION_LABELS[t.direction]}</td>
                    <td className="mono">{t.entryPrice}</td>
                    <td className="mono">{t.exitPrice ?? "—"}</td>
                    <td className={pnlClass(r)}>{fmtR(r)}</td>
                    <td className={pnlClass(pnl)}>{fmtMoney(pnl, settings.baseCurrency)}</td>
                    <td><span className={`badge ${t.status}`}>{STATUS_LABELS[t.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
