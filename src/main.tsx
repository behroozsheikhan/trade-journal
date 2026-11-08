import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "./styles.css";
import App from "./App";
import { getApi, isElectron } from "./api";
import { seedDemoTrades } from "./mockApi";

// Expose a tiny hook for e2e tests / demo seeding in browser (mock) mode.
if (!isElectron()) {
  window.__TJ__ = {
    api: getApi(),
    isMock: true,
    seedDemo: async (n = 24) => {
      const api = getApi();
      const journals = await api.listJournals();
      const active = localStorage.getItem("tj.activeJournalId");
      await seedDemoTrades(api, n, journals.find((j) => j.id === active)?.id ?? journals[0]?.id);
    },
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
