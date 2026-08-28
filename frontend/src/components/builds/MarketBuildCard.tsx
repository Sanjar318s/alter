"use client";

import Link from "next/link";
import { BadgeCheck, Heart, MessageCircle } from "lucide-react";
import { Frame } from "@/components/Frame";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/media/SmartImage";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";

export type MarketBuildCardItem = {
  id: string;
  title: string;
  character?: string;
  franchise?: string;
  author?: string;
  authorAvatar?: string | null;
  coverImageUrl?: string | null;
  likesCount: number;
  commentsCount: number;
  price?: number;
  isLiked?: boolean;
  isVerified?: boolean;
};

type MarketBuildCardProps = {
  item: MarketBuildCardItem;
  isLiked?: boolean;
  likeCount?: number;
  onToggleLike?: (id: string, liked: boolean) => void;
  formatSum?: (n: number) => string;
  moreLabel?: string;
  className?: string;
};

export function MarketBuildCard({
  item,
  isLiked,
  likeCount,
  onToggleLike,
  formatSum,
  moreLabel = "Подробнее",
  className,
}: MarketBuildCardProps) {
  const liked = isLiked ?? item.isLiked;
  const displayLikes = likeCount ?? item.likesCount;
  const buildHref = `/build/${item.id}`;
  const profileHref = item.author ? `/profile/${item.author}` : undefined;
  const imageAlt =
    item.author
      ? `${item.character || item.title} — косплей от ${item.author}`
      : item.character || item.title;

  return (
    <article className={cn("group flex flex-col", className)}>
      <Link href={buildHref} className="block no-underline text-paper">
        <Frame hover className="aspect-[4/5] overflow-hidden group-hover:scale-[1.02] transition-transform">
          <SmartImage src={item.coverImageUrl} alt={imageAlt} fallback={item.title} />
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 z-[1] bg-gradient-to-t from-ink/90 via-ink/20 to-transparent">
            <div className="font-display font-extrabold text-[14px] leading-tight">{item.character || item.title}</div>
            {item.franchise && (
              <div className="font-mono text-[10px] text-ink-70 uppercase mt-0.5">{item.franchise}</div>
            )}
            {item.price != null && item.price > 0 && formatSum && (
              <div className="font-mono text-[11px] text-amber mt-1">{formatSum(item.price)}</div>
            )}
          </div>
        </Frame>
      </Link>

      {profileHref && item.author && (
        <Link
          href={profileHref}
          className="flex items-center gap-1.5 mt-2 no-underline text-paper hover:text-magenta transition-colors min-w-0"
        >
          <span className="w-7 h-7 bg-stage border border-line shrink-0 overflow-hidden rounded-full">
            <SmartImage
              src={item.authorAvatar}
              alt={`Аватар ${item.author}`}
              fallback={item.author}
            />
          </span>
          <span className="text-[12px] truncate">@{item.author}</span>
          {item.isVerified && <BadgeCheck size={12} className="text-magenta shrink-0" />}
        </Link>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {onToggleLike ? (
          <button
            type="button"
            aria-label="Лайк"
            onClick={() => onToggleLike(item.id, Boolean(liked))}
            className="flex items-center gap-1 bg-transparent border-0 text-ink-70 hover:text-magenta cursor-pointer"
          >
            <Heart size={14} className={liked ? "fill-magenta stroke-magenta" : ""} />
            <span className="font-mono text-[11px]">{formatCount(displayLikes)}</span>
          </button>
        ) : (
          <span className="flex items-center gap-1 text-ink-70">
            <Heart size={14} />
            <span className="font-mono text-[11px]">{formatCount(displayLikes)}</span>
          </span>
        )}
        <Link href={buildHref} className="flex items-center gap-1 text-ink-70 no-underline hover:text-paper">
          <MessageCircle size={14} />
          <span className="font-mono text-[11px]">{formatCount(item.commentsCount)}</span>
        </Link>
        <Button href={buildHref} variant="outline" size="sm" className="ml-auto text-[11px] px-2.5 py-1 h-7">
          {moreLabel}
        </Button>
      </div>
    </article>
  );
}
