"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { gifs as gifsApi, type GifItem } from "@/lib/api";

type PanelPos = { left: number; bottom: number; width: number };

const PANEL_WIDTH = 360;
const PANEL_GAP = 10;

export function GifPicker({
  onSelect,
  disabled,
  buttonClassName,
}: {
  onSelect: (gif: GifItem) => void;
  disabled?: boolean;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = q.trim() ? await gifsApi.search(q.trim()) : await gifsApi.trending();
      setItems(res.gifs || []);
      setFallback(Boolean(res.fallback));
    } catch {
      setItems([]);
      setFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 32, PANEL_WIDTH);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const bottom = window.innerHeight - rect.top + PANEL_GAP;
    setPos({ left, bottom, width });
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    load("");
  }, [open, load, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(query), 320);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open, load]);

  useEffect(() => {
    if (!open) return;
    const onLayout = () => updatePosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const panel =
    open && pos ? (
      <div
        ref={panelRef}
        className="fixed z-[90] bg-stage border border-line shadow-[0_12px_40px_rgba(0,0,0,0.55)] rounded-[12px] overflow-hidden flex flex-col"
        style={{ left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: "min(420px, calc(100vh - 96px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line shrink-0">
          <Search size={14} className="text-ink-45 shrink-0" />
          <input
            className="flex-1 h-8 bg-transparent border-0 text-[13px] text-paper placeholder:text-ink-45 focus:outline-none"
            placeholder="Поиск GIF…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-ink-45">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-ink-45">Ничего не найдено</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  title={gif.title}
                  className="relative aspect-square overflow-hidden rounded-[6px] border border-line bg-ink hover:border-magenta/60 transition-colors"
                  onClick={() => {
                    onSelect(gif);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.previewUrl} alt={gif.title || "GIF"} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-3 py-2 border-t border-line text-[9px] text-ink-45 text-right shrink-0">
          {fallback ? "Демо-набор · добавьте GIPHY_API_KEY для полного поиска" : "Powered by GIPHY"}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label="GIF"
        aria-expanded={open}
        title="Отправить GIF"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-9 px-2 text-[11px] font-semibold text-ink-45 hover:text-paper bg-transparent border-0 disabled:opacity-40",
          open && "text-magenta",
          buttonClassName
        )}
      >
        GIF
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
