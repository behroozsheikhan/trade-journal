// Active-journal context: the app supports several independent journals
// (workspaces). The selection is persisted in localStorage; journal-scoped
// pages read `activeId` from here and pass it to the API as a filter.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Journal } from "../shared/types";
import { getApi } from "./api";

const ACTIVE_KEY = "tj.activeJournalId";

interface JournalContextValue {
  journals: Journal[] | null; // null = still loading
  activeId: string | null;
  activeJournal: Journal | null;
  setActiveId: (id: string) => void;
  refresh: () => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [journals, setJournals] = useState<Journal[] | null>(null);
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });

  const refresh = useCallback(async () => {
    let list = await getApi().listJournals();
    if (list.length === 0) {
      // first run (or everything deleted): always keep at least one journal
      const j = await getApi().createJournal("ژورنال اصلی");
      list = await getApi().listJournals();
      void j;
    }
    setJournals(list);
    setActiveIdState((prev) => {
      const next = prev && list.some((j) => j.id === prev) ? prev : list[0]?.id ?? null;
      try {
        if (next) localStorage.setItem(ACTIVE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveId = useCallback((id: string) => {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
    setActiveIdState(id);
  }, []);

  const value = useMemo<JournalContextValue>(() => {
    const activeJournal = journals?.find((j) => j.id === activeId) ?? null;
    return { journals, activeId, activeJournal, setActiveId, refresh };
  }, [journals, activeId, setActiveId, refresh]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used inside <JournalProvider>");
  return ctx;
}
