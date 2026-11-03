import React, { useMemo, useState } from "react";
import type { EquityPoint } from "../../shared/stats";
import { fmtMoney, fmtR } from "../format";

// ---------- Equity curve (SVG, dependency-free) ----------

export function EquityChart({ points, currency = "" }: { points: EquityPoint[]; currency?: string }) {
  const [mode, setMode] = useState<"usd" | "r">("usd");
  const width = 920;
  const height = 240;
  const pad = { t: 18, r: 16, b: 26, l: 52 };

  const values = points.map((p) => (mode === "usd" ? p.cumPnl : p.cumR));
  const data = useMemo(() => {
    if (points.length === 0) return null;
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (width - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
    const line = points.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join(" ");
    const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    return { min, max, x, y, line, area };
  }, [points, values, mode]);

  const last = values[values.length - 1];
  const positive = (last ?? 0) >= 0;

  return (
    <div className="chart-wrap">
      <div className="chart-toolbar">
        <div className="segmented small">
          <button type="button" className={mode === "usd" ? "active" : ""} onClick={() => setMode("usd")} data-testid="chart-mode-usd">
            equity ({currency || "$"})
          </button>
          <button type="button" className={mode === "r" ? "active" : ""} onClick={() => setMode("r")} data-testid="chart-mode-r">
            R-multiple
          </button>
        </div>
        <div className={`chart-last ${positive ? "pos" : "neg"}`} data-testid="chart-last">
          {mode === "usd" ? fmtMoney(last ?? 0, currency) : fmtR(last ?? 0)}
        </div>
      </div>
      {points.length === 0 || !data ? (
        <div className="empty small">هنوز معامله بسته‌شده‌ای نداری؛ منحنی equity اینجا ساخته می‌شود.</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="equity-chart" data-testid="equity-chart" role="img">
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={positive ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)"} />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>
          {/* zero line */}
          <line x1={pad.l} x2={width - pad.r} y1={data.y(0)} y2={data.y(0)} className="axis-zero" />
          {/* y labels */}
          <text x={pad.l - 6} y={data.y(data.max) + 4} className="axis-label" textAnchor="end">
            {mode === "usd" ? fmtMoney(data.max, currency) : fmtR(data.max)}
          </text>
          <text x={pad.l - 6} y={data.y(data.min) + 4} className="axis-label" textAnchor="end">
            {mode === "usd" ? fmtMoney(data.min, currency) : fmtR(data.min)}
          </text>
          <path d={data.area} fill="url(#eqFill)" />
          <path d={data.line} className={`eq-line ${positive ? "pos" : "neg"}`} fill="none" />
          {points.map((p, i) => (
            <circle key={i} cx={data.x(i)} cy={data.y(values[i])} r={2.6} className={values[i] >= 0 ? "dot pos" : "dot neg"}>
              <title>{`${p.date} — ${mode === "usd" ? fmtMoney(p.cumPnl, currency) : fmtR(p.cumR)}`}</title>
            </circle>
          ))}
          <text x={pad.l} y={height - 6} className="axis-label">{points[0]?.date}</text>
          <text x={width - pad.r} y={height - 6} className="axis-label" textAnchor="end">{points[points.length - 1]?.date}</text>
        </svg>
      )}
    </div>
  );
}

// ---------- Monthly P&L heatmap ----------

export function Heatmap({ calendar, year, month }: { calendar: Record<string, number>; year: number; month: number }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sunday
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const values = Object.values(calendar).filter((v) => v !== 0);
  const maxAbs = Math.max(1, ...values.map(Math.abs));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const gMonthLabel = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month];

  return (
    <div className="heatmap" data-testid="heatmap">
      <div className="heatmap-title">
        {gMonthLabel} {year}
      </div>
      <div className="heatmap-grid">
        {["ی", "د", "س", "چ", "پ", "ج", "ش"].map((d) => (
          <div key={d} className="heatmap-dow">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} className="heatmap-cell empty" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const v = calendar[key];
          const intensity = v != null ? Math.min(1, Math.abs(v) / maxAbs) : 0;
          const cls = v == null ? "" : v > 0 ? "pos" : v < 0 ? "neg" : "zero";
          return (
            <div
              key={key}
              className={`heatmap-cell ${cls}${key === todayStr ? " today" : ""}`}
              style={v != null && v !== 0 ? { opacity: 0.25 + 0.75 * intensity } : undefined}
              title={`${key}: ${v != null ? fmtMoney(v) : "بدون معامله"}`}
              data-testid={`heat-${key}`}
            >
              {d}
            </div>
          );
        })}
      </div>
      <div className="heatmap-legend">
        <span>زیان</span>
        <span className="legend-swatch neg" />
        <span className="legend-swatch zero" />
        <span className="legend-swatch pos" />
        <span>سود</span>
      </div>
    </div>
  );
}
