import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { computeStats } from "../../shared/stats";
import type { Journal, Settings } from "../../shared/types";
import { getApi } from "../api";
import { fmtMoney, fmtPct, pnlClass } from "../format";
import { useJournal } from "../journal";
import { Spinner, useToast } from "../components/ui";

interface JournalStat {
  count: number;
  open: number;
  netPnl: number;
  winRate: number | null; // null when no closed trades
}

export default function JournalsPage() {
  const { journals, activeId, setActiveId, refresh } = useJournal();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Record<string, JournalStat>>({});
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    void getApi().getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!journals) return;
    let cancelled = false;
    void (async () => {
      const api = getApi();
      const out: Record<string, JournalStat> = {};
      for (const j of journals) {
        const trades = await api.listTrades({ journalId: j.id });
        const st = computeStats(trades);
        out[j.id] = {
          count: st.total,
          open: st.open,
          netPnl: st.netPnl,
          winRate: st.closed > 0 ? st.winRate : null,
        };
      }
      if (!cancelled) setStats(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [journals]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    await getApi().createJournal(name);
    setNewName("");
    toast("ژورنال جدید ساخته شد");
    await refresh();
  };

  const remove = async (j: Journal) => {
    if (!journals || journals.length <= 1) {
      toast("حداقل یک ژورنال باید بماند", "err");
      return;
    }
    if (!window.confirm(`ژورنال «${j.name}» و همه معاملاتش حذف شود؟`)) return;
    await getApi().deleteJournal(j.id);
    if (activeId === j.id) setActiveId(journals[0].id);
    toast("ژورنال حذف شد");
    await refresh();
  };

  const saveRename = async (j: Journal) => {
    const name = editName.trim();
    if (!name) return;
    await getApi().updateJournal(j.id, { name });
    setEditingId(null);
    toast("نام ژورنال تغییر کرد");
    await refresh();
  };

  const enter = (j: Journal) => {
    setActiveId(j.id);
    navigate("/dashboard");
  };

  const currency = settings?.baseCurrency ?? "USDT";

  const cards = useMemo(() => journals ?? [], [journals]);

  if (!journals) return <Spinner />;

  return (
    <div className="page" data-testid="journals-page">
      <div className="page-head">
        <div>
          <h1>ژورنال‌های من</h1>
          <p className="muted">هر ژورنال یک فضای مستقل است — مثلاً ترید روزانه واقعی و بک‌تست. برای ورود روی کارت کلیک کن.</p>
        </div>
        <div className="row-actions">
          <input
            className="input"
            placeholder="نام ژورنال جدید… (مثلاً بک‌تست استراتژی)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create()}
            data-testid="new-journal-input"
          />
          <button className="btn primary" onClick={() => void create()} data-testid="btn-create-journal">
            + ژورنال جدید
          </button>
        </div>
      </div>

      <div className="journal-grid">
        {cards.map((j) => {
          const st = stats[j.id];
          return (
            <div
              key={j.id}
              className={`journal-card${j.id === activeId ? " active" : ""}`}
              data-testid="journal-card"
              data-journal-id={j.id}
              onClick={() => enter(j)}
              title={`ورود به ${j.name}`}
            >
              <div className="journal-card-top">
                {editingId === j.id ? (
                  <input
                    className="input"
                    value={editName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(j);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    data-testid="journal-rename-input"
                  />
                ) : (
                  <div className="journal-card-name" data-testid="journal-card-name">
                    {j.name}
                  </div>
                )}
                <div className="journal-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn ghost small"
                    title="تغییر نام"
                    data-testid="btn-rename-journal"
                    onClick={() => {
                      setEditingId(j.id);
                      setEditName(j.name);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn ghost small danger"
                    title={cards.length <= 1 ? "حداقل یک ژورنال باید بماند" : "حذف ژورنال و معاملاتش"}
                    disabled={cards.length <= 1}
                    data-testid="btn-delete-journal"
                    onClick={() => void remove(j)}
                  >
                    🗑
                  </button>
                </div>
              </div>
              <div className="journal-card-stats">
                <div className="journal-stat">
                  <span className="muted small">معاملات</span>
                  <b data-testid="journal-stat-count">{st ? st.count : "…"}</b>
                </div>
                <div className="journal-stat">
                  <span className="muted small">P&L خالص</span>
                  <b className={st ? pnlClass(st.netPnl) : ""} data-testid="journal-stat-pnl">
                    {st ? fmtMoney(st.netPnl, currency) : "…"}
                  </b>
                </div>
                <div className="journal-stat">
                  <span className="muted small">win rate</span>
                  <b data-testid="journal-stat-winrate">{st && st.winRate != null ? fmtPct(st.winRate * 100) : "—"}</b>
                </div>
                <div className="journal-stat">
                  <span className="muted small">باز</span>
                  <b data-testid="journal-stat-open">{st ? st.open : "…"}</b>
                </div>
              </div>
              {j.id === activeId && <div className="journal-card-badge">ژورنال فعال</div>}
            </div>
          );
        })}

        <button className="journal-card journal-card-new" data-testid="btn-new-journal-card" onClick={() => document.querySelector<HTMLInputElement>('[data-testid="new-journal-input"]')?.focus()}>
          <span className="journal-card-plus">＋</span>
          <span>ژورنال جدید</span>
        </button>
      </div>
    </div>
  );
}
