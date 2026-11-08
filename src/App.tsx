import React, { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import type { Settings } from "../shared/types";
import { getApi } from "./api";
import { JournalProvider, useJournal } from "./journal";
import { Spinner, ToastProvider } from "./components/ui";
import JournalsPage from "./pages/JournalsPage";
import Dashboard from "./pages/Dashboard";
import TradesPage from "./pages/TradesPage";
import TradeFormPage from "./pages/TradeFormPage";
import TradeDetailPage from "./pages/TradeDetailPage";
import SettingsPage from "./pages/SettingsPage";

function Sidebar() {
  const { activeJournal } = useJournal();
  return (
    <aside className="sidebar">
      <NavLink to="/" className="brand" data-testid="nav-journals">
        <div className="brand-icon">📓</div>
        <div>
          <div className="brand-name">ژورنال ترید</div>
          <div className="brand-sub" data-testid="sidebar-journal-name">{activeJournal ? activeJournal.name : "…"}</div>
        </div>
      </NavLink>
      <nav className="nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-dashboard">
          📊 داشبورد
        </NavLink>
        <NavLink to="/trades" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-trades">
          📒 معاملات
        </NavLink>
        <NavLink to="/trades/new" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-new-trade">
          ➕ معامله جدید
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-settings">
          ⚙️ تنظیمات
        </NavLink>
      </nav>
      <div className="sidebar-foot muted small">100% آفلاین — داده‌ها روی دستگاه توست</div>
    </aside>
  );
}

/** Journal-scoped pages require an active journal; otherwise go back to the journal picker. */
function JournalGate({ children }: { children: React.ReactNode }) {
  const { journals, activeId } = useJournal();
  if (journals === null) return <Spinner />;
  if (!activeId) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<JournalsPage />} />
          <Route path="/dashboard" element={<JournalGate><Dashboard /></JournalGate>} />
          <Route path="/trades" element={<JournalGate><TradesPage /></JournalGate>} />
          <Route path="/trades/new" element={<JournalGate><TradeFormPage /></JournalGate>} />
          <Route path="/trades/:id" element={<JournalGate><TradeDetailPage /></JournalGate>} />
          <Route path="/trades/:id/edit" element={<JournalGate><TradeFormPage /></JournalGate>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    void getApi().getSettings().then((s: Settings) => setTheme(s.theme));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ToastProvider>
      <JournalProvider>
        <Shell />
      </JournalProvider>
    </ToastProvider>
  );
}
