"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, User } from "lucide-react";
import { publications as publicationsApi } from "@/lib/api";
import { normalizePublication, type Publication } from "@/lib/publications";
import { SmartImage } from "@/components/media/SmartImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { PostLightbox } from "@/components/profile/PostLightbox";
import { SocialStats } from "@/components/social/SocialStats";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";

type FeedItem = Publication & {
  author?: { username?: string; displayName?: string; avatarUrl?: string | null } | null;
};

type ReelsFeedProps = {
  className?: string;
  compact?: boolean;
};

export function ReelsFeed({ className, compact = false }: ReelsFeedProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicationsApi
      .feed()
      .then((d) => {
        const list = (d.publications || []).map((p: FeedItem) => ({
          ...normalizePublication(p),
          author: p.author || null,
        }));
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const h = el.clientHeight || 1;
      setIndex(Math.round(el.scrollTop / h));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user || !items[index]) return;
    const id = items[index].id;
    if (viewedRef.current.has(id)) return;
    viewedRef.current.add(id);
    const t = setTimeout(() => {
      publicationsApi.view(id).catch(() => {
        viewedRef.current.delete(id);
      });
    }, 800);
    return () => clearTimeout(t);
  }, [index, items, user]);

  async function toggleLike(item: FeedItem) {
    if (!user) {
      toast("Войдите, чтобы лайкать", true);
      return;
    }
    try {
      const res = item.likedByMe
        ? await publicationsApi.unlike(item.id)
        : await publicationsApi.like(item.id);
      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? { ...p, likedByMe: res.liked, likesCount: res.likesCount }
            : p
        )
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось", true);
    }
  }

  if (loading) {
    return (
      <div
        className={cn(
          "bg-ink flex items-center justify-center",
          compact ? "h-full min-h-0" : "h-[calc(100dvh-57px)]",
          className
        )}
        role="status"
        aria-label="Загрузка рилсов"
      >
        <div className="relative w-full max-w-[420px] h-[min(80dvh,720px)] overflow-hidden border border-line/40">
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute bottom-6 left-4 right-16 flex flex-col gap-2 z-[1]">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("px-4 py-16 max-w-lg mx-auto w-full", compact && "h-full min-h-0 overflow-y-auto pane-scroll", className)}>
        <EmptyState
          title="Пока нет рилсов"
          description="Авторы публикуют короткие фото и видео косплея в профиле — они появятся здесь."
          action={
            <div className="flex gap-2 justify-center">
              <Button href="/explore" size="sm">Смотреть работы</Button>
              {user && (
                <Button href={`/profile/${user.username}?tab=reels`} size="sm" variant="outline">
                  Добавить рилс
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={cn("bg-ink min-h-0", compact ? "h-full" : "", className)}>
      <div
        ref={scroller}
        className={cn(
          "overflow-y-auto snap-y snap-mandatory scroll-smooth",
          compact ? "h-full min-h-0" : "h-[calc(100dvh-57px)]"
        )}
      >
        {items.map((item, i) => {
          const media = item.mediaUrls?.[0] || "";
          const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(media);
          const username = item.author?.username || item.username || "";
          return (
            <section
              key={item.id}
              className={cn(
                "relative snap-start snap-always flex items-center justify-center bg-stage",
                compact ? "h-full min-h-0" : "h-[calc(100dvh-57px)]"
              )}
            >
              <div
                className={cn(
                  "relative w-full max-w-[420px] bg-ink overflow-hidden",
                  compact ? "h-full min-h-0" : "h-full max-h-[calc(100dvh-57px)]"
                )}
              >
                {isVideo ? (
                  <video
                    key={`${item.id}-${Math.abs(i - index) <= 1 ? "on" : "off"}`}
                    src={Math.abs(i - index) <= 1 ? media : undefined}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted={i !== index}
                    autoPlay={i === index}
                    loop
                    controls={false}
                    preload={i === index ? "auto" : Math.abs(i - index) === 1 ? "metadata" : "none"}
                  />
                ) : (
                  <SmartImage
                    src={media}
                    alt={item.caption || "Рилс"}
                    className="absolute inset-0"
                    size={i === index ? "full" : "card"}
                    priority={i === index}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-ink via-ink/70 to-transparent">
                  <Link
                    href={username ? `/profile/${username}` : "/explore"}
                    className="inline-flex items-center gap-2 no-underline text-paper"
                  >
                    <span className="w-8 h-8 overflow-hidden border border-line bg-stage">
                      <SmartImage
                        src={item.author?.avatarUrl || undefined}
                        alt=""
                        fallback={username || "u"}
                        size="thumb"
                      />
                    </span>
                    <span className="font-display font-bold text-[14px]">@{username || "автор"}</span>
                  </Link>
                  {item.caption && (
                    <p className="text-[13px] text-ink-70 mt-2 line-clamp-3">{item.caption}</p>
                  )}
                  <SocialStats social={(item as any).social} />
                </div>
                <div className="absolute right-3 bottom-28 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => toggleLike(item)}
                    className={cn(
                      "w-11 h-11 rounded-full bg-ink/60 border border-line flex items-center justify-center",
                      item.likedByMe && "text-magenta border-magenta"
                    )}
                    aria-label="Лайк"
                  >
                    <Heart size={18} fill={item.likedByMe ? "currentColor" : "none"} />
                  </button>
                  <span className="text-center font-mono text-[10px] text-ink-45 -mt-2">
                    {item.likesCount || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="w-11 h-11 rounded-full bg-ink/60 border border-line flex items-center justify-center"
                    aria-label="Комментарии"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <Link
                    href={username ? `/profile/${username}` : "/explore"}
                    className="w-11 h-11 rounded-full bg-ink/60 border border-line flex items-center justify-center text-paper no-underline"
                    aria-label="Профиль"
                  >
                    <User size={18} />
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <PostLightbox
          post={selected}
          onClose={() => setSelected(null)}
          onCommentsCountChange={(n) => {
            setSelected((p) => (p ? { ...p, commentsCount: n } : p));
            setItems((list) => list.map((p) => (p.id === selected.id ? { ...p, commentsCount: n } : p)));
          }}
        />
      )}
    </div>
  );
}
