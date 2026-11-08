import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deriveTrade } from "../../shared/calc";
import type { Settings, Trade, TradeFilters } from "../../shared/types";
import { getApi, isElectron } from "../api";
import { useJournal } from "../journal";
import { fmtMoney, fmtR, pnlClass, downloadTextFile } from "../format";
import { DIRECTION_LABELS, STATUS_LABELS, setupLabel } from "../../shared/labels";
import { DIRECTIONS, TRADE_STATUSES } from "../../shared/enums";
import { EmptyState, Spinner, useToast } from "../components/ui";

export default function TradesPage() {
  const [searchParams] = useSearchParams();
  const { activeId } = useJournal();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [filters, setFilters] = useState<TradeFilters>(() => ({
    status: (searchParams.get("status") as TradeFilters["status"]) ?? "all",
  }));
  const toast = useToast();

  useEffect(() => {
    const api = getApi();
    void api.listTrades({ ...filters, journalId: activeId ?? undefined }).then(setTrades);
    void api.getSettings().then(setSettings);
  }, [filters, activeId]);

  const setups = useMemo(() => {
    const s = new Set<string>();
    void getApi().listTrades(activeId ? { journalId: activeId } : undefined).then((all) => all.forEach((t) => t.setup && s.add(t.setup)));
    return s;
  }, [activeId]);

  const exportData = async (format: "json" | "csv") => {
    const res = await getApi().exportData(format);
    if (!res.ok) return;
    if (res.content && !isElectron()) {
      const name = `trade-journal-${new Date().toISOString().slice(0, 10)}.${format}`;
      downloadTextFile(name, res.content, format === "csv" ? "text/csv" : "application/json");
      toast("فایل خروجی دانلود شد");
    } else if (res.path) {
      toast(`ذخیره شد: ${res.path}`);
    }
  };

  if (!trades || !settings) return <Spinner />;

  return (
    <div className="page" data-testid="trades-page">
      <div className="page-head">
        <h1>معاملات</h1>
        <div className="row-actions">
          <button className="btn ghost" onClick={() => void exportData("csv")} data-testid="btn-export-csv">
            خروجی CSV
          </button>
          <button className="btn ghost" onClick={() => void exportData("json")} data-testid="btn-export-json">
            خروجی JSON
          </button>
          <Link className="btn primary" to="/trades/new" data-testid="btn-new-trade">
            + معامله جدید
          </Link>
        </div>
      </div>

      <div className="filters card" data-testid="filters">
        <input
          className="input"
          placeholder="جستجو در نماد / ستاپ…"
          value={filters.search ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
          data-testid="filter-search"
        />
        <select
          className="input"
          value={filters.status ?? "all"}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TradeFilters["status"] }))}
          data-testid="filter-status"
        >
          <option value="all">همه وضعیت‌ها</option>
          {TRADE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          className="input"
          value={filters.direction ?? "all"}
          onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value as TradeFilters["direction"] }))}
          data-testid="filter-direction"
        >
          <option value="all">همه جهت‌ها</option>
          {DIRECTIONS.map((d) => (
            <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>
          ))}
        </select>
        <select
          className="input"
          value={filters.exchange ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, exchange: e.target.value || undefined }))}
          data-testid="filter-exchange"
        >
          <option value="">همه صرافی‌ها</option>
          {(settings?.exchanges ?? []).filter((e) => e.enabled).map((e) => (
            <option key={e.id} value={e.label}>{e.label}</option>
          ))}
        </select>
        <input
          type="date"
          className="input"
          value={filters.from ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
          data-testid="filter-from"
          title="از تاریخ"
        />
        <input
          type="date"
          className="input"
          value={filters.to ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
          data-testid="filter-to"
          title="تا تاریخ"
        />
      </div>

      {trades.length === 0 ? (
        <EmptyState>
          معامله‌ای با این فیلتر پیدا نشد. <Link to="/trades/new">+ ثبت معامله جدید</Link>
        </EmptyState>
      ) : (
        <div className="card">
          <table className="table" data-testid="trades-table">
            <thead>
              <tr>
                <th>تاریخ / ساعت</th>
                <th>نماد</th>
                <th>بازار</th>
                <th>جهت</th>
                <th>حالت</th>
                <th>ستاپ</th>
                <th>ورود</th>
                <th>SL</th>
                <th>TP</th>
                <th>خروج</th>
                <th>RR planned</th>
                <th>R</th>
                <th>P&L</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const d = deriveTrade(t, settings.maintenanceMarginRate);
                return (
                  <tr key={t.id} data-testid="trade-row" onClick={() => (window.location.hash = `#/trades/${t.id}`)}>
                    <td className="nowrap">{t.entryDate}<br /><span className="muted small">{t.entryTime}</span></td>
                    <td className="mono strong">{t.symbol}</td>
                    <td>{t.marketType}</td>
                    <td className={t.direction === "long" ? "pos" : "neg"}>{DIRECTION_LABELS[t.direction]}</td>
                    <td>{t.mode ?? "—"}</td>
                    <td>{setupLabel(t.setup)}</td>
                    <td className="mono">{t.entryPrice}</td>
                    <td className="mono">{t.stopLoss ?? "—"}</td>
                    <td className="mono">{t.takeProfit1 ?? "—"}</td>
                    <td className="mono">{t.exitPrice ?? "—"}</td>
                    <td className="mono">{d.plannedRR != null ? `${d.plannedRR.toFixed(2)}:1` : "—"}</td>
                    <td className={pnlClass(d.rMultiple)}>{fmtR(d.rMultiple)}</td>
                    <td className={pnlClass(d.pnlUsd)}>{fmtMoney(d.pnlUsd, settings.baseCurrency)}</td>
                    <td><span className={`badge ${t.status}`}>{STATUS_LABELS[t.status]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
