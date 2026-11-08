import React, { useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
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

function NavItem({ to, testId, children }: { to: string; testId: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? "active" : "")} data-testid={testId}>
      {children}
    </NavLink>
  );
}

function Sidebar() {
  const { activeId } = useJournal();
  const location = useLocation();
  const onPicker = location.pathname === "/";
  // Journal-scoped nav is only shown while inside a journal's pages.
  const inJournal = !!activeId && /^\/(dashboard|trades)/.test(location.pathname);
  return (
    <aside className="sidebar">
      {/* Brand is intentionally NOT a link — the nav below handles navigation. */}
      <div className="brand" data-testid="brand">
        <div className="brand-icon">📓</div>
        <div className="brand-name">ژورنال ترید</div>
      </div>
      <nav className="nav">
        {onPicker ? (
          <>
            <NavItem to="/" testId="nav-journals">🗂️ ژورنال‌های من</NavItem>
            <NavItem to="/settings" testId="nav-settings">⚙️ تنظیمات</NavItem>
          </>
        ) : (
          <>
            <NavItem to="/" testId="nav-home">🏠 صفحه اصلی</NavItem>
            {inJournal && (
              <>
                <NavItem to="/dashboard" testId="nav-dashboard">📊 داشبورد</NavItem>
                <NavItem to="/trades" testId="nav-trades">📒 معاملات</NavItem>
                <NavItem to="/trades/new" testId="nav-new-trade">➕ معامله جدید</NavItem>
              </>
            )}
            <NavItem to="/settings" testId="nav-settings">⚙️ تنظیمات</NavItem>
          </>
        )}
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
