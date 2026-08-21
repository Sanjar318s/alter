"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PlatformMode = "viewer" | "seller";

const MODE_KEY = "alter_platform_mode";

type PlatformModeCtx = {
  mode: PlatformMode;
  setMode: (m: PlatformMode) => void;
  ready: boolean;
};

const Ctx = createContext<PlatformModeCtx | null>(null);

function readMode(): PlatformMode {
  if (typeof window === "undefined") return "viewer";
  const v = localStorage.getItem(MODE_KEY);
  return v === "seller" ? "seller" : "viewer";
}

export function PlatformModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PlatformMode>("viewer");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setModeState(readMode());
    setReady(true);
  }, []);

  function setMode(m: PlatformMode) {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }

  const value = useMemo(() => ({ mode, setMode, ready }), [mode, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatformMode() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      mode: "viewer" as PlatformMode,
      setMode: (_m: PlatformMode) => {},
      ready: false,
    };
  }
  return ctx;
}
