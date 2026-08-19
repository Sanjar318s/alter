"use client";

import { Plus } from "lucide-react";
import { SmartImage } from "@/components/media/SmartImage";
import type { Publication } from "@/lib/demo/publications";
import { cn } from "@/lib/cn";

export function StoryRingStrip({
  stories,
  isOwner,
  onOpen,
  onAdd,
}: {
  stories: Publication[];
  isOwner: boolean;
  onOpen: (index: number) => void;
  onAdd: () => void;
}) {
  if (!stories.length && !isOwner) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-none">
      {isOwner && (
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 flex flex-col items-center gap-1.5 w-[72px]"
        >
          <span className="w-16 h-16 flex items-center justify-center border border-dashed border-line rounded-[4px] text-ink-45 hover:border-magenta/50 hover:text-magenta transition-colors">
            <Plus size={20} />
          </span>
          <span className="text-[11px] text-ink-45">Добавить</span>
        </button>
      )}
      {stories.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(i)}
          className="shrink-0 flex flex-col items-center gap-1.5 w-[72px]"
        >
          <span className="p-[2px] rounded-[4px] bg-gradient-to-br from-magenta to-amber">
            <span className="block w-[60px] h-[60px] rounded-[3px] overflow-hidden border border-ink">
              <SmartImage src={s.mediaUrls[0]} alt="" fallback={s.id} />
            </span>
          </span>
          <span className={cn("text-[11px] truncate w-full text-center", i === 0 ? "text-paper" : "text-ink-45")}>
            {s.caption?.slice(0, 12) || "Сторис"}
          </span>
        </button>
      ))}
    </div>
  );
}
