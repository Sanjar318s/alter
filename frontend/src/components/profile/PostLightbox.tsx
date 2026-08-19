"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, X } from "lucide-react";
import { Frame } from "@/components/Frame";
import { IconButton } from "@/components/ui/IconButton";
import { SmartImage } from "@/components/media/SmartImage";
import { formatCount } from "@/lib/format";
import type { Publication } from "@/lib/demo/publications";
import { CaptionText } from "./CaptionText";
import { CommentThread } from "@/components/comments/CommentThread";

export function PostLightbox({
  post,
  onClose,
  onCommentsCountChange,
}: {
  post: Publication;
  onClose: () => void;
  onCommentsCountChange?: (count: number) => void;
}) {
  const [slide, setSlide] = useState(0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const media = post.mediaUrls;

  return (
    <div
      className="fixed inset-0 z-[80] bg-ink/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-stage border border-line w-full max-w-[720px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <span className="font-display font-extrabold text-[16px]">Публикация</span>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="relative">
          <Frame className="w-full aspect-square max-h-[60vh] overflow-hidden">
            <SmartImage src={media[slide]} alt="" fallback="publication" />
          </Frame>
          {media.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-ink/80 border border-line flex items-center justify-center"
                onClick={() => setSlide((s) => (s > 0 ? s - 1 : media.length - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-ink/80 border border-line flex items-center justify-center"
                onClick={() => setSlide((s) => (s < media.length - 1 ? s + 1 : 0))}
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                {media.map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === slide ? "bg-magenta" : "bg-ink-45"}`} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-4">
          <div className="flex gap-4 text-[13px] text-ink-45 mb-3">
            <span className="flex items-center gap-1"><Heart size={14} /> {formatCount(post.likesCount)}</span>
            <span className="flex items-center gap-1"><MessageCircle size={14} /> {commentsCount}</span>
          </div>

          {post.caption && <CaptionText text={post.caption} />}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map((t) => (
                <span key={t} className="font-mono text-[10px] uppercase px-2 py-1 border border-magenta/40 text-magenta rounded-[4px]">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {post.mentions.length > 0 && (
            <div className="mt-3 text-[12px] text-ink-45">
              Отмечены:{" "}
              {post.mentions.map((m, i) => (
                <span key={m.id}>
                  {m.type === "user" && m.username ? (
                    <Link href={`/profile/${m.username}`} className="text-magenta no-underline hover:underline">
                      @{m.username}
                    </Link>
                  ) : (
                    <span className="text-paper">{m.displayName}</span>
                  )}
                  {i < post.mentions.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-line">
            <CommentThread
              targetType="publication"
              targetId={post.id}
              compact
              onCountChange={(n) => {
                setCommentsCount(n);
                onCommentsCountChange?.(n);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
