"use client";

import { useEffect, useRef, useState } from "react";
import { Smile, Sticker } from "lucide-react";
import { cn } from "@/lib/cn";

const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Смайлы",
    items: ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😜","🤗","🤔","😎","🤩","🥳","😢","😭","😤","😡","🤯","😴","🙌","👏","👍","👎","🙏","🔥","❤️","💕","💜","✨","⭐","🎉"],
  },
  {
    label: "Косплей",
    items: ["🎭","👗","👘","👑","🗡️","🛡️","🪄","📷","🎬","🎤","🎧","🎨","✂️","🧵","🪡","💎","🌸","🌙","⚡","🐉"],
  },
];

const STICKERS: { id: string; emoji: string; name: string }[] = [
  { id: "st-fire", emoji: "🔥", name: "Огонь" },
  { id: "st-love", emoji: "💖", name: "Любовь" },
  { id: "st-wow", emoji: "🤩", name: "Вау" },
  { id: "st-cos", emoji: "🎭", name: "Косплей" },
  { id: "st-cam", emoji: "📸", name: "Съёмка" },
  { id: "st-sword", emoji: "⚔️", name: "Босс" },
  { id: "st-crown", emoji: "👑", name: "Королева" },
  { id: "st-spark", emoji: "✨", name: "Блеск" },
  { id: "st-ok", emoji: "👍", name: "Ок" },
  { id: "st-pray", emoji: "🙏", name: "Плиз" },
  { id: "st-party", emoji: "🎉", name: "Фест" },
  { id: "st-moon", emoji: "🌙", name: "Инадзума" },
];

export function EmojiStickerPicker({
  onEmoji,
  onSticker,
  emojiOnly,
  align = "left",
  buttonClassName,
}: {
  onEmoji: (emoji: string) => void;
  onSticker?: (sticker: { id: string; emoji: string; name: string }) => void;
  emojiOnly?: boolean;
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Эмодзи"
        title="Эмодзи и стикеры"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 text-ink-70 hover:text-magenta transition-colors cursor-pointer bg-transparent border-0",
          open && "text-magenta",
          buttonClassName
        )}
      >
        <Smile size={17} strokeWidth={1.75} />
      </button>
      {open && (
        <div className={cn("absolute bottom-[calc(100%+8px)] z-50 w-[min(100vw-2rem,320px)] bg-stage border border-line shadow-[0_12px_40px_rgba(0,0,0,0.45)]", align === "right" ? "right-0" : "left-0")}>
          {!emojiOnly && (
          <div className="flex border-b border-line">
            <button
              type="button"
              className={cn("flex-1 py-2 text-[11px] font-mono uppercase bg-transparent border-0", tab === "emoji" ? "text-magenta border-b-2 border-magenta" : "text-ink-45")}
              onClick={() => setTab("emoji")}
            >
              <Smile size={12} className="inline mr-1" /> Эмодзи
            </button>
            <button
              type="button"
              className={cn("flex-1 py-2 text-[11px] font-mono uppercase bg-transparent border-0", tab === "stickers" ? "text-magenta border-b-2 border-magenta" : "text-ink-45")}
              onClick={() => setTab("stickers")}
            >
              <Sticker size={12} className="inline mr-1" /> Стикеры
            </button>
          </div>
          )}
          <div className="max-h-[240px] overflow-y-auto p-2">
            {emojiOnly || tab === "emoji" ? (
              EMOJI_GROUPS.map((g) => (
                <div key={g.label} className="mb-2">
                  <div className="font-mono text-[10px] uppercase text-ink-45 px-1 mb-1">{g.label}</div>
                  <div className="grid grid-cols-8 gap-0.5">
                    {g.items.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="h-9 text-[18px] bg-transparent border-0 hover:bg-ink rounded-[4px]"
                        onClick={() => onEmoji(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-4 gap-2 p-1">
                {STICKERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSticker?.(s);
                      setOpen(false);
                    }}
                    className="flex flex-col items-center gap-1 py-2 bg-ink border border-line hover:border-magenta rounded-[4px]"
                  >
                    <span className="text-[28px] leading-none">{s.emoji}</span>
                    <span className="font-mono text-[9px] text-ink-45 uppercase">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
