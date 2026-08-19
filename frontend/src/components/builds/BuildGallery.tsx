"use client";

import { useState } from "react";
import { SmartImage } from "@/components/media/SmartImage";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function BuildGallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const shots = photos.length ? photos : [];
  if (!shots.length) {
    return (
      <div className="aspect-[4/5] bg-stage border border-line">
        <SmartImage alt={title} fallback={title} />
      </div>
    );
  }
  return (
    <div>
      <button type="button" className="w-full bg-transparent border-0 p-0" onClick={() => setOpen(true)}>
        <div className="aspect-[4/5] overflow-hidden border border-line">
          <SmartImage src={shots[i]} alt={title} />
        </div>
      </button>
      {shots.length > 1 && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {shots.map((s, idx) => (
            <button key={s + idx} type="button" className="aspect-square overflow-hidden border border-line p-0" onClick={() => setI(idx)}>
              <SmartImage src={s} alt="" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[80] bg-ink/95 flex items-center justify-center" onClick={() => setOpen(false)}>
          <IconButton label="Закрыть" className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10" onClick={() => setOpen(false)}>
            <X />
          </IconButton>
          <button type="button" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-ink/60 border border-line rounded-full p-2 text-paper" onClick={(e) => { e.stopPropagation(); setI((n) => (n - 1 + shots.length) % shots.length); }}>
            <ChevronLeft />
          </button>
          <div className="max-w-[min(100%,90vw)] max-h-[85vh] px-10" onClick={(e) => e.stopPropagation()}>
            <SmartImage src={shots[i]} alt={title} className="max-h-[85vh] object-contain" />
          </div>
          <button type="button" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-ink/60 border border-line rounded-full p-2 text-paper" onClick={(e) => { e.stopPropagation(); setI((n) => (n + 1) % shots.length); }}>
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
