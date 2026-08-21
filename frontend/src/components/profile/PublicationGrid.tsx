"use client";

import { Heart, MessageCircle } from "lucide-react";
import { Frame } from "@/components/Frame";
import { SmartImage } from "@/components/media/SmartImage";
import { formatCount } from "@/lib/format";
import type { Publication } from "@/lib/demo/publications";

export function PublicationGrid({
  posts,
  onSelect,
  username,
}: {
  posts: Publication[];
  onSelect: (post: Publication) => void;
  username?: string;
}) {
  if (!posts.length) {
    return (
      <div className="py-12 text-center text-[13px] text-ink-45">
        Пока нет публикаций
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post, index) => (
        <button
          key={post.id}
          type="button"
          onClick={() => onSelect(post)}
          className="relative aspect-square group bg-transparent border-0 p-0 cursor-pointer"
        >
          <Frame className="w-full h-full overflow-hidden">
            <SmartImage
              src={post.mediaUrls[0]}
              alt={
                username
                  ? `Публикация ${index + 1} от ${username}`
                  : `Публикация ${index + 1}`
              }
              fallback={post.id}
            />
            <div className="absolute inset-0 bg-ink/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-[1]">
              <span className="flex items-center gap-1 text-[12px] text-paper">
                <Heart size={14} /> {formatCount(post.likesCount)}
              </span>
              <span className="flex items-center gap-1 text-[12px] text-paper">
                <MessageCircle size={14} /> {post.commentsCount}
              </span>
            </div>
            {post.mediaUrls.length > 1 && (
              <span className="absolute top-2 right-2 z-[1] text-[10px] font-mono text-paper bg-ink/70 px-1.5 py-0.5">
                {post.mediaUrls.length}
              </span>
            )}
          </Frame>
        </button>
      ))}
    </div>
  );
}
