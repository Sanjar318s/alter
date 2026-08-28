"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PlatformRole } from "@/lib/AuthContext";

/** Which nav panel is active — only one at a time (toggle in header). */
export type NavPanel = "feed" | "work";

const STORAGE_KEY = "alter_nav_panel";

type NavPanelCtx = {
  panel: NavPanel;
  setPanel: (p: NavPanel) => void;
  toggle: () => void;
};

const Ctx = createContext<NavPanelCtx>({
  panel: "feed",
  setPanel: () => {},
  toggle: () => {},
});

/** Infer panel from route. null = keep current (e.g. /messages, /me, /admin). */
export function panelForPath(pathname: string): NavPanel | null {
  if (
    pathname.startsWith("/reels") ||
    pathname === "/" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/help")
  ) {
    return "feed";
  }
  if (
    pathname.startsWith("/market") ||
    pathname.startsWith("/explore") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/build") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/partners") ||
    pathname.startsWith("/events")
  ) {
    return "work";
  }
  return null;
}

export function panelHomeHref(panel: NavPanel): string {
  return panel === "feed" ? "/reels" : "/market";
}

export function NavPanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanelState] = useState<NavPanel>("feed");

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v === "feed" || v === "work") setPanelState(v);
    } catch {
      /* ignore */
    }
  }, []);

  function setPanel(p: NavPanel) {
    setPanelState(p);
    try {
      sessionStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }

  return (
    <Ctx.Provider value={{ panel, setPanel, toggle: () => setPanel(panel === "feed" ? "work" : "feed") }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNavPanel() {
  return useContext(Ctx);
}

export function panelToggleLabel(_role: PlatformRole | null | undefined, panel: NavPanel): string {
  return panel === "feed" ? "Лента" : "Биржа";
}
