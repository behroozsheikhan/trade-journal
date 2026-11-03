import React, { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Settings } from "../shared/types";
import { getApi } from "./api";
import { ToastProvider } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import TradesPage from "./pages/TradesPage";
import TradeFormPage from "./pages/TradeFormPage";
import TradeDetailPage from "./pages/TradeDetailPage";
import SettingsPage from "./pages/SettingsPage";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">📓</div>
        <div>
          <div className="brand-name">ژورنال ترید</div>
          <div className="brand-sub">Trade Journal</div>
        </div>
      </div>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} data-testid="nav-dashboard">
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
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/trades/new" element={<TradeFormPage />} />
            <Route path="/trades/:id" element={<TradeDetailPage />} />
            <Route path="/trades/:id/edit" element={<TradeFormPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
