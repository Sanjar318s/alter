"use client";

type SocialPost = {
  platform: string;
  status: string;
  url?: string | null;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;
  tiktokVisibility?: string | null;
  lastSyncedAt?: string | Date | null;
};

export type SocialPayload = {
  moderationStatus?: string | null;
  posts?: SocialPost[];
  totals?: { likes: number; comments: number; views?: number };
} | null | undefined;

export function SocialStats({ social }: { social?: SocialPayload }) {
  if (!social || !social.moderationStatus) return null;
  if (social.moderationStatus === "rejected") return null;

  if (social.moderationStatus === "pending" || social.moderationStatus === "review") {
    return <p className="text-[11px] text-ink-45 mt-2">Проверяем для соцсетей…</p>;
  }

  const posts = social.posts || [];
  const active = posts.filter((p) =>
    ["queued", "publishing", "published", "private_pending_audit"].includes(p.status)
  );
  if (!active.length && social.moderationStatus === "approved") {
    return <p className="text-[11px] text-ink-45 mt-2">Готовим публикацию…</p>;
  }

  const publishing = active.some((p) => p.status === "queued" || p.status === "publishing");
  if (publishing && !active.some((p) => p.status === "published" || p.status === "private_pending_audit")) {
    return <p className="text-[11px] text-ink-45 mt-2">Готовим публикацию…</p>;
  }

  const published = active.filter(
    (p) => p.status === "published" || p.status === "private_pending_audit"
  );
  if (!published.length) return null;

  const totals = social.totals || { likes: 0, comments: 0 };
  const anySynced = published.some((p) => p.lastSyncedAt);
  if (!anySynced && totals.likes === 0 && totals.comments === 0) {
    return <p className="text-[11px] text-ink-45 mt-2">Опубликовано · счётчики появятся позже</p>;
  }

  const parts = published.map((p) => {
    const label =
      p.platform === "youtube"
        ? "YouTube"
        : p.platform === "tiktok"
          ? "TikTok"
          : p.platform === "instagram"
            ? "IG"
            : "FB";
    const n = (p.likesCount || 0) + (p.commentsCount || 0);
    return `${label} ${n}`;
  });

  return (
    <div className="mt-2 text-[11px] text-ink-45">
      <span className="text-ink-70">
        В соцсетях: {totals.likes} лайков · {totals.comments} комментариев
      </span>
      <span className="block mt-0.5 opacity-80">{parts.join(" · ")}</span>
    </div>
  );
}
