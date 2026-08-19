"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; text: string; error?: boolean };

const ToastCtx = createContext<(text: string, error?: boolean) => void>(
  () => {}
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, error }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`font-mono text-[12px] px-4 py-2.5 border ${
              t.error
                ? "border-amber text-amber bg-stage"
                : "border-line text-paper bg-stage"
            }`}
          >
            {t.error ? "! " : "✓ "}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
