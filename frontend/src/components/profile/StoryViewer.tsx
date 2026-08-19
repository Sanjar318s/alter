"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { SmartImage } from "@/components/media/SmartImage";
import type { Publication } from "@/lib/demo/publications";
import { CaptionText } from "./CaptionText";

export function StoryViewer({
  stories,
  startIndex,
  username,
  onClose,
}: {
  stories: Publication[];
  startIndex: number;
  username: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const story = stories[index];

  useEffect(() => {
    setProgress(0);
    const t = setInterval(() => setProgress((p) => p + 2), 100);
    const advance = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 5000);
    return () => {
      clearInterval(t);
      clearTimeout(advance);
    };
  }, [index, stories.length, onClose]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-ink flex flex-col">
      <div className="flex gap-1 p-3">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-ink-45/30 overflow-hidden rounded-full">
            <div
              className="h-full bg-paper transition-all duration-100"
              style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[13px] font-medium">{username}</span>
        <IconButton label="Закрыть" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <button
        type="button"
        className="flex-1 flex items-center justify-center p-4 bg-transparent border-0"
        onClick={() => {
          if (index < stories.length - 1) setIndex((i) => i + 1);
          else onClose();
        }}
      >
        <div className="w-full max-w-[420px] aspect-[9/16] overflow-hidden rounded-[4px]">
          <SmartImage src={story.mediaUrls[0]} alt="" fallback={story.id} />
        </div>
      </button>
      {story.caption && (
        <div className="p-4 border-t border-line">
          <CaptionText text={story.caption} />
        </div>
      )}
    </div>
  );
}
