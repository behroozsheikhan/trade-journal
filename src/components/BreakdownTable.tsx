import React from "react";
import type { BreakdownRow } from "../../shared/stats";
import { fmtMoney, fmtPct, fmtR, pnlClass } from "../format";

export function BreakdownTable({
  rows,
  labelHeader,
  labelFn,
  top = 8,
  testId,
}: {
  rows: BreakdownRow[];
  labelHeader: string;
  labelFn?: (key: string) => string;
  top?: number;
  testId?: string;
}) {
  const shown = rows.slice(0, top);
  return (
    <table className="mini-table" data-testid={testId}>
      <thead>
        <tr>
          <th>{labelHeader}</th>
          <th>تعداد</th>
          <th>win rate</th>
          <th>net R</th>
          <th>P&L</th>
        </tr>
      </thead>
      <tbody>
        {shown.length === 0 && (
          <tr>
            <td colSpan={5} className="muted center">
              داده‌ای نیست
            </td>
          </tr>
        )}
        {shown.map((r) => (
          <tr key={r.key}>
            <td>{labelFn ? labelFn(r.key) : r.key}</td>
            <td>{r.trades}</td>
            <td>{(r.winRate * 100).toFixed(0)}%</td>
            <td className={pnlClass(r.netR)}>{fmtR(r.netR)}</td>
            <td className={pnlClass(r.netPnl)}>{fmtMoney(r.netPnl)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WinRateBar({ value }: { value: number }) {
  return (
    <span className="wr-bar" title={fmtPct(value * 100)}>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}
